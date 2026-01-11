import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_DATA_URL = 'https://raw.githubusercontent.com/abusaeeidx/CricHd-playlists-Auto-Update-permanent/refs/heads/main/api.json';

// Rate limiting
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

interface CricHdChannel {
  name: string;
  id: string;
  logo: string;
  link: string;
  referer: string;
  origin: string;
}

function validateChannel(channel: unknown): CricHdChannel | null {
  if (!channel || typeof channel !== 'object') return null;
  
  const c = channel as Record<string, unknown>;
  
  if (typeof c.id !== 'string' || !c.id) return null;
  if (typeof c.link !== 'string' || !c.link) return null;
  
  return {
    name: sanitizeString(c.name, 100) || 'Unknown Channel',
    id: sanitizeString(c.id, 50),
    logo: typeof c.logo === 'string' ? c.logo : '',
    link: typeof c.link === 'string' ? c.link : '',
    referer: typeof c.referer === 'string' ? c.referer : '',
    origin: typeof c.origin === 'string' ? c.origin : '',
  };
}

function validateAndSanitizeResponse(data: unknown): { channels: CricHdChannel[] } {
  const result: { channels: CricHdChannel[] } = {
    channels: [],
  };
  
  if (!Array.isArray(data)) {
    return result;
  }
  
  for (const channel of data) {
    const validated = validateChannel(channel);
    if (validated) {
      result.channels.push(validated);
    }
  }
  
  return result;
}

// Fetch allowed API origins from database
async function fetchAllowedOrigins(supabase: any): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('allowed_domains')
      .select('domain')
      .eq('is_active', true)
      .in('domain_type', ['api', 'embed']);

    if (error) {
      console.error('Failed to fetch allowed origins from database:', error);
      return [];
    }

    return data?.map((d: { domain: string }) => d.domain) || [];
  } catch (err) {
    console.error('Error fetching allowed origins:', err);
    return [];
  }
}

// Fetch data source URL from database
async function fetchDataSourceUrl(supabase: any): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'crichd_data_source_url')
      .single();

    if (error || !data?.value) {
      console.log('Using default CricHd data source URL');
      return DEFAULT_DATA_URL;
    }

    return data.value;
  } catch (err) {
    console.error('Error fetching CricHd data source URL:', err);
    return DEFAULT_DATA_URL;
  }
}

function isAllowedOrigin(origin: string | null, allowedDomains: string[]): boolean {
  if (!origin) return false;
  
  try {
    const originUrl = new URL(origin);
    const hostname = originUrl.hostname;
    
    if (hostname.includes('localhost') || 
        hostname.includes('127.0.0.1') || 
        hostname.includes('lovableproject.com') || 
        hostname.includes('lovable.app') || 
        hostname.includes('vercel.app')) {
      return true;
    }
    
    return allowedDomains.some(domain => 
      hostname === domain || hostname.endsWith('.' + domain)
    );
  } catch {
    return false;
  }
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
        channels: [],
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    const allowedDomains = await fetchAllowedOrigins(supabase);
    console.log(`Loaded ${allowedDomains.length} allowed API origins from database`);
    
    const origin = req.headers.get('origin');
    const referer = req.headers.get('referer');
    
    let isAllowed = isAllowedOrigin(origin, allowedDomains);
    
    if (!isAllowed && referer) {
      try {
        const refererUrl = new URL(referer);
        isAllowed = isAllowedOrigin(refererUrl.origin, allowedDomains);
      } catch {
        // Invalid referer
      }
    }
    
    if (!isAllowed) {
      console.log(`Unauthorized request from origin: ${origin}, referer: ${referer}`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized',
        channels: [],
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const dataSourceUrl = await fetchDataSourceUrl(supabase);
    // Add cache-busting parameter to bypass CDN/GitHub caching
    const cacheBustUrl = new URL(dataSourceUrl);
    cacheBustUrl.searchParams.set('_t', Date.now().toString());
    console.log(`Fetching CricHd data from: ${cacheBustUrl.toString()}`);
    
    const response = await fetch(cacheBustUrl.toString(), {
      headers: { 
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
    
    if (!response.ok) {
      throw new Error('External fetch failed');
    }

    const rawData = await response.json();
    const validatedData = validateAndSanitizeResponse(rawData);

    return new Response(JSON.stringify({
      success: true,
      totalChannels: validatedData.channels.length,
      channels: validatedData.channels,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('Error in fetch-crichd-channels:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Service unavailable',
      channels: [],
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
