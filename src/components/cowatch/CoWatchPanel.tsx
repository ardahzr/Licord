import { useCallback, useRef, useState } from "react";
import { MonitorPlay, Link as LinkIcon, Youtube, Star } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useYouTubePlayer } from "@/hooks/useYouTubePlayer";
import { useCoWatch, type CoWatchCmd } from "@/hooks/useCoWatch";
import { parseYouTubeId } from "@/lib/youtube";
import { initials } from "@/lib/utils";

/**
 * Right column (360px): synchronized YouTube co-watch.
 * Local player actions are broadcast over Supabase Realtime; incoming commands
 * drive the player without re-broadcasting. Presence powers the viewers list.
 */
export function CoWatchPanel({ roomId }: { roomId: string }) {
  const { session, profile } = useAuth();
  const userId = session?.user.id ?? "";
  const username = profile?.username ?? "you";

  const [url, setUrl] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [host, setHost] = useState<string | null>(null);
  const playingRef = useRef(false);

  // `send` is created by useCoWatch; keep a ref so player callbacks (set up
  // first) can reach it without ordering issues.
  const sendRef = useRef<(cmd: CoWatchCmd) => void>(() => {});

  const { containerRef, controller, ready } = useYouTubePlayer({
    onUserPlay: (time) => {
      playingRef.current = true;
      sendRef.current({ type: "play", time });
    },
    onUserPause: (time) => {
      playingRef.current = false;
      sendRef.current({ type: "pause", time });
    },
    onUserSeek: (time) => sendRef.current({ type: "seek", time }),
  });

  const applyRemote = useCallback(
    (cmd: CoWatchCmd) => {
      switch (cmd.type) {
        case "load":
          setVideoId(cmd.videoId);
          setHost(cmd.host);
          playingRef.current = cmd.playing;
          controller.load(cmd.videoId);
          window.setTimeout(() => {
            if (cmd.time > 1) controller.seek(cmd.time);
            if (cmd.playing) controller.play();
            else controller.pause();
          }, 800);
          break;
        case "play":
          if (Math.abs(controller.getTime() - cmd.time) > 1)
            controller.seek(cmd.time);
          controller.play();
          playingRef.current = true;
          break;
        case "pause":
          controller.seek(cmd.time);
          controller.pause();
          playingRef.current = false;
          break;
        case "seek":
          controller.seek(cmd.time);
          break;
      }
    },
    [controller],
  );

  const handlePeerJoin = useCallback(() => {
    // Only the host replays current state to late joiners.
    if (host === username && videoId) {
      sendRef.current({
        type: "load",
        videoId,
        host: username,
        time: controller.getTime(),
        playing: playingRef.current,
      });
    }
  }, [host, username, videoId, controller]);

  const { viewers, send } = useCoWatch({
    roomId,
    userId,
    username,
    onRemote: applyRemote,
    onPeerJoin: handlePeerJoin,
  });
  sendRef.current = send;

  const loadVideo = () => {
    const id = parseYouTubeId(url);
    if (!id) return;
    setVideoId(id);
    setHost(username);
    playingRef.current = true;
    controller.load(id);
    send({ type: "load", videoId: id, host: username, time: 0, playing: true });
    setUrl("");
  };

  return (
    <aside className="hidden xl:flex flex-col w-[360px] flex-shrink-0 border-l border-outline-variant bg-surface-container-lowest z-30">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-md border-b border-outline-variant shrink-0">
        <div className="flex items-center">
          <MonitorPlay className="w-5 h-5 text-primary mr-sm" />
          <h3 className="font-headline-md text-headline-md font-bold text-on-surface">
            Co-watch
          </h3>
        </div>
        {videoId && (
          <div className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 animate-pulse" />
            <span className="font-label-caps text-label-caps text-primary">
              LIVE
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col p-md min-h-0 space-y-md">
        {/* URL input */}
        <div className="flex items-stretch gap-sm shrink-0">
          <div className="flex flex-1 bg-surface-container border border-outline-variant focus-within:border-primary-container transition-colors">
            <span className="text-on-surface-variant p-2 flex items-center">
              <LinkIcon className="w-4 h-4" />
            </span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadVideo()}
              placeholder="Paste YouTube URL…"
              className="flex-1 min-w-0 bg-transparent border-none text-on-surface font-code-sm text-code-sm py-2 px-1 focus:outline-none focus:ring-0 placeholder:text-on-surface-variant"
            />
          </div>
          <Button onClick={loadVideo} disabled={!ready || !url.trim()} size="sm">
            <Youtube className="w-4 h-4" />
            Load
          </Button>
        </div>

        {/* Player */}
        <div className="relative w-full aspect-video bg-black border border-outline-variant overflow-hidden shrink-0">
          <div ref={containerRef} className="absolute inset-0" />
          {!videoId && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-on-surface-variant pointer-events-none">
              <Youtube className="w-10 h-10 mb-sm opacity-60" />
              <span className="font-code-sm text-code-sm">
                Paste a link to start watching together
              </span>
            </div>
          )}
        </div>

        {/* Synchronized viewers */}
        <div className="flex-1 flex flex-col min-h-0 bg-surface-container border border-outline-variant">
          <div className="p-sm border-b border-outline-variant bg-surface-container-high font-label-caps text-label-caps text-on-surface-variant flex justify-between items-center">
            <span>Synchronized Viewers</span>
            <span className="bg-surface-container-lowest px-2 py-0.5 border border-outline-variant rounded-sm">
              {viewers.length}
            </span>
          </div>
          <div className="p-sm flex-1 overflow-y-auto space-y-sm">
            {viewers.length === 0 ? (
              <div className="text-on-surface-variant font-code-sm text-code-sm opacity-60">
                No one else here yet.
              </div>
            ) : (
              viewers.map((viewer) => (
                <div
                  key={viewer.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <Avatar
                      fallback={initials(viewer.username)}
                      sizeClassName="w-6 h-6"
                      className="mr-2"
                    />
                    <span className="font-code-sm text-code-sm text-on-surface">
                      {viewer.username}
                      {viewer.id === userId && " (you)"}
                    </span>
                  </div>
                  {host === viewer.username && (
                    <Star
                      className="w-4 h-4 text-primary fill-primary"
                      aria-label="Host"
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
