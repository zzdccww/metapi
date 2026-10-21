import type { FastifyReply, FastifyRequest } from 'fastify';
import { normalizeClientIp } from '../shared/clientIp.js';

type RateLimitOptions = {
  bucket: string;
  max: number;
  windowMs: number;
  message?: string;
  keyGenerator?: (request: FastifyRequest) => string;
};

export type RateLimitOperationOptions = {
  bucket: string;
  identity: string;
  max: number;
  windowMs: number;
  nowMs?: number;
};

export type RateLimitResult =
  | { allowed: true; retryAfterSec: 0 }
  | { allowed: false; retryAfterSec: number };

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const DEFAULT_MESSAGE = '请求过于频繁，请稍后再试';
const rateLimitStore = new Map<string, RateLimitEntry>();

function pruneExpiredEntries(nowMs: number): void {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt > nowMs) continue;
    rateLimitStore.delete(key);
  }
}

export function consumeRateLimit(options: RateLimitOperationOptions): RateLimitResult {
  const nowMs = options.nowMs ?? Date.now();
  pruneExpiredEntries(nowMs);

  const identity = String(options.identity || 'unknown');
  const key = JSON.stringify([options.bucket, identity]);
  const current = rateLimitStore.get(key);

  if (!current || current.resetAt <= nowMs) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: nowMs + options.windowMs,
    });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (current.count >= options.max) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((current.resetAt - nowMs) / 1000)),
    };
  }

  current.count += 1;
  rateLimitStore.set(key, current);
  return { allowed: true, retryAfterSec: 0 };
}

export function resetRequestRateLimitStore(): void {
  rateLimitStore.clear();
}

export function createRateLimitGuard(options: RateLimitOptions) {
  const message = options.message || DEFAULT_MESSAGE;
  return async function rateLimitGuard(request: FastifyRequest, reply: FastifyReply) {
    const identity = options.keyGenerator
      ? String(options.keyGenerator(request) || 'unknown')
      : normalizeClientIp(request.ip) || 'unknown';
    const result = consumeRateLimit({
      bucket: options.bucket,
      identity,
      max: options.max,
      windowMs: options.windowMs,
    });

    if (result.allowed) return;

    reply
      .code(429)
      .header('retry-after', String(result.retryAfterSec))
      .send({ success: false, message });
  };
}
