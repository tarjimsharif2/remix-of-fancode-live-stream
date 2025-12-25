import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Match, FancodeResponse } from "@/types/match";

export const useMatches = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchMatches = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke<FancodeResponse>('fetch-matches');

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (data?.success && data.matches) {
        const formattedMatches: Match[] = data.matches.map((m, index) => ({
          id: m.match_id?.toString() || `match-${index}`,
          team1: m.team_1,
          team2: m.team_2,
          team1Flag: m.team_1_flag,
          team2Flag: m.team_2_flag,
          event: m.event_name,
          startTime: "Live Now",
          status: 'live' as const,
          thumbnail: m.banner,
          streamLink: m.stream_link,
          matchId: m.match_id,
        }));

        setMatches(formattedMatches);
        setLastUpdated(data.lastUpdated);
      } else {
        setError(data?.error || "Failed to fetch matches");
      }
    } catch (err) {
      console.error("Error fetching matches:", err);
      setError(err instanceof Error ? err.message : "Failed to load matches");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, []);

  return { matches, loading, error, lastUpdated, refetch: fetchMatches };
};
