import { useState, type FormEvent } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Hash,
  Home,
  LogOut,
  MessageSquare,
  MessagesSquare,
  MicOff,
  Plus,
  Settings,
  UserPlus,
  Volume2,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { cn, initials } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import type { Friendship } from "@/hooks/useFriends";
import type { VoiceUserPresence } from "@/hooks/useGlobalVoicePresence";
import type { GroupChatWithMembers } from "@/hooks/useGroupChats";
import { VoiceConnectionPanel } from "@/components/voice/VoiceConnectionPanel";
import type {
  Channel,
  ChannelType,
  GroupChat,
  PresenceStatus,
  Server,
} from "@/types/database";

const STATUS_LABEL: Record<PresenceStatus, string> = {
  online: "Online",
  away: "Away",
  busy: "Busy",
  offline: "Offline",
};

const STATUS_DOT: Record<PresenceStatus, string> = {
  online: "bg-status-online",
  away: "bg-status-away",
  busy: "bg-status-busy",
  offline: "bg-surface-container-high",
};

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex items-center rounded px-sm py-2 transition-colors duration-200 active:scale-[0.98]",
    isActive
      ? "bg-surface-container-high text-primary"
      : "text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface",
  );

interface SidebarProps {
  servers: Server[];
  selectedServer: Server | null;
  textChannels: Channel[];
  voiceChannels: Channel[];
  voiceUsers?: VoiceUserPresence[];
  pendingFriendCount: number;
  error: string | null;
  onSelectServer: (id: string) => void;
  onCreateServer: (name: string) => Promise<Server>;
  onCreateChannel: (name: string, type: ChannelType) => Promise<Channel>;
  onAddMember: (serverId: string, userId: string) => Promise<void>;
  acceptedFriends: Friendship[];
  groupChats: GroupChatWithMembers[];
  groupChatsLoading: boolean;
  groupChatsError: string | null;
  onCreateGroupChat: (name: string, memberIds: string[]) => Promise<GroupChat>;
}

type CreateMode = "server" | ChannelType | null;

/** Discord-like server rail plus the selected community's channel sidebar. */
export function Sidebar({
  servers,
  selectedServer,
  textChannels,
  voiceChannels,
  voiceUsers,
  pendingFriendCount,
  error,
  onSelectServer,
  onCreateServer,
  onCreateChannel,
  onAddMember,
  acceptedFriends,
  groupChats,
  groupChatsLoading,
  groupChatsError,
  onCreateGroupChat,
}: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const notifications = useAppStore((state) => state.notifications);
  const [createMode, setCreateMode] = useState<CreateMode>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const directMode =
    location.pathname === "/friends" ||
    location.pathname.startsWith("/dms/") ||
    location.pathname.startsWith("/call/");
  const status: PresenceStatus = profile?.status ?? "online";
  const canManage = Boolean(
    selectedServer?.owner_id && selectedServer.owner_id === profile?.id,
  );

  const selectServer = (serverId: string) => {
    onSelectServer(serverId);
    navigate("/");
  };

  return (
    <>
      <nav className="hidden h-full shrink-0 md:flex z-50">
        {/* Server rail */}
        <div className="flex w-[72px] flex-col items-center gap-sm overflow-y-auto border-r border-outline-variant bg-surface-container-lowest py-sm">
          <button
            type="button"
            title="Friends and direct messages"
            aria-label="Friends and direct messages"
            onClick={() => navigate("/friends")}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-primary transition-all hover:rounded-xl"
          >
            <Home className="h-5 w-5" />
          </button>
          <div className="h-px w-8 shrink-0 bg-outline-variant" />

          {servers.map((server) => {
            const active = server.id === selectedServer?.id;
            return (
              <button
                key={server.id}
                type="button"
                title={server.name}
                aria-label={`Open ${server.name}`}
                onClick={() => selectServer(server.id)}
                className="group relative flex h-12 w-12 shrink-0 items-center justify-center"
              >
                <span
                  className={cn(
                    "absolute -left-3 w-1 rounded-r bg-on-surface transition-all",
                    active ? "h-9" : "h-0 group-hover:h-5",
                  )}
                />
                <span
                  className={cn(
                    "flex h-12 w-12 items-center justify-center overflow-hidden bg-surface-container-high text-body-md font-bold text-on-surface transition-all group-hover:rounded-xl group-hover:bg-primary group-hover:text-on-primary",
                    active
                      ? "rounded-xl bg-primary text-on-primary"
                      : "rounded-2xl",
                  )}
                >
                  {server.icon_url ? (
                    <img
                      src={server.icon_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initials(server.name)
                  )}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            title="Create a server"
            aria-label="Create a server"
            onClick={() => setCreateMode("server")}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-container-high text-status-online transition-all hover:rounded-xl hover:bg-status-online hover:text-black"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        {directMode && (
          <DirectMessagesPanel
            groups={groupChats}
            loading={groupChatsLoading}
            error={groupChatsError}
            pendingFriendCount={pendingFriendCount}
            notifications={notifications}
            onCreate={() => setGroupDialogOpen(true)}
          />
        )}

        {/* Channel panel */}
        {!directMode && (
        <div className="flex h-full w-[248px] flex-col border-r border-outline-variant bg-surface-container-low">
          <div className="flex h-16 shrink-0 items-center border-b border-outline-variant px-md shadow-sm">
            <div className="min-w-0 flex-1">
              <div className="truncate font-headline-md text-headline-md font-bold text-on-surface">
                {selectedServer?.name ?? "No server"}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-on-surface-variant">
                {canManage ? "Your community" : "Community"}
              </div>
            </div>
            {canManage && selectedServer && (
              <button
                type="button"
                title="Add friends to server"
                aria-label="Add friends to server"
                onClick={() => setInviteOpen(true)}
                className="ml-sm p-xs text-on-surface-variant transition-colors hover:text-primary"
              >
                <UserPlus className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-sm py-sm">
            <NavLink to="/friends" className={linkClass}>
              <MessageSquare className="mr-sm h-5 w-5 shrink-0" />
              <span className="truncate">Friends</span>
              {pendingFriendCount > 0 && (
                <span className="ml-auto min-w-5 rounded-full bg-error px-1.5 py-0.5 text-center text-[10px] font-bold text-on-error">
                  {Math.min(99, pendingFriendCount)}
                </span>
              )}
            </NavLink>

            <ChannelHeading
              label="Text Channels"
              canCreate={canManage}
              onCreate={() => setCreateMode("text")}
            />
            {textChannels.map((channel) => (
              <NavLink
                key={channel.id}
                to={`/channels/${channel.id}`}
                className={linkClass}
              >
                <Hash className="mr-sm h-5 w-5 shrink-0" />
                <span className="truncate">{channel.name}</span>
                <UnreadBadge channelId={channel.id} notifications={notifications} />
              </NavLink>
            ))}

            <ChannelHeading
              label="Voice Channels"
              canCreate={canManage}
              onCreate={() => setCreateMode("voice")}
            />
            {voiceChannels.length === 0 ? (
              <div className="px-sm py-xs text-xs text-on-surface-variant opacity-70">
                No voice channels yet.
              </div>
            ) : (
              voiceChannels.map((channel) => {
                const usersInChannel = voiceUsers?.filter((u) => u.channelId === channel.id) ?? [];
                return (
                  <div key={channel.id}>
                    <NavLink
                      to={`/voice/${channel.id}`}
                      className={linkClass}
                    >
                      <Volume2 className="mr-sm h-5 w-5 shrink-0" />
                      <span className="truncate">{channel.name}</span>
                    </NavLink>
                    {usersInChannel.length > 0 && (
                      <div className="ml-[28px] mt-1 flex flex-col gap-1 pb-2 pr-sm">
                        {usersInChannel.map((user) => (
                          <div
                            key={user.userId}
                            className="flex items-center gap-2 rounded px-2 py-1 text-xs text-on-surface-variant hover:bg-surface-container-highest hover:text-on-surface"
                          >
                            <Avatar
                              src={user.avatar_url}
                              fallback={initials(user.username)}
                              sizeClassName="w-6 h-6"
                            />
                            <span className="truncate flex-1 font-medium">{user.username}</span>
                            {user.isMicMuted && (
                              <MicOff className="h-3.5 w-3.5 text-error shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {error && (
              <div className="mt-md flex gap-xs border border-error/30 bg-error/10 p-sm text-xs text-error">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="break-words">{error}</span>
              </div>
            )}
          </div>

          <VoiceConnectionPanel />

          {/* User panel */}
          <div className="flex h-16 shrink-0 items-center gap-sm border-t border-outline-variant bg-surface-container-high px-sm">
            <Avatar
              src={profile?.avatar_url}
              fallback={initials(profile?.username)}
              sizeClassName="w-9 h-9"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-on-surface">
                {profile?.username ?? "Connecting…"}
              </div>
              <div className="flex items-center text-[11px] text-on-surface-variant">
                <span className={cn("mr-1.5 h-2 w-2 rounded-full", STATUS_DOT[status])} />
                {STATUS_LABEL[status]}
              </div>
            </div>
            <button
              type="button"
              title="Settings"
              aria-label="Settings"
              onClick={() => navigate("/settings")}
              className="p-xs text-on-surface-variant transition-colors hover:text-primary"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              type="button"
              title="Log out"
              aria-label="Log out"
              onClick={() => void signOut()}
              className="p-xs text-on-surface-variant transition-colors hover:text-error"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        )}
      </nav>

      {createMode && (
        <CreateDialog
          mode={createMode}
          onClose={() => setCreateMode(null)}
          onCreateServer={async (name) => {
            const server = await onCreateServer(name);
            onSelectServer(server.id);
            navigate("/");
          }}
          onCreateChannel={async (name, type) => {
            const channel = await onCreateChannel(name, type);
            navigate(
              type === "voice"
                ? `/voice/${channel.id}`
                : `/channels/${channel.id}`,
            );
          }}
        />
      )}
      {inviteOpen && selectedServer && (
        <InviteDialog
          serverName={selectedServer.name}
          friends={acceptedFriends}
          onClose={() => setInviteOpen(false)}
          onInvite={(userId) => onAddMember(selectedServer.id, userId)}
        />
      )}
      {groupDialogOpen && (
        <CreateGroupDialog
          friends={acceptedFriends}
          onClose={() => setGroupDialogOpen(false)}
          onCreate={async (name, memberIds) => {
            const group = await onCreateGroupChat(name, memberIds);
            navigate(`/dms/${group.id}`);
          }}
        />
      )}
    </>
  );
}

function DirectMessagesPanel({
  groups,
  loading,
  error,
  pendingFriendCount,
  notifications,
  onCreate,
}: {
  groups: GroupChatWithMembers[];
  loading: boolean;
  error: string | null;
  pendingFriendCount: number;
  notifications: ReturnType<typeof useAppStore.getState>["notifications"];
  onCreate: () => void;
}) {
  const { profile, signOut } = useAuth();
  const status: PresenceStatus = profile?.status ?? "online";

  return (
    <div className="flex h-full w-[248px] flex-col border-r border-outline-variant bg-surface-container-low">
      <div className="flex h-16 shrink-0 items-center border-b border-outline-variant px-md shadow-sm">
        <div className="min-w-0 flex-1">
          <div className="truncate font-headline-md text-headline-md font-bold text-on-surface">
            Direct Messages
          </div>
          <div className="text-[10px] uppercase tracking-wider text-on-surface-variant">
            Friends & private groups
          </div>
        </div>
        <button
          type="button"
          title="Create group DM"
          aria-label="Create group DM"
          onClick={onCreate}
          className="p-xs text-on-surface-variant transition-colors hover:text-primary"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-sm py-sm">
        <NavLink to="/friends" className={linkClass}>
          <UserPlus className="mr-sm h-5 w-5 shrink-0" />
          <span className="truncate">Friends</span>
          {pendingFriendCount > 0 && (
            <span className="ml-auto min-w-5 rounded-full bg-error px-1.5 py-0.5 text-center text-[10px] font-bold text-on-error">
              {Math.min(99, pendingFriendCount)}
            </span>
          )}
        </NavLink>

        <div className="mt-md flex items-center px-sm pb-xs text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
          <span className="flex-1">Group DMs</span>
          <button type="button" title="Create group DM" onClick={onCreate}>
            <Plus className="h-4 w-4 transition-colors hover:text-primary" />
          </button>
        </div>

        {loading ? (
          <div className="px-sm py-sm text-xs text-on-surface-variant">
            Loading conversations…
          </div>
        ) : groups.length === 0 ? (
          <button
            type="button"
            onClick={onCreate}
            className="w-full px-sm py-sm text-left text-xs text-on-surface-variant transition-colors hover:text-primary"
          >
            No group chats yet. Create one →
          </button>
        ) : (
          groups.map((group) => (
            <NavLink
              key={group.id}
              to={`/dms/${group.id}`}
              className={linkClass}
              title={group.displayName}
            >
              <span className="mr-sm flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container-highest text-on-surface-variant">
                <MessagesSquare className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{group.displayName}</span>
                <span className="block text-[10px] text-on-surface-variant">
                  {group.members.length} members
                </span>
              </span>
              <UnreadBadge channelId={group.id} notifications={notifications} />
            </NavLink>
          ))
        )}

        {error && (
          <div className="mt-md flex gap-xs border border-error/30 bg-error/10 p-sm text-xs text-error">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="break-words">{error}</span>
          </div>
        )}
      </div>

      <VoiceConnectionPanel />
      <div className="flex h-16 shrink-0 items-center gap-sm border-t border-outline-variant bg-surface-container-high px-sm">
        <Avatar
          src={profile?.avatar_url}
          fallback={initials(profile?.username)}
          sizeClassName="w-9 h-9"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-on-surface">
            {profile?.username ?? "Connecting…"}
          </div>
          <div className="flex items-center text-[11px] text-on-surface-variant">
            <span className={cn("mr-1.5 h-2 w-2 rounded-full", STATUS_DOT[status])} />
            {STATUS_LABEL[status]}
          </div>
        </div>
        <button
          type="button"
          title="Log out"
          aria-label="Log out"
          onClick={() => void signOut()}
          className="p-xs text-on-surface-variant transition-colors hover:text-error"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function CreateGroupDialog({
  friends,
  onClose,
  onCreate,
}: {
  friends: Friendship[];
  onClose: () => void;
  onCreate: (name: string, memberIds: string[]) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (userId: string) => {
    setSelected((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : current.length < 9
          ? [...current, userId]
          : current,
    );
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (selected.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onCreate(name, selected);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create group");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-md backdrop-blur-sm"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <form
        onSubmit={(event) => void submit(event)}
        className="flex max-h-[min(680px,calc(100vh-32px))] w-full max-w-md flex-col border border-outline-variant bg-surface-container-low p-lg shadow-2xl"
      >
        <div className="mb-md flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-on-surface">Create Group DM</h2>
            <p className="mt-xs text-sm text-on-surface-variant">
              Select up to 9 friends. The conversation stays separate from servers.
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}>
            <X className="h-5 w-5 text-on-surface-variant" />
          </button>
        </div>

        <label className="mb-xs text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          Group name <span className="font-normal normal-case">(optional)</span>
        </label>
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Weekend crew"
          maxLength={40}
          className="mb-md"
        />

        <div className="mb-xs flex justify-between text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          <span>Select friends</span>
          <span>{selected.length}/9</span>
        </div>
        <div className="min-h-28 flex-1 overflow-y-auto border-y border-outline-variant">
          {friends.length === 0 ? (
            <div className="py-lg text-center text-sm text-on-surface-variant">
              Add and accept a friend first.
            </div>
          ) : (
            friends.map((friend) => {
              const checked = selected.includes(friend.other.id);
              return (
                <button
                  key={friend.id}
                  type="button"
                  onClick={() => toggle(friend.other.id)}
                  className={cn(
                    "flex w-full items-center gap-sm border-b border-outline-variant px-xs py-sm text-left transition-colors",
                    checked
                      ? "bg-primary/10"
                      : "hover:bg-surface-container-high",
                  )}
                >
                  <Avatar
                    src={friend.other.avatar_url}
                    fallback={initials(friend.other.username)}
                    status={friend.other.status}
                    sizeClassName="w-9 h-9"
                  />
                  <span className="min-w-0 flex-1 truncate font-bold text-on-surface">
                    {friend.other.username}
                  </span>
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded border",
                      checked
                        ? "border-primary bg-primary text-on-primary"
                        : "border-outline-variant",
                    )}
                  >
                    {checked && <span className="text-xs font-bold">✓</span>}
                  </span>
                </button>
              );
            })
          )}
        </div>
        {error && <div className="mt-sm text-sm text-error">{error}</div>}
        <div className="mt-lg flex justify-end gap-sm">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={selected.length === 0 || submitting}>
            {submitting ? "Creating…" : "Create Group"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function ChannelHeading({
  label,
  canCreate,
  onCreate,
}: {
  label: string;
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="mt-md flex items-center px-sm pb-xs text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">
      <span className="flex-1">{label}</span>
      {canCreate && (
        <button
          type="button"
          title={`Create ${label.toLocaleLowerCase()}`}
          onClick={onCreate}
          className="transition-colors hover:text-primary"
        >
          <Plus className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function UnreadBadge({
  channelId,
  notifications,
}: {
  channelId: string;
  notifications: ReturnType<typeof useAppStore.getState>["notifications"];
}) {
  const count = notifications.filter(
    (notification) => notification.channelId === channelId && !notification.read,
  ).length;
  if (!count) return null;
  return (
    <span className="ml-auto min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-center text-[10px] font-bold text-on-primary">
      {Math.min(99, count)}
    </span>
  );
}

function CreateDialog({
  mode,
  onClose,
  onCreateServer,
  onCreateChannel,
}: {
  mode: Exclude<CreateMode, null>;
  onClose: () => void;
  onCreateServer: (name: string) => Promise<void>;
  onCreateChannel: (name: string, type: ChannelType) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const title =
    mode === "server"
      ? "Create your server"
      : `Create a ${mode === "voice" ? "voice" : "text"} channel`;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "server") await onCreateServer(name);
      else await onCreateChannel(name, mode);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create it");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-md backdrop-blur-sm"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <form
        onSubmit={(event) => void submit(event)}
        className="w-full max-w-md border border-outline-variant bg-surface-container-low p-lg shadow-2xl"
      >
        <div className="mb-lg flex items-start justify-between">
          <div>
            <h2 className="font-headline-md text-2xl font-bold text-on-surface">
              {title}
            </h2>
            <p className="mt-xs text-sm text-on-surface-variant">
              {mode === "server"
                ? "A general text and voice channel will be created automatically."
                : "Members of this server will see the new channel immediately."}
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}>
            <X className="h-5 w-5 text-on-surface-variant" />
          </button>
        </div>
        <label className="mb-xs block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
          {mode === "server" ? "Server name" : "Channel name"}
        </label>
        <Input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={mode === "server" ? "My community" : "new-channel"}
          maxLength={40}
        />
        {error && <div className="mt-sm text-sm text-error">{error}</div>}
        <div className="mt-lg flex justify-end gap-sm">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!name.trim() || submitting}>
            {submitting ? "Creating…" : "Create"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function InviteDialog({
  serverName,
  friends,
  onClose,
  onInvite,
}: {
  serverName: string;
  friends: Friendship[];
  onClose: () => void;
  onInvite: (userId: string) => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [invited, setInvited] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const invite = async (friend: Friendship) => {
    setBusyId(friend.other.id);
    setError(null);
    try {
      await onInvite(friend.other.id);
      setInvited((current) => [...current, friend.other.id]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add member");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-md backdrop-blur-sm"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="w-full max-w-md border border-outline-variant bg-surface-container-low p-lg shadow-2xl">
        <div className="mb-md flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-on-surface">Add Friends</h2>
            <p className="mt-xs text-sm text-on-surface-variant">
              Add accepted friends to {serverName}.
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}>
            <X className="h-5 w-5 text-on-surface-variant" />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto border-t border-outline-variant">
          {friends.length === 0 ? (
            <div className="py-lg text-center text-sm text-on-surface-variant">
              Accept a friend request first, then you can add them here.
            </div>
          ) : (
            friends.map((friend) => {
              const wasInvited = invited.includes(friend.other.id);
              return (
                <div
                  key={friend.id}
                  className="flex items-center gap-sm border-b border-outline-variant py-sm"
                >
                  <Avatar
                    src={friend.other.avatar_url}
                    fallback={initials(friend.other.username)}
                    sizeClassName="w-9 h-9"
                  />
                  <span className="min-w-0 flex-1 truncate font-bold text-on-surface">
                    {friend.other.username}
                  </span>
                  <Button
                    size="sm"
                    variant={wasInvited ? "outline" : "secondary"}
                    disabled={wasInvited || busyId === friend.other.id}
                    onClick={() => void invite(friend)}
                  >
                    {wasInvited ? "Added" : "Add"}
                  </Button>
                </div>
              );
            })
          )}
        </div>
        {error && <div className="mt-sm text-sm text-error">{error}</div>}
      </div>
    </div>
  );
}
