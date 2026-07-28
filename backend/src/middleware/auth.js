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
