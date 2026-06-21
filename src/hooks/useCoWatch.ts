import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

/** Playback commands broadcast between co-watchers. */
export type CoWatchCmd =
  | { type: "load"; videoId: string; host: string; time: number; playing: boolean }
  | { type: "play"; time: number }
  | { type: "pause"; time: number }
  | { type: "seek"; time: number };

export interface Viewer {
  id: string;
  username: string;
}

interface CoWatchOptions {
  roomId: string;
  userId: string;
  username: string;
  /** A remote co-watcher sent a command. */
  onRemote: (cmd: CoWatchCmd) => void;
  /** A new peer joined — the host should re-broadcast current state. */
  onPeerJoin?: () => void;
}

/**
 * Realtime co-watch transport: broadcasts playback commands over a per-room
 * Supabase channel and tracks who's watching via Presence.
 */
export function useCoWatch({
  roomId,
  userId,
  username,
  onRemote,
  onPeerJoin,
}: CoWatchOptions) {
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const onRemoteRef = useRef(onRemote);
  const onPeerJoinRef = useRef(onPeerJoin);
  onRemoteRef.current = onRemote;
  onPeerJoinRef.current = onPeerJoin;

  useEffect(() => {
    if (!roomId || !userId || !isSupabaseConfigured()) return;

    const channel = supabase.channel(`cowatch:${roomId}`, {
      config: { broadcast: { self: false }, presence: { key: userId } },
    });

    channel
      .on("broadcast", { event: "cmd" }, ({ payload }) => {
        onRemoteRef.current(payload as CoWatchCmd);
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ username: string }>();
        setViewers(
          Object.entries(state).map(([id, metas]) => ({
            id,
            username: metas[0]?.username ?? "anon",
          })),
        );
      })
      .on("presence", { event: "join" }, ({ key }) => {
        if (key !== userId) onPeerJoinRef.current?.();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({ username });
        }
      });

    channelRef.current = channel;
    return () => {
      void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, userId, username]);

  const send = useCallback((cmd: CoWatchCmd) => {
    channelRef.current?.send({ type: "broadcast", event: "cmd", payload: cmd });
  }, []);

  return { viewers, send };
}
