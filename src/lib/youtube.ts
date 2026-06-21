/** YouTube helpers for the co-watch feature (Phase 4). */

declare global {
  interface Window {
    // The IFrame API namespace + its ready callback (loosely typed on purpose).
    YT?: {
      Player: new (el: Element | string, opts: unknown) => YouTubePlayer;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** The subset of the YT.Player API we drive. */
export interface YouTubePlayer {
  loadVideoById: (id: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  destroy: () => void;
}

/** Extract an 11-char video id from a URL, embed link, or raw id. */
export function parseYouTubeId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  if (/^[\w-]{11}$/.test(s)) return s; // already an id

  try {
    const url = new URL(s);
    if (url.hostname === "youtu.be") {
      const id = url.pathname.slice(1, 12);
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    const v = url.searchParams.get("v");
    if (v && /^[\w-]{11}$/.test(v)) return v;
    const m = url.pathname.match(/\/(?:embed|shorts|v)\/([\w-]{11})/);
    if (m) return m[1];
  } catch {
    // not a URL — fall through
  }
  return null;
}

let apiPromise: Promise<void> | null = null;

/** Load the YouTube IFrame API exactly once; resolves when `window.YT` is ready. */
export function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<void>((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return apiPromise;
}
