import jwt from "jsonwebtoken";

// This is the fix for the old bug where the token only carried
// { userId, role } — a Regional Manager's zoneId (or a Supervisor's
// marketId) was never in the token, so there was nothing for RBAC
// middleware to actually check ownership against. Every token now carries
// everything the RBAC middleware needs to make a decision on its own,
// without an extra DB lookup per request.

const TOKEN_TTL = "8h";

// Staff = Admin / Regional Manager / Supervisor. `scope` carries the one
// piece of ownership info relevant to their role:
//   ADMIN             -> no scope needed, sees everything
//   REGIONAL_MANAGER   -> { zoneId }
//   SUPERVISOR         -> { marketId }
export function signStaffToken(user) {
  const payload = {
    kind: "staff",
    userId: user.id,
    role: user.role,
    zoneId: user.managedZone?.id ?? null,
    marketId: user.managedMarket?.id ?? null,
  };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });
}

// `role` (WORKER | CASHIER) is an additive claim — a Worker's token shape
// is unchanged in practice (role defaults to WORKER on the Employee row),
// and nothing read this claim before it existed, so this can't break any
// existing check. requireEmployeeRole() in middleware/auth.js is the
// first thing that reads it.
export function signEmployeeToken(employee) {
  const payload = {
    kind: "employee",
    employeeId: employee.id,
    marketId: employee.marketId,
    role: employee.role,
    cashierShift: employee.cashierShift ?? null,
  };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}
