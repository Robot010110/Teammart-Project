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
  rememberMe: z.boolean().optional(),
});

export const cashierLoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

// WhatsApp number — normalized to digits-only (an optional leading "+"
// stripped along with spaces/dashes/parens) before validation, so a
// malformed value can never reach the DB or later break a wa.me link
// (ProfileHeaderCard builds `https://wa.me/<digits>` directly from this).
export const updateMyProfileSchema = z.object({
  whatsappNumber: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s\-().]/g, "").replace(/^\+/, ""))
    .refine((v) => /^\d{8,15}$/.test(v), {
      message: "Enter a valid WhatsApp number, digits only (8-15 digits, country code included)",
    })
    .nullable(),
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
  "FACING",
  "REFILLING",
];

const LABEL_ISSUE_TYPES = ["MISSING", "INCORRECT", "DAMAGED"];

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
  // Only meaningful when category === "LABEL_CHECKING" (Shelf Labels
  // flow: scan a product, flag what's wrong with its label).
  productId: z.string().optional(),
  labelIssueType: z.enum(LABEL_ISSUE_TYPES).optional(),
});

export const updateActivitySchema = z.object({
  category: z.enum(ACTIVITY_CATEGORIES).optional(),
  date: z.coerce.date().optional(),
  time: z.string().min(1).max(20).optional(),
  notes: z.string().max(1000).nullable().optional(),
  status: z.enum(EMPLOYEE_SETTABLE_ACTIVITY_STATUSES).optional(),
  productId: z.string().nullable().optional(),
  labelIssueType: z.enum(LABEL_ISSUE_TYPES).nullable().optional(),
});

export const addActivityImageSchema = z.object({
  url: z.string().url(),
});

export const listActivitiesQuerySchema = z.object({
  category: z.enum(ACTIVITY_CATEGORIES).optional(),
  status: z.enum(["DRAFT", "PENDING", "APPROVED", "REJECTED"]).optional(),
});

export const listActivitiesMarketQuerySchema = z.object({
  marketId: z.string().min(1).optional(),
  employeeId: z.string().min(1).optional(),
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

// ---------------------------------------------------------------------
// Wasted Overall — Worker-reported wasted produce, one of a fixed list
// plus "Other" (not tied to a Product catalog entry — see the
// WastedOverallReport schema comment for why this isn't ItemReport).
//
// Quantity unit depends on the item: EGGS is reported as a whole-number
// count of eggs, never kilograms; every other item (including OTHER)
// stays kg-based. Exactly one of quantityKg/quantityCount is required,
// matching which one applies to `item` — enforced below, not left as a
// frontend-only convention.
// ---------------------------------------------------------------------
const WASTED_ITEMS = ["EGGS", "TOMATO", "POTATO", "CUCUMBER", "ONION", "OTHER"];

export const createWastedOverallReportSchema = z
  .object({
    item: z.enum(WASTED_ITEMS),
    // Positive, capped at a sane maximum (a single report claiming several
    // tonnes of onions is almost certainly bad input, not a real waste
    // event) — rejects 0, negative, and unreasonably large values alike.
    quantityKg: z.number().positive().max(1000).optional(),
    // Whole eggs, capped generously above any plausible single-report count.
    quantityCount: z.number().int().positive().max(1000).optional(),
    // Required identifying text when item = OTHER — reporting just the
    // literal word "Other" isn't useful on its own.
    otherItemName: z.string().min(1).max(100).optional(),
    photoUrl: z.string().url().optional(),
    notes: z.string().max(1000).optional(),
  })
  .refine((data) => (data.item === "EGGS" ? data.quantityCount != null && data.quantityKg == null : true), {
    message: "Eggs must be reported as a count (quantityCount), not kilograms",
    path: ["quantityCount"],
  })
  .refine((data) => (data.item !== "EGGS" ? data.quantityKg != null && data.quantityCount == null : true), {
    message: "quantityKg is required for this item",
    path: ["quantityKg"],
  })
  .refine((data) => (data.item === "OTHER" ? !!data.otherItemName?.trim() : true), {
    message: "Specify what this item is",
    path: ["otherItemName"],
  });

// ---------------------------------------------------------------------
// Chat — text + optional attachment (image via the pre-existing imageUrl
// path, or file/audio/voice via the new attachment* fields). At least one
// of body/imageUrl/attachmentUrl must be present — an entirely empty
// message is rejected. attachmentSize/attachmentDurationSec are
// self-reported (see prepareImageForUpload's own doc comment: there is no
// real upload endpoint anywhere in this app yet, so nothing server-side
// can independently confirm a declared byte size or duration) — the caps
// here are defense-in-depth against obviously-bad values, not a
// substitute for real server-side file inspection once a real upload
// endpoint exists.
// ---------------------------------------------------------------------
export const sendMessageSchema = z
  .object({
    body: z.string().max(4000).optional().default(""),
    imageUrl: z.string().url().optional(),
    attachmentType: z.enum(["FILE", "AUDIO", "VOICE"]).optional(),
    attachmentUrl: z.string().url().optional(),
    attachmentName: z.string().max(255).optional(),
    attachmentSize: z
      .number()
      .int()
      .positive()
      .max(15 * 1024 * 1024, "Attachment is too large (15MB max)")
      .optional(),
    attachmentDurationSec: z.number().int().positive().max(600).optional(),
  })
  .refine((data) => data.body.trim().length > 0 || !!data.imageUrl || !!data.attachmentUrl, {
    message: "A message needs text, an image, or an attachment",
    path: ["body"],
  })
  .refine((data) => !data.attachmentUrl || !!data.attachmentType, {
    message: "attachmentType is required when attachmentUrl is set",
    path: ["attachmentType"],
  })
  .refine((data) => !data.attachmentType || !!data.attachmentUrl, {
    message: "attachmentUrl is required when attachmentType is set",
    path: ["attachmentUrl"],
  });

export const listWastedOverallQuerySchema = z.object({
  marketId: z.string().min(1).optional(),
  status: z.enum(["DRAFT", "PENDING", "APPROVED", "REJECTED"]).optional(),
});

export const listItemReportsQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export const listItemReportsMarketQuerySchema = z.object({
  marketId: z.string().min(1).optional(),
  employeeId: z.string().min(1).optional(),
  condition: z.enum(ITEM_CONDITIONS).optional(),
  status: z.enum(["DRAFT", "PENDING", "APPROVED", "REJECTED"]).optional(),
});

// ---------------------------------------------------------------------
// Attendance — imported check-in/out records + supervisor adjustments.
// ---------------------------------------------------------------------
export const ATTENDANCE_STATUSES = [
  "PRESENT",
  "LATE",
  "EARLY_LEAVE",
  "ABSENT",
  "DAY_OFF",
  "APPROVED_LEAVE",
  "INCOMPLETE",
  "PENDING_REVIEW",
];
const SHIFTS = ["MORNING", "EVENING", "NIGHT"];
const DAY_OFF_TYPES = ["WEEKLY", "MONTHLY", "OTHER"];

// One parsed spreadsheet row, already normalized by
// attendanceImport.js's parseAttendanceWorkbook() — validated per-row so
// one bad row doesn't reject the whole file (see importAttendanceRecords
// in attendanceController.js).
export const attendanceImportRowSchema = z.object({
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

export const attendanceImportQuerySchema = z.object({
  periodStart: z.coerce.date().optional(),
  periodEnd: z.coerce.date().optional(),
});

// Required hours: 4-16/day (Supervisor Mode spec — default 8, must never
// go below 4 or above 16).
export const createRequiredHoursAdjustmentSchema = z.object({
  employeeId: z.string().min(1),
  date: z.coerce.date(),
  newRequiredHours: z.number().int().min(4).max(16),
  reason: z.string().min(2).max(500),
});

export const setPunishmentHoursSchema = z.object({
  employeeId: z.string().min(1),
  date: z.coerce.date(),
  hours: z.number().min(0).max(24),
  reason: z.string().min(2).max(500),
});

export const attendanceMonthQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

export const attendanceReportQuerySchema = z.object({
  marketId: z.string().min(1),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

// ---------------------------------------------------------------------
// Cashier Cleaning — station-cleaning checklist, Morning-shift cashiers only.
// ---------------------------------------------------------------------
export const submitCleaningLogSchema = z.object({
  items: z
    .array(z.object({ label: z.string().min(1).max(100), checked: z.boolean() }))
    .min(1)
    .max(30),
});

// ---------------------------------------------------------------------
// Price Reports — a cashier flagging a shelf-vs-POS price mismatch.
// ---------------------------------------------------------------------
export const createPriceReportSchema = z.object({
  productName: z.string().min(1).max(200),
  barcode: z.string().max(64).optional(),
  shelfPrice: z.number().nonnegative(),
  systemPrice: z.number().nonnegative(),
  notes: z.string().max(1000).optional(),
  photoUrl: z.string().url().optional(),
});

export const listPriceReportsQuerySchema = z.object({
  status: z.enum(["DRAFT", "PENDING", "APPROVED", "REJECTED"]).optional(),
  marketId: z.string().optional(),
});

// ---------------------------------------------------------------------
// Leave Requests — Off Day / Personal Leave, employee-submitted,
// Supervisor-reviewed.
// ---------------------------------------------------------------------
export const createLeaveRequestSchema = z
  .object({
    date: z.coerce.date(),
    type: z.enum(["MONTHLY_OFF", "PERSONAL_LEAVE", "EARNED_DAY_OFF"]),
    reason: z.string().min(2).max(500).optional(),
  })
  // Reason is required for Personal Leave but not for a scheduled Monthly
  // Off day — matches spec §10 exactly ("The employee must provide a
  // written reason" only under Personal Leave / Other Reason).
  .refine((data) => data.type !== "PERSONAL_LEAVE" || !!data.reason, {
    message: "A reason is required for Personal Leave",
    path: ["reason"],
  });

export const reviewLeaveRequestSchema = z.object({
  reviewNote: z.string().max(500).optional(),
});

export const listLeaveRequestsQuerySchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]).optional(),
  marketId: z.string().optional(),
});

// ---------------------------------------------------------------------
// Department assignment.
// ---------------------------------------------------------------------
export const assignDepartmentSchema = z.object({
  department: z.string().min(1).max(100),
});
