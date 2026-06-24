import { useState } from "react";
import { MonitorUp, ScreenShare, ScreenShareOff, X } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

export function ScreenShareButton({
  sharing,
  onToggle,
  compact = false,
  disabled = false,
}: {
  sharing: boolean;
  onToggle: () => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const height = useAppStore((state) => state.screenShareHeight);
  const fps = useAppStore((state) => state.screenShareFps);
  const setQuality = useAppStore((state) => state.setScreenShareQuality);

  const click = () => {
    if (sharing) onToggle();
    else setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        aria-label={sharing ? "Stop sharing" : "Share screen"}
        title={sharing ? "Stop sharing" : `Share screen · ${height}p ${fps} FPS`}
        disabled={disabled}
        onClick={click}
        className={cn(
          "flex items-center justify-center rounded transition-colors disabled:opacity-40",
          compact ? "h-9 w-9" : "h-12 w-12 rounded-full active:scale-95",
          sharing
            ? "bg-primary/20 text-primary hover:bg-primary/30"
            : "bg-surface-container-high text-on-surface-variant hover:text-on-surface",
        )}
      >
        {sharing ? <ScreenShareOff className="h-5 w-5" /> : <ScreenShare className="h-5 w-5" />}
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/65 p-md" onMouseDown={() => setOpen(false)}>
          <div className="w-full max-w-md border border-outline-variant bg-surface-container p-lg shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="mb-lg flex items-center justify-between">
              <div className="flex items-center gap-sm">
                <MonitorUp className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold text-on-surface">Stream quality</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-on-surface-variant hover:text-on-surface"><X className="h-5 w-5" /></button>
            </div>
            <label className="mb-md block text-sm text-on-surface-variant">
              Resolution
              <select value={height} onChange={(event) => setQuality(Number(event.target.value) as 720 | 1080 | 1440, fps)} className="mt-xs w-full border border-outline-variant bg-surface-container-high p-sm text-on-surface">
                <option value={720}>720p · Data saver</option>
                <option value={1080}>1080p · Recommended</option>
                <option value={1440}>1440p · High quality</option>
              </select>
            </label>
            <label className="mb-lg block text-sm text-on-surface-variant">
              Frame rate
              <select value={fps} onChange={(event) => setQuality(height, Number(event.target.value) as 15 | 30 | 60)} className="mt-xs w-full border border-outline-variant bg-surface-container-high p-sm text-on-surface">
                <option value={15}>15 FPS · Text / slides</option>
                <option value={30}>30 FPS · Recommended</option>
                <option value={60}>60 FPS · Games / motion</option>
              </select>
            </label>
            <button type="button" onClick={() => { setOpen(false); onToggle(); }} className="flex w-full items-center justify-center gap-sm bg-primary px-md py-sm font-bold text-on-primary hover:opacity-90">
              <ScreenShare className="h-4 w-4" /> Share at {height}p · {fps} FPS
            </button>
          </div>
        </div>
      )}
    </>
  );
}
