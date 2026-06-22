import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Friend, User } from "@/types/database";

export interface Friendship extends Friend {
  other: User;
  incoming: boolean;
}

export interface UseFriends {
  friendships: Friendship[];
  loading: boolean;
  error: string | null;
  clearError: () => void;
  sendRequest: (username: string) => Promise<void>;
  respondToRequest: (id: string, accept: boolean) => Promise<void>;
  removeFriend: (id: string) => Promise<void>;
}

type FriendRow = Friend & { user1: User; user2: User };

const FRIEND_SELECT =
  "id, user_id_1, user_id_2, status, created_at, user1:users!friends_user_id_1_fkey(*), user2:users!friends_user_id_2_fkey(*)";

/** Real Supabase-backed friend requests, roster, and realtime updates. */
export function useFriends(): UseFriends {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId || !isSupabaseConfigured()) {
      setFriendships([]);
      setLoading(false);
      return;
    }
    const { data, error: queryError } = await supabase
      .from("friends")
      .select(FRIEND_SELECT)
      .order("created_at", { ascending: false });
    if (queryError) {
      setError(queryError.message);
    } else {
      const rows = (data ?? []) as unknown as FriendRow[];
      setFriendships(
        rows.map((row) => ({
          id: row.id,
          user_id_1: row.user_id_1,
          user_id_2: row.user_id_2,
          status: row.status,
          created_at: row.created_at,
          other: row.user_id_1 === userId ? row.user2 : row.user1,
          incoming: row.user_id_2 === userId,
        })),
      );
      setError(null);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void reload();
    if (!userId || !isSupabaseConfigured()) return;
    const channel = supabase
      .channel(`friends:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friends",
          filter: `user_id_1=eq.${userId}`,
        },
        () => void reload(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friends",
          filter: `user_id_2=eq.${userId}`,
        },
        () => void reload(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, reload]);

  const sendRequest = useCallback(
    async (username: string) => {
      const { error: rpcError } = await supabase.rpc("send_friend_request", {
        target_username: username.trim(),
      });
      if (rpcError) {
        setError(rpcError.message);
        throw new Error(rpcError.message);
      }
      await reload();
    },
    [reload],
  );

  const respondToRequest = useCallback(
    async (id: string, accept: boolean) => {
      const { error: rpcError } = await supabase.rpc(
        "respond_friend_request",
        { request_id: id, accept_request: accept },
      );
      if (rpcError) {
        setError(rpcError.message);
        throw new Error(rpcError.message);
      }
      await reload();
    },
    [reload],
  );

  const removeFriend = useCallback(
    async (id: string) => {
      const { error: deleteError } = await supabase
        .from("friends")
        .delete()
        .eq("id", id);
      if (deleteError) {
        setError(deleteError.message);
        throw new Error(deleteError.message);
      }
      await reload();
    },
    [reload],
  );

  return {
    friendships,
    loading,
    error,
    clearError: () => setError(null),
    sendRequest,
    respondToRequest,
    removeFriend,
  };
}
