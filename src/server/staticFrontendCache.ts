import type { FastifyReply } from 'fastify';
import { normalize, sep } from 'node:path';

export function setFrontendCacheHeaders(reply: Pick<FastifyReply, 'header'>, filePath: string): void {
  const normalizedPath = normalize(filePath);
  if (normalizedPath.includes(`${sep}assets${sep}`)) {
    reply.header('Cache-Control', 'public, max-age=31536000, immutable');
    return;
  }
  if (normalizedPath.endsWith(`${sep}index.html`)) {
    reply.header('Cache-Control', 'no-cache');
  }
}
