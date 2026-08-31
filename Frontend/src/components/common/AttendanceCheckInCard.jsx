import { useEffect, useRef, useState } from "react";
import { LogIn, LogOut, Loader2, Coffee, Check } from "lucide-react";
import {
  checkIn,
  checkOut,
  getTodayAttendance,
  startBreak,
  endBreak,
} from "../../services/attendanceService";
import { ApiError } from "../../services/apiClient";

const BREAK_AVAILABLE_AFTER_MS = 4 * 60 * 60 * 1000;
const BREAK_DURATION_MS = 60 * 60 * 1000;
const CHECKOUT_AVAILABLE_AFTER_MS = 8 * 60 * 60 * 1000;

function formatClockTime(iso) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRemaining(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// AttendanceCheckInCard.jsx — Repair Pass §1: real check-in/check-out +
// self-service break, all backed by today's AttendanceRecord
// (checkIn/checkOut/breakStart/breakEnd) rather than the separate
// fingerprint-triggered Break model (see attendanceController.startBreak's
// own comment for why those are deliberately different systems). Timing
// gates (break at 4h, check-out at 8h) are enforced server-side — `now`
// here only drives what the UI *shows*; the actual permission check
// happens again in the request itself, so a stale clock or a disabled-
// button bypass can never let an action through early.
//
// State is loaded from GET /api/attendance/today on mount, so a refresh
// or a fresh login shows the real, persisted state immediately instead
// of resetting to "Not checked in yet" until the next button tap.
//
// showBreak — Cleanup Phase §5: Employee/Supervisor/Overlooking get the
// full Check-in -> Break -> Check-out flow (the default); a Regional
// Manager gets Check-in -> Check-out only (RegionalManagerProfile.jsx
// passes false) — the backend also independently rejects a Regional
// Manager's break-start (see startBreak's own role check), so this is a
// UI convenience, not the only enforcement.
export default function AttendanceCheckInCard({ showBreak = true }) {
  const [record, setRecord] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
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

  // Re-render every 30s so "available in Xm" / elapsed timers stay
  // current without a client-side countdown that could drift from the
  // server's own clock (used only to decide what to SHOW, never to
  // decide what's allowed — see this file's own top comment).
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      const updated = await action();
      setRecord(updated);
      setNow(Date.now());
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const isCheckedIn = !!(record?.checkIn && !record?.checkOut);
  const isCheckedOut = !!record?.checkOut;
  const checkInMs = record?.checkIn ? new Date(record.checkIn).getTime() : null;

  const onBreak = !!(record?.breakStart && !record?.breakEnd);
  const breakDone = !!(record?.breakStart && record?.breakEnd);
  const breakAvailableAt = checkInMs
    ? checkInMs + BREAK_AVAILABLE_AFTER_MS
    : null;
  const breakAvailable =
    isCheckedIn &&
    !onBreak &&
    !breakDone &&
    breakAvailableAt !== null &&
    now >= breakAvailableAt;

  const checkoutAvailableAt = checkInMs
    ? checkInMs + CHECKOUT_AVAILABLE_AFTER_MS
    : null;
  const checkoutAvailable =
    checkoutAvailableAt !== null && now >= checkoutAvailableAt;

  if (!loaded) {
    return (
      <div className="rounded-2xl p-4 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
        <p className="text-xs text-[#8B93A8]">Loading attendance...</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-4 bg-[#171C2E]/80 border border-white/[0.06] backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Attendance</p>
          <p className="text-xs text-[#8B93A8] mt-0.5">
            {isCheckedIn
              ? `Checked in at ${formatClockTime(record.checkIn)}`
              : isCheckedOut
                ? "Checked out for today"
                : "Not checked in yet"}
          </p>
        </div>
        {!isCheckedOut && (
          <button
            type="button"
            onClick={() => run(isCheckedIn ? checkOut : checkIn)}
            disabled={busy || (isCheckedIn && !checkoutAvailable)}
            title={
              isCheckedIn && !checkoutAvailable
                ? `Check-out available at ${formatClockTime(checkoutAvailableAt)}`
                : undefined
            }
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors duration-150 disabled:opacity-50 ${
              isCheckedIn
                ? "text-white bg-red-500/80 hover:bg-red-500"
                : "text-white bg-[#F47A20] hover:bg-[#ff8b36]"
            }`}
          >
            {busy ? (
              <Loader2 size={13} className="animate-spin" />
            ) : isCheckedIn ? (
              <LogOut size={13} />
            ) : (
              <LogIn size={13} />
            )}
            {isCheckedIn ? "Check Out" : "Check In"}
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      {isCheckedIn && !checkoutAvailable && (
        <p className="mt-2 text-[11px] text-[#8B93A8]">
          Check-out available at {formatClockTime(checkoutAvailableAt)}
        </p>
      )}

      {showBreak &&
        isCheckedIn &&
        !onBreak &&
        !breakDone &&
        !breakAvailable && (
          <div className="mt-3 flex items-center gap-2 rounded-xl p-3 bg-white/[0.04] border border-white/[0.06]">
            <Coffee size={14} className="text-[#4C5266] shrink-0" />
            <p className="text-xs text-[#8B93A8]">
              Break available at {formatClockTime(breakAvailableAt)}
            </p>
          </div>
        )}

      {showBreak && breakAvailable && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl p-3 bg-[#F47A20]/10 border border-[#F47A20]/25">
          <p className="flex items-center gap-1.5 text-xs text-white">
            <Coffee size={14} className="text-[#F47A20]" /> Break is available
          </p>
          <button
            type="button"
            onClick={() => run(startBreak)}
            disabled={busy}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white bg-[#F47A20] hover:bg-[#ff8b36] disabled:opacity-50"
          >
            {busy ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Coffee size={12} />
            )}{" "}
            Start Break
          </button>
        </div>
      )}

      {showBreak && onBreak && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl p-3 bg-sky-500/10 border border-sky-500/25">
          <p className="flex items-center gap-1.5 text-xs text-white">
            <Coffee size={14} className="text-sky-400" /> On break —{" "}
            {formatElapsed(now - new Date(record.breakStart).getTime())}
          </p>
          <button
            type="button"
            onClick={() => run(endBreak)}
            disabled={busy}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white bg-sky-500/80 hover:bg-sky-500 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Check size={12} />
            )}{" "}
            End Break
          </button>
        </div>
      )}

      {showBreak && breakDone && (
        <div className="mt-3 flex items-center gap-2 rounded-xl p-3 bg-emerald-500/10 border border-emerald-500/25">
          <Coffee size={14} className="text-emerald-400 shrink-0" />
          <p className="text-xs text-white">
            Break completed ({formatClockTime(record.breakStart)} -{" "}
            {formatClockTime(record.breakEnd)})
          </p>
        </div>
      )}
    </div>
  );
}
