import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { userIdTaken } from "../utils/accountIds.js";

// GET /api/profile — returns whoever is currently logged in, staff or
// employee. The frontend hits one endpoint regardless of role.
export async function getProfile(req, res, next) {
  try {
    if (req.user.kind === "staff") {
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        include: { managedZones: true, managedMarket: true, managedOverlookingMarket: true },
      });
      if (!user) return res.status(404).json({ error: "Account not found" });

      return res.json({
        kind: "staff",
        id: user.id,
        name: user.name,
        email: user.email,
        loginId: user.loginId,
        role: user.role,
        zoneIds: user.managedZones.map((z) => z.id),
        marketId: user.managedMarket?.id ?? user.managedOverlookingMarket?.id ?? null,
      });
    }

    const employee = await prisma.employee.findUnique({
      where: { id: req.user.employeeId },
      include: { market: { select: { id: true, name: true, zoneId: true } } },
    });
    if (!employee) return res.status(404).json({ error: "Account not found" });

    res.json({
      kind: "employee",
      id: employee.id,
      name: employee.name,
      employeeCode: employee.employeeCode,
      position: employee.position,
      secondaryRole: employee.secondaryRole,
      shift: employee.shift,
      market: employee.market,
      // New Employee Profile fields (Phase 1, Step 2) — all optional, not
      // calculated/populated by anything yet.
      profilePictureUrl: employee.profilePictureUrl,
      startDate: employee.startDate,
      performanceRate: employee.performanceRate,
      // role is WORKER for every existing employee (schema default), so
      // this is purely additive for them. department now applies to every
      // employee (management-assigned, see employeesController.assignDepartment
      // — an employee can never set their own); username/cashierShift stay
      // Cashier-only (null for a Worker).
      role: employee.role,
      username: employee.username,
      department: employee.department,
      cashierShift: employee.cashierShift,
      employmentStatus: employee.employmentStatus,
      whatsappNumber: employee.whatsappNumber,
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/profile — self-service profile update, for both account
// kinds. Always writes to the CALLER's own row (req.user.employeeId /
// req.user.userId, never an id from the request body) — an employee can
// only change their own photo/WhatsApp/User ID, a staff member only
// their own User ID, matching spec §9's "an employee should only be able
// to change their own profile photo" applied to every self-service field
// here. Only the keys actually present in the request are updated.
//
// employeeCode/username/loginId ("User ID", spec §7) go through the same
// case-insensitive, cross-table uniqueness check (userIdTaken) — the
// normalized comparison decides uniqueness, but the value is STORED
// exactly as the user typed it, so their chosen casing is what displays
// afterward (spec: "preserve the user's chosen casing").
export async function updateMyProfile(req, res, next) {
  try {
    if (req.user.kind === "staff") {
      if (!("loginId" in req.body)) {
        return res.json({});
      }
      const loginId = req.body.loginId;
      if (loginId !== null) {
        const taken = await userIdTaken(loginId, { excludeUserId: req.user.userId });
        if (taken) return res.status(409).json({ error: "This User ID is already in use" });
      }
      const user = await prisma.user.update({ where: { id: req.user.userId }, data: { loginId } });
      return res.json({ loginId: user.loginId });
    }

    const data = {};
    if ("whatsappNumber" in req.body) data.whatsappNumber = req.body.whatsappNumber;
    if ("profilePictureUrl" in req.body) data.profilePictureUrl = req.body.profilePictureUrl;

    for (const field of ["employeeCode", "username"]) {
      if (field in req.body) {
        const value = req.body[field];
        if (value !== null) {
          const taken = await userIdTaken(value, { excludeEmployeeId: req.user.employeeId });
          if (taken) return res.status(409).json({ error: "This User ID is already in use" });
        }
        data[field] = value;
      }
    }

    const employee = await prisma.employee.update({
      where: { id: req.user.employeeId },
      data,
    });

    res.json({
      whatsappNumber: employee.whatsappNumber,
      profilePictureUrl: employee.profilePictureUrl,
      employeeCode: employee.employeeCode,
      username: employee.username,
    });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/profile/password — change your own password (staff or
// employee). Requires the current password so a stolen/lingering session
// can't be used to lock the real owner out.
export async function updatePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (req.user.kind === "staff") {
      const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
      const matches = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!matches) return res.status(401).json({ error: "Current password is incorrect" });

      const passwordHash = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
      return res.json({ success: true });
    }

    const employee = await prisma.employee.findUnique({ where: { id: req.user.employeeId } });
    const matches = await bcrypt.compare(currentPassword, employee.passwordHash);
    if (!matches) return res.status(401).json({ error: "Current password is incorrect" });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.employee.update({ where: { id: employee.id }, data: { passwordHash } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
