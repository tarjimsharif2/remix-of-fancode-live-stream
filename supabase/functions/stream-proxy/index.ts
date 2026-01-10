import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const streamUrl = url.searchParams.get('url');
    const referer = url.searchParams.get('referer') || '';
    const origin = url.searchParams.get('origin') || '';

    if (!streamUrl) {
      return new Response(JSON.stringify({ error: 'Missing stream URL' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(streamUrl);
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid stream URL' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build headers for the upstream request
    const upstreamHeaders: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };

    if (referer) {
      upstreamHeaders['Referer'] = referer;
    }
    if (origin) {
      upstreamHeaders['Origin'] = origin;
    }

    console.log(`Proxying stream: ${streamUrl}`);
    console.log(`With Referer: ${referer}, Origin: ${origin}`);

    // Fetch the stream
    const response = await fetch(streamUrl, {
      headers: upstreamHeaders,
    });

    if (!response.ok) {
      console.error(`Upstream error: ${response.status} ${response.statusText}`);
      return new Response(JSON.stringify({ error: `Upstream error: ${response.status}` }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get content type from upstream
    const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
    
    // For HLS manifests (.m3u8), we need to rewrite segment URLs
    if (streamUrl.includes('.m3u8') || contentType.includes('mpegurl') || contentType.includes('x-mpegURL')) {
      const text = await response.text();
      
      // Get base URL for relative paths
      const baseUrl = streamUrl.substring(0, streamUrl.lastIndexOf('/') + 1);
      
      // Rewrite relative URLs in the manifest to use our proxy
      const proxyBaseUrl = `${url.origin}${url.pathname}`;
      const rewrittenManifest = text.split('\n').map(line => {
        const trimmedLine = line.trim();
        
        // Skip comments and empty lines
        if (trimmedLine.startsWith('#') || trimmedLine === '') {
          // But rewrite URI= attributes in #EXT-X-KEY and similar tags
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

      return new Response(rewrittenManifest, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // For segments (.ts files) and other binary content, stream directly
    const body = response.body;
    
    return new Response(body, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'max-age=3600',
      },
    });

  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(JSON.stringify({ error: 'Proxy error', details: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
