import WebSocket from 'ws';
import { BrokerWebSocketEvent, BrokerEventType } from './types.js';

const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 32000, 60000];
const MAX_BACKOFF_IDX = BACKOFF_MS.length - 1;

type EventHandler<T> = (event: BrokerWebSocketEvent<T>) => Promise<void>;

export class BrokerWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempt = 0;
  private shouldReconnect = true;
  private handlers = new Map<BrokerEventType, EventHandler<unknown>[]>();
  private rateLimitPenaltyMs = 0;
  private lastRateLimitReset = 0;

  constructor(
    private readonly wsUrl: string,
    private readonly getToken: () => Promise<string>,
    private readonly accountId: string
  ) {}

  /** Register handler for a broker event type */
  on<T>(type: BrokerEventType, handler: EventHandler<T>): void {
    const existing = this.handlers.get(type) as EventHandler<T>[] ?? [];
    this.handlers.set(type, [...existing, handler]);
  }

  /** Connect to WebSocket and start listening */
  async connect(): Promise<void> {
    this.shouldReconnect = true;
    await this.doConnect();
  }

  /** Gracefully disconnect */
  disconnect(): void {
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  private async doConnect(): Promise<void> {
    const token = await this.getToken();
    const url = `${this.wsUrl}?token=${token}&account=${this.accountId}`;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        this.reconnectAttempt = 0;
        resolve();
      });

      this.ws.on('message', (data: string) => {
        try {
          const event = JSON.parse(data) as BrokerWebSocketEvent<unknown>;
          this.handleEvent(event);
        } catch (err) {
          console.error('[WS] Failed to parse message:', err);
        }
      });

      this.ws.on('close', (code, reason) => {
        console.log(`[WS] Connection closed: ${code} ${reason}`);
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      });

      this.ws.on('error', (err) => {
        console.error('[WS] Error:', err.message);
        if (this.ws?.readyState === WebSocket.CONNECTING) {
          reject(err);
        }
      });
    });
  }

  private handleEvent(event: BrokerWebSocketEvent<unknown>): void {
    // Check rate limit state
    if (this.rateLimitPenaltyMs > 0 && Date.now() - this.lastRateLimitReset < this.rateLimitPenaltyMs) {
      console.warn('[WS] Rate limited — queuing event');
      return;
    }

    const handlers = this.handlers.get(event.type) ?? [];
    for (const handler of handlers) {
      handler(event as BrokerWebSocketEvent<unknown>).catch((err) => {
        console.error(`[WS] Handler error for ${event.type}:`, err);
      });
    }
  }

  private scheduleReconnect(): void {
    const delay = BACKOFF_MS[Math.min(this.reconnectAttempt, MAX_BACKOFF_IDX)];
    this.reconnectAttempt++;

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempt})`);

    setTimeout(async () => {
      try {
        await this.doConnect();
        console.log('[WS] Reconnected successfully');
      } catch (err) {
        console.error('[WS] Reconnect failed:', err);
        if (this.shouldReconnect) {
          this.scheduleReconnect();
        }
      }
    }, delay);
  }

  /** Call when server sends 429 */
  onRateLimit(penaltyMs: number): void {
    this.rateLimitPenaltyMs = penaltyMs;
    this.lastRateLimitReset = Date.now();
    console.warn(`[WS] Rate limit applied — penalty ${penaltyMs}ms`);
  }
}