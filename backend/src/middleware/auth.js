import { verifyToken } from "../utils/jwt.js";
import { prisma } from "../lib/prisma.js";

// ---------------------------------------------------------------------
// requireAuth — verifies the Bearer token and attaches its payload to
// req.user. Everything after this middleware can trust req.user is real
// and unexpired. req.user.kind is either "staff" or "employee" (see
// utils/jwt.js for the exact shape of each).
// ---------------------------------------------------------------------
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or malformed Authorization header" });
  }

  const token = header.slice("Bearer ".length);

  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ---------------------------------------------------------------------
// requireStaffRole("ADMIN", "REGIONAL_MANAGER", ...) — blocks anyone who
// isn't logged in as staff with one of the allowed roles. Must run after
// requireAuth. Employees never pass this check.
// ---------------------------------------------------------------------
export function requireStaffRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if (req.user.kind !== "staff" || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Not authorized for this action" });
    }
    next();
  };
}

// ---------------------------------------------------------------------
// requireEmployeeAuth — the counterpart to requireStaffRole, for routes
// only an Employee account should hit (e.g. submitting their own task).
// ---------------------------------------------------------------------
export function requireEmployeeAuth(req, res, next) {
  if (!req.user || req.user.kind !== "employee") {
    return res.status(403).json({ error: "This action requires an employee login" });
  }
  next();
}

// ---------------------------------------------------------------------
// requireOwnZoneOrElevated — the IDOR-prevention check for zone-scoped
// resources. ADMIN always passes. A REGIONAL_MANAGER may only touch the
// zone their own token was issued for. `getZoneId(req)` returns the zone
// id being requested (usually from req.params).
//
// NOTE: this was written in the original backend too, but never actually
// applied to any route — so it did nothing. It's applied to every
// zone-scoped route below.
// ---------------------------------------------------------------------
export function requireOwnZoneOrElevated(getZoneId) {
  return (req, res, next) => {
    if (req.user.kind !== "staff") {
      return res.status(403).json({ error: "Not authorized for this zone" });
    }
    if (req.user.role === "ADMIN") return next();

    if (req.user.role !== "REGIONAL_MANAGER") {
      return res.status(403).json({ error: "Not authorized for this zone" });
    }

    const requestedZoneId = getZoneId(req);
    if (String(req.user.zoneId) !== String(requestedZoneId)) {
      return res.status(403).json({ error: "You do not have access to this zone" });
    }
    next();
  };
}

// ---------------------------------------------------------------------
// requireOwnMarketOrElevated — same idea, one level down. ADMIN always
// passes. SUPERVISOR must own the exact market (cheap check, no DB hit —
// their marketId is already in the token). REGIONAL_MANAGER must own the
// zone the market belongs to (needs one DB lookup, since a token only
// carries the manager's own zoneId, not every market inside it).
//
// `getMarketId(req)` returns the market id being requested (usually from
// req.params, but for POST /tasks it might come from req.body instead).
// ---------------------------------------------------------------------
export function requireOwnMarketOrElevated(getMarketId) {
  return async (req, res, next) => {
    try {
      const marketId = getMarketId(req);
      const result = await staffCanAccessMarket(req.user, marketId);
      if (result === "not-found") {
        return res.status(404).json({ error: "Market not found" });
      }
      if (!result) {
        return res.status(403).json({ error: "You do not have access to this market" });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Shared helper so controllers that already have a marketId in hand (e.g.
// after fetching an Employee to find their marketId) can run the exact
// same ownership check without going through Express middleware again.
// Returns true (allowed), false (forbidden), or "not-found".
export async function staffCanAccessMarket(user, marketId) {
  if (user.kind !== "staff") return false;
  if (user.role === "ADMIN") return true;

  if (user.role === "SUPERVISOR") {
    return String(user.marketId) === String(marketId);
  }

  if (user.role === "REGIONAL_MANAGER") {
    const market = await prisma.market.findUnique({
      where: { id: marketId },
      select: { zoneId: true },
    });
    if (!market) return "not-found";
    return String(user.zoneId) === String(market.zoneId);
  }

  return false;
}

// ---------------------------------------------------------------------
// requireOwnEmployeeOrElevated — for routes about one specific employee
// (profile, task history). An Employee may only access their own record.
// Staff must additionally own the market that employee belongs to — this
// middleware only checks "is it me or am I staff"; pair it with
// requireOwnMarketOrElevated (using the employee's marketId) for the full
// staff-side check when the route needs it.
// ---------------------------------------------------------------------
export function requireOwnEmployeeOrStaff(getEmployeeId) {
  return (req, res, next) => {
    if (req.user.kind === "staff") return next();
    if (req.user.kind === "employee" && String(req.user.employeeId) === String(getEmployeeId(req))) {
      return next();
    }
    return res.status(403).json({ error: "You do not have access to this employee's data" });
  };
}

// ---------------------------------------------------------------------
// HttpError + assertMarketAccess/requireAccessibleEmployee — this exact
// shape ("call staffCanAccessMarket, then 404 on not-found / 403 on
// forbidden") was hand-written ~19 times across the controllers before
// this. Throwing an HttpError instead of returning a response directly
// means every call site can just `await` it inside its existing
// try/catch — errorHandler.js already knows how to turn `err.status`
// into the right response (see the `if (err.status)` branch there), so
// no change to the error-handling convention was needed to add this.
// ---------------------------------------------------------------------
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Throws if `user` (a staff member) can't access `marketId`. Use this
// wherever a controller already has a marketId in hand and just needs
// the ownership check — the exact same 404/403 pair every call site used
// to write out by hand.
export async function assertMarketAccess(user, marketId) {
  const allowed = await staffCanAccessMarket(user, marketId);
  if (allowed === "not-found") throw new HttpError(404, "Market not found");
  if (!allowed) throw new HttpError(403, "You do not have access to this market");
}

// Looks up an Employee by id and asserts the calling staff member can
// access the market that employee belongs to — the "assign/adjust
// something for this employee" pattern repeated across
// tasksController.js, suddenTasksController.js, and
// attendanceController.js. Returns the Employee row so the caller doesn't
// need a second lookup.
export async function requireAccessibleEmployee(user, employeeId) {
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) {
    throw new HttpError(400, "employeeId does not refer to an existing employee");
  }
  await assertMarketAccess(user, employee.marketId);
  return employee;
}
