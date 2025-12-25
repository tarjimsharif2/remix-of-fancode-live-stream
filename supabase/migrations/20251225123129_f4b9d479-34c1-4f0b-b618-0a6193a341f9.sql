-- Add type column to distinguish between embed and API domains
ALTER TABLE public.allowed_domains 
ADD COLUMN domain_type TEXT NOT NULL DEFAULT 'embed' 
CHECK (domain_type IN ('embed', 'api'));

-- Update existing domains to be 'embed' type (already done by default)

-- Insert API origin domains
INSERT INTO public.allowed_domains (domain, description, is_active, domain_type) VALUES
  ('cricfoots.com', 'Main cricket streaming site (API)', true, 'api'),
  ('www.cricfoots.com', 'Main cricket streaming site www (API)', true, 'api'),
  ('eplayhd.com', 'ePlayHD streaming site (API)', true, 'api'),
  ('www.eplayhd.com', 'ePlayHD streaming site www (API)', true, 'api'),
  ('eplayhdtv.site', 'ePlayHD TV streaming site (API)', true, 'api'),
  ('www.eplayhdtv.site', 'ePlayHD TV streaming site www (API)', true, 'api')
ON CONFLICT (domain) DO NOTHING;

-- Create index for faster type-based queries
CREATE INDEX idx_allowed_domains_type ON public.allowed_domains(domain_type);