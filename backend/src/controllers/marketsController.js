import { prisma } from "../lib/prisma.js";
import { recordAudit } from "../utils/audit.js";

// GET /api/markets — list markets, scoped by role:
//   ADMIN             -> all markets
//   REGIONAL_MANAGER   -> markets across all of their assigned zones
//   SUPERVISOR         -> only their own market
//
// Includes card-level stats a Regional Manager's Markets page needs
// (spec §5: active count, current rating, last visit) — all real,
// computed here rather than stored/duplicated. Per-market queries
// (not a single aggregate) since this app's market counts are modest
// (well under a hundred) and Prisma has no native "latest row per
// group" query; correctness over a premature aggregation here.
export async function listMarkets(req, res, next) {
  try {
    let where;
    if (req.user.role === "REGIONAL_MANAGER") {
      where = { zoneId: { in: req.user.zoneIds } };
    } else if (req.user.role === "SUPERVISOR") {
      where = { id: req.user.marketId };
    }

    const markets = await prisma.market.findMany({
      where,
      include: {
        zone: { select: { id: true, number: true } },
        supervisor: { select: { id: true, name: true } },
        overlookingSupervisor: { select: { id: true, name: true } },
        employees: { select: { id: true } },
      },
      orderBy: { name: "asc" },
    });

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const shaped = await Promise.all(
      markets.map(async (m) => {
        const employeeIds = m.employees.map((e) => e.id);
        const [activeCount, latestRating, latestVisit] = await Promise.all([
          employeeIds.length
            ? prisma.attendanceRecord.count({
                where: {
                  employeeId: { in: employeeIds },
                  date: { gte: start, lt: end },
                  checkIn: { not: null },
                  checkOut: null,
                  status: { notIn: ["DAY_OFF", "APPROVED_LEAVE"] },
                },
              })
            : Promise.resolve(0),
          prisma.marketRating.findFirst({ where: { marketId: m.id }, orderBy: { createdAt: "desc" } }),
          prisma.marketVisit.findFirst({ where: { marketId: m.id }, orderBy: { visitDate: "desc" } }),
        ]);

        return {
          id: m.id,
          name: m.name,
          status: m.status,
          photoUrl: m.photoUrl,
          zoneId: m.zoneId,
          zoneNumber: m.zone.number,
          supervisor: m.supervisor?.name ?? "Unassigned",
          overlookingSupervisor: m.overlookingSupervisor?.name ?? "Unassigned",
          employeesCount: m.employees.length,
          activeCount,
          currentRating: latestRating?.rating ?? null,
          lastVisitDate: latestVisit?.visitDate ?? null,
        };
      })
    );

    res.json(shaped);
  } catch (err) {
    next(err);
  }
}

// GET /api/markets/:id — single market with employees + zone.
// requireOwnMarketOrElevated on the route already confirmed access.
export async function getMarket(req, res, next) {
  try {
    const market = await prisma.market.findUnique({
      where: { id: req.params.id },
      include: {
        employees: true,
        zone: true,
        supervisor: { select: { id: true, name: true } },
        overlookingSupervisor: { select: { id: true, name: true } },
      },
    });
    if (!market) {
      return res.status(404).json({ error: "Market not found" });
    }
    res.json(market);
  } catch (err) {
    next(err);
  }
}

// POST /api/markets — ADMIN anywhere, REGIONAL_MANAGER only inside their
// own zone (checked here since zoneId comes from the request body, not a
// route param the ownership middleware can read).
export async function createMarket(req, res, next) {
  try {
    const { name, zoneId, status } = req.body;

    if (req.user.role === "REGIONAL_MANAGER" && !req.user.zoneIds.includes(zoneId)) {
      return res.status(403).json({ error: "You can only create markets in one of your own zones" });
    }

    const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
    if (!zone) {
      return res.status(400).json({ error: "zoneId does not refer to an existing zone" });
    }

    const market = await prisma.market.create({
      data: { name, zoneId, status: status ?? "ACTIVE" },
    });

    res.status(201).json(market);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/markets/:id — update name/status.
export async function updateMarket(req, res, next) {
  try {
    const market = await prisma.market.update({
      where: { id: req.params.id },
      data: req.body,
    });
    res.json(market);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/markets/:id/supervisor — ADMIN or the owning REGIONAL_MANAGER.
// Admin Phase 2 §9: Market.supervisorId is @unique, so re-assigning a
// Supervisor who already owns a DIFFERENT market previously just crashed
// with a raw Postgres unique-constraint error instead of transferring
// them cleanly — this transaction clears the stale prior assignment
// first, in the same atomic operation, so the caller never observes a
// state where the same Supervisor appears to own two markets (or the
// request just fails confusingly).
export async function assignMarketSupervisor(req, res, next) {
  try {
    const { supervisorId } = req.body;

    if (supervisorId !== null) {
      const supervisor = await prisma.user.findUnique({ where: { id: supervisorId } });
      if (!supervisor || supervisor.role !== "SUPERVISOR") {
        return res.status(400).json({ error: "supervisorId must belong to a SUPERVISOR account" });
      }
    }

    const before = await prisma.market.findUnique({ where: { id: req.params.id }, select: { supervisorId: true } });

    const market = await prisma.$transaction(async (tx) => {
      if (supervisorId !== null) {
        await tx.market.updateMany({ where: { supervisorId, id: { not: req.params.id } }, data: { supervisorId: null } });
      }
      return tx.market.update({ where: { id: req.params.id }, data: { supervisorId } });
    });

    if (req.user.kind === "staff" && req.user.role === "ADMIN") {
      await recordAudit({
        actorUserId: req.user.userId, action: "MARKET_ASSIGNMENT_CHANGED", targetType: "Market", targetId: req.params.id,
        marketId: req.params.id, previousValue: { supervisorId: before?.supervisorId ?? null }, newValue: { supervisorId },
      });
    }

    res.json(market);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/markets/:id/overlooking-supervisor — ADMIN or the owning
// REGIONAL_MANAGER. Mirrors assignMarketSupervisor exactly, for the
// market's separate Night/Evening-shift account (StaffRole.
// OVERLOOKING_SUPERVISOR) — a genuinely different account from the
// Supervisor, not a shift label (see Market.overlookingSupervisorId's
// schema comment).
export async function assignMarketOverlookingSupervisor(req, res, next) {
  try {
    const { overlookingSupervisorId } = req.body;

    if (overlookingSupervisorId !== null) {
      const overlooking = await prisma.user.findUnique({ where: { id: overlookingSupervisorId } });
      if (!overlooking || overlooking.role !== "OVERLOOKING_SUPERVISOR") {
        return res.status(400).json({ error: "overlookingSupervisorId must belong to an OVERLOOKING_SUPERVISOR account" });
      }
    }

    // Same stale-assignment cleanup as assignMarketSupervisor above.
    const before = await prisma.market.findUnique({ where: { id: req.params.id }, select: { overlookingSupervisorId: true } });

    const market = await prisma.$transaction(async (tx) => {
      if (overlookingSupervisorId !== null) {
        await tx.market.updateMany({ where: { overlookingSupervisorId, id: { not: req.params.id } }, data: { overlookingSupervisorId: null } });
      }
      return tx.market.update({ where: { id: req.params.id }, data: { overlookingSupervisorId } });
    });

    if (req.user.kind === "staff" && req.user.role === "ADMIN") {
      await recordAudit({
        actorUserId: req.user.userId, action: "MARKET_ASSIGNMENT_CHANGED", targetType: "Market", targetId: req.params.id,
        marketId: req.params.id, previousValue: { overlookingSupervisorId: before?.overlookingSupervisorId ?? null }, newValue: { overlookingSupervisorId },
      });
    }

    res.json(market);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/markets/:id — ADMIN or owning REGIONAL_MANAGER.
export async function deleteMarket(req, res, next) {
  try {
    await prisma.market.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------
// Supervisor directory — the people side of the markets this caller can
// already reach.
//
// A "supervisor" is NOT its own table: it is a User whose StaffRole is
// SUPERVISOR/OVERLOOKING_SUPERVISOR and who is pointed at by a market's
// own Market.supervisorId / Market.overlookingSupervisorId. So this
// derives the directory from markets rather than introducing any new
// model, and scope falls out of the existing market scoping for free:
//   ADMIN            -> every market
//   REGIONAL_MANAGER  -> markets in their own token's zoneIds
// There is deliberately no zoneId/marketId parameter to tamper with.
//
// Note both relations are @unique on Market, so a supervisor account
// belongs to exactly one market — this returns that one market, never a
// fabricated multi-market list.
// ---------------------------------------------------------------------
function scopedMarketWhere(user) {
  if (user.role === "REGIONAL_MANAGER") return { zoneId: { in: user.zoneIds ?? [] } };
  return undefined; // ADMIN — unscoped, same as listMarkets above
}

function shapeSupervisor(marketRow, user, kind) {
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    kind, // "SUPERVISOR" | "OVERLOOKING" — which slot of the market they fill
    loginId: user.loginId,
    email: user.email,
    phoneNumber: user.phoneNumber,
    whatsappNumber: user.whatsappNumber,
    profilePictureUrl: user.profilePictureUrl,
    accountStatus: user.accountStatus,
    lastActiveAt: user.lastActiveAt,
    // Account row creation — deliberately NOT called a hire/join date:
    // User has no startDate field, and presenting createdAt as one would
    // be inventing employment history (see Employee.startDate's own
    // schema comment making exactly this distinction).
    accountCreatedAt: user.createdAt,
    market: { id: marketRow.id, name: marketRow.name, status: marketRow.status, zoneId: marketRow.zoneId, zoneNumber: marketRow.zone.number },
    employeeCount: marketRow.employees.length,
  };
}

const SUPERVISOR_SELECT = {
  id: true, name: true, role: true, loginId: true, email: true,
  phoneNumber: true, whatsappNumber: true, profilePictureUrl: true,
  accountStatus: true, lastActiveAt: true, createdAt: true,
};

// GET /api/markets/supervisors
export async function listAccessibleSupervisors(req, res, next) {
  try {
    const markets = await prisma.market.findMany({
      where: scopedMarketWhere(req.user),
      include: {
        zone: { select: { number: true } },
        employees: { select: { id: true } },
        supervisor: { select: SUPERVISOR_SELECT },
        overlookingSupervisor: { select: SUPERVISOR_SELECT },
      },
      orderBy: { name: "asc" },
    });

    // Only accounts actually assigned to one of these markets appear —
    // which is also what keeps unassigned/leftover staff rows out.
    const supervisors = [];
    for (const m of markets) {
      if (m.supervisor) supervisors.push(shapeSupervisor(m, m.supervisor, "SUPERVISOR"));
      if (m.overlookingSupervisor) supervisors.push(shapeSupervisor(m, m.overlookingSupervisor, "OVERLOOKING"));
    }

    // Live on-shift state for each supervisor, from the same
    // AttendanceRecord table their own check-in writes to (staffUserId).
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const records = supervisors.length
      ? await prisma.attendanceRecord.findMany({
          where: { staffUserId: { in: supervisors.map((s) => s.id) }, date: { gte: start, lt: end } },
          select: { staffUserId: true, checkIn: true, checkOut: true, breakStart: true, breakEnd: true },
        })
      : [];
    const byUser = new Map(records.map((r) => [r.staffUserId, r]));

    res.json(
      supervisors.map((s) => {
        const r = byUser.get(s.id);
        const onShift = !!(r && r.checkIn && !r.checkOut);
        return { ...s, onShift, onBreak: !!(onShift && r.breakStart && !r.breakEnd) };
      })
    );
  } catch (err) {
    next(err);
  }
}

// GET /api/markets/supervisors/:userId — one supervisor's profile.
// Access is decided by the market they actually supervise, re-read from
// the database here, never from anything the client sent.
export async function getAccessibleSupervisor(req, res, next) {
  try {
    const userId = Number(req.params.userId);
    if (Number.isNaN(userId)) return res.status(400).json({ error: "Supervisor id must be a number" });

    const market = await prisma.market.findFirst({
      where: {
        AND: [
          scopedMarketWhere(req.user) ?? {},
          { OR: [{ supervisorId: userId }, { overlookingSupervisorId: userId }] },
        ],
      },
      include: {
        zone: { select: { number: true } },
        employees: { select: { id: true } },
        supervisor: { select: SUPERVISOR_SELECT },
        overlookingSupervisor: { select: SUPERVISOR_SELECT },
      },
    });

    // Not found and not-yours are intentionally the same 404: a Regional
    // Manager must not be able to probe for the existence of staff
    // outside their own zones.
    if (!market) return res.status(404).json({ error: "Supervisor not found" });

    const isMain = market.supervisorId === userId;
    const user = isMain ? market.supervisor : market.overlookingSupervisor;
    if (!user) return res.status(404).json({ error: "Supervisor not found" });

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const record = await prisma.attendanceRecord.findFirst({
      where: { staffUserId: userId, date: { gte: start, lt: end } },
      select: { checkIn: true, checkOut: true, breakStart: true, breakEnd: true },
    });
    const onShift = !!(record && record.checkIn && !record.checkOut);

    res.json({
      ...shapeSupervisor(market, user, isMain ? "SUPERVISOR" : "OVERLOOKING"),
      onShift,
      onBreak: !!(onShift && record.breakStart && !record.breakEnd),
      checkInAt: record?.checkIn ?? null,
      checkOutAt: record?.checkOut ?? null,
    });
  } catch (err) {
    next(err);
  }
}
