import { ConnectionState } from "livekit-client";
import { Volume2, WifiOff, Loader2, ShieldCheck } from "lucide-react";
import { useVoiceRoom } from "@/hooks/useVoiceRoom";
import { VoiceControls } from "@/components/voice/VoiceControls";
import {
  ParticipantTile,
  ScreenShareTile,
} from "@/components/voice/ParticipantTile";
import { Button } from "@/components/ui/button";
import { isLiveKitConfigured } from "@/lib/livekit";

interface VoiceRoomProps {
  channelId: string;
  channelName: string;
  directCall?: boolean;
}

/**
 * Full voice/video room experience.
 *
 * - Disconnected → "Join Voice" lobby
 * - Connecting → spinner
 * - Connected → participant grid + screen share + controls
 */
export function VoiceRoom({
  channelId,
  channelName,
  directCall = false,
}: VoiceRoomProps) {
  const {
    state,
    participants,
    screenSharer,
    connect,
    disconnect,
    toggleMic,
    toggleCamera,
    toggleScreenShare,
    isMicMuted,
    isCameraOff,
    isScreenSharing,
    error,
  } = useVoiceRoom(channelId, channelName);

  // ── Not configured ──
  if (!isLiveKitConfigured()) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-surface text-on-surface-variant p-lg text-center">
        <WifiOff className="w-12 h-12 mb-md opacity-40" />
        <h3 className="font-headline-md text-headline-md text-on-surface mb-sm">
          Voice Not Available
        </h3>
        <p className="font-code-sm text-code-sm max-w-md">
          LiveKit is not configured. Set <code>VITE_LIVEKIT_URL</code> in your{" "}
          <code>.env</code> file and deploy the LiveKit server.
        </p>
      </div>
    );
  }

  // ── Disconnected lobby ──
  if (state === ConnectionState.Disconnected) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-surface p-lg text-center">
        <div className="w-24 h-24 mb-lg flex items-center justify-center rounded-full bg-primary/10 border-2 border-primary/30">
          <Volume2 className="w-10 h-10 text-primary" />
        </div>
        <h3 className="font-headline-md text-headline-md text-on-surface mb-sm">
          {directCall ? channelName : `#${channelName}`}
        </h3>
        <p className="font-code-sm text-code-sm text-on-surface-variant mb-lg max-w-md">
          Join the {directCall ? "call" : "voice channel"} to talk with others. Your microphone will be
          enabled automatically. Noise and echo reduction are enabled.
        </p>
        {error && (
          <div className="mb-md px-md py-sm bg-error/10 border border-error/30 text-error font-code-sm text-code-sm rounded max-w-md">
            {error}
          </div>
        )}
        <Button onClick={connect} size="lg" className="px-xl">
          <Volume2 className="w-5 h-5 mr-sm" />
          Join Voice
        </Button>
      </div>
    );
  }

  // ── Connecting ──
  if (state === ConnectionState.Connecting || state === ConnectionState.Reconnecting) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-surface p-lg">
        <Loader2 className="w-10 h-10 text-primary animate-spin mb-md" />
        <p className="font-code-sm text-code-sm text-on-surface-variant">
          {state === ConnectionState.Reconnecting
            ? "Reconnecting…"
            : "Connecting to voice channel…"}
        </p>
      </div>
    );
  }

  // ── Connected ──
  return (
    <div className="flex-1 flex flex-col bg-surface min-h-0">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-md border-b border-outline-variant shrink-0">
        <div className="flex items-center">
          <Volume2 className="w-5 h-5 text-primary mr-sm" />
          <h3 className="font-headline-md text-headline-md font-bold text-on-surface">
            {directCall ? channelName : `#${channelName}`}
          </h3>
        </div>
        <div className="flex items-center space-x-1">
          <span
            className="hidden sm:flex items-center mr-sm text-primary"
            title="Noise suppression and echo cancellation are enabled"
          >
            <ShieldCheck className="w-4 h-4 mr-1" />
            <span className="font-label-caps text-label-caps">NOISE FILTER</span>
          </span>
          <span className="w-2 h-2 rounded-full bg-status-online flex-shrink-0 animate-pulse" />
          <span className="font-label-caps text-label-caps text-status-online">
            CONNECTED
          </span>
          <span className="ml-sm font-code-sm text-code-sm text-on-surface-variant">
            · {participants.length} {participants.length === 1 ? "user" : "users"}
          </span>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="border-b border-error/30 bg-error/10 px-md py-sm text-sm text-error"
        >
          Voice error: {error}
        </div>
      )}

      {/* Participants grid */}
      <div className="flex-1 overflow-y-auto p-md min-h-0">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-sm auto-rows-min">
          {/* Screen share spotlight */}
          {screenSharer && <ScreenShareTile participant={screenSharer} />}

          {/* Participant tiles */}
          {participants.map((p) => (
            <ParticipantTile key={p.identity} participant={p} />
          ))}
        </div>

        {participants.length === 1 && (
          <p className="text-center text-on-surface-variant font-code-sm text-code-sm mt-lg opacity-60">
            You're the only one here. Invite others to join!
          </p>
        )}
      </div>

      {/* Controls */}
      <VoiceControls
        isMicMuted={isMicMuted}
        isCameraOff={isCameraOff}
        isScreenSharing={isScreenSharing}
        onToggleMic={toggleMic}
        onToggleCamera={toggleCamera}
        onToggleScreenShare={toggleScreenShare}
        onDisconnect={disconnect}
      />
    </div>
  );
}
