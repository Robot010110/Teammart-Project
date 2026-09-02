import { Router } from "express";
import {
  listMarkets,
  getMarket,
  createMarket,
  updateMarket,
  assignMarketSupervisor,
  assignMarketOverlookingSupervisor,
  deleteMarket,
} from "../controllers/marketsController.js";
import {
  getMarketOverview,
  listMarketSections,
  getMarketSectionDetail,
  createMarketVisit,
  rateMarket,
  listMarketRatings,
  addMarketNote,
  sendMarketFeedback,
  getMarketFeedbackDetail,
  getMarketHistory,
  listMarketDepartments,
  addMarketDepartment,
  getMarketDepartmentCompletionRoute,
  sendDepartmentReport,
} from "../controllers/marketManagementController.js";
import { requireAuth, requireStaffRole, requireOwnMarketOrElevated } from "../middleware/auth.js";
import {
  validateBody,
  createMarketSchema,
  updateMarketSchema,
  assignMarketSupervisorSchema,
  assignMarketOverlookingSupervisorSchema,
  rateMarketSchema,
  addMarketNoteSchema,
  sendMarketFeedbackSchema,
  addMarketDepartmentSchema,
  sendDepartmentReportSchema,
} from "../utils/validate.js";

const router = Router();

// Markets are staff-only (employees reach market info through /profile,
// scoped to just their own market — see profile.routes.js).
// OVERLOOKING_SUPERVISOR added here in Phase 2: staffCanAccessMarket
// already treated Overlooking the same as Supervisor for market
// ownership, but this router-level gate never actually let an
// Overlooking token reach any of these routes to find that out — a
// gap Phase 2's Department Monitoring (explicitly a Supervisor/
// Overlooking feature) needs closed. Purely additive: nothing that
// could previously reach these routes loses access.
router.use(requireAuth, requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR", "OVERLOOKING_SUPERVISOR"));

router.get("/", listMarkets);

// Registered before "/:id" so this fixed path is never swallowed as an
// id — see getMarketFeedbackDetail's own comment on why there is no
// marketId segment here at all (access is checked against the feedback
// row's own real marketId, not a client-supplied one).
router.get("/feedback/:feedbackId", getMarketFeedbackDetail);

router.get("/:id", requireOwnMarketOrElevated((req) => req.params.id), getMarket);

// Regional Manager market-management layer — overview/sections are
// readable by any staff with market access (a Supervisor can see their
// own market's overview too); visits/ratings/notes/feedback are
// RM/Admin-only management-evaluation actions (enforced again inside the
// controller via requireRmRole, since this route-level gate is the same
// for all of them and the controller is the single source of truth).
router.get("/:id/overview", requireOwnMarketOrElevated((req) => req.params.id), getMarketOverview);
router.get("/:id/sections", requireOwnMarketOrElevated((req) => req.params.id), listMarketSections);
router.get("/:id/sections/:department", requireOwnMarketOrElevated((req) => req.params.id), getMarketSectionDetail);
router.get("/:id/history", requireOwnMarketOrElevated((req) => req.params.id), getMarketHistory);

// Phase 2 — Department Monitoring, Completion, and the Final Report.
// Same "readable by any staff with market access" pattern as
// overview/sections above.
router.get("/:id/departments", requireOwnMarketOrElevated((req) => req.params.id), listMarketDepartments);
router.post(
  "/:id/departments",
  requireOwnMarketOrElevated((req) => req.params.id),
  validateBody(addMarketDepartmentSchema),
  addMarketDepartment
);
router.get(
  "/:id/departments/completion",
  requireOwnMarketOrElevated((req) => req.params.id),
  getMarketDepartmentCompletionRoute
);
router.post(
  "/:id/department-report",
  requireOwnMarketOrElevated((req) => req.params.id),
  validateBody(sendDepartmentReportSchema),
  sendDepartmentReport
);

router.post(
  "/:id/visits",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER"),
  requireOwnMarketOrElevated((req) => req.params.id),
  createMarketVisit
);
router.get("/:id/ratings", requireOwnMarketOrElevated((req) => req.params.id), listMarketRatings);
router.post(
  "/:id/ratings",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER"),
  requireOwnMarketOrElevated((req) => req.params.id),
  validateBody(rateMarketSchema),
  rateMarket
);
router.post(
  "/:id/notes",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER"),
  requireOwnMarketOrElevated((req) => req.params.id),
  validateBody(addMarketNoteSchema),
  addMarketNote
);
router.post(
  "/:id/feedback",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER"),
  requireOwnMarketOrElevated((req) => req.params.id),
  validateBody(sendMarketFeedbackSchema),
  sendMarketFeedback
);

router.post(
  "/",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER"),
  validateBody(createMarketSchema),
  createMarket
);

router.patch(
  "/:id",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER"),
  requireOwnMarketOrElevated((req) => req.params.id),
  validateBody(updateMarketSchema),
  updateMarket
);

router.patch(
  "/:id/supervisor",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER"),
  requireOwnMarketOrElevated((req) => req.params.id),
  validateBody(assignMarketSupervisorSchema),
  assignMarketSupervisor
);

router.patch(
  "/:id/overlooking-supervisor",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER"),
  requireOwnMarketOrElevated((req) => req.params.id),
  validateBody(assignMarketOverlookingSupervisorSchema),
  assignMarketOverlookingSupervisor
);

router.delete(
  "/:id",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER"),
  requireOwnMarketOrElevated((req) => req.params.id),
  deleteMarket
);

export default router;
