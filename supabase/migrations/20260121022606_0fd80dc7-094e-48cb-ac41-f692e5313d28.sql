-- Create m3u_playlists table
CREATE TABLE public.m3u_playlists (
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
ALTER TABLE public.m3u_playlists ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view active playlists" 
ON public.m3u_playlists 
FOR SELECT 
USING (is_active = true);

CREATE POLICY "Authenticated users can view all playlists" 
ON public.m3u_playlists 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert playlists" 
ON public.m3u_playlists 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update playlists" 
ON public.m3u_playlists 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete playlists" 
ON public.m3u_playlists 
FOR DELETE 
TO authenticated
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_m3u_playlists_updated_at
BEFORE UPDATE ON public.m3u_playlists
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();