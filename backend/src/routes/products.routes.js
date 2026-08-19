import { Router } from "express";
import { createProduct, updateProduct, searchProducts } from "../controllers/productsController.js";
import { requireAuth, requireStaffRole, requireEmployeeAuth } from "../middleware/auth.js";
import { validateBody, validateQuery, createProductSchema, updateProductSchema, searchProductsQuerySchema } from "../utils/validate.js";

const router = Router();

router.use(requireAuth);

// Staff-only.
router.post(
  "/",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  validateBody(createProductSchema),
  createProduct
);
router.patch(
  "/:id",
  requireStaffRole("ADMIN", "REGIONAL_MANAGER", "SUPERVISOR"),
  validateBody(updateProductSchema),
  updateProduct
);

// Employee searches their own market's catalog while identifying a
// product to report (barcode scan or manual search) or check its price.
router.get("/", requireEmployeeAuth, validateQuery(searchProductsQuerySchema), searchProducts);

export default router;
