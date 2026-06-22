import { useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { ImageOff, Loader2 } from "lucide-react";

const VIDEO_EXT = /\.(mp4|webm|ogg|ogv|mov|m4v)(\?|$)/i;
const binaryCache = new Map<string, Promise<ArrayBuffer>>();

function mediaType(url: string): string {
  const path = url.toLowerCase().split("?")[0];
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".gif")) return "image/gif";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (/\.jpe?g$/.test(path)) return "image/jpeg";
  if (path.endsWith(".webm")) return "video/webm";
  if (/\.(mp4|m4v|mov)$/.test(path)) return "video/mp4";
  return "application/octet-stream";
}

async function fetchNative(url: string): Promise<ArrayBuffer> {
  let request = binaryCache.get(url);
  if (!request) {
    request = invoke<ArrayBuffer | number[]>("fetch_r2_media", { url }).then(
      (value) =>
        value instanceof ArrayBuffer
          ? value
          : Uint8Array.from(value).buffer,
    );
    binaryCache.set(url, request);
    request.catch(() => binaryCache.delete(url));
  }
  return request;
}

export function MediaAttachment({ url }: { url: string }) {
  const [src, setSrc] = useState(url);
  const [loadingFallback, setLoadingFallback] = useState(false);
  const [failed, setFailed] = useState(false);
  const retries = useRef(0);
  const objectUrl = useRef<string | null>(null);
  const isVideo = VIDEO_EXT.test(url);

  useEffect(() => {
    setSrc(url);
    setFailed(false);
    retries.current = 0;
    return () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
    };
  }, [url]);

  const recover = async () => {
    if (src.startsWith("blob:")) {
      setFailed(true);
      return;
    }

    let isR2Url = false;
    try {
      isR2Url = new URL(url).hostname.endsWith(".r2.dev");
    } catch {
      setFailed(true);
      return;
    }

    if (isTauri() && isR2Url) {
      setLoadingFallback(true);
      try {
        const bytes = await fetchNative(url);
        objectUrl.current = URL.createObjectURL(
          new Blob([bytes], { type: mediaType(url) }),
        );
        setSrc(objectUrl.current);
        setFailed(false);
      } catch (error) {
        console.error("Native media fallback failed:", error);
        setFailed(true);
      } finally {
        setLoadingFallback(false);
      }
      return;
    }

    if (retries.current < 2) {
      retries.current += 1;
      const separator = url.includes("?") ? "&" : "?";
      window.setTimeout(
        () => setSrc(`${url}${separator}retry=${retries.current}`),
        retries.current * 500,
      );
    } else {
      setFailed(true);
    }
  };

  if (loadingFallback) {
    return (
      <div className="mt-sm flex h-20 w-40 items-center justify-center rounded border border-outline-variant text-on-surface-variant">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (failed) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="mt-sm flex w-fit items-center gap-xs rounded border border-error/40 px-sm py-xs text-error"
      >
        <ImageOff className="h-4 w-4" />
        Open attachment
      </a>
    );
  }

  return isVideo ? (
    <video
      src={src}
      controls
      onError={() => void recover()}
      className="mt-sm max-h-80 max-w-full rounded border border-outline-variant"
    />
  ) : (
    <a href={url} target="_blank" rel="noreferrer" className="inline-block mt-sm">
      <img
        src={src}
        alt="attachment"
        loading="lazy"
        onError={() => void recover()}
        className="max-h-80 max-w-full rounded border border-outline-variant object-contain"
      />
    </a>
  );
}
