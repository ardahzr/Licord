import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneCall, Signal } from "lucide-react";
import { TopBar } from "@/components/chat/TopBar";
import { MessageList } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import { useMessages } from "@/hooks/useMessages";
import type { MessageTargetType } from "@/hooks/useMessages";
import { useAppStore } from "@/store/useAppStore";

interface ChatAreaProps {
  channelId: string;
  channelName: string;
  targetType?: MessageTargetType;
  group?: boolean;
  onStartCall?: () => void;
  onToggleMembers?: () => void;
  membersOpen?: boolean;
}

/** Middle column: header + live message stream + composer for one channel. */
export function ChatArea({
  channelId,
  channelName,
  targetType = "channel",
  group = false,
  onStartCall,
  onToggleMembers,
  membersOpen = false,
}: ChatAreaProps) {
  const navigate = useNavigate();
  const { messages, loading, error, sendMessage } = useMessages(
    channelId,
    targetType,
  );
  const [searchQuery, setSearchQuery] = useState("");
  const markChannelRead = useAppStore((state) => state.markChannelRead);
  const setActiveChannel = useAppStore((state) => state.setActiveChannel);
  const activeVoiceChannelId = useAppStore((state) => state.activeVoiceChannelId);
  const activeVoicePath = useAppStore((state) => state.activeVoicePath);
  const activeVoiceLabel = useAppStore((state) => state.activeVoiceLabel);
  const hasBackgroundCall = group && Boolean(activeVoiceChannelId);
  const isCurrentGroupCall =
    group && activeVoiceChannelId === `direct-group-${channelId}`;
  const display = group ? channelName : `# ${channelName}`;

  useEffect(() => {
    setSearchQuery("");
    markChannelRead(channelId);
    setActiveChannel(channelId);
    return () => setActiveChannel(null);
  }, [channelId, markChannelRead, setActiveChannel]);

  useEffect(() => {
    const markReadWhenVisible = () => {
      if (!document.hidden && document.hasFocus()) markChannelRead(channelId);
    };
    window.addEventListener("focus", markReadWhenVisible);
    document.addEventListener("visibilitychange", markReadWhenVisible);
    return () => {
      window.removeEventListener("focus", markReadWhenVisible);
      document.removeEventListener("visibilitychange", markReadWhenVisible);
    };
  }, [channelId, markChannelRead]);

  const visibleMessages = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return messages;
    return messages.filter(
      (message) =>
        message.content.toLocaleLowerCase().includes(query) ||
        message.sender?.username.toLocaleLowerCase().includes(query),
    );
  }, [messages, searchQuery]);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-surface">
      <TopBar
        channelName={display}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        group={group}
        onStartCall={onStartCall}
        onToggleMembers={onToggleMembers}
        membersOpen={membersOpen}
      />
      {hasBackgroundCall && (
        <button
          type="button"
          onClick={() => activeVoicePath && navigate(activeVoicePath)}
          className="flex shrink-0 items-center gap-sm border-b border-status-online/30 bg-status-online/10 px-md py-sm text-left transition-colors hover:bg-status-online/15"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-status-online/20 text-status-online">
            <Signal className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block text-sm text-status-online">
              {isCurrentGroupCall
                ? "Connected to this group call"
                : "Voice call running in background"}
            </strong>
            <span className="block text-[11px] text-on-surface-variant">
              {activeVoiceLabel ?? "Your microphone stays active while you read messages."}
            </span>
          </span>
          <span className="flex items-center gap-xs rounded bg-status-online px-sm py-xs text-xs font-bold text-black">
            <PhoneCall className="h-4 w-4" /> Return to call
          </span>
        </button>
      )}
      {error && (
        <div
          role="alert"
          className="border-b border-error/40 bg-error-container/20 px-md py-sm text-code-sm font-code-sm text-error"
        >
          Message error: {error}
        </div>
      )}
      <MessageList
        channelName={display}
        messages={visibleMessages}
        loading={loading}
        searching={Boolean(searchQuery.trim())}
        conversation={group}
      />
      <MessageInput
        channelId={channelId}
        channelName={display}
        onSend={sendMessage}
      />
    </div>
  );
}
