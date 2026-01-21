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
      // Guard against requests that can hang (network/proxy issues)
      const timeoutMs = 12000;
      const result = await Promise.race([
        supabase.functions.invoke<FancodeResponse>('fetch-matches'),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout. Please try again.')), timeoutMs)
        ),
      ]);

      const { data, error: fnError } = result;

      if (fnError) {
        throw new Error(fnError.message);
      }

      // Some deployments return { matches, lastUpdated } without a `success` flag.
      const matchesArr = (data as any)?.matches;
      const lastUpdatedVal = (data as any)?.lastUpdated;

      if (Array.isArray(matchesArr)) {
        const formattedMatches: Match[] = matchesArr.map((m: any, index: number) => {
          const inLink = m.adfree_url || m.dai_url;
          // Generate BD link by replacing 'in-mc' with 'bd-mc' in the URL
          const bdLink = inLink ? inLink.replace('in-mc-fdlive', 'bd-mc-fdlive') : undefined;
          const startTime = m.startTime || m.start_time;
          
          return {
            id: m.match_id?.toString() || `match-${index}`,
            team1: m.team_1,
            team2: m.team_2,
            event: m.event_name,
            startTime: startTime || "Live Now",
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
        setLastUpdated(typeof lastUpdatedVal === 'string' ? lastUpdatedVal : null);
      } else {
        setError((data as any)?.error || "Failed to fetch matches");
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
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      fetchMatches();
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  return { matches, loading, error, lastUpdated, refetch: fetchMatches };
};
