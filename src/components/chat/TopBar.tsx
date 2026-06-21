import { Hash, Search, Pin, Bell, Users, MonitorPlay } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

interface TopBarProps {
  channelName: string;
}

const TABS = ["Threads", "Pins", "Notifications"] as const;

/** Channel header: title, contextual tabs, search, and panel toggles. */
export function TopBar({ channelName }: TopBarProps) {
  const { rightPanelOpen, toggleRightPanel } = useAppStore();

  return (
    <header className="flex justify-between items-center w-full px-md h-16 border-b border-outline-variant bg-surface shrink-0 z-40">
      <div className="flex items-center min-w-0 flex-shrink">
        <Hash className="w-5 h-5 text-on-surface-variant mr-sm hidden md:block" />
        <h2 className="font-headline-md text-headline-md font-bold text-on-surface truncate">
          {channelName}
        </h2>
      </div>

      {/* Contextual tabs */}
      <nav className="hidden lg:flex items-center h-full ml-lg space-x-md flex-shrink-0">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            className={cn(
              "h-full flex items-center px-sm transition-colors cursor-pointer font-label-caps text-label-caps",
              i === 0
                ? "text-primary border-b-2 border-primary"
                : "text-on-surface-variant hover:text-primary",
            )}
          >
            {tab}
          </button>
        ))}
      </nav>

      <div className="flex items-center ml-auto flex-shrink-0 space-x-sm">
        <div className="relative hidden md:block w-48 lg:w-64">
          <Search className="w-4 h-4 absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant" />
          <Input placeholder="Search" className="pl-8 py-1" />
        </div>
        <div className="flex items-center border-l border-outline-variant pl-sm ml-sm space-x-1">
          <IconButton label="Pinned messages" icon={Pin} />
          <IconButton label="Notifications" icon={Bell} />
          <IconButton label="Members" icon={Users} />
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
}: {
  label: string;
  icon: typeof Pin;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "p-sm transition-colors cursor-pointer",
        active ? "text-primary" : "text-on-surface-variant hover:text-primary",
      )}
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}
