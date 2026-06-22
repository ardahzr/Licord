import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/useAppStore";

/** Shows the newest incoming message briefly while the app is in the foreground. */
export function NotificationToasts() {
  const navigate = useNavigate();
  const notifications = useAppStore((state) => state.notifications);
  const markNotificationRead = useAppStore(
    (state) => state.markNotificationRead,
  );
  const [visibleId, setVisibleId] = useState<string | null>(null);
  const latest = notifications[0];

  useEffect(() => {
    if (!latest || document.hidden || !document.hasFocus()) return;
    setVisibleId(latest.id);
    const timeout = window.setTimeout(() => setVisibleId(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [latest?.id]);

  if (!latest || visibleId !== latest.id) return null;

  return (
    <div className="fixed bottom-md right-md z-[110] flex w-[min(360px,calc(100vw-32px))] gap-sm border border-outline-variant bg-surface-container-high p-sm shadow-2xl">
      <Bell className="mt-xs h-5 w-5 shrink-0 text-primary" />
      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={() => {
          markNotificationRead(latest.id);
          setVisibleId(null);
          navigate(latest.path ?? `/channels/${latest.channelId}`);
        }}
      >
        <strong className="block truncate text-body-md font-body-md text-on-surface">
          {latest.senderName} · {latest.contextPrefix ?? "#"}{latest.channelName}
        </strong>
        <span className="block truncate text-code-sm font-code-sm text-on-surface-variant">
          {latest.body}
        </span>
      </button>
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => setVisibleId(null)}
        className="self-start p-xs text-on-surface-variant hover:text-primary"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
