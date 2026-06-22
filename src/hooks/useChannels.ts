import { useCallback, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Channel, ChannelType } from "@/types/database";

interface UseChannels {
  /** All channels (text + voice). */
  channels: Channel[];
  /** Only text channels (for chat sidebar). */
  textChannels: Channel[];
  /** Only voice channels (for voice sidebar). */
  voiceChannels: Channel[];
  loading: boolean;
  error: string | null;
  createChannel: (name: string, type: ChannelType) => Promise<Channel>;
}

/** Loads all channels for the sidebar (text + voice). */
export function useChannels(serverId: string | null): UseChannels {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured() || !serverId) {
      setChannels([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: queryError } = await supabase
      .from("channels")
      .select("*")
      .eq("server_id", serverId)
      .order("created_at", { ascending: true });
    if (queryError) setError(queryError.message);
    else {
      setChannels((data ?? []) as Channel[]);
      setError(null);
    }
    setLoading(false);
  }, [serverId]);

  useEffect(() => {
    void reload();
    if (!serverId || !isSupabaseConfigured()) return;
    const realtime = supabase
      .channel(`channels:${serverId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "channels",
          filter: `server_id=eq.${serverId}`,
        },
        () => void reload(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(realtime);
    };
  }, [serverId, reload]);

  const createChannel = useCallback(
    async (name: string, type: ChannelType): Promise<Channel> => {
      if (!serverId) throw new Error("Select a server first");
      const cleanName =
        type === "text"
          ? name.trim().toLocaleLowerCase().replace(/\s+/g, "-")
          : name.trim();
      if (cleanName.length < 2 || cleanName.length > 40) {
        throw new Error("Channel name must be between 2 and 40 characters");
      }
      const { data, error: insertError } = await supabase
        .from("channels")
        .insert({ server_id: serverId, name: cleanName, type })
        .select("*")
        .single();
      if (insertError) throw new Error(insertError.message);
      const created = data as Channel;
      setChannels((current) => [...current, created]);
      return created;
    },
    [serverId],
  );

  const textChannels = channels.filter((c) => c.type === "text");
  const voiceChannels = channels.filter((c) => c.type === "voice");

  return {
    channels,
    textChannels,
    voiceChannels,
    loading,
    error,
    createChannel,
  };
}
