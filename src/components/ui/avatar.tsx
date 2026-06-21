import { cn } from "@/lib/utils";
import type { PresenceStatus } from "@/types/database";

const STATUS_COLOR: Record<PresenceStatus, string> = {
  online: "bg-status-online",
  away: "bg-status-away",
  busy: "bg-status-busy",
  offline: "bg-surface-container-high",
};

interface AvatarProps {
  src?: string | null;
  /** Shown when there's no image (e.g. initials). */
  fallback: string;
  alt?: string;
  status?: PresenceStatus;
  className?: string;
  /** Tailwind size classes, e.g. "w-10 h-10". */
  sizeClassName?: string;
  grayscale?: boolean;
}

/**
 * Square (4px-rounded) avatar with optional presence dot — the recurring
 * identity element across the sidebar, chat stream, and friends list.
 */
export function Avatar({
  src,
  fallback,
  alt = "",
  status,
  className,
  sizeClassName = "w-10 h-10",
  grayscale = false,
}: AvatarProps) {
  return (
    <div className={cn("relative flex-shrink-0", sizeClassName, className)}>
      <div className="w-full h-full overflow-hidden rounded border border-outline-variant bg-surface-container-highest">
        {src ? (
          <img
            src={src}
            alt={alt}
            className={cn(
              "w-full h-full object-cover",
              grayscale && "grayscale",
            )}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-tertiary-container text-on-tertiary-container font-bold">
            {fallback}
          </div>
        )}
      </div>
      {status && (
        <span
          className={cn(
            "absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-surface-dim",
            STATUS_COLOR[status],
          )}
        />
      )}
    </div>
  );
}
