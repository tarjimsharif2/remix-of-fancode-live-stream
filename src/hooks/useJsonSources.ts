import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { JsonSource } from "@/types/jsonSource";

export const useJsonSources = () => {
  const [sources, setSources] = useState<JsonSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSources = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .from("json_sources")
        .select("*")
        .order("display_order", { ascending: true });

      if (fetchError) throw fetchError;
      setSources((data as JsonSource[]) || []);
    } catch (err: any) {
      console.error("Error fetching JSON sources:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const addSource = async (source: Omit<JsonSource, "id" | "created_at" | "updated_at">) => {
    // Convert to database-compatible format
    const dbSource = {
      ...source,
      link_prefixes: source.link_prefixes as Record<string, unknown> | undefined,
    };
    
    const { data, error } = await supabase
      .from("json_sources")
      .insert([dbSource as any])
      .select()
      .single();

    if (error) throw error;
    await fetchSources();
    return data as JsonSource;
  };

  const updateSource = async (id: string, updates: Partial<JsonSource>) => {
    // Convert to database-compatible format  
    const dbUpdates = {
      ...updates,
      link_prefixes: updates.link_prefixes as Record<string, unknown> | undefined,
    };
    
    const { error } = await supabase
      .from("json_sources")
      .update(dbUpdates as any)
      .eq("id", id);

    if (error) throw error;
    await fetchSources();
  };

  const deleteSource = async (id: string) => {
    const { error } = await supabase
      .from("json_sources")
      .delete()
      .eq("id", id);

    if (error) throw error;
    await fetchSources();
  };

  return {
    sources,
    loading,
    error,
    refetch: fetchSources,
    addSource,
    updateSource,
    deleteSource,
  };
};
