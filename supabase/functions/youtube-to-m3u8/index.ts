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
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  // Check if it's already just a video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
    return url;
  }

  return null;
}

// Fetch YouTube page and extract HLS manifest URL
async function getM3u8Url(videoId: string): Promise<{ success: boolean; m3u8Url?: string; error?: string; title?: string }> {
  try {
    // Fetch the YouTube watch page
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(watchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      return { success: false, error: `Failed to fetch YouTube page: ${response.status}` };
    }

    const html = await response.text();

    // Extract title
    const titleMatch = html.match(/<title>([^<]+)<\/title>/);
    const title = titleMatch ? titleMatch[1].replace(' - YouTube', '').trim() : 'YouTube Live';

    // Check if it's a live stream
    if (!html.includes('"isLive":true') && !html.includes('"isLiveContent":true')) {
      return { success: false, error: 'This video is not a live stream' };
    }

    // Try to extract HLS manifest URL from the page
    // Method 1: Look for hlsManifestUrl in the page data
    const hlsMatch = html.match(/"hlsManifestUrl"\s*:\s*"([^"]+)"/);
    if (hlsMatch) {
      const m3u8Url = hlsMatch[1].replace(/\\u0026/g, '&');
      return { success: true, m3u8Url, title };
    }

    // Method 2: Look in ytInitialPlayerResponse
    const playerResponseMatch = html.match(/var ytInitialPlayerResponse\s*=\s*({.+?});/s);
    if (playerResponseMatch) {
      try {
        // Find hlsManifestUrl in the JSON-like string
        const jsonStr = playerResponseMatch[1];
        const hlsInJson = jsonStr.match(/"hlsManifestUrl"\s*:\s*"([^"]+)"/);
        if (hlsInJson) {
          const m3u8Url = hlsInJson[1].replace(/\\u0026/g, '&');
          return { success: true, m3u8Url, title };
        }
      } catch (e) {
        console.error('Error parsing player response:', e);
      }
    }

    // Method 3: Check if video is unavailable
    if (html.includes('Video unavailable') || html.includes('"playabilityStatus":{"status":"ERROR"')) {
      return { success: false, error: 'Video is unavailable or private' };
    }

    if (html.includes('"playabilityStatus":{"status":"LOGIN_REQUIRED"')) {
      return { success: false, error: 'This video requires login to view' };
    }

    if (html.includes('"playabilityStatus":{"status":"UNPLAYABLE"')) {
      return { success: false, error: 'This video is not playable' };
    }

    return { success: false, error: 'Could not find HLS manifest. The stream may not be available or is age-restricted.' };
  } catch (error) {
    console.error('Error fetching YouTube data:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'YouTube URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid YouTube URL or video ID' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Extracting M3U8 for video ID:', videoId);

    const result = await getM3u8Url(videoId);

    if (!result.success) {
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully extracted M3U8 URL');

    return new Response(
      JSON.stringify({
        success: true,
        videoId,
        title: result.title,
        m3u8Url: result.m3u8Url,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
