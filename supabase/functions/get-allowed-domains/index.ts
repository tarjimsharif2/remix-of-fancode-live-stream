import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Get domain type from query params (default to 'embed')
    const url = new URL(req.url);
    const domainType = url.searchParams.get('type') || 'embed';

    // Validate domain type
    if (domainType !== 'embed' && domainType !== 'api') {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid domain type', domains: [] }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Fetch active domains of the specified type
    const { data, error } = await supabase
      .from('allowed_domains')
      .select('domain')
      .eq('is_active', true)
      .eq('domain_type', domainType);

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch domains', domains: [] }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const domains = data?.map(d => d.domain) || [];
    
    console.log(`Returning ${domains.length} ${domainType} domains`);

    return new Response(
      JSON.stringify({ success: true, domains }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60' // Cache for 1 minute
        } 
      }
    );
  } catch (error) {
    console.error('Error in get-allowed-domains:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error', domains: [] }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
