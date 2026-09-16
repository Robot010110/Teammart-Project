// breakNotificationCopy.js — Attendance + Shift Timing (spec §8/§9):
// localized title/body text for the three break-timing reminders, keyed
// by the recipient's OWN stored language preference (Employee.language /
// User.language, the exact same AppLanguage field — ENGLISH/KURDISH —
// every other self-service preference in this app already reads; see
// profileController.js). Notification.title/body are plain stored
// strings (not translation keys the frontend looks up), so localizing
// them has to happen HERE, at send time, not in Frontend/src/locales —
// this is the smallest correct fix for the fact that every notification
// in this app was English-only before this, not a new i18n system.
//
// Reused by BOTH break mechanisms that exist in this app (see their own
// comments for why there are two): the self-service breakStart/breakEnd
// pair on AttendanceRecord (attendanceController.js) for all three
// reminders, and the separate fingerprint-triggered Break model
// (breakService.js / maintenanceScheduler.js) for just the "ended" one —
// one shared copy source instead of two separately-maintained English
// strings that could drift apart or only get fixed in one place.
const COPY = {
  HALFWAY: {
    ENGLISH: { title: "Break Reminder", body: "30 minutes have passed. 30 minutes remain in your break." },
    KURDISH: { title: "یادەوەری پشوو", body: "30 خولەک تێپەڕی، 30 خولەکی پشووەکەت ماوە." },
  },
  TEN_MINUTES: {
    ENGLISH: { title: "Break Reminder", body: "10 minutes remain in your break." },
    KURDISH: { title: "یادەوەری پشوو", body: "10 خولەک لە پشووەکەت ماوە." },
  },
  ENDED: {
    ENGLISH: { title: "Break Ended", body: "Your break is over. Please return to work." },
    KURDISH: { title: "کۆتایی پشوو", body: "کاتی پشووەکەت تەواو بوو. تکایە بگەڕێوە سەر کار." },
  },
};

export function getBreakNotificationCopy(kind, language) {
  const entry = COPY[kind];
  return entry[language] ?? entry.ENGLISH;
}
