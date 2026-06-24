import { useEffect, useRef, useState } from "react";
import { MicOff, MonitorOff } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { cn, initials } from "@/lib/utils";
import type { VoiceParticipant } from "@/hooks/useVoiceRoom";
import { getNativeVideoFrame } from "@/lib/nativeVoice";

interface ParticipantTileProps {
  participant: VoiceParticipant;
  /** When true, renders at a larger size (e.g. screen-share spotlight). */
  spotlight?: boolean;
  nativeVoice?: boolean;
}

/**
 * Renders a single participant in the voice/video grid.
 *
 * - Camera ON → <video> element with the camera stream.
 * - Camera OFF → Avatar + name fallback.
 * - Speaking → green pulsing ring.
 * - Mic muted → small MicOff icon overlay.
 */
export function ParticipantTile({ participant, spotlight, nativeVoice }: ParticipantTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const {
    name,
    isSpeaking,
    isMicMuted,
    isCameraOff,
    isLocal,
    videoTrack,
    audioTrack,
  } = participant;

  // Attach/detach camera track to the <video> element.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (videoTrack) {
      const stream = new MediaStream([videoTrack]);
      el.srcObject = stream;
    } else {
      el.srcObject = null;
    }

    return () => {
      if (el) el.srcObject = null;
    };
  }, [videoTrack]);

  // Remote microphone audio must be attached explicitly. Without this element
  // the room connects and shows participants but nobody can hear each other.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || isLocal) return;
    el.srcObject = audioTrack ? new MediaStream([audioTrack]) : null;
    if (audioTrack) void el.play().catch(() => undefined);
    return () => {
      el.srcObject = null;
    };
  }, [audioTrack, isLocal]);

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden",
        "bg-surface-container border border-outline-variant transition-all duration-300",
        spotlight ? "col-span-full aspect-video" : "aspect-[4/3]",
        isSpeaking && "ring-2 ring-status-online animate-voice-pulse",
      )}
    >
      {!isLocal && <audio ref={audioRef} autoPlay playsInline />}
      {/* Video layer */}
      {!isCameraOff && nativeVoice ? (
        <NativeVideoImage
          identity={participant.identity}
          source="camera"
          alt={`${name}'s camera`}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : !isCameraOff && videoTrack ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        /* Avatar fallback */
        <div className="flex flex-col items-center space-y-sm">
          <Avatar
            fallback={initials(name)}
            sizeClassName={spotlight ? "w-20 h-20" : "w-14 h-14"}
            className={cn(
              "ring-2 transition-all duration-300",
              isSpeaking ? "ring-status-online" : "ring-outline-variant",
            )}
          />
          <span className="font-code-sm text-code-sm text-on-surface-variant truncate max-w-[90%] text-center">
            {name}
            {isLocal && " (you)"}
          </span>
        </div>
      )}

      {/* Name badge (shown over video) */}
      {!isCameraOff && (videoTrack || nativeVoice) && (
        <div className="absolute bottom-2 left-2 flex items-center bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-sm">
          <span className="font-code-sm text-code-sm text-white truncate max-w-[120px]">
            {name}
            {isLocal && " (you)"}
          </span>
        </div>
      )}

      {/* Mic muted indicator */}
      {isMicMuted && (
        <div
          className="absolute top-2 right-2 p-1 bg-error/80 rounded-full"
          title="Mic muted"
        >
          <MicOff className="w-3 h-3 text-white" />
        </div>
      )}
    </div>
  );
}

/**
 * Renders a screen-share track in a spotlight tile.
 */
export function ScreenShareTile({ participant }: { participant: VoiceParticipant }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !participant.screenTrack) return;

    const stream = new MediaStream([participant.screenTrack]);
    el.srcObject = stream;

    return () => {
      if (el) el.srcObject = null;
    };
  }, [participant.screenTrack]);

  return (
    <div className="relative col-span-full aspect-video bg-black border border-outline-variant overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-full object-contain"
      />
      <div className="absolute bottom-2 left-2 flex items-center bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-sm space-x-1">
        <MonitorOff className="w-3 h-3 text-primary" />
        <span className="font-code-sm text-code-sm text-white">
          {participant.name}'s screen
        </span>
      </div>
    </div>
  );
}

/** Displays native Rust screen-share frames inside the WebKit UI. */
export function NativeScreenShareTile({
  participant,
}: {
  participant: VoiceParticipant;
}) {
  return (
    <div className="relative col-span-full flex aspect-video items-center justify-center overflow-hidden border border-outline-variant bg-black">
      <NativeVideoImage
        identity={participant.identity}
        source="screen"
        alt={`${participant.name}'s screen`}
        className="h-full w-full object-contain"
      />
      <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 text-xs text-white">
        {participant.name}'s screen
      </div>
    </div>
  );
}

function NativeVideoImage({
  identity,
  source,
  alt,
  className,
}: {
  identity: string;
  source: "screen" | "camera";
  alt: string;
  className: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    let objectUrl: string | null = null;
    const update = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const bytes = await getNativeVideoFrame(identity, source);
        if (!active) return;
        const next = URL.createObjectURL(new Blob([bytes], { type: "image/jpeg" }));
        setSrc(next);
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = next;
      } catch {
        // The capture/decoder can take a moment to produce its first frame.
      } finally {
        inFlight = false;
      }
    };
    void update();
    const timer = window.setInterval(() => void update(), 80);
    return () => {
      active = false;
      window.clearInterval(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [identity, source]);

  return src ? (
    <img src={src} alt={alt} className={className} />
  ) : (
    <div className="text-center text-on-surface-variant">
      <MonitorOff className="mx-auto mb-sm h-8 w-8 text-primary" />
      Waiting for video…
    </div>
  );
}
