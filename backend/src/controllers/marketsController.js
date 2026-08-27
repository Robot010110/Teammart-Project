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
