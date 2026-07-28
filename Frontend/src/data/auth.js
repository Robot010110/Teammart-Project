import { zones } from "./mockData";

// auth.js — hardcoded, prototype-only authentication for Regional Manager
// and Supervisor (Manager/Supervisor login is out of scope for this phase,
// so it's untouched). Employee login is real now — see
// services/authService.js — so the employee-specific pieces that used to
// live here (a fake directory + one shared demo password) were removed.

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

// Supervisor demo password is the single example given in the spec, used
// universally in this prototype (any market will accept it) — swap for
// per-account credentials once Supervisor login is connected to the
// backend (out of scope here).
export const SUPERVISOR_DEMO_PASSWORD = "SP201";

export function validateLogin({ role, zoneId, marketId, password }) {
  if (role === "regionalManager") {
    const zone = zones.find((z) => z.id === zoneId);
    return !!zone && password === regionalManagerPassword(zone.number);
  }
  if (role === "supervisor") {
    return !!marketId && password === SUPERVISOR_DEMO_PASSWORD;
  }
  return false;
}

// Flat list of every market across every zone — used by the Supervisor
// market picker.
export function getAllMarkets() {
  return zones.flatMap((zone) =>
    zone.markets.map((market) => ({ ...market, zoneId: zone.id, zoneNumber: zone.number }))
  );
}
