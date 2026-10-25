import type {
  BkashPaymentStatus,
  PaymentSession,
  SessionStore,
  TokenCipher,
  TokenData,
  TokenStore,
} from '../types.js';

export interface UpstashRestConfig {
  /** The Upstash Redis REST URL (e.g. https://your-db.upstash.io) */
  url: string;
  /** The Upstash Redis REST Token */
  token: string;
  keyPrefix?: string;
  cipher?: TokenCipher;
}

const LUA_RELEASE_LOCK = `
if redis.call("get", KEYS[1]) == ARGV[1] then
    return redis.call("del", KEYS[1])
else
    return 0
end
`;

/**
 * Universal edge-friendly TokenStore using Upstash Redis REST API.
 * 100% fetch-based with zero Node-only dependencies.
 * Fully compatible with Cloudflare Workers, Vercel Edge, Deno, and Bun.
 */
export class UpstashRestTokenStore implements TokenStore {
  private url: string;
  private token: string;
  private keyPrefix: string;
  private cipher?: TokenCipher;

  constructor(config: UpstashRestConfig) {
    this.url = config.url.replace(/\/+$/, '');
    this.token = config.token;
    this.keyPrefix = config.keyPrefix ?? 'bkash:token:';
    this.cipher = config.cipher;
  }

  private async command<T>(command: string, ...args: (string | number)[]): Promise<T> {
    const res = await fetch(`${this.url}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([command, ...args]),
    });

    if (!res.ok) {
      throw new Error(`Upstash REST API error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as { result: T; error?: string };
    if (data.error) {
      throw new Error(`Upstash Redis error: ${data.error}`);
    }
    return data.result;
  }

  public async get(appKey: string): Promise<TokenData | null> {
    const raw = await this.command<string | null>('GET', `${this.keyPrefix}${appKey}`);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as TokenData;
      if (this.cipher) {
        const decryptedId = await this.cipher.decrypt(parsed.idToken);
        const decryptedRefresh = parsed.refreshToken
          ? await this.cipher.decrypt(parsed.refreshToken)
          : undefined;
        return {
          ...parsed,
          idToken: decryptedId,
          refreshToken: decryptedRefresh,
        };
      }
      return parsed;
    } catch {
      return null;
    }
  }

  public async set(appKey: string, token: TokenData, ttlSeconds: number): Promise<void> {
    let payload = { ...token };
    if (this.cipher) {
      payload = {
        ...token,
        idToken: await this.cipher.encrypt(token.idToken),
        refreshToken: token.refreshToken
          ? await this.cipher.encrypt(token.refreshToken)
          : undefined,
      };
    }

    const serialized = JSON.stringify(payload);
    await this.command('SET', `${this.keyPrefix}${appKey}`, serialized, 'EX', ttlSeconds);
  }

  public async clear(appKey: string): Promise<void> {
    await this.command('DEL', `${this.keyPrefix}${appKey}`);
    await this.command('DEL', `${this.keyPrefix}lock:${appKey}`);
  }

  public async acquireLock(
    appKey: string,
    ownerToken: string,
    ttlMs: number
  ): Promise<boolean> {
    const result = await this.command<string | null>(
      'SET',
      `${this.keyPrefix}lock:${appKey}`,
      ownerToken,
      'PX',
      ttlMs,
      'NX'
    );
    return result === 'OK';
  }

  public async releaseLock(appKey: string, ownerToken: string): Promise<void> {
    await this.command('EVAL', LUA_RELEASE_LOCK, 1, `${this.keyPrefix}lock:${appKey}`, ownerToken);
  }

  public async waitForToken(
    appKey: string,
    maxWaitMs: number = 3000,
    pollIntervalMs: number = 200
  ): Promise<TokenData | null> {
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const token = await this.get(appKey);
      if (token) return token;
      await new Promise((r) => setTimeout(r, pollIntervalMs));
    }
    return null;
  }
}

/**
 * Universal edge-friendly SessionStore using Upstash Redis REST API.
 */
export class UpstashRestSessionStore implements SessionStore {
  private url: string;
  private token: string;
  private keyPrefix: string;

  constructor(config: UpstashRestConfig) {
    this.url = config.url.replace(/\/+$/, '');
    this.token = config.token;
    this.keyPrefix = config.keyPrefix ?? 'bkash:session:';
  }

  private async command<T>(command: string, ...args: (string | number)[]): Promise<T> {
    const res = await fetch(`${this.url}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([command, ...args]),
    });

    if (!res.ok) {
      throw new Error(`Upstash REST API error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as { result: T; error?: string };
    if (data.error) {
      throw new Error(`Upstash Redis error: ${data.error}`);
    }
    return data.result;
  }

  public async saveSession(session: PaymentSession, ttlSeconds: number): Promise<void> {
    const serialized = JSON.stringify(session);
    await this.command('SET', `${this.keyPrefix}${session.paymentId}`, serialized, 'EX', ttlSeconds);
  }

  public async getSession(paymentId: string): Promise<PaymentSession | null> {
    const raw = await this.command<string | null>('GET', `${this.keyPrefix}${paymentId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PaymentSession;
    } catch {
      return null;
    }
  }

  public async updateSessionStatus(
    paymentId: string,
    status: BkashPaymentStatus
  ): Promise<void> {
    const session = await this.getSession(paymentId);
    if (session) {
      session.status = status;
      session.updatedAt = Date.now();
      await this.saveSession(session, 3600);
    }
  }

  public async deleteSession(paymentId: string): Promise<void> {
    await this.command('DEL', `${this.keyPrefix}${paymentId}`);
  }
}
