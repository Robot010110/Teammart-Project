import jwt from "jsonwebtoken";

// This is the fix for the old bug where the token only carried
// { userId, role } — a Regional Manager's zoneId (or a Supervisor's
// marketId) was never in the token, so there was nothing for RBAC
// middleware to actually check ownership against. Every token now carries
// everything the RBAC middleware needs to make a decision on its own,
// without an extra DB lookup per request.

const TOKEN_TTL = "8h";
const REMEMBER_ME_TTL = "30d";

// Staff = Admin / Regional Manager / Supervisor. `scope` carries the one
// piece of ownership info relevant to their role:
//   ADMIN             -> no scope needed, sees everything
//   REGIONAL_MANAGER   -> { zoneIds } — a Regional Manager can manage more
//                          than one zone (Zone.managerId has no
//                          uniqueness constraint), so this is always an
//                          array, even when it holds just one id.
//   SUPERVISOR         -> { marketId }
export function signStaffToken(user) {
  const payload = {
    kind: "staff",
    userId: user.id,
    role: user.role,
    zoneIds: (user.managedZones ?? []).map((z) => z.id),
    marketId: user.managedMarket?.id ?? null,
  };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });
}

// `role` (WORKER | CASHIER) is an additive claim — a Worker's token shape
// is unchanged in practice (role defaults to WORKER on the Employee row),
// and nothing read this claim before it existed, so this can't break any
// existing check. requireEmployeeRole() in middleware/auth.js is the
// first thing that reads it.
//
// rememberMe — session *restoration* already worked before this (App.jsx
// already re-validates a saved token against GET /api/profile on every
// relaunch instead of forcing a fresh login); the only real gap was the
// fixed 8h token lifetime forcing a re-login mid-shift or the next day.
// A checked "Remember me" just requests a 30-day token instead — same
// verifyToken() path, no second auth system.
export function signEmployeeToken(employee, { rememberMe = false } = {}) {
  const payload = {
    kind: "employee",
    employeeId: employee.id,
    marketId: employee.marketId,
    role: employee.role,
    cashierShift: employee.cashierShift ?? null,
  };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: rememberMe ? REMEMBER_ME_TTL : TOKEN_TTL });
}

export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}
