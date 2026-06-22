import { useMemo, useState, type FormEvent } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  Check,
  Clock3,
  Loader2,
  MessageCircle,
  Phone,
  Search,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AppOutletContext } from "@/components/layout/AppLayout";
import type { Friendship } from "@/hooks/useFriends";
import { cn, initials } from "@/lib/utils";

const TABS = ["Online", "All", "Pending", "Blocked"] as const;
type Tab = (typeof TABS)[number];

/** Supabase-backed friends roster with request and response workflows. */
export function FriendsPage() {
  const navigate = useNavigate();
  const { friends } = useOutletContext<AppOutletContext>();
  const [tab, setTab] = useState<Tab>("Online");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [username, setUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const visible = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return friends.friendships.filter((friendship) => {
      const matchesSearch = friendship.other.username
        .toLocaleLowerCase()
        .includes(search);
      if (!matchesSearch) return false;
      if (tab === "Pending") return friendship.status === "pending";
      if (tab === "Blocked") return friendship.status === "blocked";
      if (friendship.status !== "accepted") return false;
      if (tab === "Online") return friendship.other.status !== "offline";
      return true;
    });
  }, [friends.friendships, query, tab]);

  const pendingCount = friends.friendships.filter(
    (friendship) => friendship.status === "pending" && friendship.incoming,
  ).length;

  const submitRequest = async (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim() || submitting) return;
    setSubmitting(true);
    setSuccess(null);
    friends.clearError();
    try {
      await friends.sendRequest(username);
      setSuccess(`Friend request sent to ${username.trim()}.`);
      setUsername("");
      setTab("Pending");
    } catch {
      // The hook exposes the server's useful error message.
    } finally {
      setSubmitting(false);
    }
  };

  const runAction = async (id: string, action: () => Promise<void>) => {
    setActionId(id);
    setSuccess(null);
    try {
      await action();
    } catch {
      // The hook keeps the server error for the visible alert below.
    } finally {
      setActionId(null);
    }
  };

  return (
    <main className="relative flex h-full min-w-0 flex-1 flex-col bg-surface-dim">
      <header className="flex h-16 w-full shrink-0 items-center border-b border-outline-variant bg-surface px-md">
        <div className="flex items-center gap-sm border-r border-outline-variant pr-md">
          <Users className="h-5 w-5 text-on-surface-variant" />
          <h2 className="font-headline-md text-headline-md font-bold text-on-surface">
            Friends
          </h2>
        </div>
        <div className="ml-md hidden h-full items-center gap-xs md:flex">
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={cn(
                "rounded px-sm py-xs text-sm font-medium transition-colors",
                tab === item
                  ? "bg-surface-container-high text-on-surface"
                  : "text-on-surface-variant hover:text-on-surface",
              )}
            >
              {item}
              {item === "Pending" && pendingCount > 0 && (
                <span className="ml-xs rounded-full bg-error px-1.5 py-0.5 text-[10px] text-on-error">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
        <Button
          variant={adding ? "outline" : "secondary"}
          size="sm"
          className="ml-auto"
          onClick={() => {
            setAdding((current) => !current);
            setSuccess(null);
            friends.clearError();
          }}
        >
          <UserPlus className="h-4 w-4" />
          {adding ? "Close" : "Add Friend"}
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto p-lg">
        <div className="mx-auto max-w-3xl">
          {adding && (
            <form
              onSubmit={(event) => void submitRequest(event)}
              className="mb-lg border border-outline-variant bg-surface-container-low p-md"
            >
              <h3 className="text-lg font-bold text-on-surface">Add Friend</h3>
              <p className="mb-md mt-xs text-sm text-on-surface-variant">
                Enter their exact Licord username. Requests appear instantly.
              </p>
              <div className="flex gap-sm">
                <Input
                  autoFocus
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="username"
                  maxLength={32}
                />
                <Button type="submit" disabled={!username.trim() || submitting}>
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserPlus className="h-4 w-4" />
                  )}
                  Send Request
                </Button>
              </div>
              {friends.error && (
                <div className="mt-sm text-sm text-error">{friends.error}</div>
              )}
              {success && (
                <div className="mt-sm text-sm text-status-online">{success}</div>
              )}
            </form>
          )}

          <div className="relative mb-lg">
            <Search className="absolute left-sm top-1/2 h-5 w-5 -translate-y-1/2 text-on-surface-variant" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search friends"
              className="pl-xl"
            />
          </div>

          {!adding && friends.error && (
            <div className="mb-md border border-error/30 bg-error/10 p-sm text-sm text-error">
              {friends.error}
            </div>
          )}

          <div className="mb-sm flex items-center justify-between border-b border-outline-variant pb-sm text-xs font-bold uppercase tracking-wider text-on-surface-variant">
            <span>
              {tab} — {visible.length}
            </span>
          </div>

          {friends.loading ? (
            <div className="flex items-center gap-sm py-lg text-on-surface-variant">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading friends…
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-on-surface-variant">
              <Users className="mb-md h-12 w-12 opacity-30" />
              <div className="font-bold text-on-surface">Nothing here yet</div>
              <div className="mt-xs text-sm">
                {tab === "Pending"
                  ? "Friend requests will appear here."
                  : "Add someone by username to get started."}
              </div>
            </div>
          ) : (
            <div>
              {visible.map((friendship) => (
                <FriendRow
                  key={friendship.id}
                  friendship={friendship}
                  busy={actionId === friendship.id}
                  onAccept={() =>
                    void runAction(friendship.id, () =>
                      friends.respondToRequest(friendship.id, true),
                    )
                  }
                  onReject={() =>
                    void runAction(friendship.id, () =>
                      friendship.incoming
                        ? friends.respondToRequest(friendship.id, false)
                        : friends.removeFriend(friendship.id),
                    )
                  }
                  onRemove={() =>
                    void runAction(friendship.id, () =>
                      friends.removeFriend(friendship.id),
                    )
                  }
                  onCall={() =>
                    navigate(
                      `/call/friend-${friendship.id}?name=${encodeURIComponent(friendship.other.username)}`,
                    )
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function FriendRow({
  friendship,
  busy,
  onAccept,
  onReject,
  onRemove,
  onCall,
}: {
  friendship: Friendship;
  busy: boolean;
  onAccept: () => void;
  onReject: () => void;
  onRemove: () => void;
  onCall: () => void;
}) {
  const pending = friendship.status === "pending";
  const description = pending
    ? friendship.incoming
      ? "Incoming friend request"
      : "Friend request sent"
    : friendship.other.status === "offline"
      ? "Offline"
      : friendship.other.status;

  return (
    <div className="group flex items-center gap-md border-b border-outline-variant px-xs py-sm transition-colors hover:bg-surface-container-low">
      <Avatar
        src={friendship.other.avatar_url}
        fallback={initials(friendship.other.username)}
        status={friendship.other.status}
        sizeClassName="w-10 h-10"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate font-bold text-on-surface">
          {friendship.other.username}
        </div>
        <div className="truncate text-xs capitalize text-on-surface-variant">
          {description}
        </div>
      </div>

      {busy ? (
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      ) : pending ? (
        <div className="flex gap-xs">
          {friendship.incoming ? (
            <ActionButton label="Accept" onClick={onAccept} positive>
              <Check className="h-4 w-4" />
            </ActionButton>
          ) : (
            <span className="flex items-center gap-xs px-sm text-xs text-on-surface-variant">
              <Clock3 className="h-4 w-4" /> Sent
            </span>
          )}
          <ActionButton label={friendship.incoming ? "Reject" : "Cancel"} onClick={onReject}>
            <X className="h-4 w-4" />
          </ActionButton>
        </div>
      ) : friendship.status === "accepted" ? (
        <div className="flex gap-xs opacity-70 transition-opacity group-hover:opacity-100">
          <ActionButton label="Message (coming next)" disabled>
            <MessageCircle className="h-4 w-4" />
          </ActionButton>
          <ActionButton label="Start voice call" onClick={onCall} positive>
            <Phone className="h-4 w-4" />
          </ActionButton>
          <ActionButton label="Remove friend" onClick={onRemove}>
            <X className="h-4 w-4" />
          </ActionButton>
        </div>
      ) : (
        <ActionButton label="Remove blocked user" onClick={onRemove}>
          <X className="h-4 w-4" />
        </ActionButton>
      )}
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  positive = false,
  disabled = false,
  children,
}: {
  label: string;
  onClick?: () => void;
  positive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant transition-colors disabled:cursor-not-allowed disabled:opacity-35",
        positive
          ? "hover:bg-status-online/20 hover:text-status-online"
          : "hover:bg-error/20 hover:text-error",
      )}
    >
      {children}
    </button>
  );
}
