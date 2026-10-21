const updatedPageDestinations: Record<string, string> = {
  '/app': '/',
  '/app/dashboard': '/',
  '/app/oauth': '/oauth',
  '/app/downstream-keys': '/downstream-keys',
  '/app/site-announcements': '/site-announcements',
  '/app/events': '/events',
  '/app/import-export': '/settings/import-export',
  '/app/notifications': '/settings/notify',
  '/app/models': '/models',
  '/app/marketplace': '/models',
  '/app/about': '/about',
  '/app/settings': '/settings',
  '/app/accounts': '/accounts',
  '/app/sites': '/sites',
  '/app/routes': '/routes',
  '/app/playground': '/playground',
  '/app/proxy-logs': '/logs',
  '/app/monitor': '/monitor',
  '/app/checkins': '/checkin',
};

export function frontendEntryForPath(url: string): string | null {
  const pathname = url.split('?')[0];
  const reserved = ['/api', '/v1', '/monitor-proxy', '/assets', '/legacy/assets'];
  if (reserved.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return null;
  return 'index.html';
}

export function frontendRedirectForPath(url: string): string | null {
  if (!frontendEntryForPath(url)) return null;
  const queryIndex = url.indexOf('?');
  const pathname = queryIndex < 0 ? url : url.slice(0, queryIndex);
  const query = queryIndex < 0 ? '' : url.slice(queryIndex);
  const trimmedPath = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  let destination = updatedPageDestinations[trimmedPath];
  if (pathname === '/legacy' || pathname.startsWith('/legacy/')) {
    destination = pathname.slice('/legacy'.length) || '/';
  }
  // A bookmark redirect must remain a path on this server, even for malformed URLs.
  if (!destination || !destination.startsWith('/') || destination.startsWith('//') || /[\\\r\n]/.test(destination + query)) return null;
  return destination + query;
}
