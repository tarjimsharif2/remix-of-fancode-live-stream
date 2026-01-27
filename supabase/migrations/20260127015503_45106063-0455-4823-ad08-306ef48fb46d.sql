-- Add default_player column to json_sources for per-source player configuration
ALTER TABLE public.json_sources 
ADD COLUMN IF NOT EXISTS default_player TEXT DEFAULT 'clappr';

-- Add comment for documentation
COMMENT ON COLUMN public.json_sources.default_player IS 'Default player type for this source: clappr, hlsjs, iframe, native';