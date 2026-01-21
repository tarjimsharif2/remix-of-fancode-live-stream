-- Insert stream proxy key in app_settings (this can be updated from admin panel)
INSERT INTO public.app_settings (key, value, description)
VALUES ('stream_proxy_key', 'your-secret-key-change-this', 'API key for stream proxy access')
ON CONFLICT (key) DO NOTHING;