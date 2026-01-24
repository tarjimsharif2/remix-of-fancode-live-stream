import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MappedMatch, mapJsonResponse } from "@/utils/jsonFieldMapper";

export const useJsonSourceMatches = (sourceSlug: string) => {
  const [matches, setMatches] = useState<MappedMatch[]>([]);
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

      if (data?.success) {
        // Use smart mapper to handle any JSON structure
        const mappedMatches = mapJsonResponse(data.matches || data);
        setMatches(mappedMatches);
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
