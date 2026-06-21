import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names, resolving Tailwind conflicts last-wins. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Up to two uppercase initials for avatar fallbacks ("System Root" → "SR"). */
export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
