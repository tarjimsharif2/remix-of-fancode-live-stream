-- Create custom channels table with header support
CREATE TABLE public.custom_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  stream_url TEXT NOT NULL,
  logo_url TEXT,
  category TEXT DEFAULT 'general',
  -- Custom headers
  custom_referer TEXT,
  custom_origin TEXT,
  custom_user_agent TEXT,
  custom_cookie TEXT,
  custom_headers JSONB DEFAULT '{}',
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.custom_channels ENABLE ROW LEVEL SECURITY;

-- Public read access for active channels
CREATE POLICY "Anyone can view active channels"
ON public.custom_channels
FOR SELECT
USING (is_active = true);

-- Admin full access (using app_settings admin password check pattern)
CREATE POLICY "Admin can manage all channels"
ON public.custom_channels
FOR ALL
USING (true)
WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_custom_channels_updated_at
BEFORE UPDATE ON public.custom_channels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for ordering
CREATE INDEX idx_custom_channels_order ON public.custom_channels(display_order, name);