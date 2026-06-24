import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, KeyRound, Terminal, Code, Loader2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

type Mode = "login" | "signup";

/** Terminal-styled auth screen wired to Supabase email/password auth. */
export function AuthPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { session, configured, signIn, signUp } = useAuth();
  const navigate = useNavigate();

  // Already authenticated? Skip the screen.
  useEffect(() => {
    if (session) navigate("/", { replace: true });
  }, [session, navigate]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!configured) {
      setError("Licord service is not configured or not reachable.");
      return;
    }
    setError(null);
    setInfo(null);
    setSubmitting(true);

    const result =
      mode === "login"
        ? await signIn(email, password)
        : await signUp(email, password, username.trim());

    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.needsConfirmation) {
      setInfo("Account created. Check your email to confirm, then log in.");
      setMode("login");
      return;
    }
    navigate("/", { replace: true });
  };

  return (
    <div className="terminal-bg min-h-screen w-full flex items-center justify-center p-md select-none">
      <div className="w-full max-w-md bg-surface-container-low border border-outline-variant rounded p-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary-container opacity-5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

        {/* Branding */}
        <div className="flex flex-col items-center mb-lg">
          <div className="w-16 h-16 mb-md rounded flex items-center justify-center bg-primary-container text-on-primary-container border border-outline-variant">
            <Terminal className="w-8 h-8" />
          </div>
          <h1 className="font-headline-md text-headline-md text-on-surface">
            System.Access
          </h1>
          <p className="font-code-sm text-code-sm text-on-surface-variant mt-sm">
            Authenticate to proceed.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-outline-variant mb-lg font-label-caps text-label-caps w-full">
          <TabButton active={mode === "login"} onClick={() => switchMode("login")}>
            LOGIN
          </TabButton>
          <TabButton
            active={mode === "signup"}
            onClick={() => switchMode("signup")}
          >
            SIGN UP
          </TabButton>
        </div>

        {/* Feedback */}
        {error && (
          <div className="mb-md p-sm border border-error/40 bg-error-container/20 text-error font-code-sm text-code-sm rounded">
            {error}
          </div>
        )}
        {info && (
          <div className="mb-md p-sm border border-primary-container/40 bg-primary-container/10 text-primary font-code-sm text-code-sm rounded">
            {info}
          </div>
        )}

        {/* Form */}
        <form className="flex flex-col gap-md" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <Field label="USERNAME">
              <div className="relative">
                <User className="w-[18px] h-[18px] absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant" />
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="user_name"
                  className={cn(fieldClass, "pl-xl")}
                  autoComplete="username"
                  required
                />
              </div>
            </Field>
          )}

          <Field label="EMAIL">
            <div className="relative">
              <Mail className="w-[18px] h-[18px] absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@better-vc.local"
                className={cn(fieldClass, "pl-xl")}
                autoComplete="email"
                required
              />
            </div>
          </Field>

          <Field
            label="PASSWORD"
            action={
              mode === "login" ? (
                <a
                  href="#"
                  className="text-primary hover:text-primary-container transition-colors"
                >
                  Forgt_Pwd?
                </a>
              ) : undefined
            }
          >
            <div className="relative">
              <KeyRound className="w-[18px] h-[18px] absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={cn(fieldClass, "pl-xl")}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
                minLength={6}
              />
            </div>
          </Field>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary-container text-on-primary-container font-label-caps text-label-caps py-sm rounded mt-sm hover:bg-tertiary-container transition-colors flex items-center justify-center gap-xs active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>{mode === "login" ? "EXECUTE_LOGIN" : "INIT_SIGNUP"}</span>
                <Terminal className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="mt-md pt-md border-t border-outline-variant">
            <button
              type="button"
              disabled
              title="Coming soon"
              className="w-full bg-transparent border border-outline-variant text-on-surface-variant font-label-caps text-label-caps py-sm rounded hover:text-primary hover:border-primary transition-colors flex items-center justify-center gap-xs disabled:opacity-50 disabled:hover:text-on-surface-variant disabled:hover:border-outline-variant"
            >
              <Code className="w-4 h-4" />
              <span>SSO_AUTH</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const fieldClass =
  "w-full bg-surface-container-highest border border-outline-variant rounded font-code-sm text-code-sm text-on-surface py-sm px-sm placeholder:text-outline transition-colors focus:outline-none focus:border-primary-container focus:ring-0";

function Field({
  label,
  action,
  children,
}: {
  label: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="font-label-caps text-label-caps text-on-surface-variant mb-xs flex justify-between">
        <span>{label}</span>
        {action}
      </label>
      {children}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 py-sm transition-colors border-b-2",
        active
          ? "border-primary-container text-primary-container"
          : "border-transparent text-outline hover:text-on-surface",
      )}
    >
      {children}
    </button>
  );
}
