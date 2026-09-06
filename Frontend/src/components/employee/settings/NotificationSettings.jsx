import { useState } from "react";
import { Bell, AtSign, Briefcase, BellOff, Check, Loader2, Info } from "lucide-react";
import { updateMyPreferences } from "../../../services/profileService";
import { ApiError } from "../../../services/apiClient";

const ICONS = {
  ALL: { icon: Bell, tone: "text-[#F47A20] bg-[#F47A20]/10 ring-[#F47A20]/20" },
  MENTIONS_ONLY: { icon: AtSign, tone: "text-[#7EA6FF] bg-[#7EA6FF]/10 ring-[#7EA6FF]/20" },
  WORK_ACTIVITY_ONLY: { icon: Briefcase, tone: "text-amber-400 bg-amber-500/10 ring-amber-500/20" },
  MUTE_ALL: { icon: BellOff, tone: "text-red-400 bg-red-500/10 ring-red-500/20" },
};

// NotificationSettings.jsx — Settings -> Notifications.
//
// These four modes are enforced on the SERVER, at the single place
// Notification rows are written (backend utils/notifications.js), so
// choosing one genuinely changes what gets delivered rather than just
// hiding rows in this app. The preference is stored on the account, so
// it survives a reinstall or signing in on another device.
//
// There is deliberately no "Push notifications" toggle here: this
// product has no push infrastructure (no service worker, no web-push,
// no device tokens), and a switch that silently did nothing would be
// worse than not offering it.
export default function NotificationSettings({ profile, loading, onChanged, t }) {
  // Derived, not snapshotted: `profile` is null on first render while it
  // loads, so useState(profile?.…) would freeze on the fallback and the
  // saved preference would never appear selected. `override` holds the
  // user's own choice the moment they make it, so the UI still responds
  // instantly without waiting for a refetch.
  const [override, setOverride] = useState(null);
  const mode = override ?? profile?.notificationMode ?? "ALL";
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState(null);

  const OPTIONS = [
    { key: "ALL", label: t.modeAll, sub: t.modeAllSub },
    { key: "MENTIONS_ONLY", label: t.modeMentions, sub: t.modeMentionsSub },
    { key: "WORK_ACTIVITY_ONLY", label: t.modeWork, sub: t.modeWorkSub },
    { key: "MUTE_ALL", label: t.modeMute, sub: t.modeMuteSub },
  ];

  async function choose(next) {
    if (next === mode || saving) return;
    const previous = mode;
    setOverride(next); // optimistic — reverted below if the server refuses
    setSaving(next);
    setError(null);
    try {
      await updateMyPreferences({ notificationMode: next });
      onChanged?.({ notificationMode: next });
    } catch (err) {
      setOverride(previous);
      setError(err instanceof ApiError ? err.message : "Could not save your preference.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-2.5">
      {loading ? (
        Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[76px] animate-pulse rounded-2xl bg-white/[0.05]" />)
      ) : (
        OPTIONS.map((o) => {
          const cfg = ICONS[o.key];
          const Icon = cfg.icon;
          const active = mode === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => choose(o.key)}
              aria-pressed={active}
              className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-all duration-200 active:scale-[0.99] ${
                active
                  ? "border-[#F47A20]/55 bg-[#F47A20]/[0.09] shadow-[0_0_20px_-8px_rgba(244,122,32,0.9)]"
                  : "border-white/[0.07] bg-[#111A2D]/80 hover:border-white/[0.16]"
              }`}
            >
              <span
                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors ${
                  active ? "border-[#F47A20]" : "border-[#4C5266]"
                }`}
              >
                {active && <span className="h-2.5 w-2.5 rounded-full bg-[#F47A20]" />}
              </span>

              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${cfg.tone}`}>
                <Icon size={16} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-[13.5px] font-semibold text-white">{o.label}</span>
                  {saving === o.key && <Loader2 size={12} className="animate-spin text-[#F47A20]" />}
                  {active && saving !== o.key && <Check size={13} className="text-[#F47A20]" />}
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-[#8B93A8]">{o.sub}</span>
              </span>
            </button>
          );
        })
      )}

      {error && <p className="text-[12.5px] text-red-400">{error}</p>}

      <div className="flex items-start gap-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-3">
        <Info size={15} className="mt-0.5 shrink-0 text-[#8B93A8]" />
        <p className="text-[11.5px] leading-relaxed text-[#8B93A8]">{t.notificationsFootnote}</p>
      </div>
    </div>
  );
}
