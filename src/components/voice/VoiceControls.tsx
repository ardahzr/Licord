import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  ScreenShareOff,
  PhoneOff,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface VoiceControlsProps {
  isMicMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onDisconnect: () => void;
  disabled?: boolean;
}

/**
 * Bottom control bar for voice/video calls.
 * Mic · Camera · Screen Share · Leave
 */
export function VoiceControls({
  isMicMuted,
  isCameraOff,
  isScreenSharing,
  onToggleMic,
  onToggleCamera,
  onToggleScreenShare,
  onDisconnect,
  disabled,
}: VoiceControlsProps) {
  return (
    <div className="flex items-center justify-center gap-sm p-md border-t border-outline-variant bg-surface-container-low shrink-0">
      {/* Microphone */}
      <ControlButton
        label={isMicMuted ? "Unmute mic" : "Mute mic"}
        active={!isMicMuted}
        danger={isMicMuted}
        onClick={onToggleMic}
        disabled={disabled}
      >
        {isMicMuted ? (
          <MicOff className="w-5 h-5" />
        ) : (
          <Mic className="w-5 h-5" />
        )}
      </ControlButton>

      {/* Camera */}
      <ControlButton
        label={isCameraOff ? "Turn on camera" : "Turn off camera"}
        active={!isCameraOff}
        danger={isCameraOff}
        onClick={onToggleCamera}
        disabled={disabled}
      >
        {isCameraOff ? (
          <VideoOff className="w-5 h-5" />
        ) : (
          <Video className="w-5 h-5" />
        )}
      </ControlButton>

      {/* Screen Share */}
      <ControlButton
        label={isScreenSharing ? "Stop sharing" : "Share screen"}
        active={isScreenSharing}
        onClick={onToggleScreenShare}
        disabled={disabled}
      >
        {isScreenSharing ? (
          <ScreenShareOff className="w-5 h-5" />
        ) : (
          <ScreenShare className="w-5 h-5" />
        )}
      </ControlButton>

      {/* Divider */}
      <div className="w-px h-8 bg-outline-variant mx-sm" />

      {/* Disconnect */}
      <button
        aria-label="Leave call"
        title="Leave call"
        onClick={onDisconnect}
        disabled={disabled}
        className={cn(
          "flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200 cursor-pointer",
          "bg-error hover:bg-error/80 text-white",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "active:scale-95",
        )}
      >
        <PhoneOff className="w-5 h-5" />
      </button>
    </div>
  );
}

// ── Internal ControlButton ──────────────────────────────────────────
function ControlButton({
  label,
  active,
  danger,
  onClick,
  disabled,
  children,
}: {
  label: string;
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center justify-center w-12 h-12 rounded-full transition-all duration-200 cursor-pointer",
        "active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
        danger
          ? "bg-surface-container-high text-error hover:bg-error/20"
          : active
            ? "bg-primary/20 text-primary hover:bg-primary/30"
            : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest",
      )}
    >
      {children}
    </button>
  );
}
