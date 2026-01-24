-- Create table for managing multiple JSON data sources
CREATE TABLE public.json_sources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.json_sources ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view active sources"
ON public.json_sources
FOR SELECT
USING (is_active = true);

CREATE POLICY "Authenticated users can view all sources"
ON public.json_sources
FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert sources"
ON public.json_sources
FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update sources"
ON public.json_sources
FOR UPDATE
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete sources"
ON public.json_sources
FOR DELETE
USING (auth.role() = 'authenticated');

-- Trigger for updated_at
CREATE TRIGGER update_json_sources_updated_at
BEFORE UPDATE ON public.json_sources
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default FanCode source
INSERT INTO public.json_sources (name, slug, url, description, display_order)
VALUES (
  'FanCode',
  'fancode',
  'https://raw.githubusercontent.com/drmlive/fancode-live-events/main/fancode.json',
  'FanCode Live Sports Events',
  0
);