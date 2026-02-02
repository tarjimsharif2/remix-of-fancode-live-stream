const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface YouTubeFormat {
  url: string;
  format_id: string;
  ext: string;
  protocol?: string;
  acodec?: string;
  vcodec?: string;
}

interface YouTubeInfo {
  formats?: YouTubeFormat[];
  is_live?: boolean;
  title?: string;
  thumbnail?: string;
}

// Extract video ID from various YouTube URL formats
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/live\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Use yt-dlp compatible API to get stream info
async function getYouTubeStreamInfo(videoId: string): Promise<{ m3u8Url: string | null; title?: string; thumbnail?: string }> {
  try {
    // Try cobalt.tools API first (free, no API key needed)
    const cobaltResponse = await fetch('https://api.cobalt.tools/api/json', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: `https://www.youtube.com/watch?v=${videoId}`,
        isAudioOnly: false,
        aFormat: 'best',
        vQuality: '1080',
      }),
    });

    if (cobaltResponse.ok) {
      const cobaltData = await cobaltResponse.json();
      if (cobaltData.url) {
        console.log('Got stream URL from cobalt:', cobaltData.url);
        return { m3u8Url: cobaltData.url };
      }
    }
  } catch (err) {
    console.log('Cobalt API failed, trying alternative methods:', err);
  }

  try {
    // Try invidious API (multiple instances available)
    const invidiousInstances = [
      'https://vid.puffyan.us',
      'https://invidious.snopyta.org',
      'https://yewtu.be',
      'https://invidious.kavin.rocks',
    ];

    for (const instance of invidiousInstances) {
      try {
        const response = await fetch(`${instance}/api/v1/videos/${videoId}`, {
          headers: { 'Accept': 'application/json' },
        });

        if (response.ok) {
          const data = await response.json();
          
          // Look for HLS format
          if (data.hlsUrl) {
            console.log('Got HLS URL from invidious:', data.hlsUrl);
            return { 
              m3u8Url: data.hlsUrl, 
              title: data.title,
              thumbnail: data.videoThumbnails?.[0]?.url 
            };
          }

          // Look for adaptive formats with m3u8
          const adaptiveFormats = data.adaptiveFormats || [];
          const hlsFormat = adaptiveFormats.find((f: any) => 
            f.type?.includes('application/x-mpegURL') || 
            f.url?.includes('.m3u8')
          );

          if (hlsFormat?.url) {
            console.log('Got adaptive HLS format from invidious');
            return { 
              m3u8Url: hlsFormat.url,
              title: data.title,
              thumbnail: data.videoThumbnails?.[0]?.url 
            };
          }

          // For live streams, construct HLS URL
          if (data.liveNow) {
            const liveUrl = `${instance}/api/manifest/hls_variant/${videoId}.m3u8`;
            console.log('Constructed live HLS URL:', liveUrl);
            return { 
              m3u8Url: liveUrl,
              title: data.title,
              thumbnail: data.videoThumbnails?.[0]?.url 
            };
          }
        }
      } catch (instanceErr) {
        console.log(`Invidious instance ${instance} failed:`, instanceErr);
        continue;
      }
    }
  } catch (err) {
    console.log('All invidious instances failed:', err);
  }

  // Try piped API as fallback
  try {
    const pipedInstances = [
      'https://pipedapi.kavin.rocks',
      'https://api.piped.privacydev.net',
    ];

    for (const instance of pipedInstances) {
      try {
        const response = await fetch(`${instance}/streams/${videoId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.hls) {
            console.log('Got HLS URL from piped:', data.hls);
            return { 
              m3u8Url: data.hls,
              title: data.title,
              thumbnail: data.thumbnailUrl 
            };
          }
        }
      } catch (pipedErr) {
        console.log(`Piped instance ${instance} failed:`, pipedErr);
        continue;
      }
    }
  } catch (err) {
    console.log('All piped instances failed:', err);
  }

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
          error: 'Could not extract M3U8 URL. The stream may not be live or is unavailable.' 
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
