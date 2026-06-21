import { useParams, useOutletContext, Navigate } from "react-router-dom";
import { ChatArea } from "@/components/chat/ChatArea";
import { CoWatchPanel } from "@/components/cowatch/CoWatchPanel";
import { FullScreenLoader } from "@/components/auth/RequireAuth";
import { useAppStore } from "@/store/useAppStore";
import type { AppOutletContext } from "@/components/layout/AppLayout";

/** Main 3-column experience: chat + (optional) co-watch panel. */
export function ChatPage() {
  const { channelId } = useParams();
  const { channels, channelsLoading } = useOutletContext<AppOutletContext>();
  const rightPanelOpen = useAppStore((s) => s.rightPanelOpen);

  if (channelsLoading) return <FullScreenLoader />;

  if (channels.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface text-on-surface-variant font-code-sm text-code-sm p-lg text-center">
        No channels yet. Run supabase/schema.sql to seed the default channels.
      </div>
    );
  }

  // No channel selected (Home / unknown id) → open the first one.
  const active = channelId
    ? channels.find((c) => c.id === channelId)
    : channels[0];
  if (!active) return <Navigate to={`/channels/${channels[0].id}`} replace />;

  return (
    <>
      <ChatArea channelId={active.id} channelName={active.name} />
      {rightPanelOpen && <CoWatchPanel roomId={active.id} />}
    </>
  );
}
