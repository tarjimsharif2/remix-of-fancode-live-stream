import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type M3uChannel = {
  name: string;
  url: string;
  logo?: string;
  group?: string;
};

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const slug = (body?.slug ?? "").toString();
    const cacheBust = body?.cacheBust ? String(body.cacheBust) : "";

    if (!slug) {
      return new Response(JSON.stringify({ error: "Missing slug" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Internal DB fetch (service role), still respects table flags.
    const playlistRes = await fetch(`${supabaseUrl}/rest/v1/m3u_playlists?slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&select=*`, {
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
      },
    });

    if (!playlistRes.ok) {
      const txt = await playlistRes.text().catch(() => "");
      return new Response(JSON.stringify({ error: "Failed to load playlist", details: txt }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const playlists = (await playlistRes.json()) as any[];
    const playlist = playlists?.[0];
    if (!playlist?.url) {
      return new Response(JSON.stringify({ error: "Playlist not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const m3uUrl = new URL(playlist.url);
    if (cacheBust) m3uUrl.searchParams.set("_t", cacheBust);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(m3uUrl.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": req.headers.get("user-agent") ?? "Mozilla/5.0",
        Accept: "*/*",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    }).catch((e) => {
      throw new Error(e?.name === "AbortError" ? "M3U_FETCH_TIMEOUT" : "M3U_FETCH_FAILED");
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return new Response(
        JSON.stringify({
          error: "Failed to fetch M3U",
          status: res.status,
          statusText: res.statusText,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const content = await res.text();
    const channels = parseM3u(content);

    return new Response(JSON.stringify({ playlist, channels }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: "Internal error", details: e?.message ?? String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
