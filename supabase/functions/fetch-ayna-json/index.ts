import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// AynaOTT JSON API - provides fresh streams with valid tokens
// Using JSON instead of M3U for better data structure and consistent URLs
const AYNA_JSON_URL = "https://raw.githubusercontent.com/sm-monirulislam/AynaOTT-auto-update-playlist/refs/heads/main/AynaOTT.json";


interface JsonChannel {
  id: string;
  name: string;
  title: string;
  category: string;
  thumbnail: string;
  logo: string;
  status: string;
  url: string;
  stream_url: string;
  streams: { name: string; url: string }[];
  origin?: string;
  referer?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Add cache-busting timestamp to always get fresh JSON
    const cacheBust = Date.now();
    const jsonUrl = `${AYNA_JSON_URL}?_t=${cacheBust}`;

    console.log(`[${new Date().toISOString()}] Fetching AynaOTT JSON from: ${jsonUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(jsonUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch JSON: ${response.status} ${response.statusText}`);
    }

    const jsonContent = await response.json() as any;
    
    // Handle both array format and object with 'response' key
    let channels = Array.isArray(jsonContent) ? jsonContent : (jsonContent.response || []);
    
    console.log(`Fetched ${channels.length} channels from AynaOTT JSON`);

    // Ensure each channel has required fields and AynaOTT headers
    const jsonChannels: JsonChannel[] = channels.map((channel: any, index: number) => ({
      id: channel.id || `ayna-${index}`,
      name: channel.name || channel.title || "Unknown",
      title: channel.title || channel.name || "Unknown",
      category: channel.category || "General",
      thumbnail: channel.thumbnail || "",
      logo: channel.logo || channel.thumbnail || "",
      status: channel.status || "live",
      url: channel.url || channel.stream_url || "",
      stream_url: channel.stream_url || channel.url || "",
      streams: channel.streams || [
        {
          name: "Primary",
          url: channel.stream_url || channel.url || "",
        },
      ],
      // AynaOTT streams require these headers for aynascope.net domains
      origin: "https://aynaott.com",
      referer: "https://aynaott.com/",
    }));

    // Group by category for the response
    const groupedByCategory = jsonChannels.reduce((acc, channel) => {
      if (!acc[channel.category]) {
        acc[channel.category] = [];
      }
      acc[channel.category].push(channel);
      return acc;
    }, {} as Record<string, JsonChannel[]>);

    console.log(`Categories: ${Object.keys(groupedByCategory).join(", ")}`);

    return new Response(
      JSON.stringify({
        success: true,
        matches: jsonChannels,
        count: jsonChannels.length,
        categories: Object.keys(groupedByCategory),
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          // No caching - always fresh
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
