-- Add link_prefixes column to json_sources table for per-source prefix configuration
ALTER TABLE public.json_sources 
ADD COLUMN IF NOT EXISTS link_prefixes JSONB DEFAULT '{}'::jsonb;

-- Comment for clarity
COMMENT ON COLUMN public.json_sources.link_prefixes IS 'Per-link proxy prefixes. Format: {"1": "https://proxy1/", "2": "https://proxy2/"}';
