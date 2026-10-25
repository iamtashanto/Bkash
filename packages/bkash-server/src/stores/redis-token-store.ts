import type { TokenCipher, TokenData, TokenStore } from '../types.js';

export interface GenericRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: unknown[]): Promise<unknown>;
  del(key: string): Promise<number>;
  eval(script: string, numkeys: number, ...args: (string | number)[]): Promise<unknown>;
}

export interface RedisTokenStoreOptions {
  redis: GenericRedisClient;
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
 * Production Redis TokenStore.
 * Implements atomic distributed locking (SET NX PX) and safe compare-and-delete
 * Lua script release to eliminate rate-limit lockouts in multi-instance architectures.
 */
export class RedisTokenStore implements TokenStore {
  private redis: GenericRedisClient;
  private keyPrefix: string;
  private cipher?: TokenCipher;

  constructor(options: RedisTokenStoreOptions) {
    this.redis = options.redis;
    this.keyPrefix = options.keyPrefix ?? 'bkash:token:';
    this.cipher = options.cipher;
  }

  private tokenKey(appKey: string): string {
    return `${this.keyPrefix}${appKey}`;
  }

  private lockKey(appKey: string): string {
    return `${this.keyPrefix}lock:${appKey}`;
  }

  public async get(appKey: string): Promise<TokenData | null> {
    const raw = await this.redis.get(this.tokenKey(appKey));
    if (!raw) {
      return null;
    }

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
        refreshToken: token.refreshToken ? await this.cipher.encrypt(token.refreshToken) : undefined,
      };
    }

    const serialized = JSON.stringify(payload);
    // Redis SET key value EX seconds
    await this.redis.set(this.tokenKey(appKey), serialized, 'EX', ttlSeconds);
  }

  public async clear(appKey: string): Promise<void> {
    await this.redis.del(this.tokenKey(appKey));
    await this.redis.del(this.lockKey(appKey));
  }

  public async acquireLock(appKey: string, ownerToken: string, ttlMs: number): Promise<boolean> {
    // Atomic SET NX PX
    const result = await this.redis.set(this.lockKey(appKey), ownerToken, 'PX', ttlMs, 'NX');
    return result === 'OK' || result === true;
  }

  public async releaseLock(appKey: string, ownerToken: string): Promise<void> {
    await this.redis.eval(LUA_RELEASE_LOCK, 1, this.lockKey(appKey), ownerToken);
  }

  /**
   * Contention Poller: When another worker holds the distributed lock,
   * polls Redis for the refreshed token instead of issuing a separate grant call.
   */
  public async waitForToken(
    appKey: string,
    maxWaitMs: number = 3000,
    pollIntervalMs: number = 200
  ): Promise<TokenData | null> {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      const token = await this.get(appKey);
      if (token) {
        return token;
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    return null;
  }
}
