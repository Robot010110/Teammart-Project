import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ShieldCheck, Zap, Lock } from "lucide-react";
import CinematicBackground from "./CinematicBackground";
import RoleCardPremium from "./RoleCardPremium";
import LanguagePreLoginToggle from "./LanguagePreLoginToggle";
import { ROLE_OPTIONS } from "../../data/auth";
import { BrandMark, BrandWordmark } from "../common/BrandMark";

// RoleSelectScreen.jsx — Stage 1, "Who's logging in?" the cinematic
// entrance the rest of the login flow branches from. `onSelect(roleKey)`
// is the real navigation — this component owns only the ~220ms
// tap-then-transition beat (see RoleCardPremium.jsx's own comment) so
// the actual screen change never feels like a hard cut.
export default function RoleSelectScreen({ onSelect }) {
  const { t } = useTranslation();
  const [pendingKey, setPendingKey] = useState(null);

  function handleSelect(key) {
    if (pendingKey) return; // ignore a second tap mid-transition
    setPendingKey(key);
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setTimeout(() => onSelect(key), reduceMotion ? 0 : 220);
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <CinematicBackground variant="storefront" />

      <div className="relative min-h-screen flex flex-col px-5 sm:px-8 py-6">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandMark className="h-10 w-10" />
            <div className="leading-tight">
              <BrandWordmark className="h-[16px]" />
              <p className="mt-1 text-[9.5px] uppercase tracking-[0.18em] text-[#8B93A8]">{t("auth.brandSubtitle")}</p>
            </div>
          </div>
          <LanguagePreLoginToggle />
        </header>

        <div className="flex-1 flex flex-col justify-center max-w-4xl w-full mx-auto py-10">
          <div className="text-center mb-8 animate-fade-up" style={{ animationDelay: "60ms" }}>
            {/* The background scrim is deliberately light now that the
                storefront photo is meant to read clearly (see
                CinematicBackground.jsx) — this text-shadow is the
                legibility guarantee instead of relying on heavy
                darkening. */}
            <h1
              className="font-display text-[28px] sm:text-4xl font-extrabold text-white"
              style={{ textShadow: "0 2px 16px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.9)" }}
            >
              {t("auth.whosLoggingIn")}
            </h1>
            <p
              className="mt-2.5 text-[13.5px] sm:text-sm text-[#C4C9D6]"
              style={{ textShadow: "0 1px 8px rgba(0,0,0,0.9)" }}
            >
              {t("auth.chooseRole")}
            </p>
          </div>

          {/* Stacked, full-width rows on phones (the reference's primary
              shape — one thumb-sized target per role, not four cramped
              tiles side by side). From `sm` up, two spacious columns of
              the same horizontal-row card rather than a four-across
              strip, which kept every card tall and roomy at desktop
              widths too. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 mx-auto w-full max-w-xl sm:max-w-3xl">
            {ROLE_OPTIONS.map((r, i) => (
              <RoleCardPremium key={r.key} role={r} index={i} onSelect={handleSelect} pending={pendingKey === r.key} />
            ))}
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-4 pb-2 text-[11px] text-[#8B93A8]">
          <span className="flex items-center gap-1.5">
            <Lock size={12} className="text-[#F47A20]" /> {t("auth.secureAccess")}
          </span>
          <span className="flex items-center gap-1.5">
            <Zap size={12} className="text-[#F47A20]" /> {t("auth.fastReliable")}
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={12} className="text-[#F47A20]" /> {t("auth.protectedData")}
          </span>
        </footer>
      </div>
    </div>
  );
}
