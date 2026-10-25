import type { TokenCipher, TokenData, TokenStore } from '../types.js';

interface LockRecord {
  ownerToken: string;
  expiresAt: number;
}

/**
 * In-memory TokenStore for local development and single-process environments.
 *
 * WARNING: Do NOT use MemoryTokenStore in production multi-instance, clustered (PM2),
 * or serverless (Lambda/Vercel) environments. Because bKash strictly enforces a max of
 * 2 token requests per hour, unshared memory stores across multiple workers will trigger
 * immediate 1-hour merchant credential lockouts!
 */
export class MemoryTokenStore implements TokenStore {
  private tokens = new Map<string, { data: TokenData; expiresAt: number }>();
  private locks = new Map<string, LockRecord>();
  private cipher?: TokenCipher;

  constructor(options?: { cipher?: TokenCipher; suppressWarning?: boolean }) {
    this.cipher = options?.cipher;

    const isProduction =
      typeof process !== 'undefined' && process.env?.['NODE_ENV'] === 'production';

    if (isProduction && !options?.suppressWarning) {
      console.warn(
        '\x1b[33m[bkash-server WARNING]\x1b[0m Using MemoryTokenStore in a production environment! ' +
          'bKash strictly enforces a 2 calls/hour rate limit on grant/refresh tokens. ' +
          'Multiple server instances or serverless functions will cause immediate credential lockouts. ' +
          'Please configure RedisTokenStore in production.'
      );
    }
  }

  public async get(appKey: string): Promise<TokenData | null> {
    const entry = this.tokens.get(appKey);
    if (!entry) {
      return null;
    }
    if (Date.now() >= entry.expiresAt) {
      this.tokens.delete(appKey);
      return null;
    }

    if (this.cipher) {
      const decryptedId = await this.cipher.decrypt(entry.data.idToken);
      const decryptedRefresh = entry.data.refreshToken
        ? await this.cipher.decrypt(entry.data.refreshToken)
        : undefined;
      return {
        ...entry.data,
        idToken: decryptedId,
        refreshToken: decryptedRefresh,
      };
    }

    return { ...entry.data };
  }

  public async set(appKey: string, token: TokenData, ttlSeconds: number): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;

    let payload: TokenData = { ...token };
    if (this.cipher) {
      payload = {
        ...token,
        idToken: await this.cipher.encrypt(token.idToken),
        refreshToken: token.refreshToken ? await this.cipher.encrypt(token.refreshToken) : undefined,
      };
    }

    this.tokens.set(appKey, { data: payload, expiresAt });
  }

  public async clear(appKey: string): Promise<void> {
    this.tokens.delete(appKey);
    this.locks.delete(appKey);
  }

  public async acquireLock(appKey: string, ownerToken: string, ttlMs: number): Promise<boolean> {
    const now = Date.now();
    const existing = this.locks.get(appKey);

    if (existing && now < existing.expiresAt) {
      if (existing.ownerToken === ownerToken) {
        // Re-entrant extension
        existing.expiresAt = now + ttlMs;
        return true;
      }
      return false;
    }

    this.locks.set(appKey, { ownerToken, expiresAt: now + ttlMs });
    return true;
  }

  public async releaseLock(appKey: string, ownerToken: string): Promise<void> {
    const existing = this.locks.get(appKey);
    if (existing && existing.ownerToken === ownerToken) {
      this.locks.delete(appKey);
    }
  }
}
