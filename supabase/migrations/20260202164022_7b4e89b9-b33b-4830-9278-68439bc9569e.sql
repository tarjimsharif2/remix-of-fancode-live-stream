-- Add manual_m3u8 column for direct M3U8 URL input
ALTER TABLE public.youtube_streams 
ADD COLUMN manual_m3u8 TEXT;