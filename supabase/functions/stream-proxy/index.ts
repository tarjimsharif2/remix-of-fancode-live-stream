import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

// External proxy for geo-restricted streams (Bangladesh-based)
const EXTERNAL_PROXY_BASE = 'https://tv.eplayhd.fun/proxy.php';

// Domains that require external proxy (geo-restricted)
const GEO_RESTRICTED_DOMAINS = [
  'akamaized.net',
  'tapmad',
  'akamaicdn',
];

interface ProxyError {
  error: string;
  code: string;
  details?: string;
  url?: string;
  status?: number;
}

function createErrorResponse(error: ProxyError, statusCode: number = 500): Response {
  console.error(`Proxy Error [${error.code}]:`, error.error, error.details || '');
  return new Response(JSON.stringify(error), {
    status: statusCode,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isGeoRestricted(url: string): boolean {
  return GEO_RESTRICTED_DOMAINS.some(domain => url.toLowerCase().includes(domain.toLowerCase()));
}

function buildExternalProxyUrl(streamUrl: string, referer: string, origin: string, userAgent: string): string {
  const params = new URLSearchParams();
  params.set('link', streamUrl);
  if (referer) params.set('referer', referer);
  if (origin) params.set('origin', origin);
  if (userAgent) params.set('user_agent', userAgent);
  return `${EXTERNAL_PROXY_BASE}?${params.toString()}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Origin/Referer verification - block direct browser access
    const requestOrigin = req.headers.get('origin') || '';
    const requestReferer = req.headers.get('referer') || '';
    
    // List of allowed origins/patterns (our app domains)
    const allowedPatterns = [
      'lovable.app',
      'lovableproject.com',
      'lovable.dev',
      'eplayhd',
      'cricfoots',
      'localhost',
      '127.0.0.1'
    ];
    
    const isAllowedOrigin = allowedPatterns.some(pattern => 
      requestOrigin.includes(pattern) || requestReferer.includes(pattern)
    );
    
    // If no origin/referer (direct browser access) or not from allowed origin, block
    if (!requestOrigin && !requestReferer) {
      console.warn(`Direct access attempt blocked from ${req.headers.get('x-forwarded-for') || 'unknown'}`);
      return new Response(JSON.stringify({ 
        error: 'Forbidden', 
        code: 'DIRECT_ACCESS_BLOCKED',
        details: 'Direct browser access is not allowed. Use the app to access streams.'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    if (!isAllowedOrigin) {
      console.warn(`Unauthorized origin: ${requestOrigin || requestReferer}`);
      return new Response(JSON.stringify({ 
        error: 'Forbidden', 
        code: 'UNAUTHORIZED_ORIGIN',
        details: 'Access from this origin is not allowed'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const streamUrl = url.searchParams.get('url');
    const referer = url.searchParams.get('referer') || '';
    const origin = url.searchParams.get('origin') || '';
    const customUserAgent = url.searchParams.get('user_agent') || '';
    const customCookie = url.searchParams.get('cookie') || '';
    const customHeadersJson = url.searchParams.get('custom_headers') || '';
    const useExternalProxy = url.searchParams.get('use_external_proxy') === 'true';

    // Validate required parameters
    if (!streamUrl) {
      return createErrorResponse({
        error: 'Missing stream URL parameter',
        code: 'MISSING_URL',
        details: 'The "url" query parameter is required',
      }, 400);
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(streamUrl);
    } catch (e) {
      return createErrorResponse({
        error: 'Invalid stream URL format',
        code: 'INVALID_URL',
        details: `Could not parse URL: ${streamUrl}`,
        url: streamUrl,
      }, 400);
    }

    // Check protocol
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return createErrorResponse({
        error: 'Invalid URL protocol',
        code: 'INVALID_PROTOCOL',
        details: `Only HTTP and HTTPS protocols are allowed. Got: ${parsedUrl.protocol}`,
        url: streamUrl,
      }, 400);
    }

    // Determine if we should use external proxy
    const shouldUseExternalProxy = useExternalProxy || isGeoRestricted(streamUrl);
    
    // Build headers for the upstream request
    const requestUa = req.headers.get('user-agent') || '';
    const requestRange = req.headers.get('range') || '';
    const effectiveUserAgent = customUserAgent || requestUa || 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

    let fetchUrl: string;
    let upstreamHeaders: Record<string, string>;

    if (shouldUseExternalProxy) {
      // Use external proxy for geo-restricted content
      fetchUrl = buildExternalProxyUrl(streamUrl, referer, origin, effectiveUserAgent);
      upstreamHeaders = {
        'User-Agent': effectiveUserAgent,
      };
      console.log(`[${new Date().toISOString()}] Using EXTERNAL PROXY for: ${streamUrl}`);
      console.log(`External proxy URL: ${fetchUrl}`);
    } else {
      // Direct fetch
      fetchUrl = streamUrl;
      upstreamHeaders = {
        'User-Agent': effectiveUserAgent,
      };
      
      if (referer) {
        upstreamHeaders['Referer'] = referer;
      }
      if (origin) {
        upstreamHeaders['Origin'] = origin;
      }
      if (customCookie) {
        upstreamHeaders['Cookie'] = customCookie;
      }

      // Parse and apply any additional custom headers
      if (customHeadersJson) {
        try {
          const additionalHeaders = JSON.parse(customHeadersJson);
          if (typeof additionalHeaders === 'object' && additionalHeaders !== null) {
            for (const [key, value] of Object.entries(additionalHeaders)) {
              if (typeof value === 'string') {
                upstreamHeaders[key] = value;
              }
            }
          }
        } catch (e) {
          console.warn('Failed to parse custom_headers JSON:', e);
        }
      }
      
      console.log(`[${new Date().toISOString()}] Proxying DIRECT: ${streamUrl}`);
    }

    if (requestRange) {
      upstreamHeaders['Range'] = requestRange;
    }

    console.log(`Headers: Referer=${referer || 'none'}, Origin=${origin || 'none'}, UA=${customUserAgent ? 'custom' : 'default'}, Cookie=${customCookie ? 'set' : 'none'}, ExternalProxy=${shouldUseExternalProxy}`);

    // Fetch the stream with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    let response: Response;
    try {
      response = await fetch(fetchUrl, {
        headers: upstreamHeaders,
        signal: controller.signal,
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        return createErrorResponse({
          error: 'Connection timeout',
          code: 'TIMEOUT',
          details: 'The upstream server took too long to respond (>30s)',
          url: streamUrl,
        }, 504);
      }

      // Network errors
      if (fetchError.message?.includes('dns') || fetchError.message?.includes('resolve')) {
        return createErrorResponse({
          error: 'DNS resolution failed',
          code: 'DNS_ERROR',
          details: `Could not resolve hostname: ${parsedUrl.hostname}`,
          url: streamUrl,
        }, 502);
      }

      if (fetchError.message?.includes('connect') || fetchError.message?.includes('ECONNREFUSED')) {
        return createErrorResponse({
          error: 'Connection refused',
          code: 'CONNECTION_REFUSED',
          details: `Could not connect to ${parsedUrl.hostname}:${parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80)}`,
          url: streamUrl,
        }, 502);
      }

      if (fetchError.message?.includes('certificate') || fetchError.message?.includes('SSL') || fetchError.message?.includes('TLS')) {
        return createErrorResponse({
          error: 'SSL/TLS error',
          code: 'SSL_ERROR',
          details: `SSL certificate issue with ${parsedUrl.hostname}: ${fetchError.message}`,
          url: streamUrl,
        }, 502);
      }

      return createErrorResponse({
        error: 'Network error',
        code: 'NETWORK_ERROR',
        details: fetchError.message || 'Unknown network error occurred',
        url: streamUrl,
      }, 502);
    }

    clearTimeout(timeoutId);

    // Check for HTTP errors
    if (!response.ok) {
      const statusText = response.statusText || 'Unknown';
      let errorDetails = `Upstream returned HTTP ${response.status} ${statusText}`;
      
      // Try to get response body for more details
      try {
        const errorBody = await response.text();
        if (errorBody && errorBody.length < 500) {
          errorDetails += `. Response: ${errorBody}`;
        }
      } catch {}

      const errorCodes: Record<number, string> = {
        400: 'UPSTREAM_BAD_REQUEST',
        401: 'UPSTREAM_UNAUTHORIZED',
        403: 'UPSTREAM_FORBIDDEN',
        404: 'UPSTREAM_NOT_FOUND',
        410: 'UPSTREAM_GONE',
        429: 'UPSTREAM_RATE_LIMITED',
        500: 'UPSTREAM_SERVER_ERROR',
        502: 'UPSTREAM_BAD_GATEWAY',
        503: 'UPSTREAM_UNAVAILABLE',
        504: 'UPSTREAM_TIMEOUT',
      };

      return createErrorResponse({
        error: `Upstream server error: ${response.status}`,
        code: errorCodes[response.status] || 'UPSTREAM_HTTP_ERROR',
        details: errorDetails,
        url: streamUrl,
        status: response.status,
      }, response.status >= 500 ? 502 : response.status);
    }

    // Get content type from upstream
    const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
    
    console.log(`Upstream response: ${response.status}, Content-Type: ${contentType}`);

    // For HLS manifests (.m3u8), we need to rewrite segment URLs
    if (streamUrl.includes('.m3u8') || contentType.includes('mpegurl') || contentType.includes('x-mpegURL')) {
      let text: string;
      try {
        text = await response.text();
      } catch (e) {
        return createErrorResponse({
          error: 'Failed to read manifest',
          code: 'MANIFEST_READ_ERROR',
          details: 'Could not read the HLS manifest response body',
          url: streamUrl,
        }, 502);
      }

      // Validate manifest format
      if (!text.includes('#EXTM3U')) {
        return createErrorResponse({
          error: 'Invalid HLS manifest',
          code: 'INVALID_MANIFEST',
          details: 'Response does not appear to be a valid HLS manifest (missing #EXTM3U header)',
          url: streamUrl,
        }, 502);
      }
      
      // Get base URL for relative paths
      const baseUrl = streamUrl.substring(0, streamUrl.lastIndexOf('/') + 1);
      
      // Rewrite relative URLs in the manifest to use our public proxy endpoint
      const supabaseUrl = (Deno.env.get('SUPABASE_URL') ?? '').replace(/^http:/, 'https:');
      const proxyBaseUrl = `${supabaseUrl}/functions/v1/stream-proxy`;
      
      // Build query params to forward - include external proxy flag if needed
      const forwardParams = new URLSearchParams();
      forwardParams.set('referer', referer);
      forwardParams.set('origin', origin);
      if (customUserAgent) forwardParams.set('user_agent', customUserAgent);
      if (customCookie) forwardParams.set('cookie', customCookie);
      if (customHeadersJson) forwardParams.set('custom_headers', customHeadersJson);
      if (shouldUseExternalProxy) forwardParams.set('use_external_proxy', 'true');
      const forwardParamsStr = forwardParams.toString();
      
      const rewrittenManifest = text.split('\n').map(line => {
        const trimmedLine = line.trim();
        
        // Skip comments and empty lines, but handle URI= attributes
        if (trimmedLine.startsWith('#') || trimmedLine === '') {
          // Rewrite URI= attributes in #EXT-X-KEY, #EXT-X-MAP, etc.
          if (trimmedLine.includes('URI="')) {
            return line.replace(/URI="([^"]+)"/g, (match, uri) => {
              const absoluteUri = uri.startsWith('http') ? uri : baseUrl + uri;
              const encodedUri = encodeURIComponent(absoluteUri);
              return `URI="${proxyBaseUrl}?url=${encodedUri}&${forwardParamsStr}"`;
            });
          }
          return line;
        }
        
        // Rewrite segment URLs
        if (!trimmedLine.startsWith('http')) {
          // Relative URL - make absolute and proxy
          const absoluteUrl = baseUrl + trimmedLine;
          return `${proxyBaseUrl}?url=${encodeURIComponent(absoluteUrl)}&${forwardParamsStr}`;
        } else {
          // Absolute URL - just proxy
          return `${proxyBaseUrl}?url=${encodeURIComponent(trimmedLine)}&${forwardParamsStr}`;
        }
      }).join('\n');

      const elapsed = Date.now() - startTime;
      console.log(`Manifest proxied successfully in ${elapsed}ms, ${rewrittenManifest.length} bytes`);

      return new Response(rewrittenManifest, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-cache',
          'X-Proxy-Time': `${elapsed}ms`,
        },
      });
    }

    // For segments (.ts files) and other binary content, stream directly
    const body = response.body;
    const contentLength = response.headers.get('Content-Length');
    
    const elapsed = Date.now() - startTime;
    console.log(`Segment proxied in ${elapsed}ms, size: ${contentLength || 'unknown'} bytes`);

    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      'Content-Type': contentType,
      'Cache-Control': 'max-age=3600',
      'X-Proxy-Time': `${elapsed}ms`,
    };

    if (contentLength) {
      responseHeaders['Content-Length'] = contentLength;
    }

    return new Response(body, { headers: responseHeaders });

  } catch (error: any) {
    console.error('Unexpected proxy error:', error);
    return createErrorResponse({
      error: 'Internal proxy error',
      code: 'INTERNAL_ERROR',
      details: error.message || 'An unexpected error occurred in the proxy',
    }, 500);
  }
});