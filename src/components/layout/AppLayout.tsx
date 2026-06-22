import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { NotificationToasts } from "@/components/notifications/NotificationToasts";
import { useChannels } from "@/hooks/useChannels";
import { useFriends, type UseFriends } from "@/hooks/useFriends";
import { useMessageNotifications } from "@/hooks/useMessageNotifications";
import { useGroupChats } from "@/hooks/useGroupChats";
import { useServers } from "@/hooks/useServers";
import { useAppStore } from "@/store/useAppStore";
import type { Channel, Server } from "@/types/database";
import { useGlobalVoicePresence } from "@/hooks/useGlobalVoicePresence";

export interface AppOutletContext {
  channels: Channel[];
  textChannels: Channel[];
  voiceChannels: Channel[];
  channelsLoading: boolean;
  selectedServer: Server | null;
  friends: UseFriends;
  groupChats: ReturnType<typeof useGroupChats>;
}

/**
 * Authenticated app shell: persistent left Sidebar + routed content.
 * Channels are fetched once here and shared with the Sidebar (prop) and pages
 * (Outlet context). The optional right co-watch column lives in the pages.
 */
export function AppLayout() {
  const {
    servers,
    loading: serversLoading,
    error: serversError,
    createServer,
    addMember,
  } = useServers();
  const activeServerId = useAppStore((state) => state.activeServerId);
  const setActiveServer = useAppStore((state) => state.setActiveServer);
  const selectedServer =
    servers.find((server) => server.id === activeServerId) ?? null;
  const {
    channels,
    textChannels,
    voiceChannels,
    loading: channelsLoading,
    error: channelsError,
    createChannel,
  } = useChannels(selectedServer?.id ?? null);
  const friends = useFriends();
  const groupChats = useGroupChats();
  const voiceUsers = useGlobalVoicePresence();

  useEffect(() => {
    if (serversLoading) return;
    if (
      !activeServerId ||
      !servers.some((server) => server.id === activeServerId)
    ) {
      setActiveServer(servers[0]?.id ?? null);
    }
  }, [activeServerId, servers, serversLoading, setActiveServer]);

  useMessageNotifications(channels, groupChats.groupChats);

  const loading =
    serversLoading ||
    (servers.length > 0 && (!selectedServer || channelsLoading));

  return (
    <div className="h-full w-full flex overflow-hidden">
      <Sidebar
        servers={servers}
        selectedServer={selectedServer}
        textChannels={textChannels}
        voiceChannels={voiceChannels}
        voiceUsers={voiceUsers}
        pendingFriendCount={
          friends.friendships.filter(
            (friend) => friend.status === "pending" && friend.incoming,
          ).length
        }
        error={serversError ?? channelsError}
        onSelectServer={setActiveServer}
        onCreateServer={createServer}
        onCreateChannel={createChannel}
        onAddMember={addMember}
        acceptedFriends={friends.friendships.filter(
          (friend) => friend.status === "accepted",
        )}
        groupChats={groupChats.groupChats}
        groupChatsLoading={groupChats.loading}
        groupChatsError={groupChats.error}
        onCreateGroupChat={groupChats.createGroupChat}
      />
      <Outlet
        context={
          {
            channels: textChannels,
            textChannels,
            voiceChannels,
            channelsLoading: loading,
            selectedServer,
            friends,
            groupChats,
          } satisfies AppOutletContext
        }
      />
      <NotificationCenter />
      <NotificationToasts />
    </div>
  );
}
