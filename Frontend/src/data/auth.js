// auth.js — role picker configuration for LoginPage.jsx. Every role
// (Employee/Worker/Cashier, Supervisor, Regional Manager, Admin)
// authenticates against the real backend now (see authService.js) — this
// file used to also hold hardcoded demo-password login logic for
// Supervisor and Regional Manager; both were removed once each role was
// connected to real backend auth, leaving just this static role-list
// configuration.

export const ROLE_OPTIONS = [
  // Translation KEYS, not display text: the picker is rendered in
  // whichever language is active, so the copy lives in locales/ and this
  // file stays pure configuration. Keys resolve in RoleCardPremium.jsx.
  { key: "admin", labelKey: "roles.admin", taglineKey: "auth.adminDesc", hintKey: "auth.adminHint" },
  { key: "regionalManager", labelKey: "roles.regionalManager", taglineKey: "auth.regionalManagerDesc", hintKey: "auth.regionalManagerHint" },
  { key: "supervisor", labelKey: "roles.supervisor", taglineKey: "auth.supervisorDesc", hintKey: "auth.supervisorHint" },
  { key: "employee", labelKey: "roles.employee", taglineKey: "auth.employeeDesc", hintKey: "auth.employeeHint" },
];
