import { useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Paperclip, Smile, Loader2, X } from "lucide-react";
import { uploadToR2, fileKind } from "@/lib/storage";

interface MessageInputProps {
  channelId: string;
  channelName: string;
  onSend: (content: string, mediaUrl?: string) => Promise<void> | void;
}

/**
 * Composer. Enter sends text (Shift+Enter = newline). The 📎 button uploads a
 * file to Cloudflare R2 (via the presigned-URL Edge Function) and posts it as a
 * media message.
 */
export function MessageInput({
  channelId,
  channelName,
  onSend,
}: MessageInputProps) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = async () => {
    const content = value.trim();
    if (!content || sending) return;
    setValue("");
    setSending(true);
    try {
      await onSend(content);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const { url } = await uploadToR2(file, fileKind(file), channelId);
      await onSend("", url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="px-md pb-md pt-sm shrink-0 bg-surface">
      {error && (
        <div className="mb-xs flex items-center justify-between gap-sm p-sm border border-error/40 bg-error-container/20 text-error font-code-sm text-code-sm rounded">
          <span className="truncate">{error}</span>
          <button aria-label="Dismiss" onClick={() => setError(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="relative flex items-center bg-surface-container-high border border-outline-variant focus-within:border-primary-container transition-colors">
        <input
          ref={fileRef}
          type="file"
          hidden
          accept="image/*,video/*"
          onChange={handleFile}
        />
        <button
          aria-label="Attach file"
          title="Attach image or video"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="p-sm text-on-surface-variant hover:text-primary transition-colors flex-shrink-0 cursor-pointer flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Paperclip className="w-5 h-5" />
          )}
        </button>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            uploading ? "Uploading…" : `Message ${channelName}`
          }
          disabled={uploading}
          className="flex-1 bg-transparent border-none text-on-surface font-code-sm text-code-sm py-3 px-sm focus:outline-none focus:ring-0 placeholder:text-on-surface-variant disabled:opacity-60"
        />
        <div className="flex items-center pr-sm space-x-1 flex-shrink-0">
          <button
            aria-label="Emoji"
            className="p-xs text-on-surface-variant hover:text-primary transition-colors cursor-pointer flex items-center justify-center"
          >
            <Smile className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className="text-[10px] text-on-surface-variant mt-unit font-code-sm text-right px-unit">
        Press{" "}
        <span className="bg-surface-container px-1 py-px border border-outline-variant rounded-sm text-on-surface">
          Enter
        </span>{" "}
        to send,{" "}
        <span className="bg-surface-container px-1 py-px border border-outline-variant rounded-sm text-on-surface">
          Shift + Enter
        </span>{" "}
        to add a new line
      </div>
    </div>
  );
}
