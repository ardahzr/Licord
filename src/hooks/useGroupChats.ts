import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { GroupChat, GroupChatMember, User } from "@/types/database";

export interface GroupChatMemberWithUser extends GroupChatMember {
  user: User;
}

export interface GroupChatWithMembers extends GroupChat {
  members: GroupChatMemberWithUser[];
  displayName: string;
}

interface UseGroupChats {
  groupChats: GroupChatWithMembers[];
  loading: boolean;
  error: string | null;
  createGroupChat: (name: string, memberIds: string[]) => Promise<GroupChat>;
  reload: () => Promise<void>;
}

type GroupChatRow = GroupChat & {
  members: Array<GroupChatMember & { user: User }>;
};

const GROUP_CHAT_SELECT =
  "id, name, icon_url, owner_id, created_at, members:group_chat_members(group_chat_id, user_id, joined_at, user:users!group_chat_members_user_id_fkey(*))";

/** Private Discord-style group conversations, separate from servers/channels. */
export function useGroupChats(): UseGroupChats {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [groupChats, setGroupChats] = useState<GroupChatWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId || !isSupabaseConfigured()) {
      setGroupChats([]);
      setLoading(false);
      return;
    }

    const { data, error: queryError } = await supabase
      .from("group_chats")
      .select(GROUP_CHAT_SELECT)
      .order("created_at", { ascending: false });

    if (queryError) {
      setError(queryError.message);
    } else {
      const rows = (data ?? []) as unknown as GroupChatRow[];
      setGroupChats(
        rows.map((row) => {
          const others = row.members
            .filter((member) => member.user_id !== userId)
            .map((member) => member.user.username);
          return {
            ...row,
            displayName: row.name?.trim() || others.join(", ") || "Group Chat",
          };
        }),
      );
      setError(null);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void reload();
    if (!userId || !isSupabaseConfigured()) return;

    const realtime = supabase
      .channel(`group-chats:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_chats" },
        () => void reload(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_chat_members" },
        () => void reload(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(realtime);
    };
  }, [reload, userId]);

  const createGroupChat = useCallback(
    async (name: string, memberIds: string[]): Promise<GroupChat> => {
      const { data, error: rpcError } = await supabase.rpc(
        "create_group_chat",
        {
          group_name: name.trim() || null,
          member_ids: memberIds,
        },
      );
      if (rpcError) {
        setError(rpcError.message);
        throw new Error(rpcError.message);
      }
      const created = (Array.isArray(data) ? data[0] : data) as GroupChat;
      await reload();
      return created;
    },
    [reload],
  );

  return { groupChats, loading, error, createGroupChat, reload };
}
