import { Hash, Search, Pin, Bell, Users, MonitorPlay, Phone, MessagesSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

interface TopBarProps {
  channelName: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  group?: boolean;
  onStartCall?: () => void;
  onToggleMembers?: () => void;
  membersOpen?: boolean;
}

const TABS = ["Threads", "Pins", "Notifications"] as const;

/** Channel header: title, contextual tabs, search, and panel toggles. */
export function TopBar({
  channelName,
  searchQuery,
  onSearchChange,
  group = false,
  onStartCall,
  onToggleMembers,
  membersOpen = false,
}: TopBarProps) {
  const {
    rightPanelOpen,
    toggleRightPanel,
    notifications,
    notificationCenterOpen,
    toggleNotificationCenter,
  } = useAppStore();
  const unreadCount = notifications.filter((item) => !item.read).length;

  return (
    <header className="flex justify-between items-center w-full px-md h-16 border-b border-outline-variant bg-surface shrink-0 z-40">
      <div className="flex items-center min-w-0 flex-shrink">
        {group ? (
          <MessagesSquare className="w-5 h-5 text-on-surface-variant mr-sm hidden md:block" />
        ) : (
          <Hash className="w-5 h-5 text-on-surface-variant mr-sm hidden md:block" />
        )}
        <h2 className="font-headline-md text-headline-md font-bold text-on-surface truncate">
          {channelName}
        </h2>
      </div>

      {/* Contextual tabs */}
      {!group && <nav className="hidden lg:flex items-center h-full ml-lg space-x-md flex-shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={
              tab === "Notifications" ? toggleNotificationCenter : undefined
            }
            data-notification-trigger={tab === "Notifications" || undefined}
            disabled={tab !== "Notifications"}
            title={
              tab === "Notifications"
                ? "Open notifications"
                : `${tab} are not available yet`
            }
            className={cn(
              "h-full flex items-center px-sm transition-colors cursor-pointer font-label-caps text-label-caps",
              tab === "Notifications" && notificationCenterOpen
                ? "text-primary border-b-2 border-primary"
                : "text-on-surface-variant hover:text-primary disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:text-on-surface-variant",
            )}
          >
            {tab}
          </button>
        ))}
      </nav>}

      <div className="flex items-center ml-auto flex-shrink-0 space-x-sm">
        <div className="relative hidden md:block w-48 lg:w-64">
          <Search className="w-4 h-4 absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <Input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search messages"
            aria-label="Search messages"
            className="pl-8 py-1"
          />
        </div>
        <div className="flex items-center border-l border-outline-variant pl-sm ml-sm space-x-1">
          {group && (
            <IconButton
              label="Start group voice call"
              icon={Phone}
              onClick={onStartCall}
            />
          )}
          <IconButton
            label="Pinned messages (not available yet)"
            icon={Pin}
            disabled
          />
          <div className="relative">
            <IconButton
              label="Notifications"
              icon={Bell}
              active={notificationCenterOpen}
              onClick={toggleNotificationCenter}
              notificationTrigger
            />
            {unreadCount > 0 && (
              <span className="pointer-events-none absolute right-0 top-0 min-w-4 rounded-full bg-error px-1 text-center text-[9px] font-bold leading-4 text-on-error">
                {Math.min(99, unreadCount)}
              </span>
            )}
          </div>
          <IconButton
            label={group ? "Toggle members" : "Members (not available yet)"}
            icon={Users}
            disabled={!group}
            active={membersOpen}
            onClick={onToggleMembers}
          />
          <IconButton
            label="Toggle co-watch panel"
            icon={MonitorPlay}
            active={rightPanelOpen}
            onClick={toggleRightPanel}
          />
        </div>
      </div>
    </header>
  );
}

function IconButton({
  label,
  icon: Icon,
  active = false,
  onClick,
  disabled = false,
  notificationTrigger = false,
}: {
  label: string;
  icon: typeof Pin;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  notificationTrigger?: boolean;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      data-notification-trigger={notificationTrigger || undefined}
      className={cn(
        "p-sm transition-colors cursor-pointer",
        active ? "text-primary" : "text-on-surface-variant hover:text-primary",
        disabled && "cursor-not-allowed opacity-40 hover:text-on-surface-variant",
      )}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}
