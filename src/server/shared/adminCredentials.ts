import { createHash, timingSafeEqual } from 'node:crypto';

export const DEFAULT_ADMIN_TOKEN = 'change-me-admin-token';

export function parseAdminBearerToken(authorization: string): string | null {
  const match = /^Bearer +([^\s,]+)$/i.exec(authorization);
  return match && match[0].length === authorization.length ? match[1] : null;
}

export function timingSafeTokenEqual(actual: string, expected: string): boolean {
  // Fixed-size digests support unequal lengths; UTF-16 preserves exact JS strings.
  const digest = (value: string) => createHash('sha256').update(value, 'utf16le').digest();
  return timingSafeEqual(digest(actual), digest(expected));
}

type AdminCredentialConfig = {
  authToken: string;
  listenHost: string;
  isDesktop: boolean;
  nodeEnv: string;
};

export function assertSafeAdminCredentials(config: AdminCredentialConfig): void {
  if (!config.authToken.trim()) throw new Error('AUTH_TOKEN must not be blank');
  if (/[\s,]/.test(config.authToken)) throw new Error('AUTH_TOKEN must not contain whitespace or commas');
  if (!timingSafeTokenEqual(config.authToken, DEFAULT_ADMIN_TOKEN)) return;
  const loopback = config.listenHost === '127.0.0.1' || config.listenHost === '::1';
  if (!loopback || (!config.isDesktop && config.nodeEnv === 'production')) {
    throw new Error('Set a non-default AUTH_TOKEN or saved administrator token before exposing the server; the default token is allowed only for loopback desktop/development use');
  }
}
