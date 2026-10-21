export function normalizeClientIp(rawIp: string | null | undefined): string {
  const ip = (rawIp || '').trim();
  if (ip.startsWith('::ffff:')) return ip.slice('::ffff:'.length).trim();
  if (ip === '::1') return '127.0.0.1';
  return ip;
}
