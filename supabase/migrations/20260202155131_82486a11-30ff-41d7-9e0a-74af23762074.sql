-- Add player_type column to custom_channels table
ALTER TABLE public.custom_channels 
ADD COLUMN player_type text DEFAULT 'clappr';

-- Add comment for clarity
COMMENT ON COLUMN public.custom_channels.player_type IS 'Video player type: clappr, hlsjs, iframe, native';