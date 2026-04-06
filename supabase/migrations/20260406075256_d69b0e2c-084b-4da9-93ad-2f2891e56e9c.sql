
-- Add slug column
ALTER TABLE public.custom_channels ADD COLUMN slug text;

-- Generate slugs for existing channels
-- First, create a function to generate slug from name
CREATE OR REPLACE FUNCTION public.generate_channel_slug(channel_name text)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN lower(regexp_replace(regexp_replace(trim(channel_name), '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
END;
$$;

-- Update existing channels with slugs, handling duplicates
DO $$
DECLARE
  rec RECORD;
  base_slug text;
  final_slug text;
  counter int;
BEGIN
  FOR rec IN SELECT id, name FROM public.custom_channels ORDER BY created_at ASC LOOP
    base_slug := lower(regexp_replace(regexp_replace(trim(rec.name), '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
    IF base_slug = '' THEN
      base_slug := 'channel';
    END IF;
    
    -- Check if slug already exists
    IF NOT EXISTS (SELECT 1 FROM public.custom_channels WHERE slug = base_slug) THEN
      final_slug := base_slug;
    ELSE
      counter := 1;
      LOOP
        final_slug := base_slug || '-' || counter;
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.custom_channels WHERE slug = final_slug);
        counter := counter + 1;
      END LOOP;
    END IF;
    
    UPDATE public.custom_channels SET slug = final_slug WHERE id = rec.id;
  END LOOP;
END;
$$;

-- Now make slug NOT NULL and UNIQUE
ALTER TABLE public.custom_channels ALTER COLUMN slug SET NOT NULL;
ALTER TABLE public.custom_channels ADD CONSTRAINT custom_channels_slug_unique UNIQUE (slug);

-- Drop the helper function
DROP FUNCTION public.generate_channel_slug;
