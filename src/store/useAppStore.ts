import { create } from "zustand";

export interface AppNotification {
  id: string;
  channelId: string;
  channelName: string;
  path?: string;
  contextPrefix?: string;
  senderName: string;
  body: string;
  createdAt: string;
  read: boolean;
}

/**
 * Global UI state. Deliberately small — server data (messages, friends) will be
 * fetched per-feature in later phases; this only holds cross-cutting UI concerns.
 * (System Directive: prefer Zustand/Context over Redux.)
 */
interface AppState {
  /** Discord-like server/community selected in the left rail. */
  activeServerId: string | null;
  setActiveServer: (id: string | null) => void;

  /** Currently selected channel/DM id (null = none). */
  activeChannelId: string | null;
  setActiveChannel: (id: string | null) => void;

  /** Co-watch / context inspector panel visibility (right column). */
  rightPanelOpen: boolean;
  toggleRightPanel: () => void;
  setRightPanelOpen: (open: boolean) => void;

  /** In-app notifications generated from incoming Realtime messages. */
  notifications: AppNotification[];
  notificationCenterOpen: boolean;
  addNotification: (notification: Omit<AppNotification, "read">) => void;
  markNotificationRead: (id: string) => void;
  markChannelRead: (channelId: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  toggleNotificationCenter: () => void;
  closeNotificationCenter: () => void;

  // ── Voice (Phase 5) ──

  /** Currently connected voice channel (null = not in a call). */
  activeVoiceChannelId: string | null;
  activeVoiceLabel: string | null;
  activeVoicePath: string | null;
  setActiveVoiceChannel: (id: string | null, label?: string, path?: string) => void;

  /** Local track states for quick UI access. */
  isMicMuted: boolean;
  isDeafened: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  setMicMuted: (muted: boolean) => void;
  setDeafened: (deafened: boolean) => void;
  setCameraOff: (off: boolean) => void;
  setScreenSharing: (sharing: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeServerId: null,
  setActiveServer: (id) => set({ activeServerId: id }),

  activeChannelId: null,
  setActiveChannel: (id) => set({ activeChannelId: id }),

  rightPanelOpen: true,
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),

  notifications: [],
  notificationCenterOpen: false,
  addNotification: (notification) =>
    set((state) => {
      if (state.notifications.some((item) => item.id === notification.id)) {
        return state;
      }
      return {
        notifications: [
          { ...notification, read: false },
          ...state.notifications,
        ].slice(0, 100),
      };
    }),
  markNotificationRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((item) =>
        item.id === id ? { ...item, read: true } : item,
      ),
    })),
  markChannelRead: (channelId) =>
    set((state) => ({
      notifications: state.notifications.map((item) =>
        item.channelId === channelId ? { ...item, read: true } : item,
      ),
    })),
  markAllNotificationsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((item) => ({
        ...item,
        read: true,
      })),
    })),
  clearNotifications: () => set({ notifications: [] }),
  toggleNotificationCenter: () =>
    set((state) => ({ notificationCenterOpen: !state.notificationCenterOpen })),
  closeNotificationCenter: () => set({ notificationCenterOpen: false }),

  // Voice
  activeVoiceChannelId: null,
  activeVoiceLabel: null,
  activeVoicePath: null,
  setActiveVoiceChannel: (id, label, path) =>
    set({
      activeVoiceChannelId: id,
      activeVoiceLabel: id ? (label ?? null) : null,
      activeVoicePath: id ? (path ?? null) : null,
    }),

  isMicMuted: false,
  isDeafened: false,
  isCameraOff: true,
  isScreenSharing: false,
  setMicMuted: (muted) => set({ isMicMuted: muted }),
  setDeafened: (deafened) => set({ isDeafened: deafened }),
  setCameraOff: (off) => set({ isCameraOff: off }),
  setScreenSharing: (sharing) => set({ isScreenSharing: sharing }),
}));
