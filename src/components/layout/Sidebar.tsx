import { NavLink } from "react-router-dom";
import {
  Home,
  MessageSquare,
  Hash,
  Plus,
  Settings,
  HelpCircle,
  LogOut,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn, initials } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import type { Channel, PresenceStatus } from "@/types/database";

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
    "flex items-center px-sm py-2 transition-colors duration-200 cursor-pointer active:scale-95",
    isActive
      ? "border-l-4 border-primary bg-surface-container-high text-primary"
      : "text-on-surface-variant hover:bg-surface-container-highest",
  );

/** Left column (280px): identity, navigation, channels, and actions. */
export function Sidebar({ channels }: { channels: Channel[] }) {
  const { profile, signOut } = useAuth();
  const status: PresenceStatus = profile?.status ?? "online";
  const name = profile?.username ?? "Connecting…";

  return (
    <nav className="hidden md:flex w-[280px] h-full flex-col flex-shrink-0 border-r border-outline-variant bg-surface-container-low z-50">
      {/* Identity header */}
      <div className="h-16 flex items-center px-md border-b border-outline-variant shrink-0">
        <Avatar
          src={profile?.avatar_url}
          fallback={initials(profile?.username)}
          sizeClassName="w-10 h-10"
          className="mr-sm"
        />
        <div className="flex-1 min-w-0">
          <h1 className="font-headline-md text-headline-md font-bold text-primary truncate">
            {name}
          </h1>
          <div className="flex items-center text-on-surface-variant">
            <span
              className={cn(
                "w-2 h-2 rounded-full mr-2 flex-shrink-0",
                STATUS_DOT[status],
              )}
            />
            <span className="font-code-sm text-code-sm truncate">
              {STATUS_LABEL[status]}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-sm">
        <div className="px-sm space-y-unit">
          <NavLink to="/" end className={linkClass}>
            <Home className="w-5 h-5 mr-sm shrink-0" />
            <span className="truncate">Home</span>
          </NavLink>
          <NavLink to="/friends" className={linkClass}>
            <MessageSquare className="w-5 h-5 mr-sm shrink-0" />
            <span className="truncate">Direct Messages</span>
          </NavLink>

          <div className="pt-md pb-xs px-sm font-label-caps text-label-caps text-on-surface-variant uppercase">
            Channels
          </div>
          {channels.map((channel) => (
            <NavLink
              key={channel.id}
              to={`/channels/${channel.id}`}
              className={linkClass}
            >
              <Hash className="w-5 h-5 mr-sm shrink-0" />
              <span className="truncate">{channel.name}</span>
            </NavLink>
          ))}
        </div>
      </div>

      {/* Actions / footer */}
      <div className="p-md border-t border-outline-variant shrink-0">
        <Button variant="outline" className="w-full mb-sm">
          <Plus className="w-4 h-4" />
          <span>New Server</span>
        </Button>
        <div className="flex justify-between">
          <button
            aria-label="Settings"
            className="flex items-center p-sm text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button
            aria-label="Support"
            className="flex items-center p-sm text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
          <button
            aria-label="Log out"
            title="Log out"
            onClick={() => void signOut()}
            className="flex items-center p-sm text-on-surface-variant hover:text-error transition-colors cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </nav>
  );
}
