-- Create youtube_streams table for managing YouTube Live channels
CREATE TABLE public.youtube_streams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  youtube_url TEXT NOT NULL,
  logo_url TEXT,
  category TEXT DEFAULT 'general',
  cached_m3u8 TEXT,
  last_fetched_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.youtube_streams ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view active youtube streams"
ON public.youtube_streams
FOR SELECT
USING (is_active = true);

CREATE POLICY "Authenticated users can view all youtube streams"
ON public.youtube_streams
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert youtube streams"
ON public.youtube_streams
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update youtube streams"
ON public.youtube_streams
FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete youtube streams"
ON public.youtube_streams
FOR DELETE
USING (auth.role() = 'authenticated');

-- Add updated_at trigger
CREATE TRIGGER update_youtube_streams_updated_at
BEFORE UPDATE ON public.youtube_streams
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();