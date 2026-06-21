import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { Message, User } from "@/types/database";

type SenderInfo = Pick<User, "username" | "avatar_url">;

export interface ChatMessage {
  id: string;
  content: string;
  media_url: string | null;
  created_at: string;
  sender_id: string;
  sender: SenderInfo | null;
}

const MESSAGE_SELECT =
  "id, content, media_url, created_at, sender_id, sender:users!sender_id(username, avatar_url)";

// Cache profiles across channel switches so realtime inserts can be enriched
// without a round-trip per message.
const senderCache = new Map<string, SenderInfo>();

function toChatMessage(row: Message, sender: SenderInfo | null): ChatMessage {
  return {
    id: row.id,
    content: row.content,
    media_url: row.media_url,
    created_at: row.created_at,
    sender_id: row.sender_id,
    sender,
  };
}

async function resolveSender(senderId: string): Promise<SenderInfo | null> {
  const cached = senderCache.get(senderId);
  if (cached) return cached;
  const { data } = await supabase
    .from("users")
    .select("username, avatar_url")
    .eq("id", senderId)
    .maybeSingle();
  if (data) senderCache.set(senderId, data);
  return data;
}

interface UseMessages {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  sendMessage: (content: string, mediaUrl?: string) => Promise<void>;
}

/**
 * Loads a channel's history and keeps it live via a Realtime postgres_changes
 * subscription. The sender's own insert also arrives over Realtime, so we treat
 * the subscription as the single source of truth (deduping by id).
 */
export function useMessages(channelId: string | null): UseMessages {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelIdRef = useRef(channelId);
  channelIdRef.current = channelId;

  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) =>
      prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
    );
  }, []);

  useEffect(() => {
    if (!channelId || !isSupabaseConfigured()) {
      setMessages([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setMessages([]);

    // 1) Initial history (joined with sender profile).
    supabase
      .from("messages")
      .select(MESSAGE_SELECT)
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true })
      .limit(100)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          setError(error.message);
        } else {
          const rows = (data ?? []) as unknown as Array<
            Message & { sender: SenderInfo | null }
          >;
          for (const r of rows) {
            if (r.sender) senderCache.set(r.sender_id, r.sender);
          }
          setMessages(rows.map((r) => toChatMessage(r, r.sender)));
        }
        setLoading(false);
      });

    // 2) Live inserts for this channel.
    const channel = supabase
      .channel(`messages:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload: RealtimePostgresInsertPayload<Message>) => {
          const row = payload.new;
          if (channelIdRef.current !== row.channel_id) return;
          const sender = await resolveSender(row.sender_id);
          if (active) appendMessage(toChatMessage(row, sender));
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [channelId, appendMessage]);

  const sendMessage = useCallback(
    async (content: string, mediaUrl?: string) => {
      const trimmed = content.trim();
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if ((!trimmed && !mediaUrl) || !channelId || !userId) return;

      const { error } = await supabase.from("messages").insert({
        channel_id: channelId,
        sender_id: userId,
        content: trimmed,
        media_url: mediaUrl ?? null,
      });
      if (error) setError(error.message);
    },
    [channelId],
  );

  return { messages, loading, error, sendMessage };
}
