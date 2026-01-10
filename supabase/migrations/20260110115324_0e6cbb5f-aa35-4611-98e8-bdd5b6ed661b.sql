-- Create referrer_domains table for managing allowed referrer domains
CREATE TABLE public.referrer_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.referrer_domains ENABLE ROW LEVEL SECURITY;

-- Only authenticated users (admins) can manage referrer domains
CREATE POLICY "Authenticated users can view referrer domains" 
ON public.referrer_domains 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert referrer domains" 
ON public.referrer_domains 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update referrer domains" 
ON public.referrer_domains 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete referrer domains" 
ON public.referrer_domains 
FOR DELETE 
TO authenticated
USING (true);

-- Allow anonymous users to read active referrer domains (for frontend validation)
CREATE POLICY "Anyone can view active referrer domains"
ON public.referrer_domains
FOR SELECT
TO anon
USING (is_active = true);

-- Create index for faster lookups
CREATE INDEX idx_referrer_domains_domain ON public.referrer_domains(domain);
CREATE INDEX idx_referrer_domains_active ON public.referrer_domains(is_active);

-- Create trigger for updated_at
CREATE TRIGGER update_referrer_domains_updated_at
BEFORE UPDATE ON public.referrer_domains
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();