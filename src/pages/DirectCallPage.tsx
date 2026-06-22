import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { VoiceRoom } from "@/components/voice/VoiceRoom";

/** One-to-one voice call; uses a stable LiveKit room derived from friendship id. */
export function DirectCallPage() {
  const { roomId } = useParams();
  const [params] = useSearchParams();
  if (!roomId) return <Navigate to="/friends" replace />;
  const friendName = params.get("name")?.slice(0, 32) || "Friend Call";
  return (
    <VoiceRoom
      key={roomId}
      channelId={`direct-${roomId}`}
      channelName={`Call with ${friendName}`}
      directCall
    />
  );
}
