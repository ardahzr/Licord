import { useEffect, useState } from "react";
import { Bell, MonitorUp, Save, Shield, UserRound } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useAppStore } from "@/store/useAppStore";
import type { PresenceStatus } from "@/types/database";

export function SettingsPage() {
  const { session, profile, updateProfile, updatePassword } = useAuth();
  const [username, setUsername] = useState(profile?.username ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "");
  const [status, setStatus] = useState<PresenceStatus>(profile?.status ?? "online");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const settings = useAppStore();

  useEffect(() => {
    setUsername(profile?.username ?? "");
    setAvatarUrl(profile?.avatar_url ?? "");
    setStatus(profile?.status ?? "online");
  }, [profile]);

  const saveProfile = async () => {
    const result = await updateProfile({ username: username.trim(), avatar_url: avatarUrl.trim() || null, status });
    setMessage(result.error ?? "Account settings saved.");
  };

  const savePassword = async () => {
    if (password.length < 8) return setMessage("Password must contain at least 8 characters.");
    const result = await updatePassword(password);
    if (!result.error) setPassword("");
    setMessage(result.error ?? "Password updated.");
  };

  return (
    <main className="flex-1 overflow-y-auto bg-surface p-lg text-on-surface">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-xs text-2xl font-bold">Settings</h1>
        <p className="mb-xl text-sm text-on-surface-variant">Account, stream and desktop preferences.</p>
        {message && <div className="mb-md border border-primary/30 bg-primary/10 p-sm text-sm text-primary">{message}</div>}

        <SettingsSection icon={UserRound} title="My account">
          <div className="grid gap-md md:grid-cols-2">
            <Field label="Username"><input value={username} onChange={(e) => setUsername(e.target.value)} /></Field>
            <Field label="Presence"><select value={status} onChange={(e) => setStatus(e.target.value as PresenceStatus)}><option value="online">Online</option><option value="away">Away</option><option value="busy">Do not disturb</option><option value="offline">Invisible</option></select></Field>
            <Field label="Avatar URL"><input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" /></Field>
            <Field label="Email"><input value={session?.user.email ?? ""} disabled /></Field>
          </div>
          <button onClick={() => void saveProfile()} className="mt-md flex items-center gap-xs bg-primary px-md py-sm font-bold text-on-primary"><Save className="h-4 w-4" /> Save account</button>
        </SettingsSection>

        <SettingsSection icon={Shield} title="Security">
          <div className="flex gap-sm"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password (8+ characters)" className="min-w-0 flex-1" /><button onClick={() => void savePassword()} className="bg-surface-container-high px-md font-bold hover:bg-primary/20">Change password</button></div>
        </SettingsSection>

        <SettingsSection icon={MonitorUp} title="Stream defaults">
          <div className="grid gap-md md:grid-cols-2">
            <Field label="Resolution"><select value={settings.screenShareHeight} onChange={(e) => settings.setScreenShareQuality(Number(e.target.value) as 720 | 1080 | 1440, settings.screenShareFps)}><option value={720}>720p</option><option value={1080}>1080p</option><option value={1440}>1440p</option></select></Field>
            <Field label="Frame rate"><select value={settings.screenShareFps} onChange={(e) => settings.setScreenShareQuality(settings.screenShareHeight, Number(e.target.value) as 15 | 30 | 60)}><option value={15}>15 FPS</option><option value={30}>30 FPS</option><option value={60}>60 FPS</option></select></Field>
          </div>
        </SettingsSection>

        <SettingsSection icon={Bell} title="Application">
          <Toggle label="Reduced motion" checked={settings.reducedMotion} onChange={settings.setReducedMotion} />
          <Toggle label="Compact interface" checked={settings.compactMode} onChange={settings.setCompactMode} />
          <Toggle label="Notification sounds" checked={settings.notificationSounds} onChange={settings.setNotificationSounds} />
        </SettingsSection>
      </div>
    </main>
  );
}

function SettingsSection({ icon: Icon, title, children }: { icon: typeof UserRound; title: string; children: React.ReactNode }) {
  return <section className="mb-lg border border-outline-variant bg-surface-container-low p-lg"><h2 className="mb-md flex items-center gap-sm text-lg font-bold"><Icon className="h-5 w-5 text-primary" />{title}</h2>{children}</section>;
}
function Field({ label, children }: { label: string; children: React.ReactElement }) {
  return <label className="text-sm text-on-surface-variant">{label}<div className="mt-xs [&>input]:w-full [&>input]:border [&>input]:border-outline-variant [&>input]:bg-surface-container-high [&>input]:p-sm [&>select]:w-full [&>select]:border [&>select]:border-outline-variant [&>select]:bg-surface-container-high [&>select]:p-sm [&>input]:text-on-surface [&>select]:text-on-surface">{children}</div></label>;
}
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex items-center justify-between border-b border-outline-variant py-sm last:border-0"><span>{label}</span><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-primary" /></label>;
}
