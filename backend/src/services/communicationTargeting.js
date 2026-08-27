import { prisma } from "../lib/prisma.js";
import { HttpError, staffCanAccessMarket, assertZoneAccess } from "../middleware/auth.js";
import { authorizedStaffContactsFor } from "../controllers/chatController.js";

// communicationTargeting.js — Warnings & Notifications: the ONE place
// that turns a sender's targeting request into (a) a proof the sender is
// actually authorized to reach that audience, and (b) the real list of
// qualifying employee ids. Both the preview endpoint and the final send
// endpoint call the SAME functions here — the preview count and the send
// count can only ever disagree because of a real state change between
// the two calls (an employee moved market, one became inactive, etc.),
// never because of two different code paths computing "who matches"
// differently. This is deliberately backend-only: nothing here ever
// trusts a count, list, or authorization decision made by the frontend
// (spec Rule 3 / §24).

const EMPLOYEE_ROLES = ["WORKER", "CASHIER", "BUTCHER"];

// Roles that structurally never have a department (spec: "A Cashier
// doesn't work within a department" — see ProfileHeaderCard.jsx's own
// comment). Targeting a specific department together with CASHIER or
// EVERYONE would silently under-match in a confusing way, so it's
// rejected outright rather than quietly ignored.
function assertDepartmentRoleCompatible(targetRole, targetDepartment) {
  if (!targetDepartment) return;
  if (targetRole === "CASHIER") {
    throw new HttpError(400, "Cashiers do not have departments — use 'All Departments' when targeting Cashiers");
  }
  if (targetRole === "EVERYONE") {
    throw new HttpError(400, "A specific department cannot be combined with the 'Everyone' role (not every role has departments) — target a specific role instead");
  }
}

// Validates the requested scope/role/department shape and — the
// security-critical part — that the SENDER is currently authorized to
// reach it. Never trusts zoneId/marketId/targetRole/targetDepartment as
// already-safe just because they arrived in a request; re-resolves the
// real Market->Zone relationship from the database every time (spec
// §11: "Authorization should reflect the current assignment when a new
// notification is created").
//
// Returns the resolved { marketId, zoneId, zoneNumber } (zoneId/zoneNumber
// filled in even for a MARKET scope, from the market's CURRENT zone).
// zoneId is the real FK value (Communication.zoneId); zoneNumber is the
// human-readable "Zone 2" label (Communication.senderZoneSnapshot) — the
// two are deliberately different columns on Zone (id vs. number), so
// callers must never conflate them for display.
export async function authorizeTargeting(user, { scopeType, zoneId, marketId, targetRole, targetDepartment, targetSupervisorId }) {
  if (user.kind !== "staff" || !["ADMIN", "REGIONAL_MANAGER"].includes(user.role)) {
    throw new HttpError(403, "Only Admin or a Regional/Zone Manager may send a targeted communication");
  }

  // Verification pass §1 — a single named Supervisor, resolved entirely
  // independently of the role/department/geography axes below (those
  // don't apply to this scope at all). Authorization reuses the EXACT
  // same "who can this staff member message" rule the RM<->Supervisor
  // chat feature already enforces (authorizedStaffContactsFor) — never a
  // second, hand-rolled zone check that could quietly drift from it.
  if (scopeType === "SPECIFIC_SUPERVISOR") {
    if (!targetSupervisorId) throw new HttpError(400, "targetSupervisorId is required for this scope");
    const contacts = await authorizedStaffContactsFor(user);
    const target = contacts.find((c) => c.id === Number(targetSupervisorId));
    if (!target) throw new HttpError(403, "You are not authorized to send to this Supervisor");
    if (target.role !== "SUPERVISOR" && target.role !== "OVERLOOKING_SUPERVISOR") {
      throw new HttpError(400, "targetSupervisorId must refer to a Supervisor or Overlooking Supervisor account");
    }
    return { marketId: null, zoneId: null, zoneNumber: null, targetSupervisorId: target.id };
  }

  if (!EMPLOYEE_ROLES.includes(targetRole) && targetRole !== "EVERYONE") {
    throw new HttpError(400, "Invalid targetRole");
  }
  assertDepartmentRoleCompatible(targetRole, targetDepartment);

  if (scopeType === "ALL_MARKETS") {
    if (user.role !== "ADMIN") {
      throw new HttpError(403, "Only Admin may target all markets");
    }
    return { marketId: null, zoneId: null, zoneNumber: null };
  }

  if (scopeType === "ZONE") {
    if (!zoneId) throw new HttpError(400, "zoneId is required for a Zone-scoped communication");
    await assertZoneAccess(user, zoneId);
    const zone = await prisma.zone.findUnique({ where: { id: Number(zoneId) }, select: { number: true } });
    return { marketId: null, zoneId: Number(zoneId), zoneNumber: zone?.number ?? null };
  }

  if (scopeType === "MARKET") {
    if (!marketId) throw new HttpError(400, "marketId is required for a Market-scoped communication");
    const allowed = await staffCanAccessMarket(user, marketId);
    if (allowed === "not-found") throw new HttpError(404, "Market not found");
    if (!allowed) throw new HttpError(403, "You do not have access to this market");
    const market = await prisma.market.findUnique({ where: { id: marketId }, select: { zoneId: true, zone: { select: { number: true } } } });
    return { marketId, zoneId: market.zoneId, zoneNumber: market.zone.number };
  }

  throw new HttpError(400, "Invalid scopeType");
}

// The actual recipient calculation — a single query, not resolved
// per-employee, so this behaves identically (and just as efficiently) at
// 20 or 2000 candidate employees. Department matching checks BOTH the
// Main and any Additional DepartmentAssignment (currently-open rows
// only) — spec §6's own worked example.
//
// Returns a uniform { kind: "employee" | "staff", id } list regardless
// of scope — sendCommunication builds CommunicationRecipient rows off
// this without needing to know which scope produced them.
export async function calculateRecipients({ scopeType, zoneId, marketId, targetRole, targetDepartment, targetSupervisorId }) {
  if (scopeType === "SPECIFIC_SUPERVISOR") {
    // Re-derive from the id alone (never trust a caller-supplied "yes
    // this is valid" flag) — a single, cheap existence check.
    const supervisor = await prisma.user.findUnique({
      where: { id: Number(targetSupervisorId) },
      select: { id: true, accountStatus: true },
    });
    if (!supervisor || supervisor.accountStatus !== "ACTIVE") return [];
    return [{ kind: "staff", id: supervisor.id }];
  }

  const where = {
    employmentStatus: "ACTIVE",
    accountStatus: "ACTIVE",
    role: targetRole === "EVERYONE" ? { in: EMPLOYEE_ROLES } : targetRole,
  };

  if (scopeType === "MARKET") {
    where.marketId = marketId;
  } else if (scopeType === "ZONE") {
    where.market = { zoneId };
  }
  // ALL_MARKETS — no geographic constraint.

  if (targetDepartment) {
    where.departmentAssignments = {
      some: { endDate: null, department: targetDepartment, role: { in: ["MAIN", "ADDITIONAL"] } },
    };
  }

  const employees = await prisma.employee.findMany({ where, select: { id: true } });
  return employees.map((e) => ({ kind: "employee", id: e.id }));
}
