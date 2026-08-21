import { z } from "zod";

// "User ID" shape (spec §5-7) — Employee.employeeCode/username and
// User.loginId all share this same format constraint. Uniqueness is
// case-insensitive and checked separately (see utils/accountIds.js);
// this only validates the shape itself.
export const USER_ID_SCHEMA = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9_.-]{2,30}$/, "User ID must be 2-30 characters: letters, numbers, underscore, dot, or hyphen");

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
  role: z.enum(["ADMIN", "REGIONAL_MANAGER", "SUPERVISOR", "OVERLOOKING_SUPERVISOR"]),
  loginId: USER_ID_SCHEMA.optional(),
});

export const staffLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const staffIdLoginSchema = z.object({
  loginId: z.string().min(1),
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
    .nullable()
    .optional(),
  // Same base64-data-URL-today, real-upload-later convention already
  // documented on activityService.prepareImageForUpload — a data: URI is
  // a valid URL as far as z.string().url() is concerned.
  profilePictureUrl: z.string().url().nullable().optional(),
  // "User ID" self-service change (spec §7) — Worker uses employeeCode,
  // Cashier uses username; the frontend only ever sends the one relevant
  // to the caller's own role. Case-insensitive uniqueness is enforced in
  // the controller (userIdTaken), not here — this schema only checks
  // shape. null clears it back to "not assigned" (only meaningful for a
  // still-pending account finishing its own activation, if ever exposed
  // that way).
  employeeCode: USER_ID_SCHEMA.nullable().optional(),
  username: USER_ID_SCHEMA.nullable().optional(),
  // Staff-only in practice (Supervisor/Overlooking's own User ID) — kept
  // in this same schema since PATCH /api/profile is one shared route for
  // both account kinds (see profileController.updateMyProfile).
  loginId: USER_ID_SCHEMA.nullable().optional(),
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

export const assignMarketOverlookingSupervisorSchema = z.object({
  overlookingSupervisorId: z.number().int().positive().nullable(),
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
  // Activating a pending hire (spec §4/§7), or a staff-assigned User ID/
  // password change for an existing employee. employeeCode/username go
  // through the same USER_ID_SCHEMA + case-insensitive uniqueness check
  // as the self-service change (see employeesController.updateEmployee).
  employeeCode: USER_ID_SCHEMA.nullable().optional(),
  username: USER_ID_SCHEMA.nullable().optional(),
  password: z.string().min(6).optional(),
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
  // Only meaningful when category === "ITEM_COUNTING" — which
  // CountingAssignment this submission was performed against (spec §4).
  countingAssignmentId: z.string().optional(),
});

export const updateActivitySchema = z.object({
  category: z.enum(ACTIVITY_CATEGORIES).optional(),
  date: z.coerce.date().optional(),
  time: z.string().min(1).max(20).optional(),
  notes: z.string().max(1000).nullable().optional(),
  status: z.enum(EMPLOYEE_SETTABLE_ACTIVITY_STATUSES).optional(),
  productId: z.string().nullable().optional(),
  labelIssueType: z.enum(LABEL_ISSUE_TYPES).nullable().optional(),
  countingAssignmentId: z.string().nullable().optional(),
});

export const addActivityImageSchema = z.object({
  url: z.string().url(),
});

export const listActivitiesQuerySchema = z.object({
  category: z.enum(ACTIVITY_CATEGORIES).optional(),
  status: z.enum(["DRAFT", "PENDING", "APPROVED", "REJECTED"]).optional(),
});

// Staff approving/rejecting a PENDING Activity — mirrors rejectTaskSchema's
// shape (rejectionReason required only for REJECTED, enforced below).
export const reviewActivitySchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED"]),
    rejectionReason: z.string().min(2).max(500).optional(),
  })
  .refine((data) => data.status !== "REJECTED" || !!data.rejectionReason, {
    message: "A rejection reason is required",
    path: ["rejectionReason"],
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
  price: z.number().nonnegative().max(1_000_000).optional(),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  stockQuantity: z.number().int().min(0).optional(),
  price: z.number().nonnegative().max(1_000_000).nullable().optional(),
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
    // The message being replied to, if any — existence/ownership of this
    // id within the same conversation is re-checked server-side in
    // chatController.sendMessage, never trusted from this shape alone.
    replyToId: z.string().min(1).optional(),
    // Forward (spec §5) — when set, the controller copies body/attachment
    // from this source message instead of requiring them in the request
    // body; access to the source is re-verified server-side.
    forwardMessageId: z.string().min(1).optional(),
  })
  .refine((data) => !!data.forwardMessageId || data.body.trim().length > 0 || !!data.imageUrl || !!data.attachmentUrl, {
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

export const editMessageSchema = z.object({
  body: z.string().trim().min(1, "Message can't be empty").max(4000),
});

// Supervisor/Admin/Regional-Manager group chat (spec §6-8).
export const createGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    marketId: z.string().min(1).optional(),
    zoneId: z.number().int().positive().optional(),
    memberEmployeeIds: z.array(z.string().min(1)).max(200).optional().default([]),
    memberStaffUserIds: z.array(z.number().int().positive()).max(200).optional().default([]),
  })
  .refine((data) => !!data.marketId !== !!data.zoneId, {
    message: "Provide exactly one of marketId or zoneId",
  })
  .refine((data) => data.memberEmployeeIds.length + data.memberStaffUserIds.length > 0, {
    message: "Add at least one member",
  });

export const renameGroupSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export const changeGroupPictureSchema = z.object({
  pictureUrl: z.string().url().nullable(),
});

export const addGroupMemberSchema = z
  .object({
    employeeId: z.string().min(1).optional(),
    userId: z.number().int().positive().optional(),
  })
  .refine((data) => !!data.employeeId !== !!data.userId, {
    message: "Provide exactly one of employeeId or userId",
  });

export const setGroupMemberAdminSchema = z.object({
  isAdmin: z.boolean(),
});

// ---------------------------------------------------------------------
// Total Sales — a market's total money sold in one 24-hour reporting day
// (spec §4-5). amount/photoUrl are required — never a fabricated figure
// or a report with no evidence.
// ---------------------------------------------------------------------
export const submitTotalSalesSchema = z.object({
  date: z.coerce.date(),
  amount: z.number().positive().max(1_000_000_000),
  photoUrl: z.string().url(),
});

export const listTotalSalesQuerySchema = z.object({
  marketId: z.string().min(1),
  date: z.coerce.date().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

// ---------------------------------------------------------------------
// Card Sales — per-shift card-count verification (spec §6-8). At least
// one photo required, a second optional ("up to two photos").
// ---------------------------------------------------------------------
export const submitCardSalesSchema = z.object({
  date: z.coerce.date(),
  shift: z.enum(["MORNING", "AFTERNOON", "NIGHT"]),
  photoUrl: z.string().url(),
  photoUrl2: z.string().url().optional(),
});

export const cardSalesDayQuerySchema = z.object({
  marketId: z.string().min(1),
  date: z.coerce.date(),
});

export const cardSalesHistoryQuerySchema = z.object({
  marketId: z.string().min(1),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

// Fixed reaction set (spec §10) — kept small and workplace-appropriate on
// purpose, not an open-ended emoji picker on the backend.
export const ALLOWED_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "👏"];

export const reactToMessageSchema = z.object({
  emoji: z.enum(ALLOWED_REACTIONS),
});

export const conversationPreferenceSchema = z
  .object({
    pinned: z.boolean().optional(),
    muted: z.boolean().optional(),
  })
  .refine((data) => data.pinned !== undefined || data.muted !== undefined, {
    message: "Provide pinned and/or muted",
  });

// Staff approving/rejecting a PENDING Wasted Overall report — same shape
// as reviewActivitySchema.
export const reviewWastedOverallReportSchema = z
  .object({
    status: z.enum(["APPROVED", "REJECTED"]),
    rejectionReason: z.string().min(2).max(500).optional(),
  })
  .refine((data) => data.status !== "REJECTED" || !!data.rejectionReason, {
    message: "A rejection reason is required",
    path: ["rejectionReason"],
  });

export const listWastedOverallQuerySchema = z.object({
  marketId: z.string().min(1).optional(),
  employeeId: z.string().min(1).optional(),
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

// Extra-hours self-submission (spec §10-11) — an employee claims hours
// worked beyond their normal schedule on a specific date; PENDING until a
// Supervisor reviews it (see AttendanceAdjustmentRequest schema comment
// for why this is a separate model from RequiredHoursAdjustment/
// punishmentHours). Capped at 12/day — generous for a single extra shift,
// without accepting an obviously-mistaken entry.
export const submitExtraHoursSchema = z.object({
  date: z.coerce.date(),
  hours: z.number().positive().max(12),
  reason: z.string().max(500).optional(),
});

export const reviewAttendanceAdjustmentSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewNote: z.string().max(500).optional(),
});

export const listAttendanceAdjustmentsQuerySchema = z.object({
  employeeId: z.string().min(1).optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
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

// ---------------------------------------------------------------------
// Regional Manager market management — ratings, notes, formal
// Warning/Recognition feedback, and visits (see
// marketManagementController.js).
// ---------------------------------------------------------------------
export const rateMarketSchema = z.object({
  rating: z.number().int().min(1).max(10),
  notes: z.string().max(1000).optional(),
  visitId: z.string().min(1).optional(),
});

export const addMarketNoteSchema = z.object({
  content: z.string().min(2).max(2000),
  category: z.string().max(100).optional(),
  visitId: z.string().min(1).optional(),
});

export const sendMarketFeedbackSchema = z.object({
  type: z.enum(["WARNING", "RECOGNITION"]),
  title: z.string().min(2).max(150),
  description: z.string().min(2).max(2000),
  category: z.string().max(100).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  photoUrl: z.string().url().optional(),
  visitId: z.string().min(1).optional(),
});

// ---------------------------------------------------------------------
// Inventory Counting assignments (spec §1-3).
// ---------------------------------------------------------------------
export const createCountingAssignmentSchema = z.object({
  employeeId: z.string().min(1),
  assignedDepartment: z.string().min(1).max(100),
  countingArea: z.string().max(200).optional(),
});

export const listCountingAssignmentsQuerySchema = z.object({
  marketId: z.string().min(1).optional(),
  pending: z.enum(["true", "false"]).optional(),
});

// ---------------------------------------------------------------------
// Missing-checkout confirmation (spec §7 — "Are you still working?").
// ---------------------------------------------------------------------
export const confirmStillWorkingSchema = z.object({
  recordId: z.string().min(1),
});
