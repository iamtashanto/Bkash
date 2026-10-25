/**
 * Universal crypto helpers compatible with Node >= 18, Deno, Bun,
 * Cloudflare Workers, and browser environments via Web Crypto API.
 */

export function generateUUID(): string {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  // Fallback RFC4122 v4 UUID generator if crypto.randomUUID is not present
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
