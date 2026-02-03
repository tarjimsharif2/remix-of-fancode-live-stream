-- Add default_player column to m3u_playlists table
ALTER TABLE public.m3u_playlists 
ADD COLUMN IF NOT EXISTS default_player text DEFAULT 'hlsjs';