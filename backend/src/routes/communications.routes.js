import { Router } from "express";
import {
  previewCommunication,
  sendCommunication,
  listSentCommunications,
  getCommunicationProgress,
  listMyCommunications,
  getMyCommunication,
  acknowledgeCommunication,
  startCommunicationTask,
  completeCommunicationTask,
} from "../controllers/communicationsController.js";
import { requireAuth, requireStaffRole } from "../middleware/auth.js";
import {
  validateBody,
  previewCommunicationSchema,
  createCommunicationSchema,
  submitCommunicationResponseSchema,
} from "../utils/validate.js";

const router = Router();

router.use(requireAuth);

// Sending is still ADMIN/REGIONAL_MANAGER-only — full send-time
// re-authorization lives inside communicationTargeting.authorizeTargeting,
// not in this requireStaffRole gate alone (a SUPERVISOR/
// OVERLOOKING_SUPERVISOR still can never SEND — spec §2 — but, since
// Verification pass §1's Specific-Supervisor targeting, can now be a
// RECIPIENT, hence the /my routes below are open to any authenticated
// account, not employee-only).
router.post("/preview", requireStaffRole("ADMIN", "REGIONAL_MANAGER"), validateBody(previewCommunicationSchema), previewCommunication);
router.post("/", requireStaffRole("ADMIN", "REGIONAL_MANAGER"), validateBody(createCommunicationSchema), sendCommunication);
router.get("/sent", requireStaffRole("ADMIN", "REGIONAL_MANAGER"), listSentCommunications);

// Recipient-facing (Employee OR staff — see requireOwnRecipientRow's own
// comment) — registered BEFORE the /:id catch-all-ish routes below so
// "/my" is never swallowed as an :id. requireAuth (applied above) is the
// only gate; ownership is enforced entirely inside each controller
// function against the caller's own id, never trusted from the URL.
router.get("/my", listMyCommunications);
router.get("/my/:id", getMyCommunication);
router.patch("/my/:id/acknowledge", acknowledgeCommunication);
router.patch("/my/:id/start", startCommunicationTask);
router.patch("/my/:id/complete", validateBody(submitCommunicationResponseSchema), completeCommunicationTask);

// Sender-only detail + live progress (ownership checked inside the
// controller against the real senderId, not this role gate alone).
router.get("/:id", requireStaffRole("ADMIN", "REGIONAL_MANAGER"), getCommunicationProgress);

export default router;
