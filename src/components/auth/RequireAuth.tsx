import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

/** Centered spinner while the session is being established. */
export function FullScreenLoader() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-background">
      <Loader2 className="w-6 h-6 text-primary-container animate-spin" />
    </div>
  );
}

/** Gate for the authenticated app shell; bounces to /login when signed out. */
export function RequireAuth() {
  const { session, loading } = useAuth();

  if (loading) return <FullScreenLoader />;
  if (!session) return <Navigate to="/login" replace />;
  return <Outlet />;
}
