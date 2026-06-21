import { Users, Search, MessageCircle, Phone } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MOCK_FRIENDS, type MockFriend } from "@/lib/mock";

const TABS = ["Online", "All", "Pending", "Blocked"] as const;

/** Friends roster (Phase 2 wires the `friends` table + add-by-username). */
export function FriendsPage() {
  const online = MOCK_FRIENDS.filter((f) => f.status !== "offline");
  const offline = MOCK_FRIENDS.filter((f) => f.status === "offline");

  return (
    <main className="flex-1 flex flex-col h-full bg-surface-dim relative min-w-0">
      {/* Header */}
      <header className="flex justify-between items-center w-full px-md bg-surface h-16 border-b border-outline-variant flex-shrink-0">
        <div className="flex items-center gap-sm">
          <Users className="w-5 h-5 text-on-surface-variant" />
          <h2 className="font-headline-md text-headline-md font-bold text-on-surface">
            Friends
          </h2>
        </div>
        <div className="flex items-center gap-md">
          <div className="hidden md:flex gap-sm">
            {TABS.map((tab, i) => (
              <button
                key={tab}
                className={cn(
                  "px-sm py-[18px] font-label-caps text-label-caps cursor-pointer transition-colors",
                  i === 0
                    ? "text-primary border-b-2 border-primary"
                    : "text-on-surface-variant hover:text-primary",
                )}
              >
                {tab}
              </button>
            ))}
          </div>
          <Button variant="secondary" size="sm" className="ml-lg">
            Add Friend
          </Button>
        </div>
      </header>

      {/* Roster */}
      <div className="flex-1 overflow-y-auto p-lg">
        <div className="mb-lg max-w-2xl mx-auto">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <Input
              placeholder="Search friends or add by username..."
              className="pl-xl"
            />
          </div>
        </div>

        <div className="max-w-2xl mx-auto">
          <FriendGroup
            label={`Online — ${online.length}`}
            friends={online}
          />
          {offline.length > 0 && (
            <FriendGroup
              label={`Offline — ${offline.length}`}
              friends={offline}
              className="mt-xl"
              dimmed
            />
          )}
        </div>
      </div>
    </main>
  );
}

function FriendGroup({
  label,
  friends,
  className,
  dimmed = false,
}: {
  label: string;
  friends: MockFriend[];
  className?: string;
  dimmed?: boolean;
}) {
  return (
    <div className={className}>
      <h3 className="font-label-caps text-label-caps text-on-surface-variant mb-sm uppercase">
        {label}
      </h3>
      <div className="space-y-sm">
        {friends.map((friend) => (
          <FriendRow key={friend.id} friend={friend} dimmed={dimmed} />
        ))}
      </div>
    </div>
  );
}

function FriendRow({
  friend,
  dimmed,
}: {
  friend: MockFriend;
  dimmed: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between p-sm border-t border-transparent transition-colors group cursor-pointer hover:bg-surface-container-highest hover:border-outline-variant",
        dimmed && "opacity-60",
      )}
    >
      <div className="flex items-center gap-md">
        <Avatar
          fallback={friend.fallback}
          status={friend.status}
          sizeClassName="w-10 h-10"
          grayscale={dimmed}
        />
        <div>
          <div className="font-body-lg text-body-lg text-on-surface flex items-center gap-xs">
            {friend.name}
            {friend.tag && (
              <span className="font-code-sm text-code-sm text-on-surface-variant bg-surface-container-high px-1 rounded-sm border border-outline-variant">
                {friend.tag}
              </span>
            )}
          </div>
          <div className="font-body-md text-body-md text-on-surface-variant truncate w-48">
            {friend.activity}
          </div>
        </div>
      </div>
      {!dimmed && (
        <div className="flex items-center gap-sm opacity-0 group-hover:opacity-100 transition-opacity">
          <FriendAction label="Message" icon={MessageCircle} />
          <FriendAction label="Voice Call" icon={Phone} />
        </div>
      )}
    </div>
  );
}

function FriendAction({
  label,
  icon: Icon,
}: {
  label: string;
  icon: typeof Phone;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      className="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant text-on-surface-variant hover:bg-primary-container hover:text-on-primary-container flex items-center justify-center transition-colors"
    >
      <Icon className="w-[18px] h-[18px]" />
    </button>
  );
}
