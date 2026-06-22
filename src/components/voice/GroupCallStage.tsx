import { useEffect, useRef } from "react";
import { ConnectionState } from "livekit-client";
import {
  HeadphoneOff,
  Headphones,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Settings,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import {
  setActiveVoiceDeafened,
  useVoiceRoom,
} from "@/hooks/useVoiceRoom";
import type { GroupChatWithMembers } from "@/hooks/useGroupChats";
import { initials } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

interface GroupCallStageProps {
  group: GroupChatWithMembers;
  onClose: () => void;
}

/** Discord-style inline group call: call presence above messages, not a new page. */
export function GroupCallStage({ group, onClose }: GroupCallStageProps) {
  const roomId = `direct-group-${group.id}`;
  const attempted = useRef(false);
  const {
    state,
    participants,
    connect,
    disconnect,
    toggleMic,
    isMicMuted,
    error,
  } = useVoiceRoom(roomId, `Call with ${group.displayName}`);
  const deafened = useAppStore((current) => current.isDeafened);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (attempted.current) return;
    const restoring = useAppStore.getState().activeVoiceChannelId === roomId;
    const timer = window.setTimeout(() => {
      attempted.current = true;
      if (stateRef.current === ConnectionState.Disconnected) void connect();
    }, restoring ? 400 : 100);
    return () => window.clearTimeout(timer);
  }, [connect, roomId]);

  const leave = () => {
    disconnect();
    onClose();
  };

  const connectedIds = new Set(participants.map((participant) => participant.identity));
  const connectedNames = new Set(participants.map((participant) => participant.name));

  return (
    <section className="shrink-0 border-b border-outline-variant bg-surface-container-lowest px-md py-md">
      <div className="mb-md flex items-center justify-between">
        <div className="flex items-center gap-sm">
          <Users className="h-5 w-5 text-primary" />
          <div>
            <h3 className="text-sm font-bold text-on-surface">Group voice call</h3>
            <p className="text-[11px] text-on-surface-variant">
              {state === ConnectionState.Connected
                ? `${participants.length} connected`
                : error
                  ? "Could not connect"
                  : "Connecting…"}
            </p>
          </div>
        </div>
        {error && (
          <button
            type="button"
            onClick={() => void connect()}
            className="rounded bg-primary px-sm py-xs text-xs font-bold text-on-primary"
          >
            Retry
          </button>
        )}
      </div>

      <div className="flex min-h-16 items-center gap-md overflow-x-auto py-xs">
        {group.members.map((member) => {
          const connected =
            connectedIds.has(member.user_id) || connectedNames.has(member.user.username);
          return (
            <div key={member.user_id} className="w-14 shrink-0 text-center">
              <div className="relative mx-auto w-fit">
                <Avatar
                  src={member.user.avatar_url}
                  fallback={initials(member.user.username)}
                  sizeClassName="w-11 h-11"
                  className={
                    connected
                      ? "rounded-full ring-2 ring-status-online ring-offset-2 ring-offset-surface-container-lowest"
                      : "rounded-full opacity-60"
                  }
                />
                {connected && (
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface-container-lowest bg-status-online" />
                )}
              </div>
              <span className="mt-xs block truncate text-[10px] text-on-surface-variant">
                {member.user.username}
              </span>
            </div>
          );
        })}
        {state !== ConnectionState.Connected && !error && (
          <Loader2 className="ml-sm h-5 w-5 shrink-0 animate-spin text-primary" />
        )}
      </div>

      <div className="mt-md flex items-center justify-center gap-sm">
        <CallButton
          label={isMicMuted ? "Unmute" : "Mute"}
          active={isMicMuted}
          onClick={() => void toggleMic()}
        >
          {isMicMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </CallButton>
        <button
          type="button"
          onClick={leave}
          className="flex items-center gap-xs rounded bg-error px-md py-2 text-xs font-bold text-on-error transition-colors hover:bg-error/80"
        >
          <PhoneOff className="h-4 w-4" /> Leave call
        </button>
        <CallButton
          label={deafened ? "Undeafen" : "Deafen"}
          active={deafened}
          onClick={() => void setActiveVoiceDeafened(!deafened)}
        >
          {deafened ? (
            <HeadphoneOff className="h-4 w-4" />
          ) : (
            <Headphones className="h-4 w-4" />
          )}
        </CallButton>
        <CallButton label="Voice settings" disabled onClick={() => undefined}>
          <Settings className="h-4 w-4" />
        </CallButton>
      </div>
    </section>
  );
}

function CallButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
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
      className={`flex h-9 w-9 items-center justify-center rounded transition-colors disabled:opacity-40 ${
        active
          ? "bg-error/20 text-error"
          : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
      }`}
    >
      {children}
    </button>
  );
}
