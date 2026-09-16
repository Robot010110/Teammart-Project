import { prisma } from "../lib/prisma.js";
import { assertZoneAccess, assertMarketAccess, HttpError } from "../middleware/auth.js";
import { getZoneActivityCounts, listZoneActivityCategory } from "../services/zoneActivitiesService.js";
import {
  listDepartmentClosingMarkets, getDepartmentClosingMarketDetail, getDepartmentClosingShiftDetail,
  DEPARTMENT_CLOSING_SHIFTS,
} from "../services/departmentClosingZoneService.js";
import { ZONE_ACTIVITY_CATEGORIES } from "../utils/validate.js";

// zoneActivitiesController.js — Zone Activities (Regional Manager): thin
// HTTP handlers over zoneActivitiesService.js's read-only aggregation.
// Route-level `requireStaffRole("ADMIN", "REGIONAL_MANAGER")` (see
// zoneActivities.routes.js) already excludes Worker/Cashier/Supervisor —
// this file's own job is resolving WHICH zone(s) the caller is actually
// authorized to see, the same "authorization comes from the token, never
// the request" rule every other zone-wide endpoint in this app follows
// (activitiesController.listCompanyActivities, itemReportsController.
// listZoneItemReports).

// Mirrors listCompanyActivities' own RM-scoping shape exactly:
//   ADMIN, no zoneId given  -> null (no filter — company-wide, matching
//                              listCompanyActivities' own ADMIN default)
//   ADMIN, zoneId given     -> that one zone, if it's real
//   REGIONAL_MANAGER, no zoneId  -> ALL of their own zones (the normal
//                              path — the RM frontend never sends zoneId
//                              at all, it doesn't need to)
//   REGIONAL_MANAGER, zoneId given -> that one zone, ONLY if
//                              assertZoneAccess confirms they manage it —
//                              never trusted just because it was supplied
async function resolveZoneScope(user, zoneId) {
  if (user.role === "ADMIN") {
    if (zoneId == null) return null;
    const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
    if (!zone) throw new HttpError(400, "zoneId does not refer to an existing zone");
    return [zoneId];
  }
  // REGIONAL_MANAGER — the only other role the route allows through.
  if (zoneId != null) {
    await assertZoneAccess(user, zoneId); // throws 403/404 if not theirs
    return [zoneId];
  }
  return user.zoneIds ?? [];
}

// GET /api/zone-activities/counts?period=today|week|month&zoneId=
export async function getCounts(req, res, next) {
  try {
    const { period, zoneId } = req.query;
    const zoneIds = await resolveZoneScope(req.user, zoneId);
    const result = await getZoneActivityCounts(zoneIds, period);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// GET /api/zone-activities/department-closing/markets?period=&zoneId=
// PAGE 2 — every authorized market with Completed/Expected shifts.
export async function getDepartmentClosingMarkets(req, res, next) {
  try {
    const { period, zoneId } = req.query;
    const zoneIds = await resolveZoneScope(req.user, zoneId);
    const result = await listDepartmentClosingMarkets(zoneIds, period);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// GET /api/zone-activities/department-closing/markets/:marketId?period=
// PAGE 3 — one market's day-by-day, shift-by-shift completion.
// Authorization here is market-level (assertMarketAccess), not the
// zone-list resolver above — the exact same helper every other staff-
// scoped single-market endpoint in this app already uses
// (getMarket/getMarketOverview/etc.), so a Regional Manager can reach
// this only for a market inside one of their own zones, and Admin can
// reach any market, unchanged from the rest of the app.
export async function getDepartmentClosingMarket(req, res, next) {
  try {
    const { marketId } = req.params;
    await assertMarketAccess(req.user, marketId);
    const { period } = req.query;
    const result = await getDepartmentClosingMarketDetail(marketId, period);
    if (!result) return res.status(404).json({ error: "Market not found" });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// GET /api/zone-activities/department-closing/markets/:marketId/shifts/:date/:shift
// PAGE 4 / "Show All" — every department's latest valid record for one
// exact market + date + shift. Same market-level authorization as Page 3.
export async function getDepartmentClosingShift(req, res, next) {
  try {
    const { marketId, date, shift } = req.params;
    await assertMarketAccess(req.user, marketId);
    if (!DEPARTMENT_CLOSING_SHIFTS.includes(shift)) {
      return res.status(400).json({ error: "Unknown shift" });
    }
    const result = await getDepartmentClosingShiftDetail(marketId, date, shift);
    if (!result) return res.status(404).json({ error: "Market or date not found" });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// GET /api/zone-activities/:category?period=&zoneId=&page=&pageSize=
export async function listCategory(req, res, next) {
  try {
    const { category } = req.params;
    if (!ZONE_ACTIVITY_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: "Unknown activity category" });
    }
    const { period, zoneId, page, pageSize } = req.query;
    const zoneIds = await resolveZoneScope(req.user, zoneId);
    const { total, rows } = await listZoneActivityCategory(category, zoneIds, period, { page, pageSize });
    res.json({ total, page, pageSize, records: rows });
  } catch (err) {
    next(err);
  }
}
