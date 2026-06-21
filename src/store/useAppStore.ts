import { create } from "zustand";

/**
 * Global UI state. Deliberately small — server data (messages, friends) will be
 * fetched per-feature in later phases; this only holds cross-cutting UI concerns.
 * (System Directive: prefer Zustand/Context over Redux.)
 */
interface AppState {
  /** Currently selected channel/DM id (null = none). */
  activeChannelId: string | null;
  setActiveChannel: (id: string | null) => void;

  /** Co-watch / context inspector panel visibility (right column). */
  rightPanelOpen: boolean;
  toggleRightPanel: () => void;
  setRightPanelOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeChannelId: "general-discussion",
  setActiveChannel: (id) => set({ activeChannelId: id }),

  rightPanelOpen: true,
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
}));
