import { prisma } from "../lib/prisma.js";

// GET /api/markets — list markets, scoped by role:
//   ADMIN             -> all markets
//   REGIONAL_MANAGER   -> only markets in their own zone
//   SUPERVISOR         -> only their own market
export async function listMarkets(req, res, next) {
  try {
    let where;
    if (req.user.role === "REGIONAL_MANAGER") {
      where = { zoneId: req.user.zoneId };
    } else if (req.user.role === "SUPERVISOR") {
      where = { id: req.user.marketId };
    }

    // _count instead of `include: { employees: true }` — this endpoint only
    // ever needs the employee COUNT per market, not every employee row.
    const markets = await prisma.market.findMany({
      where,
      include: {
        supervisor: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
      },
      orderBy: { name: "asc" },
    });

    res.json(
      markets.map((m) => ({
        id: m.id,
        name: m.name,
        status: m.status,
        zoneId: m.zoneId,
        supervisor: m.supervisor?.name ?? "Unassigned",
        employeesCount: m._count.employees,
      }))
    );
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

    if (req.user.role === "REGIONAL_MANAGER" && req.user.zoneId !== zoneId) {
      return res.status(403).json({ error: "You can only create markets in your own zone" });
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
