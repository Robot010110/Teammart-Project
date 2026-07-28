import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../lib/prisma.js";
import { staffCanAccessMarket } from "../middleware/auth.js";

function publicEmployee(e) {
  // Never send passwordHash back to the client.
  const { passwordHash, ...rest } = e;
  return rest;
}

// Generates a short, human-typeable employee code like "TM-4821".
// Collisions are extremely unlikely at this scale, but we still verify
// uniqueness before returning it.
async function generateUniqueEmployeeCode() {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `TM-${crypto.randomInt(1000, 9999)}`;
    const existing = await prisma.employee.findUnique({ where: { employeeCode: code } });
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique employee code, please try again");
}

// GET /api/employees?marketId=xyz — scoped by role:
//   ADMIN             -> all employees (optionally filtered by marketId)
//   REGIONAL_MANAGER   -> only employees in their zone's markets
//   SUPERVISOR         -> only employees in their own market
export async function listEmployees(req, res, next) {
  try {
    const { marketId } = req.query;

    let where = marketId ? { marketId: String(marketId) } : {};

    if (req.user.role === "SUPERVISOR") {
      where = { ...where, marketId: req.user.marketId };
    } else if (req.user.role === "REGIONAL_MANAGER") {
      where = { ...where, market: { zoneId: req.user.zoneId } };
    }
    // ADMIN: no extra scoping.

    if (marketId) {
      const allowed = await staffCanAccessMarket(req.user, String(marketId));
      if (allowed === "not-found") return res.status(404).json({ error: "Market not found" });
      if (!allowed) return res.status(403).json({ error: "You do not have access to this market" });
    }

    const employees = await prisma.employee.findMany({
      where,
      orderBy: { name: "asc" },
    });

    res.json(employees.map(publicEmployee));
  } catch (err) {
    next(err);
  }
}

// GET /api/employees/:id
export async function getEmployee(req, res, next) {
  try {
    const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!employee) {
      return res.status(404).json({ error: "Employee not found" });
    }

    if (req.user.kind === "staff") {
      const allowed = await staffCanAccessMarket(req.user, employee.marketId);
      if (!allowed || allowed === "not-found") {
        return res.status(403).json({ error: "You do not have access to this employee" });
      }
    } else if (req.user.kind === "employee" && req.user.employeeId !== employee.id) {
      return res.status(403).json({ error: "You do not have access to this employee" });
    }

    res.json(publicEmployee(employee));
  } catch (err) {
    next(err);
  }
}

// POST /api/employees — ADMIN, or REGIONAL_MANAGER/SUPERVISOR scoped to
// their own zone/market. Returns the generated temp password ONCE — it is
// never retrievable again after this response (only its hash is stored).
export async function createEmployee(req, res, next) {
  try {
    const { name, position, secondaryRole, shift, marketId, password } = req.body;

    const allowed = await staffCanAccessMarket(req.user, marketId);
    if (allowed === "not-found") return res.status(400).json({ error: "marketId does not refer to an existing market" });
    if (!allowed) return res.status(403).json({ error: "You do not have access to this market" });

    const employeeCode = await generateUniqueEmployeeCode();
    const plainPassword = password ?? crypto.randomBytes(4).toString("hex");
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const employee = await prisma.employee.create({
      data: { name, position, secondaryRole, shift, marketId, employeeCode, passwordHash },
    });

    res.status(201).json({
      ...publicEmployee(employee),
      // Only returned on creation — write this down, it can't be shown again.
      temporaryPassword: plainPassword,
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/employees/:id
export async function updateEmployee(req, res, next) {
  try {
    const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    const allowed = await staffCanAccessMarket(req.user, employee.marketId);
    if (!allowed || allowed === "not-found") {
      return res.status(403).json({ error: "You do not have access to this employee" });
    }

    // If moving the employee to a different market, the caller must also
    // have access to the DESTINATION market.
    if (req.body.marketId && req.body.marketId !== employee.marketId) {
      const allowedDestination = await staffCanAccessMarket(req.user, req.body.marketId);
      if (!allowedDestination || allowedDestination === "not-found") {
        return res.status(403).json({ error: "You do not have access to the destination market" });
      }
    }

    const updated = await prisma.employee.update({
      where: { id: req.params.id },
      data: req.body,
    });

    res.json(publicEmployee(updated));
  } catch (err) {
    next(err);
  }
}

// DELETE /api/employees/:id
export async function deleteEmployee(req, res, next) {
  try {
    const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });
    if (!employee) return res.status(404).json({ error: "Employee not found" });

    const allowed = await staffCanAccessMarket(req.user, employee.marketId);
    if (!allowed || allowed === "not-found") {
      return res.status(403).json({ error: "You do not have access to this employee" });
    }

    await prisma.employee.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
