// activityRules.js — the single place that knows which Activity statuses
// are editable/deletable by the employee who owns them. Before this file
// existed, "DRAFT or PENDING" and "DRAFT only" were spelled out with
// hand-written `status === "..."` checks independently in
// TaskStatusTabs.jsx, EmployeeWorkspace.jsx, and SubmitTaskModal.jsx — three
// copies of the same rule that could quietly drift apart. Now all three
// import from here.
//
// IMPORTANT: these are UX guards only (hide/disable a button, show a
// friendly message) — they are NOT the real security boundary. The actual
// enforcement is server-side, in backend/src/controllers/activitiesController.js
// (EDITABLE_STATUSES / the DRAFT-only delete check). Even if every check
// below were deleted, an employee still could not edit/delete another
// person's activity or one that's already been reviewed — the backend
// would reject it. These exist purely so the UI doesn't offer a button
// that's guaranteed to fail.

const EDITABLE_STATUSES = ["DRAFT", "PENDING"];
const DELETABLE_STATUSES = ["DRAFT"];

export function canEditActivity(activity) {
  return EDITABLE_STATUSES.includes(activity.status);
}

export function canDeleteActivity(activity) {
  return DELETABLE_STATUSES.includes(activity.status);
}
