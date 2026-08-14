import { zones } from "./mockData";

// auth.js — hardcoded, prototype-only authentication for Regional Manager
// only. Employee (Worker/Cashier) and Supervisor login are both real
// backend auth now (see LoginPage.jsx's own comment) — the Supervisor
// mock branch and its per-market picker were removed once Supervisor
// Mode was connected to the real backend; LoginPage never reaches this
// module for that role anymore.

export const ROLE_OPTIONS = [
  {
    key: "regionalManager",
    label: "Regional Manager",
    tagline: "Strategic overview across your zone",
    hint: "Every market in your assigned zone",
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

// Regional Manager passwords follow a per-zone formula so each zone has a
// distinct demo password: RM<zoneNumber>12 (Zone 1 -> RM112, matches spec).
export function regionalManagerPassword(zoneNumber) {
  return `RM${zoneNumber}12`;
}

export function validateLogin({ role, zoneId, password }) {
  if (role === "regionalManager") {
    const zone = zones.find((z) => z.id === zoneId);
    return !!zone && password === regionalManagerPassword(zone.number);
  }
  return false;
}
