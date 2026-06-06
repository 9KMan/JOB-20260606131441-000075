import axios, { AxiosInstance } from 'axios';
import { RiskStatusResponse, LiquidationRequest, BrokerAccount } from './types.js';

export class BrokerRestClient {
  private http: AxiosInstance;

  constructor(
    private readonly baseUrl: string,
    private readonly getToken: () => Promise<string>
  ) {
    this.http = axios.create({
      baseURL: baseUrl,
      timeout: 30_000,
      headers: { 'Content-Type': 'application/json' },
    });

    // Intercept to inject auth token
    this.http.interceptors.request.use(async (config) => {
      const token = await this.getToken();
      config.headers.Authorization = `Bearer ${token}`;
      return config;
    });

    // Handle 401 — trigger re-auth
    this.http.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired — emit event for connector to re-auth
          throw Object.assign(new Error('TOKEN_EXPIRED'), { code: 'TOKEN_EXPIRED' });
        }
        throw error;
      }
    );
  }

  /** Provision a master-level trading account */
  async provisionAccount(name: string, email: string): Promise<BrokerAccount> {
    const response = await this.http.post<{ account_id: string; status: string }>(
      '/api/v1/accounts',
      { name, email, account_type: 'master' }
    );
    return {
      id: response.data.account_id,
      brokerAccountId: response.data.account_id,
      masterAccountId: null,
      status: response.data.status as 'active' | 'suspended' | 'closed',
      createdAt: new Date(),
    };
  }

  /** Get current risk status for an account */
  async getRiskStatus(accountId: string): Promise<RiskStatusResponse> {
    const response = await this.http.get<RiskStatusResponse>(
      `/api/v1/accounts/${accountId}/risk-status`
    );
    return response.data;
  }

  /** Trigger force liquidation for an account */
  async triggerLiquidation(request: LiquidationRequest): Promise<void> {
    await this.http.post(`/api/v1/accounts/${request.accountId}/liquidate`, {
      reason: request.reason,
      breach_type: request.breachType,
      triggered_at: new Date().toISOString(),
    });
  }

  /** Get current positions for an account */
  async getPositions(accountId: string) {
    const response = await this.http.get(`/api/v1/accounts/${accountId}/positions`);
    return response.data;
  }

  /** Reset account — clear positions and reset risk limits */
  async resetAccount(accountId: string): Promise<void> {
    await this.http.post(`/api/v1/accounts/${accountId}/reset`, {
      reset_type: 'full',
      reason: 'Manual reset requested',
    });
  }
}