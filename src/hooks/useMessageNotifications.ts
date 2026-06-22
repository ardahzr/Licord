import { useEffect, useRef } from "react";
import type { RealtimePostgresInsertPayload } from "@supabase/supabase-js";
import { useAuth } from "@/context/AuthContext";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAppStore } from "@/store/useAppStore";
import type { Channel, Message } from "@/types/database";
import type { GroupChatWithMembers } from "@/hooks/useGroupChats";

function messageBody(message: Message): string {
  const text = message.content.trim();
  if (text) return text.length > 120 ? `${text.slice(0, 117)}…` : text;
  return message.media_url ? "Sent an attachment" : "Sent a message";
}

/**
 * One app-wide Realtime subscription for incoming-message notifications.
 * Channel chat subscriptions remain responsible for rendering the messages.
 */
export function useMessageNotifications(
  channels: Channel[],
  groupChats: GroupChatWithMembers[],
) {
  const { session } = useAuth();
  const addNotification = useAppStore((state) => state.addNotification);
  const channelsRef = useRef(channels);
  channelsRef.current = channels;
  const groupChatsRef = useRef(groupChats);
  groupChatsRef.current = groupChats;

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId || !isSupabaseConfigured()) return;

    let active = true;
    const realtime = supabase
      .channel(`message-notifications:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload: RealtimePostgresInsertPayload<Message>) => {
          const message = payload.new;
          const targetId = message.channel_id ?? message.group_chat_id;
          if (!active || message.sender_id === userId || !targetId) {
            return;
          }

          const appIsFocused = !document.hidden && document.hasFocus();
          if (
            appIsFocused &&
            useAppStore.getState().activeChannelId === targetId
          ) {
            return;
          }

          let channel = message.channel_id
            ? channelsRef.current.find((item) => item.id === message.channel_id)
            : undefined;
          if (message.channel_id && !channel) {
            const { data } = await supabase
              .from("channels")
              .select("*")
              .eq("id", message.channel_id)
              .maybeSingle();
            channel = data ? (data as Channel) : undefined;
          }
          const group = message.group_chat_id
            ? groupChatsRef.current.find(
                (item) => item.id === message.group_chat_id,
              )
            : undefined;
          const { data: sender } = await supabase
            .from("users")
            .select("username")
            .eq("id", message.sender_id)
            .maybeSingle();
          if (!active) return;

          const senderName = sender?.username ?? "Someone";
          const channelName = group?.displayName ?? channel?.name ?? "Conversation";
          const path = message.group_chat_id
            ? `/dms/${message.group_chat_id}`
            : `/channels/${message.channel_id}`;
          const body = messageBody(message);

          addNotification({
            id: message.id,
            channelId: targetId,
            channelName,
            path,
            contextPrefix: group ? "" : "#",
            senderName,
            body,
            createdAt: message.created_at,
          });

          // System notifications are intentionally limited to background use.
          // The in-app notification center works even when this API is absent.
          if (
            "Notification" in window &&
            Notification.permission === "granted" &&
            !appIsFocused
          ) {
            const notice = new Notification(
              `${senderName} in ${group ? "" : "#"}${channelName}`,
              { body, tag: `message:${message.id}` },
            );
            notice.onclick = () => {
              window.focus();
              window.location.hash = path;
              notice.close();
            };
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(realtime);
    };
  }, [session?.user.id, addNotification]);
}
