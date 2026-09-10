import { useTranslation } from "react-i18next";
import { setLanguageTagFromPreLogin, LANGUAGES } from "../../i18n";

// LanguagePreLoginToggle.jsx — the language selector for the three
// screens reachable before a session exists (RoleSelectScreen /
// StaffLoginScreen / EmployeeLoginScreen). Deliberately its own tiny
// component rather than a copy of LanguageSettings.jsx's two full-width
// rows — that layout fits a Settings page, not a login header — but it
// drives the exact same underlying language system (i18n/index.js),
// just through setLanguageTagFromPreLogin instead of setLanguageTag, so
// App.jsx can tell "picked here, before login" apart from "already
// active" once the account's own saved preference enters the picture
// after a successful login (see i18n/index.js's own comment on that).
//
// Switching is instant — no reload, and the whole page (this header
// included) re-renders RTL/LTR immediately, the same guarantee already
// verified for the in-app Settings picker.
export default function LanguagePreLoginToggle({ className = "" }) {
  const { i18n } = useTranslation();
  const current = i18n.language;

  return (
    <div
      role="group"
      aria-label={`${LANGUAGES.en.label} / ${LANGUAGES.ckb.endonym}`}
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full border border-white/15 bg-black/30 p-0.5 backdrop-blur-md ${className}`}
    >
      <button
        type="button"
        onClick={() => setLanguageTagFromPreLogin("en")}
        aria-pressed={current === "en"}
        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors duration-150 ${
          current === "en" ? "bg-white text-[#111827]" : "text-white/65 hover:text-white"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLanguageTagFromPreLogin("ckb")}
        aria-pressed={current === "ckb"}
        className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors duration-150 ${
          current === "ckb" ? "bg-white text-[#111827]" : "text-white/65 hover:text-white"
        }`}
      >
        کوردی
      </button>
    </div>
  );
}
