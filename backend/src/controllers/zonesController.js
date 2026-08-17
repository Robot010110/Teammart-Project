import { prisma } from "../lib/prisma.js";

// Shapes a raw Zone (with manager + markets + employees included) into the
// flat structure the frontend's mockData.js `zones` export uses — so the
// frontend can swap its mock import for this fetch() with no other changes.
function shapeZoneSummary(zone) {
  return {
    id: `zone-${zone.id}`,
    number: zone.number,
    manager: zone.manager?.name ?? "Unassigned",
    marketsCount: zone.markets.length,
    employeesCount: zone.markets.reduce((sum, m) => sum + m._count.employees, 0),
  };
}

// GET /api/zones — list all zones.
// ADMIN sees every zone. A REGIONAL_MANAGER only sees their own zone (no
// route guard needed here since the query itself is scoped).
export async function listZones(req, res, next) {
  try {
    const where = req.user.role === "REGIONAL_MANAGER" ? { id: { in: req.user.zoneIds } } : undefined;

    const zones = await prisma.zone.findMany({
      where,
      include: {
        manager: { select: { id: true, name: true } },
        // _count instead of `include: { employees: true }` — only the
        // employee COUNT per market is ever used below, not the rows.
        markets: { include: { _count: { select: { employees: true } } } },
      },
      orderBy: { number: "asc" },
    });

    res.json(zones.map(shapeZoneSummary));
  } catch (err) {
    next(err);
  }
}

// GET /api/zones/:id — single zone with its markets.
// Route-level requireOwnZoneOrElevated already confirmed access.
export async function getZone(req, res, next) {
  try {
    const zoneId = Number(req.params.id);
    if (Number.isNaN(zoneId)) {
      return res.status(400).json({ error: "Zone id must be a number" });
    }

    const zone = await prisma.zone.findUnique({
      where: { id: zoneId },
      include: {
        manager: { select: { id: true, name: true } },
        // _count instead of `include: { employees: true }` — only the
        // employee COUNT per market is ever used below, not the rows.
        markets: { include: { _count: { select: { employees: true } } } },
      },
    });

    if (!zone) {
      return res.status(404).json({ error: "Zone not found" });
    }

    res.json({
      id: `zone-${zone.id}`,
      number: zone.number,
      manager: zone.manager?.name ?? "Unassigned",
      markets: zone.markets.map((m) => ({
        id: m.id,
        name: m.name,
        employees: m._count.employees,
        status: m.status.charAt(0) + m.status.slice(1).toLowerCase(),
      })),
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/zones — ADMIN only.
export async function createZone(req, res, next) {
  try {
    const zone = await prisma.zone.create({ data: { number: req.body.number } });
    res.status(201).json(zone);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/zones/:id/manager — ADMIN only. Assign or unassign the
// Regional Manager for this zone.
export async function assignZoneManager(req, res, next) {
  try {
    const zoneId = Number(req.params.id);
    if (Number.isNaN(zoneId)) {
      return res.status(400).json({ error: "Zone id must be a number" });
    }
    const { managerId } = req.body;

    if (managerId !== null) {
      const manager = await prisma.user.findUnique({ where: { id: managerId } });
      if (!manager || manager.role !== "REGIONAL_MANAGER") {
        return res.status(400).json({ error: "managerId must belong to a REGIONAL_MANAGER account" });
      }
    }

    const zone = await prisma.zone.update({
      where: { id: zoneId },
      data: { managerId },
    });

    res.json(zone);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/zones/:id — ADMIN only.
export async function deleteZone(req, res, next) {
  try {
    const zoneId = Number(req.params.id);
    if (Number.isNaN(zoneId)) {
      return res.status(400).json({ error: "Zone id must be a number" });
    }
    await prisma.zone.delete({ where: { id: zoneId } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
