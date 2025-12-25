-- Create allowed_domains table for storing embed parent domains
CREATE TABLE public.allowed_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.allowed_domains ENABLE ROW LEVEL SECURITY;

-- RLS policy: Authenticated users can view all domains
CREATE POLICY "Authenticated users can view domains"
ON public.allowed_domains
FOR SELECT
TO authenticated
USING (true);

-- RLS policy: Authenticated users can insert domains
CREATE POLICY "Authenticated users can insert domains"
ON public.allowed_domains
FOR INSERT
TO authenticated
WITH CHECK (true);

-- RLS policy: Authenticated users can update domains
CREATE POLICY "Authenticated users can update domains"
ON public.allowed_domains
FOR UPDATE
TO authenticated
USING (true);

-- RLS policy: Authenticated users can delete domains
CREATE POLICY "Authenticated users can delete domains"
ON public.allowed_domains
FOR DELETE
TO authenticated
USING (true);

-- Public read access for edge function (active domains only)
CREATE POLICY "Public can read active domains"
ON public.allowed_domains
FOR SELECT
TO anon
USING (is_active = true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_allowed_domains_updated_at
BEFORE UPDATE ON public.allowed_domains
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default domains
INSERT INTO public.allowed_domains (domain, description, is_active) VALUES
  ('cricfoots.com', 'Main cricket streaming site', true),
  ('www.cricfoots.com', 'Main cricket streaming site (www)', true),
  ('eplayhd.com', 'ePlayHD streaming site', true),
  ('www.eplayhd.com', 'ePlayHD streaming site (www)', true),
  ('eplayhdtv.site', 'ePlayHD TV streaming site', true),
  ('www.eplayhdtv.site', 'ePlayHD TV streaming site (www)', true);