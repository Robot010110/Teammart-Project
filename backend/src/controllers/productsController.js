import { prisma } from "../lib/prisma.js";
import { assertMarketAccess } from "../middleware/auth.js";

// productsController.js — a minimal per-market inventory catalog, just
// enough to back the Expired/Wasted Items report-and-decrement flow (see
// schema.prisma's Product comment for why this exists at all — no real
// Inventory/Indent Management system exists to integrate with).

// POST /api/products — staff adds a product to their market's catalog.
export async function createProduct(req, res, next) {
  try {
    const { barcode, name, stockQuantity } = req.body;

    if (req.user.kind !== "staff") {
      return res.status(403).json({ error: "Not authorized for this action" });
    }

    // A product always belongs to the creating staff member's own market
    // scope: SUPERVISOR creates it in their market; ADMIN/REGIONAL_MANAGER
    // must say which market via req.body.marketId.
    const marketId = req.user.role === "SUPERVISOR" ? req.user.marketId : req.body.marketId;
    if (!marketId) {
      return res.status(400).json({ error: "marketId is required" });
    }

    await assertMarketAccess(req.user, marketId);

    const product = await prisma.product.create({
      data: { barcode, name, stockQuantity, marketId, createdById: req.user.userId },
    });

    res.status(201).json(product);
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(409).json({ error: "A product with this barcode already exists in this market" });
    }
    next(err);
  }
}

// GET /api/products?search=&barcode= — employee-only, scoped to their own
// market. `barcode` does an exact match (the barcode-scan path);
// `search` does a case-insensitive name match (the manual-search path).
export async function searchProducts(req, res, next) {
  try {
    const { search, barcode } = req.query;
    const where = { marketId: req.user.marketId };
    if (barcode) where.barcode = barcode;
    if (search) where.name = { contains: search, mode: "insensitive" };

    const products = await prisma.product.findMany({
      where,
      orderBy: { name: "asc" },
      take: 25,
    });

    res.json(products);
  } catch (err) {
    next(err);
  }
}
