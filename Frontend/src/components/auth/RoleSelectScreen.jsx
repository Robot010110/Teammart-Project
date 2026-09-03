import { useState } from "react";
import { ShieldCheck, Zap, Lock } from "lucide-react";
import CinematicBackground from "./CinematicBackground";
import RoleCardPremium from "./RoleCardPremium";
import { ROLE_OPTIONS } from "../../data/auth";

// RoleSelectScreen.jsx — Stage 1, "Who's logging in?" the cinematic
// entrance the rest of the login flow branches from. `onSelect(roleKey)`
// is the real navigation — this component owns only the ~220ms
// tap-then-transition beat (see RoleCardPremium.jsx's own comment) so
// the actual screen change never feels like a hard cut.
export default function RoleSelectScreen({ onSelect }) {
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
        <header className="flex items-center gap-3">
          <div className="relative h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-[#F47A20] to-[#c95c10] grid place-items-center shadow-[0_0_16px_-2px_rgba(244,122,32,0.6)]">
            <span className="font-display font-extrabold text-white text-[15px]">TM</span>
          </div>
          <div className="leading-tight">
            <p className="font-display font-bold text-white text-[16px] tracking-wide">
              TEAM<span className="text-[#F47A20]">MART</span>
            </p>
            <p className="text-[9.5px] uppercase tracking-[0.18em] text-[#8B93A8]">Market Management</p>
          </div>
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
              Who's logging in?
            </h1>
            <p
              className="mt-2.5 text-[13.5px] sm:text-sm text-[#C4C9D6]"
              style={{ textShadow: "0 1px 8px rgba(0,0,0,0.9)" }}
            >
              Choose your role to access your dashboard
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ROLE_OPTIONS.map((r, i) => (
              <RoleCardPremium key={r.key} role={r} index={i} onSelect={handleSelect} pending={pendingKey === r.key} />
            ))}
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-4 pb-2 text-[11px] text-[#8B93A8]">
          <span className="flex items-center gap-1.5">
            <Lock size={12} className="text-[#F47A20]" /> Secure Access
          </span>
          <span className="flex items-center gap-1.5">
            <Zap size={12} className="text-[#F47A20]" /> Fast &amp; Reliable
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={12} className="text-[#F47A20]" /> Protected Data
          </span>
        </footer>
      </div>
    </div>
  );
}
