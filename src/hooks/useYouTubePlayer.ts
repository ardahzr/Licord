import { useEffect, useRef, useState } from "react";
import {
  loadYouTubeApi,
  type YouTubePlayer,
} from "@/lib/youtube";

interface PlayerCallbacks {
  /** Fired when the local user (not a remote sync) plays/pauses/seeks. */
  onUserPlay?: (time: number) => void;
  onUserPause?: (time: number) => void;
  onUserSeek?: (time: number) => void;
}

export interface PlayerController {
  load: (videoId: string) => void;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  getTime: () => number;
}

const SUPPRESS_MS = 900; // ignore local events briefly after a remote-driven action
const SEEK_DRIFT = 1.3; // seconds of unexpected jump that counts as a manual seek

/**
 * Wraps the YouTube IFrame player and distinguishes *local* user actions from
 * programmatic (remote-sync) ones, so the co-watch layer only broadcasts real
 * user intent. Returns a ref to mount the player into and an imperative
 * controller for applying remote commands.
 */
export function useYouTubePlayer(callbacks: PlayerCallbacks) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  const suppressUntil = useRef(0);
  const lastTick = useRef({ time: 0, wall: 0 });
  const [ready, setReady] = useState(false);

  const suppressed = () => Date.now() < suppressUntil.current;
  const suppress = () => {
    suppressUntil.current = Date.now() + SUPPRESS_MS;
  };

  useEffect(() => {
    let cancelled = false;
    let player: YouTubePlayer | null = null;

    loadYouTubeApi().then(() => {
      if (cancelled || !containerRef.current || !window.YT) return;
      // YT replaces the target node with an iframe; give it a throwaway child
      // so React keeps owning `containerRef`.
      const host = document.createElement("div");
      host.style.width = "100%";
      host.style.height = "100%";
      containerRef.current.appendChild(host);

      player = new window.YT.Player(host, {
        width: "100%",
        height: "100%",
        playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          onReady: () => !cancelled && setReady(true),
          onStateChange: (e: { data: number }) => {
            if (suppressed() || !window.YT) return;
            const time = player?.getCurrentTime() ?? 0;
            if (e.data === window.YT.PlayerState.PLAYING) {
              cbRef.current.onUserPlay?.(time);
            } else if (e.data === window.YT.PlayerState.PAUSED) {
              cbRef.current.onUserPause?.(time);
            }
          },
        },
      }) as YouTubePlayer;
      playerRef.current = player;
    });

    // Detect manual seeks (the IFrame API has no dedicated "seeked" event).
    const interval = window.setInterval(() => {
      const p = playerRef.current;
      if (!p || !window.YT) return;
      const now = Date.now();
      const playing = p.getPlayerState() === window.YT.PlayerState.PLAYING;
      const actual = p.getCurrentTime();
      const prev = lastTick.current;

      if (playing && prev.wall && !suppressed()) {
        const expected = prev.time + (now - prev.wall) / 1000;
        if (Math.abs(actual - expected) > SEEK_DRIFT) {
          cbRef.current.onUserSeek?.(actual);
        }
      }
      lastTick.current = { time: actual, wall: now };
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      player?.destroy?.();
      playerRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, []);

  const controller = useRef<PlayerController>({
    load: (videoId) => {
      suppress();
      playerRef.current?.loadVideoById(videoId);
    },
    play: () => {
      suppress();
      playerRef.current?.playVideo();
    },
    pause: () => {
      suppress();
      playerRef.current?.pauseVideo();
    },
    seek: (time) => {
      suppress();
      playerRef.current?.seekTo(time, true);
    },
    getTime: () => playerRef.current?.getCurrentTime() ?? 0,
  });

  return { containerRef, controller: controller.current, ready };
}
