// departments.js — the ONE canonical list of department names in the
// whole application. Every place that used to accept a free-typed
// department string (Employee Main/Additional department assignment, a
// market's department catalog, Night Shift task department restriction,
// Warnings & Notifications targeting) now validates against this exact
// list instead — a Supervisor (or anyone else) can no longer type an
// arbitrary department name into the system. Historical
// DepartmentAssignment/MarketDepartment/Activity rows that predate this
// list are untouched (this is validation on NEW writes only, never a
// migration/rewrite of existing data).
export const DEPARTMENTS = [
  "Snacks",
  "Food",
  "Non-Food 1",
  "Non-Food 2",
  "Frozen",
  "Fresh",
  "Front",
  "Children Needs",
];
