import { TopBar } from "@/components/chat/TopBar";
import { MessageList } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import { useMessages } from "@/hooks/useMessages";

interface ChatAreaProps {
  channelId: string;
  channelName: string;
}

/** Middle column: header + live message stream + composer for one channel. */
export function ChatArea({ channelId, channelName }: ChatAreaProps) {
  const { messages, loading, sendMessage } = useMessages(channelId);
  const display = `# ${channelName}`;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-surface">
      <TopBar channelName={display} />
      <MessageList
        channelName={display}
        messages={messages}
        loading={loading}
      />
      <MessageInput
        channelId={channelId}
        channelName={display}
        onSend={sendMessage}
      />
    </div>
  );
}
