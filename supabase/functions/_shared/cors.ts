export type CorsResult = {
  headers: Record<string, string>;
  allowed: boolean;
};

function isAllowedOrigin(origin: string): boolean {
  // Local development
  if (
    origin.startsWith('http://localhost:') ||
    origin.startsWith('http://127.0.0.1:') ||
    origin.startsWith('http://0.0.0.0:')
  ) {
    return true;
  }

  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    // Allow the production domain and any subdomain (e.g. staging.elevenfolks.com)
    return host === 'elevenfolks.com' || host.endsWith('.elevenfolks.com');
  } catch {
    return false;
  }
}

/**
 * CORS helper for Supabase Edge Functions.
 *
 * - If Origin header is missing (server-to-server calls), allow it.
 * - If Origin is present, allow only localhost (dev) and *.elevenfolks.com (prod/staging).
 */
export function getCors(req: Request): CorsResult {
  const origin = req.headers.get('origin') ?? '';
  const allowed = !origin || isAllowedOrigin(origin);

  // For allowed browser requests, echo the origin (required when credentials/Authorization are used).
  // For non-browser requests, fall back to production origin.
  const allowOrigin = allowed ? (origin || 'https://elevenfolks.com') : 'null';

  return {
    allowed,
    headers: {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Vary': 'Origin',
    },
  };
}

