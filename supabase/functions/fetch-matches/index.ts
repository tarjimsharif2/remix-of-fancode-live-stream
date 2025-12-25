import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Allowed origins for CORS and domain validation (exact matches only)
const ALLOWED_ORIGINS = [
  'https://cricfoots.com',
  'https://www.cricfoots.com',
  'https://eplayhd.com',
  'https://www.eplayhd.com',
];

// Allowed stream URL domain patterns (must be exact domain or subdomain)
const ALLOWED_STREAM_DOMAIN_PATTERNS = [
  /^([a-z0-9-]+\.)*fdlive\.[a-z]+$/i,
  /^([a-z0-9-]+\.)*fancode\.[a-z]+$/i,
  /^([a-z0-9-]+\.)*hotstar\.[a-z]+$/i,
];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FANCODE_DATA_URL = 'https://raw.githubusercontent.com/drmlive/fancode-live-events/main/fancode.json';

// Rate limiting - note: resets on cold start, provides basic protection only
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60000;
const RATE_LIMIT_MAX = 30;

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

function sanitizeString(value: unknown, maxLength: number = 200): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[<>]/g, '')
    .slice(0, maxLength)
    .trim();
}

// Validate URL with strict domain pattern matching
function validateStreamUrl(url: unknown): string | null {
  if (typeof url !== 'string' || !url) return null;
  
  try {
    const parsed = new URL(url);
    
    // Strict hostname validation - must match allowed patterns exactly
    const isValidDomain = ALLOWED_STREAM_DOMAIN_PATTERNS.some(pattern => 
      pattern.test(parsed.hostname)
    );
    
    if (!isValidDomain) {
      return null;
    }
    
    // Ensure HTTPS only
    if (parsed.protocol !== 'https:') {
      return null;
    }
    
    return url;
  } catch {
    return null;
  }
}

function validateMatch(match: unknown): Record<string, unknown> | null {
  if (!match || typeof match !== 'object') return null;
  
  const m = match as Record<string, unknown>;
  
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
    adfree_url: validateStreamUrl(m.adfree_url),
    dai_url: validateStreamUrl(m.dai_url),
  };
}

function validateAndSanitizeResponse(data: unknown): { matches: Record<string, unknown>[]; lastUpdated: string | null } {
  const result: { matches: Record<string, unknown>[]; lastUpdated: string | null } = {
    matches: [],
    lastUpdated: null,
  };
  
  if (!data || typeof data !== 'object') {
    return result;
  }
  
  const d = data as Record<string, unknown>;
  
  if (typeof d['last update time'] === 'string') {
    result.lastUpdated = sanitizeString(d['last update time'], 100);
  }
  
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
  
  // Development mode
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    return true;
  }
  
  // Exact origin match only
  return ALLOWED_ORIGINS.includes(origin);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('cf-connecting-ip') || 
                     'unknown';
    
    if (!checkRateLimit(clientIp)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Too many requests',
        matches: [],
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const origin = req.headers.get('origin');
    const referer = req.headers.get('referer');
    
    let isAllowed = isAllowedOrigin(origin);
    
    if (!isAllowed && referer) {
      try {
        const refererUrl = new URL(referer);
        isAllowed = isAllowedOrigin(refererUrl.origin);
      } catch {
        // Invalid referer
      }
    }
    
    if (!isAllowed) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized',
        matches: [],
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const response = await fetch(FANCODE_DATA_URL, {
      headers: { 'Cache-Control': 'no-cache' },
    });
    
    if (!response.ok) {
      throw new Error('External fetch failed');
    }

    const rawData = await response.json();
    const validatedData = validateAndSanitizeResponse(rawData);

    return new Response(JSON.stringify({
      success: true,
      totalMatches: validatedData.matches.length,
      lastUpdated: validatedData.lastUpdated,
      matches: validatedData.matches,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Service unavailable',
      matches: [],
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
