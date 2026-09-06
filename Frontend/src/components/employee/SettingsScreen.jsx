import { useSearchParams } from "react-router-dom";
import { ArrowLeft, User, Bell, Globe, LogOut, ChevronRight } from "lucide-react";
import { useAsync } from "../../hooks/useAsync";
import { getProfile } from "../../services/profileService";
import { stringsFor } from "../../i18n/settingsStrings";
import AccountSettings from "./settings/AccountSettings";
import NotificationSettings from "./settings/NotificationSettings";
import LanguageSettings from "./settings/LanguageSettings";

// SettingsScreen.jsx — Settings and its three real sections.
//
// Structure is deliberately Account / Notifications / Language. There is
// no separate "Security" entry any more: the only thing it did was
// change your password, and that belongs with the rest of your account
// details rather than in a category of its own. "Appearance" is also
// gone — this app is dark-only and has no theme system, so a theme
// picker would have been a control that does nothing.
//
// Sub-sections are addressed with a ?section= query parameter rather
// than local state. That keeps them real router history: the phone's
// Back gesture and the browser Back button both work, and a section can
// be linked to directly — without needing nested <Route>s added at each
// of the three places this screen is mounted (Employee profile,
// Supervisor, Admin).
const ENTRIES = [
  { key: "account", icon: User, title: "account", sub: "accountSub" },
  { key: "notifications", icon: Bell, title: "notifications", sub: "notificationsSub" },
  { key: "language", icon: Globe, title: "language", sub: "languageSub" },
];

export default function SettingsScreen({ onBack, onLogout }) {
  const [params, setParams] = useSearchParams();
  const section = params.get("section");

  const { data: profile, loading, setData } = useAsync(getProfile, { deps: [] });
  const t = stringsFor(profile?.language);

  function openSection(key) {
    const next = new URLSearchParams(params);
    next.set("section", key);
    setParams(next);
  }

  function closeSection() {
    const next = new URLSearchParams(params);
    next.delete("section");
    setParams(next);
  }

  // Applying a saved preference locally keeps the UI (including this
  // screen's own language) in step without a second network round trip.
  function handleChanged(patch) {
    setData((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  const active = ENTRIES.find((e) => e.key === section);

  if (active) {
    const Icon = active.icon;
    return (
      <div dir={t.dir} className="mx-auto max-w-2xl animate-fade-up px-4 pb-6 pt-5 sm:px-6">
        <button
          type="button"
          onClick={closeSection}
          className="-ml-1 mb-4 flex items-center gap-1.5 px-1 py-1.5 text-[13px] text-[#9AA1B4] transition-colors hover:text-white"
        >
          <ArrowLeft size={16} className={t.dir === "rtl" ? "rotate-180" : ""} /> {t.backToSettings}
        </button>

        <div className="mb-4 flex items-center gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#F47A20]/10 text-[#F47A20] ring-1 ring-inset ring-[#F47A20]/20">
            <Icon size={17} />
          </span>
          <div>
            <h1 className="font-display text-[20px] font-bold leading-tight text-white">{t[`${active.key}Title`] ?? t[active.title]}</h1>
            <p className="text-[12px] text-[#8B93A8]">{t[`${active.key}Lead`] ?? ""}</p>
          </div>
        </div>

        {active.key === "account" && <AccountSettings profile={profile} loading={loading} t={t} />}
        {active.key === "notifications" && (
          <NotificationSettings profile={profile} loading={loading} onChanged={handleChanged} t={t} />
        )}
        {active.key === "language" && (
          <LanguageSettings profile={profile} loading={loading} onChanged={handleChanged} t={t} />
        )}
      </div>
    );
  }

  return (
    <div dir={t.dir} className="mx-auto max-w-2xl animate-fade-up px-4 pb-6 pt-5 sm:px-6">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="-ml-1 mb-4 flex items-center gap-1.5 px-1 py-1.5 text-[13px] text-[#9AA1B4] transition-colors hover:text-white"
        >
          <ArrowLeft size={16} className={t.dir === "rtl" ? "rotate-180" : ""} /> {t.backToProfile}
        </button>
      )}

      <h1 className="mb-4 font-display text-[22px] font-bold text-white">{t.settings}</h1>

      <div className="space-y-2.5">
        {ENTRIES.map(({ key, icon: Icon, title, sub }) => (
          <button
            key={key}
            type="button"
            onClick={() => openSection(key)}
            className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#111A2D]/80 p-3.5 text-left backdrop-blur-xl transition-all duration-200 hover:border-[#F47A20]/30 hover:bg-[#131E33]/90 active:scale-[0.99]"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#F47A20]/10 text-[#F47A20] ring-1 ring-inset ring-[#F47A20]/20">
              <Icon size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-white">{t[title]}</span>
              <span className="mt-0.5 block truncate text-[11.5px] text-[#8B93A8]">{t[sub]}</span>
            </span>
            <ChevronRight size={17} className={`shrink-0 text-[#4C5266] ${t.dir === "rtl" ? "rotate-180" : ""}`} />
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onLogout}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/[0.07] py-3.5 text-[14px] font-semibold text-red-400 transition-colors duration-200 hover:bg-red-500/[0.12]"
      >
        <LogOut size={16} /> {t.logOut}
      </button>
    </div>
  );
}
