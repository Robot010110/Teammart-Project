import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2, Info } from "lucide-react";
import { updateMyPreferences } from "../../../services/profileService";
import { ApiError } from "../../../services/apiClient";
import { TAG_TO_API, API_TO_TAG, setLanguageTag } from "../../../i18n";

// LanguageSettings.jsx — Settings -> Language.
//
// Exactly two languages, matching what the product actually offers. The
// choice is stored on the account (not localStorage) so it follows the
// person across devices and survives a reinstall; i18n/index.js keeps a
// local mirror purely so the pre-login screens, where no profile exists
// yet, can still render in the right language.
//
// Switching is immediate and does NOT reload the app: setLanguageTag()
// changes i18next, every subscribed component re-renders, and <html
// dir>/font swap in the same tick. The account write happens after, so
// a slow or failed network call never blocks the visible switch — it
// just rolls the selection back if it fails.
export default function LanguageSettings({ profile, loading, onChanged }) {
  const { t, i18n } = useTranslation();
  // Derived rather than snapshotted, for the same reason as
  // NotificationSettings: `profile` is still loading on first render.
  const [override, setOverride] = useState(null);
  const language = override ?? profile?.language ?? API_TO_TAG[i18n.language] ?? "ENGLISH";
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState(null);

  const OPTIONS = [
    // Two-letter tags rather than flag emoji: Windows Chrome has no flag
    // glyphs and renders "🇬🇧" as boxed "GB" letters, so the two rows
    // looked inconsistent. Text tags render identically on every platform,
    // and a flag would be the wrong symbol for Kurdish anyway.
    { key: "ENGLISH", label: t("settings.english"), sub: t("settings.englishSub"), tag: "EN" },
    { key: "KURDISH", label: t("settings.kurdish"), sub: t("settings.kurdishSub"), tag: "KU" },
  ];

  async function choose(next) {
    if (next === language || saving) return;
    const previous = language;
    setOverride(next);
    setSaving(next);
    setError(null);
    // Switch the UI first — the person sees the result of their tap
    // immediately rather than after a round trip.
    setLanguageTag(API_TO_TAG[next]);
    try {
      await updateMyPreferences({ language: next });
      onChanged?.({ language: next });
    } catch (err) {
      setOverride(previous);
      setLanguageTag(API_TO_TAG[previous]);
      setError(err instanceof ApiError ? err.message : t("settings.languageSaveError"));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-2.5">
      {loading ? (
        Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-[70px] animate-pulse rounded-2xl bg-white/[0.05]" />)
      ) : (
        OPTIONS.map((o) => {
          const active = language === o.key;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => choose(o.key)}
              aria-pressed={active}
              className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-start transition-all duration-200 active:scale-[0.99] ${
                active
                  ? "border-[#F47A20]/55 bg-[#F47A20]/[0.09] shadow-[0_0_20px_-8px_rgba(244,122,32,0.9)]"
                  : "border-white/[0.07] bg-[#111A2D]/80 hover:border-white/[0.16]"
              }`}
            >
              <span
                dir="ltr"
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[13px] font-bold tracking-wide ring-1 ring-inset transition-colors ${
                  active
                    ? "bg-[#F47A20]/12 text-[#F47A20] ring-[#F47A20]/25"
                    : "bg-white/[0.06] text-[#8B93A8] ring-white/[0.08]"
                }`}
              >
                {o.tag}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-white">{o.label}</span>
                <span className="mt-0.5 block truncate text-[11.5px] text-[#8B93A8]">{o.sub}</span>
              </span>
              {saving === o.key ? (
                <Loader2 size={16} className="shrink-0 animate-spin text-[#F47A20]" />
              ) : (
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                    active ? "border-[#F47A20]" : "border-[#4C5266]"
                  }`}
                >
                  {active && <Check size={11} className="text-[#F47A20]" />}
                </span>
              )}
            </button>
          );
        })
      )}

      {error && <p className="text-[12.5px] text-red-400">{error}</p>}

      <div className="flex items-start gap-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3.5 py-3">
        <Info size={14} className="mt-0.5 shrink-0 text-[#8B93A8]" />
        <p className="text-[11.5px] leading-relaxed text-[#8B93A8]">{t("settings.languageFootnote")}</p>
      </div>
    </div>
  );
}
