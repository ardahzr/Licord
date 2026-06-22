import { useParams, useOutletContext, Navigate } from "react-router-dom";
import { VoiceRoom } from "@/components/voice/VoiceRoom";
import { FullScreenLoader } from "@/components/auth/RequireAuth";
import type { AppOutletContext } from "@/components/layout/AppLayout";

/** Route page for `/voice/:channelId`. */
export function VoiceRoomPage() {
  const { channelId } = useParams();
  const { voiceChannels, channelsLoading } = useOutletContext<AppOutletContext>();

  if (channelsLoading) return <FullScreenLoader />;

  if (!channelId || voiceChannels.length === 0) {
    return <Navigate to="/" replace />;
  }

  const channel = voiceChannels.find((c) => c.id === channelId);
  if (!channel) return <Navigate to="/" replace />;

  return <VoiceRoom channelId={channel.id} channelName={channel.name} />;
}
