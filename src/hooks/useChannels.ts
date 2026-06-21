import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Channel } from "@/types/database";

interface UseChannels {
  channels: Channel[];
  loading: boolean;
  error: string | null;
}

/** Loads text channels for the sidebar (Phase 2: the single seeded server). */
export function useChannels(): UseChannels {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    let active = true;

    supabase
      .from("channels")
      .select("*")
      .eq("type", "text")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setError(error.message);
        else setChannels(data ?? []);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { channels, loading, error };
}
