import { prisma } from "../lib/prisma.js";

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
export async function assignMarketSupervisor(req, res, next) {
  try {
    const { supervisorId } = req.body;

    if (supervisorId !== null) {
      const supervisor = await prisma.user.findUnique({ where: { id: supervisorId } });
      if (!supervisor || supervisor.role !== "SUPERVISOR") {
        return res.status(400).json({ error: "supervisorId must belong to a SUPERVISOR account" });
      }
    }

    const market = await prisma.market.update({
      where: { id: req.params.id },
      data: { supervisorId },
    });

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
