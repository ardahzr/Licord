import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import { useAppStore } from "@/store/useAppStore";

export interface VoiceUserPresence {
  userId: string;
  username: string;
  avatar_url: string | null;
  channelId: string;
  isMicMuted: boolean;
  isScreenSharing: boolean;
}

export function useGlobalVoicePresence() {
  const { session, profile } = useAuth();
  const activeVoiceChannelId = useAppStore((state) => state.activeVoiceChannelId);
  const isMicMuted = useAppStore((state) => state.isMicMuted);
  const isScreenSharing = useAppStore((state) => state.isScreenSharing);
  const [usersInVoice, setUsersInVoice] = useState<VoiceUserPresence[]>([]);

  useEffect(() => {
    if (!session || !isSupabaseConfigured()) return;

    const channel = supabase.channel("global:voice_presence", {
      config: { presence: { key: session.user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{
          username: string;
          avatar_url: string | null;
          channelId: string | null;
          isMicMuted: boolean;
          isScreenSharing: boolean;
        }>();

        const list: VoiceUserPresence[] = [];
        for (const [id, metas] of Object.entries(state)) {
          // If a user has multiple tabs open, we take the first valid presence
          const meta = metas.find((m) => m.channelId != null);
          if (meta && meta.channelId) {
            list.push({
              userId: id,
              username: meta.username ?? "anon",
              avatar_url: meta.avatar_url ?? null,
              channelId: meta.channelId,
              isMicMuted: meta.isMicMuted ?? false,
              isScreenSharing: meta.isScreenSharing ?? false,
            });
          }
        }
        setUsersInVoice(list);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // Sync initial state if already in a channel
          if (activeVoiceChannelId) {
            await channel.track({
              username: profile?.username ?? session.user.id,
              avatar_url: profile?.avatar_url ?? null,
              channelId: activeVoiceChannelId,
              isMicMuted,
              isScreenSharing,
            });
          }
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session, profile]);

  // Push local state changes to presence
  useEffect(() => {
    if (!session || !isSupabaseConfigured()) return;

    // Supabase returns the existing channel instance by name
    const channel = supabase.channel("global:voice_presence");
    
    if (channel.state === "joined") {
      if (activeVoiceChannelId) {
        void channel.track({
          username: profile?.username ?? session.user.id,
          avatar_url: profile?.avatar_url ?? null,
          channelId: activeVoiceChannelId,
          isMicMuted,
          isScreenSharing,
        });
      } else {
        void channel.untrack();
      }
    }
  }, [activeVoiceChannelId, isMicMuted, isScreenSharing, session, profile]);

  return usersInVoice;
}
