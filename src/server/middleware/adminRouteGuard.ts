import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { isPublicApiRoute } from '../desktop.js';
import { authMiddleware } from './auth.js';
import { createRateLimitGuard } from './requestRateLimit.js';

export function registerAdminRouteGuard(app: FastifyInstance): void {
  const limitAuthenticatedAdmin = createRateLimitGuard({
    bucket: 'admin-authenticated',
    max: config.authenticatedRateLimitMax,
    windowMs: config.requestRateLimitWindowMs,
    keyGenerator: () => 'admin',
  });

  app.addHook('onRequest', async (request, reply) => {
    // Match the router's identity so encoded static segments cannot bypass auth.
    // Unmatched requests retain the existing raw-URL policy.
    const routeUrl = request.routeOptions.url ?? request.url;
    if (routeUrl.startsWith('/api/') && !isPublicApiRoute(routeUrl)) {
      await authMiddleware(request, reply);
      if (!reply.sent) await limitAuthenticatedAdmin(request, reply);
    }
  });
}
