import { useEffect, useState } from "react";
import { CalendarCheck2, LogIn, LogOut, Coffee, Check, History, Loader2, AlertTriangle, RotateCcw } from "lucide-react";
import { checkIn, checkOut, getTodayAttendance, startBreak, endBreak } from "../../../services/attendanceService";
import { ApiError } from "../../../services/apiClient";

// AttendanceStatusCenter.jsx — the Attendance page's status + action
// hero: "You are currently / <state> / Since <time>" with the actions
// that are genuinely available in that state.
//
// BUSINESS LOGIC IS UNCHANGED. This is a new presentation of the exact
// same real state and calls the existing AttendanceCheckInCard.jsx
// already uses — getTodayAttendance / checkIn / checkOut / startBreak /
// endBreak — with the identical 4h-break / 8h-checkout display gating
// and the same constants. Nothing about when an action is allowed was
// touched; the backend re-validates every one of these regardless of
// what this UI shows, exactly as before.
//
// AttendanceCheckInCard.jsx itself is deliberately left in place and
// unmodified — it is still used by RegionalManagerProfile.jsx and is
// shared beyond this page.
const BREAK_AVAILABLE_AFTER_MS = 4 * 60 * 60 * 1000;
const CHECKOUT_AVAILABLE_AFTER_MS = 8 * 60 * 60 * 1000;

function clockTime(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function elapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// Semantic tone per real state — green checked in, purple break, red
// checked out, slate not yet started.
const TONES = {
  in: {
    label: "Checked In",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
    ring: "border-emerald-500/25",
    wash: "from-emerald-500/[0.10]",
    halo: "shadow-[0_0_22px_2px_rgba(52,211,153,0.35)]",
    iconBg: "bg-emerald-500/[0.12]",
  },
  break: {
    label: "On Break",
    text: "text-violet-400",
    dot: "bg-violet-400",
    ring: "border-violet-500/25",
    wash: "from-violet-500/[0.10]",
    halo: "shadow-[0_0_22px_2px_rgba(167,139,250,0.35)]",
    iconBg: "bg-violet-500/[0.12]",
  },
  out: {
    label: "Checked Out",
    text: "text-[#FF5C5C]",
    dot: "bg-[#FF5C5C]",
    ring: "border-red-500/25",
    wash: "from-red-500/[0.08]",
    halo: "shadow-[0_0_22px_2px_rgba(255,92,92,0.30)]",
    iconBg: "bg-red-500/[0.12]",
  },
  none: {
    label: "Not Checked In",
    text: "text-[#9AA1B4]",
    dot: "bg-white/25",
    ring: "border-white/[0.09]",
    wash: "from-white/[0.04]",
    halo: "",
    iconBg: "bg-white/[0.05]",
  },
};

// flex-1 only on mobile, where the buttons share one row edge to edge.
// On desktop they sit at their natural width inside a shrink-0 group —
// without lg:flex-none they get squeezed until the label ellipsises to
// "Chec...".
function ActionButton({ onClick, disabled, busy, icon: Icon, label, tone, title }) {
  const TONE = {
    green: "text-emerald-400 border-emerald-500/30 bg-emerald-500/[0.08] hover:bg-emerald-500/[0.14] shadow-[0_0_16px_-2px_rgba(52,211,153,0.45)]",
    red: "text-[#FF5C5C] border-red-500/30 bg-red-500/[0.08] hover:bg-red-500/[0.14] shadow-[0_0_16px_-2px_rgba(255,92,92,0.45)]",
    violet: "text-violet-400 border-violet-500/30 bg-violet-500/[0.08] hover:bg-violet-500/[0.14] shadow-[0_0_16px_-2px_rgba(167,139,250,0.45)]",
    blue: "text-sky-400 border-sky-500/30 bg-sky-500/[0.08] hover:bg-sky-500/[0.14] shadow-[0_0_16px_-2px_rgba(56,189,248,0.45)]",
    orange: "text-white border-[#F47A20]/40 bg-[#F47A20] hover:bg-[#ff8b36] shadow-[0_0_18px_-2px_rgba(244,122,32,0.65)]",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex-1 lg:flex-none min-w-0 flex items-center justify-center gap-1.5 rounded-xl border px-3 lg:px-4 py-2.5 text-[12.5px] font-semibold whitespace-nowrap transition-all duration-150 active:scale-[0.97] disabled:opacity-40 disabled:shadow-none ${TONE}`}
    >
      {busy ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Icon size={14} className="shrink-0" />}
      <span>{label}</span>
    </button>
  );
}

export default function AttendanceStatusCenter({ onViewHistory, onChanged }) {
  const [record, setRecord] = useState(null);
  const [loaded, setLoaded] = useState(false);
  // Distinct from `record === null`, which is the real "nothing recorded
  // today yet" state. A failed load must never render as "Not Checked
  // In" with a live Check In button — same guard as AttendanceQuickBar.
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoadFailed(false);
    getTodayAttendance()
      .then((r) => {
        if (cancelled) return;
        setRecord(r);
        setLoadFailed(false);
      })
      .catch(() => !cancelled && setLoadFailed(true))
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  async function run(action, label) {
    setBusy(label);
    setError(null);
    try {
      const updated = await action();
      setRecord(updated);
      setNow(Date.now());
      // Let the page refresh the month-derived cards (overview, rate,
      // calendar) off the same real change.
      onChanged?.(updated);
    } catch (err) {
      // Never pretend success — the state stays exactly as the backend
      // last reported it and the reason is shown.
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  if (!loaded) {
    return <div className="shimmer h-[132px] rounded-[20px] bg-[#0D1223]/80 border border-white/[0.06]" />;
  }

  if (loadFailed) {
    return (
      <div className="rounded-[20px] p-4 bg-red-500/[0.05] border border-red-500/20 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-[#8B93A8]">Attendance</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-red-300">
            <AlertTriangle size={15} className="shrink-0" /> Status unavailable
          </p>
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="shrink-0 flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white bg-white/10 hover:bg-white/15 active:scale-95 transition-all"
        >
          <RotateCcw size={14} /> Retry
        </button>
      </div>
    );
  }

  const isCheckedIn = !!(record?.checkIn && !record?.checkOut);
  const isCheckedOut = !!record?.checkOut;
  const onBreak = !!(record?.breakStart && !record?.breakEnd);
  const breakDone = !!(record?.breakStart && record?.breakEnd);
  const checkInMs = record?.checkIn ? new Date(record.checkIn).getTime() : null;

  const breakAvailableAt = checkInMs ? checkInMs + BREAK_AVAILABLE_AFTER_MS : null;
  const breakAvailable = isCheckedIn && !onBreak && !breakDone && breakAvailableAt != null && now >= breakAvailableAt;
  const checkoutAvailableAt = checkInMs ? checkInMs + CHECKOUT_AVAILABLE_AFTER_MS : null;
  const checkoutAvailable = checkoutAvailableAt != null && now >= checkoutAvailableAt;

  const state = onBreak ? "break" : isCheckedOut ? "out" : isCheckedIn ? "in" : "none";
  const t = TONES[state];

  const since = onBreak
    ? `On break for ${elapsed(now - new Date(record.breakStart).getTime())}`
    : isCheckedOut
      ? `At ${clockTime(record.checkOut)}`
      : isCheckedIn
        ? `Since ${clockTime(record.checkIn)}`
        : "No check-in recorded today";

  return (
    <section
      className={`relative overflow-hidden rounded-[20px] border ${t.ring} bg-[#0D1223]/85 transition-colors duration-500`}
    >
      {/* Ambient state wash — the card itself carries the semantic tone. */}
      <div className={`absolute inset-0 bg-gradient-to-br ${t.wash} to-transparent pointer-events-none`} aria-hidden="true" />
      <div className="absolute -top-16 -left-10 w-48 h-48 rounded-full bg-current opacity-[0.05] blur-3xl pointer-events-none" aria-hidden="true" />

      <div className="relative p-4 sm:p-5">
        {/* Desktop puts status and actions on one row; mobile stacks them. */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex items-center gap-3.5 min-w-0 lg:flex-1">
            <span
              className={`shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded-full grid place-items-center ${t.iconBg} ${t.halo} ${t.text}`}
            >
              <CalendarCheck2 size={26} strokeWidth={1.9} />
            </span>
            <div className="min-w-0">
              <p className="text-[12.5px] text-[#8B93A8]">You are currently</p>
              <p className={`font-display text-[22px] sm:text-[26px] font-bold leading-tight flex items-center gap-2 ${t.text}`}>
                {t.label}
                <span className={`w-2 h-2 rounded-full ${t.dot} ${state !== "none" ? "animate-glow-pulse" : ""}`} />
              </p>
              <p className="mt-0.5 text-[12.5px] text-[#9AA1B4]">{since}</p>
            </div>
          </div>

          <div className="flex items-stretch gap-2 lg:shrink-0">
            {!isCheckedIn && !isCheckedOut && !onBreak && (
              <ActionButton
                onClick={() => run(checkIn, "in")}
                disabled={busy !== null}
                busy={busy === "in"}
                icon={LogIn}
                label="Check In"
                tone="orange"
              />
            )}

            {onBreak && (
              <ActionButton
                onClick={() => run(endBreak, "endBreak")}
                disabled={busy !== null}
                busy={busy === "endBreak"}
                icon={Check}
                label="End Break"
                tone="violet"
              />
            )}

            {isCheckedIn && !onBreak && (
              <>
                <ActionButton
                  onClick={() => run(checkOut, "out")}
                  disabled={busy !== null || !checkoutAvailable}
                  busy={busy === "out"}
                  icon={LogOut}
                  label="Check Out"
                  tone="red"
                  title={!checkoutAvailable ? `Check-out available at ${clockTime(checkoutAvailableAt)}` : undefined}
                />
                <ActionButton
                  onClick={() => run(startBreak, "break")}
                  disabled={busy !== null || !breakAvailable}
                  busy={busy === "break"}
                  icon={Coffee}
                  label="Break"
                  tone="violet"
                  title={
                    breakDone
                      ? "Break already taken today"
                      : !breakAvailable && breakAvailableAt
                        ? `Break available at ${clockTime(breakAvailableAt)}`
                        : undefined
                  }
                />
              </>
            )}

            <ActionButton onClick={onViewHistory} icon={History} label="History" tone="blue" />
          </div>
        </div>

        {/* Real gate explanations — why a disabled button is disabled. */}
        {isCheckedIn && !onBreak && (!checkoutAvailable || (!breakAvailable && !breakDone)) && (
          <div className="relative mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#5C6479]">
            {!checkoutAvailable && checkoutAvailableAt && <span>Check-out at {clockTime(checkoutAvailableAt)}</span>}
            {!breakAvailable && !breakDone && breakAvailableAt && <span>Break at {clockTime(breakAvailableAt)}</span>}
            {breakDone && <span>Break completed</span>}
          </div>
        )}

        {error && (
          <p className="relative mt-3 flex items-center gap-1.5 text-xs text-red-400">
            <AlertTriangle size={12} className="shrink-0" /> {error}
          </p>
        )}
      </div>
    </section>
  );
}
