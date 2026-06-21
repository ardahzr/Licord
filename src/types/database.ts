/**
 * TypeScript mirror of the Supabase PostgreSQL schema (Phase 2 will create the
 * tables + RLS via SQL). Kept hand-written for now; can be swapped for
 * `supabase gen types typescript` output once the project exists.
 */

export type PresenceStatus = "online" | "away" | "busy" | "offline";
export type FriendStatus = "pending" | "accepted" | "blocked";
export type ChannelType = "text" | "voice";

export interface User {
  id: string; // UUID (auth.users.id)
  username: string;
  avatar_url: string | null; // R2 public URL
  status: PresenceStatus;
  created_at: string;
}

export interface Friend {
  id: string;
  user_id_1: string;
  user_id_2: string;
  status: FriendStatus;
  created_at: string;
}

export interface Server {
  id: string;
  name: string;
  icon_url: string | null;
  owner_id: string;
  created_at: string;
}

export interface Channel {
  id: string;
  server_id: string;
  name: string;
  type: ChannelType;
  created_at: string;
}

export interface Message {
  id: string;
  channel_id: string | null; // set for server-channel messages
  friend_id: string | null; // set for DM threads
  sender_id: string;
  content: string;
  media_url: string | null; // R2 link (Phase 3)
  created_at: string;
}

// NOTE: the Supabase client is left untyped (no `createClient<Database>`) — the
// row interfaces above are applied explicitly at query boundaries (see
// hooks/useMessages.ts, useChannels.ts, context/AuthContext.tsx). Once the
// schema is live these can be regenerated with `supabase gen types typescript`.
