import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { ChatPage } from "@/pages/ChatPage";
import { FriendsPage } from "@/pages/FriendsPage";
import { AuthPage } from "@/pages/AuthPage";

/**
 * HashRouter avoids deep-link 404s when the packaged Tauri app serves the bundle
 * from a custom protocol. `RequireAuth` gates the app shell behind a session.
 */
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route index element={<ChatPage />} />
            <Route path="channels/:channelId" element={<ChatPage />} />
            <Route path="friends" element={<FriendsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
