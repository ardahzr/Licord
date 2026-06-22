import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  HeadphoneOff,
  Headphones,
  Mic,
  MicOff,
  PhoneOff,
  Signal,
} from "lucide-react";
import {
  disconnectActiveVoice,
  setActiveVoiceDeafened,
  setActiveVoiceMuted,
} from "@/hooks/useVoiceRoom";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

/** Persistent Discord-style call status and controls for both sidebar modes. */
export function VoiceConnectionPanel() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const activeVoiceChannelId = useAppStore((state) => state.activeVoiceChannelId);
  const label = useAppStore((state) => state.activeVoiceLabel);
  const path = useAppStore((state) => state.activeVoicePath);
  const muted = useAppStore((state) => state.isMicMuted);
  const deafened = useAppStore((state) => state.isDeafened);

  if (!activeVoiceChannelId) return null;

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch (error) {
      console.error("Voice control failed:", error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="shrink-0 border-t border-outline-variant bg-surface-container px-sm py-sm">
      <div className="flex items-center gap-sm">
        <button
          type="button"
          onClick={() => path && navigate(path)}
          className="min-w-0 flex-1 text-left"
          title="Return to voice call"
        >
          <span className="flex items-center text-xs font-bold text-status-online">
            <Signal className="mr-xs h-4 w-4" /> Voice Connected
          </span>
          <span className="block truncate text-[11px] text-on-surface-variant">
            {label ?? "Voice call"}
          </span>
        </button>
        <button
          type="button"
          aria-label="Disconnect from voice"
          title="Disconnect"
          disabled={busy}
          onClick={() => void run(disconnectActiveVoice)}
          className="rounded p-xs text-on-surface-variant transition-colors hover:bg-error/15 hover:text-error disabled:opacity-50"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-sm grid grid-cols-2 gap-xs">
        <VoiceButton
          label={muted ? "Unmute microphone" : "Mute microphone"}
          active={muted}
          disabled={busy}
          onClick={() => void run(() => setActiveVoiceMuted(!muted))}
        >
          {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          <span>{muted ? "Muted" : "Mic"}</span>
        </VoiceButton>
        <VoiceButton
          label={deafened ? "Undeafen" : "Deafen"}
          active={deafened}
          disabled={busy}
          onClick={() => void run(() => setActiveVoiceDeafened(!deafened))}
        >
          {deafened ? (
            <HeadphoneOff className="h-4 w-4" />
          ) : (
            <Headphones className="h-4 w-4" />
          )}
          <span>{deafened ? "Deafened" : "Deafen"}</span>
        </VoiceButton>
      </div>
    </div>
  );
}

function VoiceButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-xs rounded bg-surface-container-high px-xs py-1.5 text-[11px] transition-colors disabled:opacity-50",
        active
          ? "text-error hover:bg-error/15"
          : "text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface",
      )}
    >
      {children}
    </button>
  );
}
