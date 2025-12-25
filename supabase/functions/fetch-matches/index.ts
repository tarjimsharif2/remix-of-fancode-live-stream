import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Allowed origins for CORS and domain validation
const ALLOWED_ORIGINS = [
  'https://cricfoots.com',
  'https://www.cricfoots.com',
  'https://eplayhd.com',
  'https://www.eplayhd.com',
];

// Allowed stream URL domains for validation
const ALLOWED_STREAM_DOMAINS = [
  'fdlive',
  'fancode',
  'hotstar',
];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-origin-host',
};

const FANCODE_DATA_URL = 'https://raw.githubusercontent.com/drmlive/fancode-live-events/main/fancode.json';

// Simple rate limiting using in-memory store (resets on cold start)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 30; // 30 requests per minute per IP

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  entry.count++;
  return true;
}

// Validate and sanitize string fields
function sanitizeString(value: unknown, maxLength: number = 200): string {
  if (typeof value !== 'string') return '';
  // Remove potentially dangerous characters and limit length
  return value
    .replace(/[<>]/g, '') // Remove < > to prevent HTML injection
    .slice(0, maxLength)
    .trim();
}

// Validate URL matches expected stream domains
function validateStreamUrl(url: unknown): string | null {
  if (typeof url !== 'string' || !url) return null;
  
  try {
    const parsed = new URL(url);
    // Check if URL hostname contains an allowed domain
    const isValidDomain = ALLOWED_STREAM_DOMAINS.some(domain => 
      parsed.hostname.includes(domain)
    );
    
    if (!isValidDomain) {
      console.warn(`Rejected stream URL with unexpected domain: ${parsed.hostname}`);
      return null;
    }
    
    // Ensure it's HTTPS
    if (parsed.protocol !== 'https:') {
      console.warn(`Rejected non-HTTPS stream URL: ${url}`);
      return null;
    }
    
    return url;
  } catch {
    console.warn(`Invalid URL format: ${url}`);
    return null;
  }
}

// Validate and sanitize a single match object
function validateMatch(match: unknown): Record<string, unknown> | null {
  if (!match || typeof match !== 'object') return null;
  
  const m = match as Record<string, unknown>;
  
  // Validate match_id is a number
  if (typeof m.match_id !== 'number' || !Number.isFinite(m.match_id)) {
    return null;
  }
  
  return {
    match_id: m.match_id,
    team_1: sanitizeString(m.team_1, 100),
    team_2: sanitizeString(m.team_2, 100),
    event_name: sanitizeString(m.event_name, 200),
    status: sanitizeString(m.status, 50),
    start_time: sanitizeString(m.start_time, 50),
    venue: sanitizeString(m.venue, 200),
    // Validate stream URLs
    adfree_url: validateStreamUrl(m.adfree_url),
    dai_url: validateStreamUrl(m.dai_url),
  };
}

// Validate the entire response from external source
function validateAndSanitizeResponse(data: unknown): { matches: Record<string, unknown>[]; lastUpdated: string | null } {
  const result: { matches: Record<string, unknown>[]; lastUpdated: string | null } = {
    matches: [],
    lastUpdated: null,
  };
  
  if (!data || typeof data !== 'object') {
    console.warn('Invalid response structure from external source');
    return result;
  }
  
  const d = data as Record<string, unknown>;
  
  // Validate last update time
  if (typeof d['last update time'] === 'string') {
    result.lastUpdated = sanitizeString(d['last update time'], 100);
  }
  
  // Validate matches array
  if (Array.isArray(d.matches)) {
    for (const match of d.matches) {
      const validated = validateMatch(match);
      if (validated) {
        result.matches.push(validated);
      }
    }
  }
  
  return result;
}

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  
  // Allow localhost for development
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    return true;
  }
  
  return ALLOWED_ORIGINS.some(allowed => origin === allowed || origin.endsWith(allowed.replace('https://', '.')));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP for rate limiting
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';
    
    // Check rate limit
    if (!checkRateLimit(clientIp)) {
      console.warn(`Rate limit exceeded for IP: ${clientIp}`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Rate limit exceeded. Please try again later.',
        matches: [],
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Validate origin for domain restriction
    const origin = req.headers.get('origin');
    const referer = req.headers.get('referer');
    
    // Check if request is from allowed origin
    let isAllowed = isAllowedOrigin(origin);
    
    // Also check referer as fallback
    if (!isAllowed && referer) {
      try {
        const refererUrl = new URL(referer);
        isAllowed = isAllowedOrigin(refererUrl.origin);
      } catch {
        // Invalid referer URL
      }
    }
    
    if (!isAllowed) {
      console.warn(`Unauthorized origin: ${origin || 'none'}, referer: ${referer || 'none'}, IP: ${clientIp}`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized domain',
        matches: [],
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log(`Fetching matches from Fancode... Origin: ${origin}, IP: ${clientIp}`);
    
    const response = await fetch(FANCODE_DATA_URL, {
      headers: {
        'Cache-Control': 'no-cache',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const rawData = await response.json();
    
    // Validate and sanitize the external data
    const validatedData = validateAndSanitizeResponse(rawData);
    
    console.log(`Fetched and validated ${validatedData.matches.length} matches`);

    return new Response(JSON.stringify({
      success: true,
      totalMatches: validatedData.matches.length,
      lastUpdated: validatedData.lastUpdated,
      matches: validatedData.matches,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error fetching matches:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch matches',
      matches: [],
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
