import { Router } from "express";
import { createProduct, searchProducts } from "../controllers/productsController.js";
import { requireAuth, requireStaffRole, requireEmployeeAuth } from "../middleware/auth.js";
import { validateBody, validateQuery, createProductSchema, searchProductsQuerySchema } from "../utils/validate.js";

const router = Router();

router.use(requireAuth);

// Staff-only. No frontend caller yet (no Supervisor/inventory UI) —
// prepared for that module the same way Sudden Task assignment was.
router.post(
  "/",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  validateBody(createProductSchema),
  createProduct
);

// Employee searches their own market's catalog while identifying a
// product to report (barcode scan or manual search).
router.get("/", requireEmployeeAuth, validateQuery(searchProductsQuerySchema), searchProducts);

export default router;
