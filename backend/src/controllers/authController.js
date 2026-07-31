import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { signStaffToken, signEmployeeToken } from "../utils/jwt.js";

// POST /api/auth/register
// Creates a new staff account (Admin / Regional Manager / Supervisor).
// Locked to ADMIN-only in the routes file — this is a management tool,
// not a public sign-up form, so only an existing Admin can create more
// staff. The very first Admin is created by prisma/seed.js instead.
export async function register(req, res, next) {
  try {
    const { name, email, password, role } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "An account with that email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role },
    });

    res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login  (staff: Admin / Regional Manager / Supervisor)
export async function staffLogin(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      include: { managedZone: true, managedMarket: true },
    });

    // Deliberately vague error for both "no such user" and "wrong password" —
    // don't let this endpoint be used to enumerate valid emails.
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signStaffToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        zoneId: user.managedZone?.id ?? null,
        marketId: user.managedMarket?.id ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/employee-login
export async function employeeLogin(req, res, next) {
  try {
    const { employeeCode, password } = req.body;

    const employee = await prisma.employee.findUnique({ where: { employeeCode } });

    if (!employee) {
      return res.status(401).json({ error: "Invalid employee code or password" });
    }

    const passwordMatches = await bcrypt.compare(password, employee.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid employee code or password" });
    }

    const token = signEmployeeToken(employee);

    res.json({
      token,
      employee: {
        id: employee.id,
        name: employee.name,
        employeeCode: employee.employeeCode,
        marketId: employee.marketId,
        role: employee.role,
      },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/cashier-login — same shape as employeeLogin, but looks
// up by `username` instead of `employeeCode`. A separate endpoint rather
// than a merged lookup so Worker login (employeeLogin above) stays
// completely untouched — no shared "try employeeCode, fall back to
// username" logic that could get subtly wrong for either side.
export async function cashierLogin(req, res, next) {
  try {
    const { username, password } = req.body;

    const employee = await prisma.employee.findUnique({ where: { username } });

    // Same deliberately-vague error as every other login endpoint — don't
    // let this be used to enumerate valid usernames.
    if (!employee) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const passwordMatches = await bcrypt.compare(password, employee.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = signEmployeeToken(employee);

    res.json({
      token,
      employee: {
        id: employee.id,
        name: employee.name,
        employeeCode: employee.employeeCode,
        username: employee.username,
        marketId: employee.marketId,
        role: employee.role,
      },
    });
  } catch (err) {
    next(err);
  }
}
