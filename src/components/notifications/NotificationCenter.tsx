import { useEffect, useRef, useState } from "react";
import { Bell, BellRing, CheckCheck, Trash2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";

type PermissionState = NotificationPermission | "unsupported";

function currentPermission(): PermissionState {
  return "Notification" in window ? Notification.permission : "unsupported";
}

function relativeTime(iso: string): string {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 1000),
  );
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function NotificationCenter() {
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const [permission, setPermission] = useState<PermissionState>(currentPermission);
  const {
    notifications,
    notificationCenterOpen,
    closeNotificationCenter,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
  } = useAppStore();

  useEffect(() => {
    if (!notificationCenterOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Element;
      if (target.closest('[data-notification-trigger="true"]')) return;
      if (!panelRef.current?.contains(target)) closeNotificationCenter();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeNotificationCenter();
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [notificationCenterOpen, closeNotificationCenter]);

  if (!notificationCenterOpen) return null;

  const enableDesktop = async () => {
    if (!("Notification" in window)) return;
    try {
      setPermission(await Notification.requestPermission());
    } catch {
      setPermission("unsupported");
    }
  };

  const openNotification = (id: string, path: string) => {
    markNotificationRead(id);
    closeNotificationCenter();
    navigate(path);
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Notifications"
      className="fixed right-md top-[72px] z-[100] flex max-h-[min(560px,calc(100vh-88px))] w-[min(380px,calc(100vw-32px))] flex-col border border-outline-variant bg-surface-container-lowest shadow-2xl"
    >
      <div className="flex items-center justify-between border-b border-outline-variant p-sm">
        <div className="flex items-center gap-sm">
          <BellRing className="h-5 w-5 text-primary" />
          <h3 className="font-headline-md text-headline-md font-bold text-on-surface">
            Notifications
          </h3>
        </div>
        <button
          type="button"
          aria-label="Close notifications"
          onClick={closeNotificationCenter}
          className="p-xs text-on-surface-variant transition-colors hover:text-primary"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {permission === "default" && (
        <div className="border-b border-outline-variant bg-surface-container p-sm">
          <div className="mb-sm text-code-sm font-code-sm text-on-surface-variant">
            Enable desktop alerts for messages received while Licord is in the
            background.
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void enableDesktop()}
          >
            <Bell className="h-4 w-4" /> Enable desktop alerts
          </Button>
        </div>
      )}
      {permission === "denied" && (
        <div className="border-b border-outline-variant bg-error-container/20 p-sm text-code-sm font-code-sm text-error">
          Desktop alerts are blocked in system/browser permissions. In-app
          alerts remain active.
        </div>
      )}
      {permission === "unsupported" && (
        <div className="border-b border-outline-variant bg-surface-container p-sm text-code-sm font-code-sm text-on-surface-variant">
          Desktop alerts are unavailable in this runtime. In-app alerts remain
          active.
        </div>
      )}

      <div className="flex items-center justify-end gap-xs border-b border-outline-variant px-sm py-xs">
        <button
          type="button"
          onClick={markAllNotificationsRead}
          disabled={notifications.length === 0}
          className="flex items-center gap-xs p-xs text-label-caps font-label-caps text-on-surface-variant transition-colors hover:text-primary disabled:opacity-40"
        >
          <CheckCheck className="h-4 w-4" /> Mark all read
        </button>
        <button
          type="button"
          onClick={clearNotifications}
          disabled={notifications.length === 0}
          className="flex items-center gap-xs p-xs text-label-caps font-label-caps text-on-surface-variant transition-colors hover:text-error disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" /> Clear
        </button>
      </div>

      <div className="min-h-32 flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center p-md text-center text-on-surface-variant">
            <Bell className="mb-sm h-8 w-8 opacity-50" />
            <span className="text-code-sm font-code-sm">
              You're all caught up.
            </span>
          </div>
        ) : (
          notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              onClick={() =>
                openNotification(
                  notification.id,
                  notification.path ?? `/channels/${notification.channelId}`,
                )
              }
              className={cn(
                "flex w-full gap-sm border-b border-outline-variant p-sm text-left transition-colors hover:bg-surface-container-high",
                !notification.read && "bg-primary/5",
              )}
            >
              <span
                className={cn(
                  "mt-2 h-2 w-2 shrink-0 rounded-full",
                  notification.read ? "bg-transparent" : "bg-primary",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-sm">
                  <strong className="truncate text-body-md font-body-md text-on-surface">
                    {notification.senderName}
                  </strong>
                  <span className="shrink-0 text-[10px] text-on-surface-variant">
                    {relativeTime(notification.createdAt)}
                  </span>
                </span>
                <span className="block text-[11px] text-primary">
                  {notification.contextPrefix ?? "#"}{notification.channelName}
                </span>
                <span className="mt-xs block truncate text-code-sm font-code-sm text-on-surface-variant">
                  {notification.body}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
