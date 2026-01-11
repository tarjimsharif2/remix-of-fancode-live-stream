import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const url = new URL(req.url);
    const streamUrl = url.searchParams.get('url');
    const referer = url.searchParams.get('referer') || '';
    const origin = url.searchParams.get('origin') || '';

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

    // Build headers for the upstream request (mimic a real browser as closely as possible)
    const requestUa = req.headers.get('user-agent') || '';
    const requestAcceptLang = req.headers.get('accept-language') || '';
    const requestAccept = req.headers.get('accept') || '';
    const requestRange = req.headers.get('range') || '';

    const upstreamHeaders: Record<string, string> = {
      'User-Agent': requestUa || 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
      'Accept': requestAccept || 'application/vnd.apple.mpegurl,application/x-mpegURL,application/octet-stream,*/*',
      'Accept-Language': requestAcceptLang || 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Connection': 'keep-alive',
      // Common fetch metadata headers some CDNs check
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
    };

    if (requestRange) {
      upstreamHeaders['Range'] = requestRange;
    }

    // Some upstreams are strict about trailing slashes on referer.
    const normalizedReferer = referer ? referer.replace(/\/$/, '') : '';

    if (normalizedReferer) {
      upstreamHeaders['Referer'] = normalizedReferer;
    }
    if (origin) {
      upstreamHeaders['Origin'] = origin;
    }

    console.log(`[${new Date().toISOString()}] Proxying: ${streamUrl}`);
    console.log(`Headers: Referer=${referer || 'none'}, Origin=${origin || 'none'}`);

    // Fetch the stream with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    let response: Response;
    try {
      response = await fetch(streamUrl, {
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
      const rewrittenManifest = text.split('\n').map(line => {
        const trimmedLine = line.trim();
        
        // Skip comments and empty lines, but handle URI= attributes
        if (trimmedLine.startsWith('#') || trimmedLine === '') {
          // Rewrite URI= attributes in #EXT-X-KEY, #EXT-X-MAP, etc.
          if (trimmedLine.includes('URI="')) {
            return line.replace(/URI="([^"]+)"/g, (match, uri) => {
              const absoluteUri = uri.startsWith('http') ? uri : baseUrl + uri;
              const encodedUri = encodeURIComponent(absoluteUri);
              return `URI="${proxyBaseUrl}?url=${encodedUri}&referer=${encodeURIComponent(referer)}&origin=${encodeURIComponent(origin)}"`;
            });
          }
          return line;
        }
        
        // Rewrite segment URLs
        if (!trimmedLine.startsWith('http')) {
          // Relative URL - make absolute and proxy
          const absoluteUrl = baseUrl + trimmedLine;
          return `${proxyBaseUrl}?url=${encodeURIComponent(absoluteUrl)}&referer=${encodeURIComponent(referer)}&origin=${encodeURIComponent(origin)}`;
        } else {
          // Absolute URL - just proxy
          return `${proxyBaseUrl}?url=${encodeURIComponent(trimmedLine)}&referer=${encodeURIComponent(referer)}&origin=${encodeURIComponent(origin)}`;
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
