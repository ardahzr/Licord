import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { User } from "@/types/database";

interface AuthResult {
  error: string | null;
  /** signUp only: true when an email-confirmation step is required. */
  needsConfirmation?: boolean;
}

interface AuthContextValue {
  session: Session | null;
  profile: User | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (
    email: string,
    password: string,
    username: string,
  ) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isSupabaseConfigured();

  // Establish the session once, then keep it in sync.
  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        setSession(null);
        setLoading(false);
        return;
      }

      // Do not admit a stale persisted session into the app shell. Supabase
      // validates it and refreshes when possible; otherwise we clear it locally.
      const { error } = await supabase.auth.getUser();
      if (error) {
        const { data: refreshed, error: refreshError } =
          await supabase.auth.refreshSession();
        if (refreshError || !refreshed.session) {
          await supabase.auth.signOut({ scope: "local" });
          setSession(null);
          setLoading(false);
          return;
        }
        setSession(refreshed.session);
      } else {
        setSession(data.session);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, [configured]);

  // Load the public profile whenever the signed-in user changes.
  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) {
      setProfile(null);
      return;
    }
    let active = true;
    supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setProfile(data);
      });
    return () => {
      active = false;
    };
  }, [session?.user.id]);

  const signIn: AuthContextValue["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error?.message ?? null };
  };

  const signUp: AuthContextValue["signUp"] = async (
    email,
    password,
    username,
  ) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    if (error) return { error: error.message };
    // No session back ⇒ email confirmation is enabled in the project.
    return { error: null, needsConfirmation: !data.session };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        configured,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
