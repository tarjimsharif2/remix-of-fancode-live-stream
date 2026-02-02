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
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Try to get stream info from Invidious instances
async function tryInvidiousInstances(videoId: string): Promise<{ m3u8Url: string | null; title?: string; thumbnail?: string }> {
  const instances = [
    'https://yewtu.be',
    'https://inv.nadeko.net',
    'https://invidious.nerdvpn.de',
    'https://invidious.io.lol',
    'https://invidious.perennialte.ch',
    'https://invidious.einfachzocken.eu',
    'https://iv.datura.network',
    'https://invidious.projectsegfau.lt',
    'https://invidious.darkness.services',
    'https://yt.drgnz.club',
  ];

  for (const instance of instances) {
    try {
      console.log(`Trying Invidious instance: ${instance}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      
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
      
      // Check for HLS URL directly
      if (data.hlsUrl) {
        console.log(`Got HLS URL from ${instance}`);
        return { 
          m3u8Url: data.hlsUrl, 
          title: data.title,
          thumbnail: data.videoThumbnails?.[0]?.url 
        };
      }

      // For live streams, construct manifest URL
      if (data.liveNow) {
        const liveUrl = `${instance}/api/manifest/hls_variant/${videoId}.m3u8`;
        console.log(`Constructed live HLS URL from ${instance}`);
        return { 
          m3u8Url: liveUrl,
          title: data.title,
          thumbnail: data.videoThumbnails?.[0]?.url 
        };
      }

      // Look for adaptive formats
      const adaptiveFormats = data.adaptiveFormats || [];
      const hlsFormat = adaptiveFormats.find((f: any) => 
        f.type?.includes('application/x-mpegURL') || 
        f.container === 'hls' ||
        f.url?.includes('.m3u8')
      );

      if (hlsFormat?.url) {
        console.log(`Got adaptive HLS format from ${instance}`);
        return { 
          m3u8Url: hlsFormat.url,
          title: data.title,
          thumbnail: data.videoThumbnails?.[0]?.url 
        };
      }

      // If video exists but no HLS, try manifest endpoint
      if (data.videoId) {
        const manifestUrl = `${instance}/api/manifest/hls_variant/${videoId}.m3u8`;
        console.log(`Video found, trying manifest URL from ${instance}`);
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
  const instances = [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.adminforge.de',
    'https://pipedapi.darkness.services',
    'https://pipedapi.drgns.space',
    'https://api.piped.projectsegfau.lt',
    'https://pipedapi.in.projectsegfau.lt',
  ];

  for (const instance of instances) {
    try {
      console.log(`Trying Piped instance: ${instance}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      
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
      
      if (data.hls) {
        console.log(`Got HLS URL from Piped ${instance}`);
        return { 
          m3u8Url: data.hls,
          title: data.title,
          thumbnail: data.thumbnailUrl 
        };
      }

      // Look for livestream URL
      if (data.livestream && data.videoStreams) {
        const hlsStream = data.videoStreams.find((s: any) => 
          s.format === 'HLS' || s.mimeType?.includes('mpegURL')
        );
        if (hlsStream?.url) {
          console.log(`Got livestream HLS from Piped ${instance}`);
          return { 
            m3u8Url: hlsStream.url,
            title: data.title,
            thumbnail: data.thumbnailUrl 
          };
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

// Try YouTube oEmbed to get basic info then construct manifest
async function tryYouTubeOEmbed(videoId: string): Promise<{ m3u8Url: string | null; title?: string; thumbnail?: string }> {
  try {
    console.log('Trying YouTube oEmbed approach...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      console.log(`YouTube oEmbed returned ${response.status}`);
      return { m3u8Url: null };
    }
    
    const data = await response.json();
    
    // If we can get oEmbed data, try to use best available Invidious for manifest
    const workingInstances = ['https://yewtu.be', 'https://invidious.nerdvpn.de', 'https://iv.datura.network'];
    
    for (const instance of workingInstances) {
      const manifestUrl = `${instance}/api/manifest/hls_variant/${videoId}.m3u8`;
      console.log(`Constructed manifest URL: ${manifestUrl}`);
      return {
        m3u8Url: manifestUrl,
        title: data.title,
        thumbnail: data.thumbnail_url
      };
    }
    
  } catch (err) {
    console.log('YouTube oEmbed failed:', err instanceof Error ? err.message : String(err));
  }
  
  return { m3u8Url: null };
}

// Main extraction function
async function getYouTubeStreamInfo(videoId: string): Promise<{ m3u8Url: string | null; title?: string; thumbnail?: string }> {
  // Try Piped first (often more reliable for HLS)
  let result = await tryPipedInstances(videoId);
  if (result.m3u8Url) {
    return result;
  }

  // Try Invidious
  result = await tryInvidiousInstances(videoId);
  if (result.m3u8Url) {
    return result;
  }

  // Try oEmbed approach as last resort
  result = await tryYouTubeOEmbed(videoId);
  if (result.m3u8Url) {
    return result;
  }

  console.log('All extraction methods failed');
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
          error: 'Could not extract M3U8 URL. The stream may not be live, is age-restricted, or external APIs are temporarily unavailable. Please try again later.' 
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
