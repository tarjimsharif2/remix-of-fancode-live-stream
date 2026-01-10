import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CricHdChannel, CricHdResponse } from "@/types/crichd";

export const useCricHdChannels = () => {
  const [channels, setChannels] = useState<CricHdChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChannels = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke<CricHdResponse>('fetch-crichd-channels');

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.success && data.channels) {
        setChannels(data.channels);
      } else {
        setError(data?.error || "Failed to fetch channels");
      }
    } catch (err) {
      console.error("Error fetching CricHd channels:", err);
      setError(err instanceof Error ? err.message : "Failed to load channels");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels();
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(() => {
      fetchChannels();
    }, 300000);
    
    return () => clearInterval(interval);
  }, []);

  return { channels, loading, error, refetch: fetchChannels };
};
