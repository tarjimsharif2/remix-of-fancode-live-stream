import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Extract array from various JSON wrapper structures
const extractDataArray = (data: unknown): unknown[] => {
  if (!data) return [];
  
  if (Array.isArray(data)) {
    return data;
  }
  
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    
    // Common wrapper field names
    const wrapperFields = [
      'matches', 'events', 'data', 'items', 'results', 
      'channels', 'streams', 'content', 'list', 'games',
      'response', 'payload', 'records', 'entries'
    ];
    
    for (const field of wrapperFields) {
      if (obj[field]) {
        if (Array.isArray(obj[field])) {
          return obj[field] as unknown[];
        }
        // Try nested extraction
        const nested = extractDataArray(obj[field]);
        if (nested.length > 0) return nested;
      }
    }
    
    // If single object with stream-like properties, wrap it
    if (obj.url || obj.stream_url || obj.title || obj.name) {
      return [obj];
    }
  }
  
  return [];
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetching JSON from: ${url}`);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";
    let data: unknown;
    
    // Handle different content types
    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      // Try parsing as JSON anyway
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("Response is not valid JSON");
      }
    }

    // Extract array from any structure
    const items = extractDataArray(data);

    console.log(`Extracted ${items.length} items from source`);

    return new Response(
      JSON.stringify({
        success: true,
        matches: items,
        count: items.length,
        rawStructure: typeof data === 'object' && data !== null 
          ? Object.keys(data as Record<string, unknown>).slice(0, 10) 
          : typeof data,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60",
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
