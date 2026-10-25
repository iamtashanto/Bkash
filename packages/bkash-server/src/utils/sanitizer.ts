/**
 * Masks customer phone numbers (MSISDN) to protect PII in logs and return objects.
 * Example: "01712345678" -> "017****5678"
 */
export function maskMsisdn(msisdn?: string): string {
  if (!msisdn || typeof msisdn !== 'string') {
    return '';
  }
  const clean = msisdn.trim();
  if (clean.length <= 6) {
    return '***';
  }
  const prefix = clean.slice(0, 3);
  const suffix = clean.slice(-4);
  return `${prefix}****${suffix}`;
}

/**
 * Normalizes any amount input (number or string) to a canonical 2-decimal string.
 * Example: 1550 -> "1550.00", "1550.5" -> "1550.50"
 */
export function formatAmount(amount: number | string): string {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount).trim());
  if (isNaN(num)) {
    throw new TypeError(`Invalid amount value: ${amount}`);
  }
  return num.toFixed(2);
}

const SENSITIVE_KEYS = new Set([
  'password',
  'appsecret',
  'app_secret',
  'id_token',
  'refresh_token',
  'idtoken',
  'refreshtoken',
  'authorization',
  'customermsisdn',
]);

/**
 * Recursively sanitizes data objects, redacting secrets and masking PII
 * before sending to logger.
 */
export function sanitizeLogData(data: unknown): unknown {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey === 'customermsisdn' && typeof val === 'string') {
      sanitized[key] = maskMsisdn(val);
    } else if (SENSITIVE_KEYS.has(lowerKey)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = sanitizeLogData(val);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}
