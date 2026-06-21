/**
 * Remaining placeholder data for features not yet wired to Supabase.
 * - Friends list → replaced when the friends flow lands
 */
import type { PresenceStatus } from "@/types/database";

export interface MockFriend {
  id: string;
  name: string;
  fallback: string;
  tag?: string;
  activity: string;
  status: PresenceStatus;
}

export const MOCK_FRIENDS: MockFriend[] = [
  {
    id: "f1",
    name: "NeoCoder",
    fallback: "N",
    tag: "kernel-dev",
    activity: "Compiling...",
    status: "online",
  },
  {
    id: "f2",
    name: "VoidWalker",
    fallback: "V",
    activity: "Listening to Synthwave",
    status: "online",
  },
  {
    id: "f3",
    name: "SysAdmin_Jane",
    fallback: "S",
    activity: "Idle (Away)",
    status: "away",
  },
  {
    id: "f4",
    name: "RetroDev",
    fallback: "R",
    activity: "Last seen 2 hours ago",
    status: "offline",
  },
];
