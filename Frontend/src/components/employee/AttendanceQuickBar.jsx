import { useEffect, useState } from "react";
import { LogIn, LogOut, Coffee, Check, Loader2 } from "lucide-react";
import { checkIn, checkOut, getTodayAttendance, startBreak, endBreak } from "../../services/attendanceService";
import { ApiError } from "../../services/apiClient";

// Same real gating this app's existing AttendanceCheckInCard.jsx already
// uses (break available 4h after check-in, check-out available 8h
// after) — intentionally mirrored here rather than extracted into a
// shared hook. Reasoning: the backend independently re-validates every
// one of these actions regardless of what the UI shows (see
// AttendanceCheckInCard.jsx's own comment — "`now` here only drives
// what the UI *shows*"), so this client-side gating is presentation-
// only, never the source of truth. Refactoring the already-working
// attendance card into a shared hook for a purely cosmetic homepage
// placement change would be a bigger, riskier edit than this task asks
// for — duplicating two numeric constants is a far smaller risk than
// touching business-critical clock-in/out code that already works.
const BREAK_AVAILABLE_AFTER_MS = 4 * 60 * 60 * 1000;
const CHECKOUT_AVAILABLE_AFTER_MS = 8 * 60 * 60 * 1000;

function formatClockTime(iso) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function formatElapsed(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// AttendanceQuickBar.jsx — Home tab's compact attendance quick-action
// bar, replacing the announcement card's slot. Same real backend state/
// actions as AttendanceCheckInCard.jsx (checkIn/checkOut/startBreak/
// endBreak, GET /attendance/today) — this is a second, more compact
// presentation of the same real data, not a new attendance system. The
// full Attendance page (calendar, month summary, day-off requests)
// still lives where it always has; this bar is action-only, on purpose
// (see the brief: "Today's Performance is for SUMMARY, this bar is for
// ACTIONS").
export default function AttendanceQuickBar() {
  const [record, setRecord] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(null); // which action is in flight
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getTodayAttendance()
      .then((r) => !cancelled && setRecord(r))
      .catch(() => {})
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  async function run(action, label) {
    setBusy(label);
    setError(null);
    try {
      const updated = await action();
      setRecord(updated);
      setNow(Date.now());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const isCheckedIn = !!(record?.checkIn && !record?.checkOut);
  const isCheckedOut = !!record?.checkOut;
  const checkInMs = record?.checkIn ? new Date(record.checkIn).getTime() : null;
  const onBreak = !!(record?.breakStart && !record?.breakEnd);
  const breakDone = !!(record?.breakStart && record?.breakEnd);
  const breakAvailableAt = checkInMs ? checkInMs + BREAK_AVAILABLE_AFTER_MS : null;
  const breakAvailable = isCheckedIn && !onBreak && !breakDone && breakAvailableAt !== null && now >= breakAvailableAt;
  const checkoutAvailableAt = checkInMs ? checkInMs + CHECKOUT_AVAILABLE_AFTER_MS : null;
  const checkoutAvailable = checkoutAvailableAt !== null && now >= checkoutAvailableAt;

  if (!loaded) {
    return <div className="rounded-2xl h-[60px] bg-[#171C2E]/60 border border-white/[0.06] animate-pulse" />;
  }

  // Status label + accent tone, one of: not checked in / checked in /
  // on break / checked out — the only four real states this model has.
  let statusLabel = "Not Checked In";
  let statusSub = null;
  let tone = { text: "text-[#8B93A8]", dot: "bg-white/20" };
  if (onBreak) {
    statusLabel = "On Break";
    statusSub = formatElapsed(now - new Date(record.breakStart).getTime());
    tone = { text: "text-violet-400", dot: "bg-violet-400" };
  } else if (isCheckedOut) {
    statusLabel = "Checked Out";
    statusSub = `at ${formatClockTime(record.checkOut)}`;
    tone = { text: "text-[#8B93A8]", dot: "bg-white/20" };
  } else if (isCheckedIn) {
    statusLabel = "Checked In";
    statusSub = `Since ${formatClockTime(record.checkIn)}`;
    tone = { text: "text-emerald-400", dot: "bg-emerald-400" };
  }

  return (
    <div className="card-premium rounded-2xl px-4 py-3 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl transition-all duration-300">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-[#8B93A8]">Attendance</p>
          <p className={`text-sm font-semibold flex items-center gap-1.5 ${tone.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${tone.dot} ${isCheckedIn || onBreak ? "animate-glow-pulse" : ""}`} />
            {statusLabel}
            {statusSub && <span className="text-xs font-normal text-[#9AA1B4]">· {statusSub}</span>}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isCheckedIn && !isCheckedOut && !onBreak && (
            <button
              type="button"
              onClick={() => run(checkIn, "in")}
              disabled={busy !== null}
              className="glow-orange flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] active:scale-95 disabled:opacity-50 transition-all duration-150"
            >
              {busy === "in" ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />} Check In
            </button>
          )}

          {onBreak && (
            <button
              type="button"
              onClick={() => run(endBreak, "endBreak")}
              disabled={busy !== null}
              className="glow-violet flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white bg-violet-500/80 hover:bg-violet-500 active:scale-95 disabled:opacity-50 transition-all duration-150"
            >
              {busy === "endBreak" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} End Break
            </button>
          )}

          {isCheckedIn && !onBreak && (
            <>
              {breakAvailable && (
                <button
                  type="button"
                  onClick={() => run(startBreak, "break")}
                  disabled={busy !== null}
                  title="Start Break"
                  aria-label="Start Break"
                  className="glow-sky-soft flex items-center justify-center w-10 h-10 rounded-xl text-sky-400 bg-sky-500/10 hover:bg-sky-500/15 active:scale-95 disabled:opacity-50 transition-all duration-150"
                >
                  {busy === "break" ? <Loader2 size={14} className="animate-spin" /> : <Coffee size={16} />}
                </button>
              )}
              <button
                type="button"
                onClick={() => run(checkOut, "out")}
                disabled={busy !== null || !checkoutAvailable}
                title={!checkoutAvailable ? `Check-out available at ${formatClockTime(checkoutAvailableAt)}` : undefined}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold text-white bg-red-500/80 hover:bg-red-500 active:scale-95 disabled:opacity-40 disabled:bg-white/10 transition-all duration-150"
              >
                {busy === "out" ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />} Check Out
              </button>
            </>
          )}
        </div>
      </div>

      {error && <p className="mt-2 text-[11px] text-red-400">{error}</p>}
    </div>
  );
}
