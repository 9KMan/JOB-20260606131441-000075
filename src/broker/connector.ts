import axios, { AxiosInstance } from 'axios';
import { Pool } from 'pg';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { OAuthTokenResponse } from './types';

const TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY ?? '';
const ALGORITHM = 'aes-256-gcm';
const KEY_DERIVATION_SALT = 'broker-integration-v1';

/**
 * Derives a 32-byte AES key from the configured secret using scrypt.
 * The secret can be a hex string (preferred) or arbitrary passphrase.
 */
function deriveKey(secret: string): Buffer {
  if (!secret) {
    throw new Error('TOKEN_ENCRYPTION_KEY environment variable not set');
  }
  // If user provided a 64-char hex string, use it directly as the key
  if (/^[0-9a-fA-F]{64}$/.test(secret)) {
    return Buffer.from(secret, 'hex');
  }
  // Otherwise derive via scrypt from the passphrase
  return scryptSync(secret, KEY_DERIVATION_SALT, 32);
}

export class BrokerConnector {
  private http: AxiosInstance;
  private db: Pool;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(
    private readonly brokerBaseUrl: string,
    private readonly clientId: string,
    private readonly clientSecret: string,
    db: Pool
  ) {
    this.http = axios.create({
      baseURL: brokerBaseUrl,
      timeout: 30_000,
      headers: { 'Content-Type': 'application/json' },
    });
    this.db = db;
  }

  /** Initiate OAuth flow — return authorization URL */
  async getAuthorizationUrl(redirectUri: string): Promise<string> {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: 'read write trading',
    });
    return `${this.brokerBaseUrl}/oauth/authorize?${params.toString()}`;
  }

  /** Exchange authorization code for tokens */
  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<void> {
    const response = await this.http.post<OAuthTokenResponse>('/oauth/token', {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    await this.storeTokens(response.data);
  }

  /** Refresh access token if expired */
  async ensureAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiresAt && new Date() < this.tokenExpiresAt) {
      return this.accessToken;
    }
    await this.refreshAccessToken();
    if (!this.accessToken) {
      throw new Error('Failed to obtain access token after refresh');
    }
    return this.accessToken;
  }

  /** Force re-authentication (e.g., on auth failure) */
  async reAuthenticate(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available — manual re-auth required');
    }
    await this.refreshAccessToken();
  }

  // ── Token storage ────────────────────────────────────────────────────────

  private async storeTokens(response: OAuthTokenResponse): Promise<void> {
    const encryptedAccess = this.encrypt(response.access_token);
    const encryptedRefresh = this.encrypt(response.refresh_token);
    const expiresAt = new Date(Date.now() + response.expires_in * 1000);

    await this.db.query(
      `INSERT INTO broker_tokens (encrypted_access_token, encrypted_refresh_token, token_expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [encryptedAccess, encryptedRefresh, expiresAt]
    );

    this.accessToken = response.access_token;
    this.refreshToken = response.refresh_token;
    this.tokenExpiresAt = expiresAt;
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await this.http.post<OAuthTokenResponse>('/oauth/token', {
      grant_type: 'refresh_token',
      refresh_token: this.refreshToken,
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });

    await this.storeTokens(response.data);
  }

  // ── Symmetric encryption (AES-256-GCM) ──────────────────────────────────
  // Output format: base64(iv || authTag || ciphertext) → 12 + 16 + N bytes

  private encrypt(plaintext: string): string {
    const key = deriveKey(TOKEN_ENCRYPTION_KEY);
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
  }

  private decrypt(encoded: string): string {
    const key = deriveKey(TOKEN_ENCRYPTION_KEY);
    const buf = Buffer.from(encoded, 'base64');
    if (buf.length < 28) {
      throw new Error('Encrypted payload is too short to be valid');
    }
    const iv = buf.subarray(0, 12);
    const authTag = buf.subarray(12, 28);
    const ciphertext = buf.subarray(28);
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plaintext.toString('utf-8');
  }

  /** Load tokens from database on startup */
  async loadStoredTokens(): Promise<boolean> {
    const result = await this.db.query<{ encrypted_access_token: string; encrypted_refresh_token: string; token_expires_at: Date }>(
      `SELECT encrypted_access_token, encrypted_refresh_token, token_expires_at
       FROM broker_tokens ORDER BY created_at DESC LIMIT 1`
    );

    if (result.rows.length === 0) {
      return false;
    }

    const row = result.rows[0];
    this.accessToken = this.decrypt(row.encrypted_access_token);
    this.refreshToken = this.decrypt(row.encrypted_refresh_token);
    this.tokenExpiresAt = row.token_expires_at;
    return true;
  }
}

// Re-export for tests
export { deriveKey };
