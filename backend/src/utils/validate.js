import { z } from "zod";

// Reusable middleware factory: validates req.body against a zod schema.
// If invalid, responds 400 with details instead of letting bad data reach
// the DB layer. This is the app's main defense against malformed input.
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.error.flatten(),
      });
    }
    req.body = result.data;
    next();
  };
}

// Same idea, but for query strings (e.g. GET /tasks?status=PENDING).
export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({
        error: "Invalid query parameters",
        details: result.error.flatten(),
      });
    }
    req.query = result.data;
    next();
  };
}

// ---------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------
export const staffRegisterSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"]),
});

export const staffLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const employeeLoginSchema = z.object({
  employeeCode: z.string().min(1),
  password: z.string().min(1),
});

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

// ---------------------------------------------------------------------
// Zones
// ---------------------------------------------------------------------
export const createZoneSchema = z.object({
  number: z.number().int().positive(),
});

export const assignZoneManagerSchema = z.object({
  managerId: z.number().int().positive().nullable(),
});

// ---------------------------------------------------------------------
// Markets
// ---------------------------------------------------------------------
export const createMarketSchema = z.object({
  name: z.string().min(2).max(100),
  zoneId: z.number().int().positive(),
  status: z.enum(["ACTIVE", "MAINTENANCE", "CLOSED"]).optional(),
});

export const updateMarketSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  status: z.enum(["ACTIVE", "MAINTENANCE", "CLOSED"]).optional(),
});

export const assignMarketSupervisorSchema = z.object({
  supervisorId: z.number().int().positive().nullable(),
});

// ---------------------------------------------------------------------
// Employees
// ---------------------------------------------------------------------
export const createEmployeeSchema = z.object({
  name: z.string().min(2).max(100),
  position: z.string().min(2).max(100),
  secondaryRole: z.string().max(100).optional(),
  shift: z.string().max(100).optional(),
  marketId: z.string().min(1),
  // Optional: caller can set an initial password, otherwise we generate one
  // and return it once (since employeeCode isn't a secret, the temp
  // password is the only credential the employee is given at creation).
  password: z.string().min(6).optional(),
});

export const updateEmployeeSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  position: z.string().min(2).max(100).optional(),
  secondaryRole: z.string().max(100).nullable().optional(),
  shift: z.string().max(100).nullable().optional(),
  marketId: z.string().min(1).optional(),
});

// ---------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------
const TASK_TYPES = [
  "FACING",
  "REFILLING",
  "DEPARTMENT_PHOTO",
  "WASTE_ITEMS",
  "SHELF_CLEANING",
  "CHECKING_LABELS",
  "COUNTING_ITEMS",
  "CUSTOMIZATION",
];

// Used when an employee submits their own completed task.
export const submitTaskSchema = z.object({
  type: z.enum(TASK_TYPES),
  label: z.string().min(2).max(150),
  department: z.string().min(1).max(100),
  notes: z.string().max(1000).optional(),
  requiresPhoto: z.boolean().optional().default(false),
  beforePhotoUrl: z.string().url().optional(),
  afterPhotoUrl: z.string().url().optional(),
});

// Used when a supervisor/manager proactively assigns a task to an employee.
export const assignTaskSchema = z.object({
  employeeId: z.string().min(1),
  type: z.enum(TASK_TYPES),
  label: z.string().min(2).max(150),
  department: z.string().min(1).max(100),
  notes: z.string().max(1000).optional(),
  requiresPhoto: z.boolean().optional().default(false),
});

export const rejectTaskSchema = z.object({
  rejectionReason: z.string().min(2).max(500),
});

export const listTasksQuerySchema = z.object({
  status: z.enum(["ASSIGNED", "PENDING", "APPROVED", "REJECTED"]).optional(),
  employeeId: z.string().optional(),
  marketId: z.string().optional(),
});

// ---------------------------------------------------------------------
// Activities (Phase 1, Step 3/4/5 — an employee's own daily activity log)
// ---------------------------------------------------------------------
const ACTIVITY_CATEGORIES = [
  "EXPIRED_ITEMS",
  "SHELF_CLEANING",
  "PRODUCT_CUSTOMIZATION",
  "DAILY_CLEANING",
  "ITEM_COUNTING",
  "LABEL_CHECKING",
];

// An employee may only ever put their own activity into DRAFT or PENDING —
// APPROVED/REJECTED are review outcomes, and no review endpoint exists yet
// (that's Supervisor-side work, out of scope for this module).
const EMPLOYEE_SETTABLE_ACTIVITY_STATUSES = ["DRAFT", "PENDING"];

export const createActivitySchema = z.object({
  category: z.enum(ACTIVITY_CATEGORIES),
  date: z.coerce.date(),
  time: z.string().min(1).max(20),
  notes: z.string().max(1000).optional(),
  status: z.enum(EMPLOYEE_SETTABLE_ACTIVITY_STATUSES).optional().default("DRAFT"),
  // Optional list of image URLs to attach right away. No upload service
  // exists yet, so this only accepts URLs a client already has.
  imageUrls: z.array(z.string().url()).max(20).optional(),
});

export const updateActivitySchema = z.object({
  category: z.enum(ACTIVITY_CATEGORIES).optional(),
  date: z.coerce.date().optional(),
  time: z.string().min(1).max(20).optional(),
  notes: z.string().max(1000).nullable().optional(),
  status: z.enum(EMPLOYEE_SETTABLE_ACTIVITY_STATUSES).optional(),
});

export const addActivityImageSchema = z.object({
  url: z.string().url(),
});

export const listActivitiesQuerySchema = z.object({
  category: z.enum(ACTIVITY_CATEGORIES).optional(),
  status: z.enum(["DRAFT", "PENDING", "APPROVED", "REJECTED"]).optional(),
});

// ---------------------------------------------------------------------
// Sudden Tasks — a Supervisor/Manager/Admin pushing an urgent task at an
// employee. Separate module from both Tasks and Activities.
// ---------------------------------------------------------------------
const SUDDEN_TASK_PRIORITIES = ["NORMAL", "HIGH", "URGENT"];

export const createSuddenTaskSchema = z.object({
  employeeId: z.string().min(1),
  title: z.string().min(2).max(150),
  description: z.string().min(2).max(1000),
  priority: z.enum(SUDDEN_TASK_PRIORITIES).optional().default("NORMAL"),
});

export const listSuddenTasksQuerySchema = z.object({
  status: z.enum(["ASSIGNED", "COMPLETED"]).optional(),
  priority: z.enum(SUDDEN_TASK_PRIORITIES).optional(),
  employeeId: z.string().optional(),
  marketId: z.string().optional(),
});

// ---------------------------------------------------------------------
// Products — a minimal per-market inventory catalog backing the
// Expired/Wasted Items module (see schema.prisma's Product comment).
// ---------------------------------------------------------------------
export const createProductSchema = z.object({
  barcode: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  stockQuantity: z.number().int().min(0).optional().default(0),
});

export const searchProductsQuerySchema = z.object({
  search: z.string().min(1).max(200).optional(),
  barcode: z.string().min(1).max(64).optional(),
});

// ---------------------------------------------------------------------
// Item Reports — Expired/Wasted Items module.
// ---------------------------------------------------------------------
const ITEM_CONDITIONS = ["EXPIRED", "WASTED"];

export const createItemReportSchema = z.object({
  productId: z.string().min(1),
  condition: z.enum(ITEM_CONDITIONS),
  quantity: z.number().int().positive(),
  notes: z.string().max(1000).optional(),
  imageUrl: z.string().url().optional(),
});

export const listItemReportsQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

// ---------------------------------------------------------------------
// Attendance — imported check-in/out records + supervisor adjustments.
// ---------------------------------------------------------------------
const ATTENDANCE_STATUSES = ["PRESENT", "LATE", "ABSENT", "DAY_OFF"];
const SHIFTS = ["MORNING", "EVENING", "NIGHT"];
const DAY_OFF_TYPES = ["WEEKLY", "MONTHLY", "OTHER"];
const ATTENDANCE_ADJUSTMENT_TYPES = ["REWARD", "EXTRA", "PENALTY"];

const attendanceImportRowSchema = z.object({
  employeeCode: z.string().min(1),
  date: z.coerce.date(),
  status: z.enum(ATTENDANCE_STATUSES).optional().default("PRESENT"),
  shift: z.enum(SHIFTS).optional(),
  checkIn: z.coerce.date().optional(),
  checkOut: z.coerce.date().optional(),
  breakStart: z.coerce.date().optional(),
  breakEnd: z.coerce.date().optional(),
  dayOffType: z.enum(DAY_OFF_TYPES).optional(),
});

export const importAttendanceRecordsSchema = z.object({
  records: z.array(attendanceImportRowSchema).min(1).max(2000),
});

export const createAttendanceAdjustmentSchema = z.object({
  employeeId: z.string().min(1),
  type: z.enum(ATTENDANCE_ADJUSTMENT_TYPES),
  hours: z.number().positive(),
  reason: z.string().min(2).max(500),
  date: z.coerce.date(),
});

export const attendanceMonthQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});
