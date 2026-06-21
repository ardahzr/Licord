import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { useChannels } from "@/hooks/useChannels";
import type { Channel } from "@/types/database";

export interface AppOutletContext {
  channels: Channel[];
  channelsLoading: boolean;
}

/**
 * Authenticated app shell: persistent left Sidebar + routed content.
 * Channels are fetched once here and shared with the Sidebar (prop) and pages
 * (Outlet context). The optional right co-watch column lives in the pages.
 */
export function AppLayout() {
  const { channels, loading } = useChannels();

  return (
    <div className="h-full w-full flex overflow-hidden">
      <Sidebar channels={channels} />
      <Outlet
        context={
          { channels, channelsLoading: loading } satisfies AppOutletContext
        }
      />
    </div>
  );
}
