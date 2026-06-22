import { useEffect, useRef } from "react";
import { History, Loader2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { initials } from "@/lib/utils";
import type { ChatMessage } from "@/hooks/useMessages";
import { MediaAttachment } from "@/components/chat/MediaAttachment";

interface MessageListProps {
  channelName: string;
  messages: ChatMessage[];
  loading: boolean;
  searching?: boolean;
  conversation?: boolean;
}

const MEDIA_URL = /^https:\/\/[^\s]+\.(?:png|jpe?g|webp|gif|svg|mp4|webm|ogg|ogv|mov|m4v)(?:\?[^\s]*)?$/i;

function messageMedia(msg: ChatMessage): string | null {
  if (msg.media_url) return msg.media_url;
  const content = msg.content.trim();
  return MEDIA_URL.test(content) ? content : null;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return sameDay ? `Today at ${time}` : `${d.toLocaleDateString()} ${time}`;
}

/**
 * Scrollable message stream ("stream" layout, no bubbles). Auto-scrolls to the
 * newest message as Realtime delivers inserts.
 */
export function MessageList({
  channelName,
  messages,
  loading,
  searching = false,
  conversation = false,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <main className="flex-1 overflow-y-auto p-md space-y-md font-code-sm text-code-sm select-text flex flex-col justify-end">
      {/* Channel start banner */}
      <div className="w-full mb-lg flex items-end opacity-50 pb-md border-b border-outline-variant">
        <div className="text-on-surface-variant">
          <History className="w-8 h-8 mb-sm block" />
          Welcome to the start of the{" "}
          <strong className="text-primary">{channelName}</strong>{" "}
          {conversation ? "conversation" : "channel"}.
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-sm text-on-surface-variant py-md">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading messages…
        </div>
      ) : messages.length === 0 && searching ? (
        <div className="py-md text-on-surface-variant">
          No matching messages.
        </div>
      ) : (
        messages.map((msg) => {
          const mediaUrl = messageMedia(msg);
          const contentIsMediaUrl = mediaUrl === msg.content.trim();
          return (
          <div
            key={msg.id}
            className="flex group hover:bg-surface-container-low transition-colors p-unit -mx-unit"
          >
            <Avatar
              src={msg.sender?.avatar_url}
              fallback={initials(msg.sender?.username)}
              sizeClassName="w-10 h-10"
              className="mr-sm mt-xs"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline mb-xs">
                <span className="font-bold text-on-surface mr-sm">
                  {msg.sender?.username ?? "unknown"}
                </span>
                <span className="text-[11px] text-on-surface-variant">
                  {formatTime(msg.created_at)}
                </span>
              </div>
              {msg.content && !contentIsMediaUrl && (
                <div className="text-on-surface whitespace-pre-wrap leading-relaxed">
                  {msg.content}
                </div>
              )}
              {mediaUrl && <MediaAttachment url={mediaUrl} />}
            </div>
          </div>
          );
        })
      )}
      <div ref={bottomRef} />
    </main>
  );
}
