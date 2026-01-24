import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Match } from "@/types/match";

export const useJsonSourceMatches = (sourceSlug: string) => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sourceName, setSourceName] = useState<string>("");

  const fetchMatches = useCallback(async () => {
    if (!sourceSlug) {
      setError("No source specified");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch source info
      const { data: sourceData, error: sourceError } = await supabase
        .from("json_sources")
        .select("*")
        .eq("slug", sourceSlug)
        .eq("is_active", true)
        .single();

      if (sourceError || !sourceData) {
        throw new Error("Source not found or inactive");
      }

      setSourceName(sourceData.name);

      // Fetch matches from edge function with source URL
      const { data, error: fnError } = await supabase.functions.invoke("fetch-json-source", {
        body: { url: sourceData.url },
      });

      if (fnError) throw fnError;

      if (data?.success && data.matches) {
        const formattedMatches: Match[] = data.matches.map((match: any) => ({
          matchId: match.match_id?.toString() || "",
          title: match.title || match.match_title || "Unknown Match",
          category: match.category || match.sport || "Sports",
          startTime: match.start_time || match.startTime || "",
          status: match.status || "upcoming",
          thumbnail: match.thumbnail || match.image || "",
          streamUrl: match.adfree_url || match.dai_url || match.stream_url || "",
          bdStreamUrl: match.adfree_url
            ? match.adfree_url.replace("in-mc-fdlive", "bd-mc-fdlive")
            : "",
        }));

        setMatches(formattedMatches);
        setLastUpdated(new Date());
      } else {
        setMatches([]);
      }
    } catch (err: any) {
      console.error("Error fetching matches:", err);
      setError(err.message || "Failed to fetch matches");
    } finally {
      setLoading(false);
    }
  }, [sourceSlug]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  return {
    matches,
    loading,
    error,
    lastUpdated,
    sourceName,
    refetch: fetchMatches,
  };
};
