import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { M3uPlaylist } from '@/types/m3uPlaylist';

export function useM3uPlaylists() {
  const [playlists, setPlaylists] = useState<M3uPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlaylists = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('m3u_playlists')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      setPlaylists((data || []) as M3uPlaylist[]);
    } catch (err) {
      console.error('Error fetching M3U playlists:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch playlists');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  return {
    playlists,
    loading,
    error,
    refetch: fetchPlaylists,
  };
}
