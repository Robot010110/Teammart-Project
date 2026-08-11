import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";

// GET /api/profile — returns whoever is currently logged in, staff or
// employee. The frontend hits one endpoint regardless of role.
export async function getProfile(req, res, next) {
  try {
    if (req.user.kind === "staff") {
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        include: { managedZone: true, managedMarket: true },
      });
      if (!user) return res.status(404).json({ error: "Account not found" });

      return res.json({
        kind: "staff",
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        zoneId: user.managedZone?.id ?? null,
        marketId: user.managedMarket?.id ?? null,
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

// PATCH /api/profile — employee-only self-service profile update.
// Currently only WhatsApp number — name is already covered by
// Employee.name (no duplicate identity field), and every other profile
// field (department, position, etc.) is management-assigned, not
// self-service. Validation/normalization (digits only, no "+", no
// spaces) happens in validate.js's updateMyProfileSchema so a malformed
// value can never reach the DB or later break a wa.me link.
export async function updateMyProfile(req, res, next) {
  try {
    if (req.user.kind !== "employee") {
      return res.status(403).json({ error: "This action requires an employee login" });
    }

    const employee = await prisma.employee.update({
      where: { id: req.user.employeeId },
      data: { whatsappNumber: req.body.whatsappNumber },
    });

    res.json({ whatsappNumber: employee.whatsappNumber });
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
