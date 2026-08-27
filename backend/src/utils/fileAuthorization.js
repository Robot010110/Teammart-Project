import { prisma } from "../lib/prisma.js";
import { staffCanAccessMarket } from "../middleware/auth.js";
import { conversationAccessFor } from "../controllers/chatController.js";

// fileAuthorization.js — GET /api/uploads/:filename's ONE job: given a
// filename, figure out what business resource (if any) actually
// references it, then decide whether the requesting user is allowed to
// see that resource. A random UUID filename is never itself proof of
// authorization (see uploadsController.js's own comment) — this is the
// real check, based on ownership, not obscurity.
//
// Every field in the schema that stores an uploaded file's URL is
// checked here, in order. Each resolver returns null if ITS table has no
// match (not an error — just "not this one, try the next"), or an
// "owner" descriptor once a match is found. The pipeline stops at the
// first match, since a given filename is only ever referenced by one
// business record — a single file is never simultaneously an Activity
// photo AND a chat attachment.
const OWNER_RESOLVERS = [
  // Activity evidence photos. Most Activity rows are employee-owned, but
  // a Phase 2 Department Closing submitted by a Supervisor for a
  // genuinely unassigned department has employeeId: null and marketId
  // set directly instead (see Activity.employeeId's own schema comment)
  // — both shapes resolve to the same "employeeOwned" access rule below
  // (an employee only ever matches the first; staff-with-market-access
  // matches either), just sourced from a different field.
  async function activityImage(filename) {
    const img = await prisma.activityImage.findFirst({
      where: { url: { contains: filename } },
      select: {
        activity: { select: { employeeId: true, marketId: true, employee: { select: { marketId: true } } } },
      },
    });
    if (!img) return null;
    return {
      rule: "employeeOwned",
      employeeId: img.activity.employeeId,
      marketId: img.activity.employee?.marketId ?? img.activity.marketId,
    };
  },
  // Profile pictures.
  async function employeeProfilePicture(filename) {
    const emp = await prisma.employee.findFirst({
      where: { profilePictureUrl: { contains: filename } },
      select: { id: true, marketId: true },
    });
    if (!emp) return null;
    return { rule: "employeeOwned", employeeId: emp.id, marketId: emp.marketId };
  },
  // Sudden Task completion evidence.
  async function suddenTaskEvidence(filename) {
    const t = await prisma.suddenTask.findFirst({
      where: { evidenceUrl: { contains: filename } },
      select: { employeeId: true, employee: { select: { marketId: true } } },
    });
    if (!t) return null;
    return { rule: "employeeOwned", employeeId: t.employeeId, marketId: t.employee.marketId };
  },
  // Expired/Wasted item report photos.
  async function itemReportImage(filename) {
    const r = await prisma.itemReport.findFirst({
      where: { imageUrl: { contains: filename } },
      select: { employeeId: true, marketId: true },
    });
    if (!r) return null;
    return { rule: "employeeOwned", employeeId: r.employeeId, marketId: r.marketId };
  },
  // Cashier price-report photos.
  async function priceReportPhoto(filename) {
    const r = await prisma.priceReport.findFirst({
      where: { photoUrl: { contains: filename } },
      select: { employeeId: true, marketId: true },
    });
    if (!r) return null;
    return { rule: "employeeOwned", employeeId: r.employeeId, marketId: r.marketId };
  },
  // Wasted Overall report photos.
  async function wastedOverallPhoto(filename) {
    const r = await prisma.wastedOverallReport.findFirst({
      where: { photoUrl: { contains: filename } },
      select: { employeeId: true, marketId: true },
    });
    if (!r) return null;
    return { rule: "employeeOwned", employeeId: r.employeeId, marketId: r.marketId };
  },
  // Legacy Task before/after photos (Task has no frontend caller today,
  // but the fields exist and could hold data — see the model's own
  // comment in schema.prisma).
  async function taskPhoto(filename) {
    const r = await prisma.task.findFirst({
      where: { OR: [{ beforePhotoUrl: { contains: filename } }, { afterPhotoUrl: { contains: filename } }] },
      select: { employeeId: true, marketId: true },
    });
    if (!r) return null;
    return { rule: "employeeOwned", employeeId: r.employeeId, marketId: r.marketId };
  },
  // Regional Manager formal Warning/Recognition evidence — per
  // marketManagementController.getMarketHistory, this is returned to
  // ANY staff with market access (unlike MarketNote, which is RM/Admin-
  // only) since it's addressed to that market's own Supervisor.
  async function marketFeedbackPhoto(filename) {
    const r = await prisma.marketFeedback.findFirst({
      where: { photoUrl: { contains: filename } },
      select: { marketId: true },
    });
    if (!r) return null;
    return { rule: "marketStaffOnly", marketId: r.marketId };
  },
  // Card Sales evidence — per cardSalesController's own comment, viewable
  // by any staff with market access (not restricted like Total Sales).
  async function cardSalesPhoto(filename) {
    const r = await prisma.cardSalesReport.findFirst({
      where: { OR: [{ photoUrl: { contains: filename } }, { photoUrl2: { contains: filename } }] },
      select: { marketId: true },
    });
    if (!r) return null;
    return { rule: "marketStaffOnly", marketId: r.marketId };
  },
  // Total Sales evidence — per totalSalesController's own comment, this
  // is the one report type explicitly restricted to Regional Manager/
  // Admin only; even the Supervisor who submitted it has no read access
  // afterward (spec's own repeated rule), so the photo follows the same
  // restriction rather than being an accidental back door to the number
  // it's evidence for.
  async function totalSalesPhoto(filename) {
    const r = await prisma.totalSalesReport.findFirst({
      where: { photoUrl: { contains: filename } },
      select: { marketId: true },
    });
    if (!r) return null;
    return { rule: "marketRmAdminOnly", marketId: r.marketId };
  },
  // Chat message image/file/voice attachments.
  async function messageAttachment(filename) {
    const m = await prisma.message.findFirst({
      where: { OR: [{ imageUrl: { contains: filename } }, { attachmentUrl: { contains: filename } }] },
      select: { conversationId: true },
    });
    if (!m) return null;
    return { rule: "conversation", conversationId: m.conversationId };
  },
  // Group chat picture.
  async function conversationPicture(filename) {
    const c = await prisma.conversation.findFirst({
      where: { pictureUrl: { contains: filename } },
      select: { id: true },
    });
    if (!c) return null;
    return { rule: "conversation", conversationId: c.id };
  },
];

// Falls back to "whoever uploaded this" when no business record
// references the file yet (see UploadedFile's own schema comment for
// why this window exists and why it's safe to fall back to here).
async function uploaderFallback(filename) {
  const uploaded = await prisma.uploadedFile.findUnique({ where: { filename } });
  if (!uploaded) return null;
  return {
    rule: "uploaderOnly",
    uploaderEmployeeId: uploaded.uploaderEmployeeId,
    uploaderUserId: uploaded.uploaderUserId,
  };
}

// Returns the file's mimetype (from UploadedFile — server-validated at
// upload time, never trusted from the request) and its owner descriptor,
// or null for BOTH if this filename was never uploaded through this app
// at all (a real 404, not an authorization question).
export async function resolveFile(filename) {
  const uploaded = await prisma.uploadedFile.findUnique({ where: { filename } });
  if (!uploaded) return { mimetype: null, owner: null };

  for (const resolver of OWNER_RESOLVERS) {
    const owner = await resolver(filename);
    if (owner) return { mimetype: uploaded.mimetype, owner };
  }

  return { mimetype: uploaded.mimetype, owner: await uploaderFallback(filename) };
}

// The actual yes/no check, given an owner descriptor from resolveFile.
export async function canAccessFile(user, owner) {
  if (!owner) return false;

  if (owner.rule === "employeeOwned") {
    if (user.kind === "employee") return String(user.employeeId) === String(owner.employeeId);
    return (await staffCanAccessMarket(user, owner.marketId)) === true;
  }

  if (owner.rule === "marketStaffOnly") {
    if (user.kind !== "staff") return false;
    return (await staffCanAccessMarket(user, owner.marketId)) === true;
  }

  if (owner.rule === "marketRmAdminOnly") {
    if (user.kind !== "staff" || !["REGIONAL_MANAGER", "ADMIN"].includes(user.role)) return false;
    return (await staffCanAccessMarket(user, owner.marketId)) === true;
  }

  if (owner.rule === "conversation") {
    return !!(await conversationAccessFor(user, owner.conversationId));
  }

  if (owner.rule === "uploaderOnly") {
    if (user.kind === "employee") return String(user.employeeId) === String(owner.uploaderEmployeeId);
    if (user.kind === "staff") return String(user.userId) === String(owner.uploaderUserId);
    return false;
  }

  return false;
}
