-- Add CricHd data source URL setting
INSERT INTO public.app_settings (key, value, description)
VALUES ('crichd_data_source_url', 'https://raw.githubusercontent.com/abusaeeidx/CricHd-playlists-Auto-Update-permanent/refs/heads/main/api.json', 'CricHd channels data source JSON URL')
ON CONFLICT (key) DO NOTHING;