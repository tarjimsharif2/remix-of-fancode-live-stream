import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { M3uPlaylist, M3uChannel } from '@/types/m3uPlaylist';

function parseM3u(content: string): M3uChannel[] {
  const lines = content.split('\n');
  const channels: M3uChannel[] = [];
  let currentChannel: Partial<M3uChannel> = {};

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine.startsWith('#EXTINF:')) {
      // Parse EXTINF line
      const nameMatch = trimmedLine.match(/,(.+)$/);
      const logoMatch = trimmedLine.match(/tvg-logo="([^"]+)"/);
      const groupMatch = trimmedLine.match(/group-title="([^"]+)"/);
      
      currentChannel = {
        name: nameMatch ? nameMatch[1].trim() : 'Unknown Channel',
        logo: logoMatch ? logoMatch[1] : undefined,
        group: groupMatch ? groupMatch[1] : undefined,
      };
    } else if (trimmedLine && !trimmedLine.startsWith('#') && currentChannel.name) {
      // This is the URL line
      currentChannel.url = trimmedLine;
      channels.push(currentChannel as M3uChannel);
      currentChannel = {};
    }
  }

  return channels;
}

export function useM3uChannels(slug: string | null) {
  const [playlist, setPlaylist] = useState<M3uPlaylist | null>(null);
  const [channels, setChannels] = useState<M3uChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChannels = useCallback(async () => {
    if (!slug) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch playlist info
      const { data: playlistData, error: playlistError } = await supabase
        .from('m3u_playlists')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();

      if (playlistError) {
        throw playlistError;
      }

      if (!playlistData) {
        throw new Error('Playlist not found');
      }

      setPlaylist(playlistData as M3uPlaylist);

      // Fetch M3U content
      const response = await fetch(playlistData.url);
      if (!response.ok) {
        throw new Error('Failed to fetch M3U playlist');
      }

      const content = await response.text();
      const parsedChannels = parseM3u(content);
      setChannels(parsedChannels);
    } catch (err) {
      console.error('Error fetching M3U channels:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch channels');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  return {
    playlist,
    channels,
    loading,
    error,
    refetch: fetchChannels,
  };
}
