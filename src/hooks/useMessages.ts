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

export type MessageTargetType = "channel" | "group";

function targetColumn(type: MessageTargetType) {
  return type === "group" ? "group_chat_id" : "channel_id";
}

/**
 * Loads a channel's history and keeps it live via a Realtime postgres_changes
 * subscription. The sender's own insert also arrives over Realtime, so we treat
 * the subscription as the single source of truth (deduping by id).
 */
export function useMessages(
  targetId: string | null,
  targetType: MessageTargetType = "channel",
): UseMessages {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const targetRef = useRef(`${targetType}:${targetId ?? ""}`);
  targetRef.current = `${targetType}:${targetId ?? ""}`;

  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) =>
      prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
    );
  }, []);

  useEffect(() => {
    if (!targetId || !isSupabaseConfigured()) {
      setMessages([]);
      setError(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    setMessages([]);

    // 1) Initial history (joined with sender profile).
    supabase
      .from("messages")
      .select(MESSAGE_SELECT)
      .eq(targetColumn(targetType), targetId)
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
          const history = rows.map((r) => toChatMessage(r, r.sender));
          // Do not overwrite inserts that arrived while history was loading.
          setMessages((current) => {
            const merged = new Map(
              history.map((message) => [message.id, message]),
            );
            for (const message of current) merged.set(message.id, message);
            return [...merged.values()].sort(
              (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at),
            );
          });
        }
        setLoading(false);
      });

    // 2) Live inserts for this channel.
    const channel = supabase
      .channel(`messages:${targetType}:${targetId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `${targetColumn(targetType)}=eq.${targetId}`,
        },
        async (payload: RealtimePostgresInsertPayload<Message>) => {
          const row = payload.new;
          const rowTarget =
            targetType === "group" ? row.group_chat_id : row.channel_id;
          if (targetRef.current !== `${targetType}:${rowTarget ?? ""}`) return;
          const sender = await resolveSender(row.sender_id);
          if (active) appendMessage(toChatMessage(row, sender));
        },
      )
      .subscribe((status) => {
        if (!active) return;
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setError("Realtime connection failed. New messages may be delayed.");
        }
      });

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [targetId, targetType, appendMessage]);

  const sendMessage = useCallback(
    async (content: string, mediaUrl?: string) => {
      const trimmed = content.trim();
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if ((!trimmed && !mediaUrl) || !targetId || !userId) return;

      const target =
        targetType === "group"
          ? { group_chat_id: targetId }
          : { channel_id: targetId };

      const { data, error: insertError } = await supabase
        .from("messages")
        .insert({
          ...target,
          sender_id: userId,
          content: trimmed,
          media_url: mediaUrl ?? null,
        })
        .select(
          "id, channel_id, friend_id, group_chat_id, sender_id, content, media_url, created_at",
        )
        .single();
      if (insertError) {
        setError(insertError.message);
        throw new Error(insertError.message);
      }
      const sender = await resolveSender(userId);
      appendMessage(toChatMessage(data as Message, sender));
      setError(null);
    },
    [targetId, targetType, appendMessage],
  );

  return { messages, loading, error, sendMessage };
}
