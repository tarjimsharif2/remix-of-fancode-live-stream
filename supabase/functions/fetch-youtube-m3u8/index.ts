const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Extract video ID from various YouTube URL formats
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Verify if M3U8 URL is actually valid by checking response
async function verifyM3u8Url(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}

// Try to get stream info from Invidious instances
async function tryInvidiousInstances(videoId: string): Promise<{ m3u8Url: string | null; title?: string; thumbnail?: string }> {
  // Updated list with more reliable instances
  const instances = [
    'https://invidious.fdn.fr',
    'https://inv.tux.pizza',
    'https://invidious.protokolla.fi',
    'https://invidious.lunar.icu',
    'https://invidious.privacydev.net',
    'https://vid.puffyan.us',
    'https://inv.pistasjis.net',
    'https://invidious.slipfox.xyz',
    'https://invidious.flokinet.to',
    'https://iv.ggtyler.dev',
    'https://yewtu.be',
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://invidious.darkness.services',
  ];

  for (const instance of instances) {
    try {
      console.log(`Trying Invidious instance: ${instance}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(`${instance}/api/v1/videos/${videoId}`, {
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.log(`Instance ${instance} returned ${response.status}`);
        continue;
      }

      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('application/json')) {
        console.log(`Instance ${instance} returned non-JSON response`);
        continue;
      }

      const data = await response.json();
      
      // Check for direct HLS URL
      if (data.hlsUrl) {
        console.log(`Got direct HLS URL from ${instance}`);
        // Verify the URL works
        const isValid = await verifyM3u8Url(data.hlsUrl);
        if (isValid) {
          return { 
            m3u8Url: data.hlsUrl, 
            title: data.title,
            thumbnail: data.videoThumbnails?.[0]?.url 
          };
        }
        console.log(`HLS URL from ${instance} failed verification`);
      }

      // For live streams, try different manifest URL patterns
      if (data.liveNow || data.isLive) {
        // Try different manifest URL formats
        const manifestPatterns = [
          `${instance}/api/manifest/hls_variant/${videoId}.m3u8`,
          `${instance}/latest_version?id=${videoId}&itag=300`,
          `${instance}/latest_version?id=${videoId}&itag=95`,
        ];
        
        for (const manifestUrl of manifestPatterns) {
          console.log(`Trying manifest URL: ${manifestUrl}`);
          const isValid = await verifyM3u8Url(manifestUrl);
          if (isValid) {
            console.log(`Valid manifest found from ${instance}`);
            return { 
              m3u8Url: manifestUrl,
              title: data.title,
              thumbnail: data.videoThumbnails?.[0]?.url 
            };
          }
        }
      }

      // Look for adaptive formats with HLS
      const adaptiveFormats = data.adaptiveFormats || [];
      for (const format of adaptiveFormats) {
        if (format.type?.includes('mpegURL') || format.container === 'hls' || format.url?.includes('.m3u8')) {
          const isValid = await verifyM3u8Url(format.url);
          if (isValid) {
            console.log(`Got valid adaptive HLS format from ${instance}`);
            return { 
              m3u8Url: format.url,
              title: data.title,
              thumbnail: data.videoThumbnails?.[0]?.url 
            };
          }
        }
      }

      // If video found but no valid HLS yet, try manifest endpoint anyway
      if (data.videoId) {
        const manifestUrl = `${instance}/api/manifest/hls_variant/${videoId}.m3u8`;
        console.log(`Trying manifest URL for existing video: ${manifestUrl}`);
        // Don't verify, just return and let player try
        return { 
          m3u8Url: manifestUrl,
          title: data.title,
          thumbnail: data.videoThumbnails?.[0]?.url 
        };
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes('aborted')) {
        console.log(`Instance ${instance} timed out`);
      } else {
        console.log(`Instance ${instance} failed: ${errorMsg}`);
      }
      continue;
    }
  }

  return { m3u8Url: null };
}

// Try Piped instances
async function tryPipedInstances(videoId: string): Promise<{ m3u8Url: string | null; title?: string; thumbnail?: string }> {
  // Updated list with more reliable instances
  const instances = [
    'https://pipedapi.kavin.rocks',
    'https://api.piped.privacydev.net',
    'https://pipedapi.osphost.fi',
    'https://pipedapi.tokhmi.xyz',
    'https://pipedapi.moomoo.me',
    'https://pipedapi.syncpundit.io',
    'https://api.piped.yt',
    'https://pipedapi.r4fo.com',
  ];

  for (const instance of instances) {
    try {
      console.log(`Trying Piped instance: ${instance}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(`${instance}/streams/${videoId}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.log(`Piped instance ${instance} returned ${response.status}`);
        continue;
      }

      const data = await response.json();
      
      // Check for direct HLS URL
      if (data.hls) {
        console.log(`Got HLS URL from Piped ${instance}`);
        const isValid = await verifyM3u8Url(data.hls);
        if (isValid) {
          return { 
            m3u8Url: data.hls,
            title: data.title,
            thumbnail: data.thumbnailUrl 
          };
        }
        // Return anyway, let the player try
        return { 
          m3u8Url: data.hls,
          title: data.title,
          thumbnail: data.thumbnailUrl 
        };
      }

      // Look for livestream or HLS in video streams
      if (data.livestream || data.videoStreams) {
        const streams = data.videoStreams || [];
        for (const stream of streams) {
          if (stream.format === 'HLS' || stream.mimeType?.includes('mpegURL') || stream.url?.includes('.m3u8')) {
            console.log(`Got HLS stream from Piped ${instance}`);
            return { 
              m3u8Url: stream.url,
              title: data.title,
              thumbnail: data.thumbnailUrl 
            };
          }
        }
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (errorMsg.includes('aborted')) {
        console.log(`Piped instance ${instance} timed out`);
      } else {
        console.log(`Piped instance ${instance} failed: ${errorMsg}`);
      }
      continue;
    }
  }

  return { m3u8Url: null };
}

// Try Cobalt API for extraction
async function tryCobaltApi(videoId: string): Promise<{ m3u8Url: string | null; title?: string; thumbnail?: string }> {
  const cobaltInstances = [
    'https://co.wuk.sh',
    'https://cobalt.api.timelessnesses.me',
  ];

  for (const instance of cobaltInstances) {
    try {
      console.log(`Trying Cobalt instance: ${instance}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${instance}/api/json`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          vQuality: 'max',
          isAudioOnly: false,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.log(`Cobalt instance ${instance} returned ${response.status}`);
        continue;
      }

      const data = await response.json();
      
      if (data.url && data.url.includes('.m3u8')) {
        console.log(`Got M3U8 from Cobalt ${instance}`);
        return { m3u8Url: data.url };
      }

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.log(`Cobalt instance ${instance} failed: ${errorMsg}`);
      continue;
    }
  }

  return { m3u8Url: null };
}

// Main extraction function with multiple fallbacks
async function getYouTubeStreamInfo(videoId: string): Promise<{ m3u8Url: string | null; title?: string; thumbnail?: string }> {
  console.log(`Starting extraction for video ID: ${videoId}`);
  
  // Try Piped first (often better for live streams)
  let result = await tryPipedInstances(videoId);
  if (result.m3u8Url) {
    console.log('Successfully got M3U8 from Piped');
    return result;
  }

  // Try Invidious
  result = await tryInvidiousInstances(videoId);
  if (result.m3u8Url) {
    console.log('Successfully got M3U8 from Invidious');
    return result;
  }

  // Try Cobalt as last resort
  result = await tryCobaltApi(videoId);
  if (result.m3u8Url) {
    console.log('Successfully got M3U8 from Cobalt');
    return result;
  }

  console.log('All extraction methods failed for video:', videoId);
  return { m3u8Url: null };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { youtube_url, stream_id } = await req.json();

    if (!youtube_url) {
      return new Response(
        JSON.stringify({ success: false, error: 'YouTube URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const videoId = extractVideoId(youtube_url);
    if (!videoId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid YouTube URL format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Extracting M3U8 for video ID: ${videoId}`);

    const streamInfo = await getYouTubeStreamInfo(videoId);

    if (!streamInfo.m3u8Url) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Could not extract M3U8 URL. The stream may be geo-restricted, age-restricted, or the video is not available for streaming. External extraction APIs may also be temporarily unavailable.' 
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If stream_id provided, update the cached URL in database
    if (stream_id) {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      await supabase
        .from('youtube_streams')
        .update({ 
          cached_m3u8: streamInfo.m3u8Url,
          last_fetched_at: new Date().toISOString()
        })
        .eq('id', stream_id);

      console.log(`Updated cached M3U8 for stream ${stream_id}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        m3u8_url: streamInfo.m3u8Url,
        title: streamInfo.title,
        thumbnail: streamInfo.thumbnail,
        video_id: videoId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error extracting YouTube M3U8:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to extract M3U8' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
