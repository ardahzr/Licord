import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Server } from "@/types/database";

export interface UseServers {
  servers: Server[];
  loading: boolean;
  error: string | null;
  createServer: (name: string) => Promise<Server>;
  addMember: (serverId: string, userId: string) => Promise<void>;
}

/** Loads communities visible to the signed-in user and keeps the rail current. */
export function useServers(): UseServers {
  const { session } = useAuth();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured() || !session?.user.id) {
      setServers([]);
      setLoading(false);
      return;
    }
    const { data, error: queryError } = await supabase
      .from("servers")
      .select("*")
      .order("created_at", { ascending: true });
    if (queryError) setError(queryError.message);
    else {
      setServers((data ?? []) as Server[]);
      setError(null);
    }
    setLoading(false);
  }, [session?.user.id]);

  useEffect(() => {
    void reload();
    if (!session?.user.id || !isSupabaseConfigured()) return;
    const channel = supabase
      .channel(`servers:${session.user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "servers" },
        () => void reload(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "server_members",
          filter: `user_id=eq.${session.user.id}`,
        },
        () => void reload(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session?.user.id, reload]);

  const createServer = useCallback(async (name: string): Promise<Server> => {
    const { data, error: rpcError } = await supabase.rpc("create_server", {
      server_name: name,
    });
    if (rpcError) throw new Error(rpcError.message);
    const created = (Array.isArray(data) ? data[0] : data) as Server;
    setServers((current) =>
      current.some((server) => server.id === created.id)
        ? current
        : [...current, created],
    );
    return created;
  }, []);

  const addMember = useCallback(async (serverId: string, userId: string) => {
    const { error: rpcError } = await supabase.rpc("add_server_member", {
      target_server: serverId,
      target_user: userId,
    });
    if (rpcError) throw new Error(rpcError.message);
  }, []);

  return { servers, loading, error, createServer, addMember };
}
