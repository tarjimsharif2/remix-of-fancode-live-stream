-- Create app_settings table for configurable settings
CREATE TABLE public.app_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to manage settings
CREATE POLICY "Authenticated users can view settings" 
ON public.app_settings 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can update settings" 
ON public.app_settings 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert settings" 
ON public.app_settings 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Allow edge functions to read settings (anon role for public access)
CREATE POLICY "Public can read settings" 
ON public.app_settings 
FOR SELECT 
TO anon
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default data source URL
INSERT INTO public.app_settings (key, value, description)
VALUES ('data_source_url', 'https://raw.githubusercontent.com/drmlive/fancode-live-events/main/fancode.json', 'GitHub JSON URL for fetching match data');