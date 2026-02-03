import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// M3U source URL - this auto-updates with fresh tokens
const AYNA_M3U_URL = "https://raw.githubusercontent.com/sm-monirulislam/AynaOTT-auto-update-playlist/refs/heads/main/AynaOTT.m3u";

interface M3uChannel {
  name: string;
  url: string;
  logo?: string;
  group?: string;
}

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
}

function parseM3u(content: string): M3uChannel[] {
  const lines = content.split("\n");
  const channels: M3uChannel[] = [];
  let current: Partial<M3uChannel> = {};

  for (const line of lines) {
    const t = line.trim();

    if (t.startsWith("#EXTINF:")) {
      const nameMatch = t.match(/,(.+)$/);
      const logoMatch = t.match(/tvg-logo="([^"]+)"/);
      const groupMatch = t.match(/group-title="([^"]+)"/);

      current = {
        name: nameMatch ? nameMatch[1].trim() : "Unknown Channel",
        logo: logoMatch ? logoMatch[1] : undefined,
        group: groupMatch ? groupMatch[1] : undefined,
      };
      continue;
    }

    if (t && !t.startsWith("#") && current.name) {
      current.url = t;
      channels.push(current as M3uChannel);
      current = {};
    }
  }

  return channels;
}

function convertToJsonFormat(channels: M3uChannel[]): JsonChannel[] {
  return channels.map((channel, index) => ({
    id: `ayna-${index}`,
    name: channel.name,
    title: channel.name,
    category: channel.group || "General",
    thumbnail: channel.logo || "",
    logo: channel.logo || "",
    status: "live",
    url: channel.url,
    stream_url: channel.url,
    streams: [
      {
        name: "Primary",
        url: channel.url,
      },
    ],
  }));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Add cache-busting timestamp to always get fresh M3U
    const cacheBust = Date.now();
    const m3uUrl = `${AYNA_M3U_URL}?_t=${cacheBust}`;

    console.log(`[${new Date().toISOString()}] Fetching AynaOTT M3U from: ${m3uUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(m3uUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "*/*",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to fetch M3U: ${response.status} ${response.statusText}`);
    }

    const m3uContent = await response.text();
    
    // Parse M3U
    const channels = parseM3u(m3uContent);
    console.log(`Parsed ${channels.length} channels from M3U`);

    // Convert to JSON format compatible with json_sources
    const jsonChannels = convertToJsonFormat(channels);

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
