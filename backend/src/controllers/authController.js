import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { signStaffToken, signEmployeeToken } from "../utils/jwt.js";
import { userIdTaken } from "../utils/accountIds.js";

// POST /api/auth/register
// Creates a new staff account (Admin / Regional Manager / Supervisor /
// Overlooking Supervisor). Locked to ADMIN-only in the routes file —
// this is a management tool, not a public sign-up form, so only an
// existing Admin can create more staff. The very first Admin is created
// by prisma/seed.js instead.
//
// loginId is optional (Admin/Regional Manager have none in this spec;
// Supervisor/Overlooking use it to log in — see authController.
// staffIdLogin) and goes through the same cross-table case-insensitive
// uniqueness check as every other User ID assignment.
export async function register(req, res, next) {
  try {
    const { name, email, password, role, loginId } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "An account with that email already exists" });
    }
    if (loginId && (await userIdTaken(loginId))) {
      return res.status(409).json({ error: "This User ID is already in use" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role, loginId: loginId || null },
    });

    res.status(201).json({ id: user.id, name: user.name, email: user.email, loginId: user.loginId, role: user.role });
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
      include: { managedZones: true, managedMarket: true, managedOverlookingMarket: true },
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
        zoneIds: user.managedZones.map((z) => z.id),
        marketId: user.managedMarket?.id ?? user.managedOverlookingMarket?.id ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/staff-id-login — Supervisor/Overlooking authenticate
// with a case-insensitive "User ID" (loginId) instead of email (spec:
// "em881"/"EM881"/"Em881" all resolve to the same account). Admin/
// Regional Manager keep using POST /api/auth/login (email) — they have
// no loginId in this spec, so nothing here applies to them; a User row
// with loginId: null simply never matches any lookup value, so this
// endpoint naturally can't be used to reach an Admin/RM account.
export async function staffIdLogin(req, res, next) {
  try {
    const { loginId, password } = req.body;

    const user = await prisma.user.findFirst({
      where: { loginId: { equals: loginId, mode: "insensitive" } },
      include: { managedZones: true, managedMarket: true, managedOverlookingMarket: true },
    });

    // Same deliberately-vague error as every other login endpoint.
    if (!user) {
      return res.status(401).json({ error: "Invalid User ID or password" });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid User ID or password" });
    }

    const token = signStaffToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        loginId: user.loginId,
        zoneIds: user.managedZones.map((z) => z.id),
        marketId: user.managedMarket?.id ?? user.managedOverlookingMarket?.id ?? null,
      },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/employee-login — employeeCode is a case-insensitive
// "User ID" (spec: "em881"/"EM881"/"Em881" must all resolve to the same
// account). findFirst + mode:"insensitive" rather than findUnique, since
// findUnique can't do a case-insensitive exact match on a @unique column
// directly. The stored value keeps whatever casing the account owner
// last chose (see employeesController.updateEmployee) — only the LOOKUP
// is case-blind, never the stored/displayed value.
export async function employeeLogin(req, res, next) {
  try {
    const { employeeCode, password, rememberMe } = req.body;

    const employee = await prisma.employee.findFirst({
      where: { employeeCode: { equals: employeeCode, mode: "insensitive" } },
    });

    // A pending hire (employeeCode/passwordHash not assigned yet — see
    // the Employee model's own comment) never matches here since
    // employeeCode is null, so this "not found" branch already covers it
    // correctly without a separate check.
    if (!employee || !employee.passwordHash) {
      return res.status(401).json({ error: "Invalid employee code or password" });
    }

    const passwordMatches = await bcrypt.compare(password, employee.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid employee code or password" });
    }

    const token = signEmployeeToken(employee, { rememberMe });

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
    const { username, password, rememberMe } = req.body;

    // Case-insensitive lookup, same reasoning as employeeLogin above.
    const employee = await prisma.employee.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
    });

    // Same deliberately-vague error as every other login endpoint — don't
    // let this be used to enumerate valid usernames. Also covers a
    // pending hire (username/passwordHash not assigned yet).
    if (!employee || !employee.passwordHash) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const passwordMatches = await bcrypt.compare(password, employee.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = signEmployeeToken(employee, { rememberMe });

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
