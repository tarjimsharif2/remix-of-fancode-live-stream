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
        const formattedMatches: Match[] = data.matches.map((m, index) => {
          const inLink = m.adfree_url || m.dai_url;
          // Generate BD link by replacing 'in-mc' with 'bd-mc' in the URL
          const bdLink = inLink ? inLink.replace('in-mc-fdlive', 'bd-mc-fdlive') : undefined;
          
          return {
            id: m.match_id?.toString() || `match-${index}`,
            team1: m.team_1,
            team2: m.team_2,
            event: m.event_name,
            startTime: m.startTime || "Live Now",
            status: m.status?.toUpperCase() === 'LIVE' ? 'live' as const : 'upcoming' as const,
            thumbnail: m.src,
            streamLinkIN: inLink,
            streamLinkBD: bdLink,
            matchId: m.match_id,
            title: m.title,
            category: m.event_category,
          };
        });

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
