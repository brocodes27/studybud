export type CorsResult = {
  headers: Record<string, string>;
  allowed: boolean;
};

function isAllowedOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
      return false;
    }
    const host = url.hostname.toLowerCase();
    // Local development, with or without a port, over HTTP or HTTPS.
    if (['localhost', '127.0.0.1', '0.0.0.0', '[::1]'].includes(host)) {
      return true;
    }
    // Allow curveapp.tech, elevenfolks.com and their subdomains
    return (
      host === 'curveapp.tech' ||
      host.endsWith('.curveapp.tech') ||
      host === 'elevenfolks.com' ||
      host.endsWith('.elevenfolks.com')
    );
  } catch {
    return false;
  }
}

/**
 * CORS helper for Supabase Edge Functions.
 *
 * - If Origin header is missing (server-to-server calls), allow it.
 * - If Origin is present, allow localhost/loopback (dev), curveapp.tech, elevenfolks.com, and their subdomains.
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
