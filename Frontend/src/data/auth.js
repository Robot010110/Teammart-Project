// auth.js — role picker configuration for LoginPage.jsx. Every role
// (Employee/Worker/Cashier, Supervisor, Regional Manager) authenticates
// against the real backend now (see authService.js) — this file used to
// also hold hardcoded demo-password login logic for Supervisor and
// Regional Manager; both were removed once each role was connected to
// real backend auth, leaving just this static role-list configuration.

export const ROLE_OPTIONS = [
  {
    key: "regionalManager",
    label: "Regional Manager",
    tagline: "Strategic overview across your zones",
    hint: "Every market in your assigned zones",
  },
  {
    key: "supervisor",
    label: "Supervisor",
    tagline: "Operational management of one market",
    hint: "Your assigned market only",
  },
  {
    key: "employee",
    label: "Employee",
    tagline: "Your personal tasks & daily work",
    hint: "Just your own profile and activity",
  },
];
