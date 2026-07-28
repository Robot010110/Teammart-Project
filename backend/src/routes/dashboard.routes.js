import { Router } from "express";
import { getDashboard } from "../controllers/dashboardController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Every logged-in account (staff or employee) gets a dashboard — the
// controller decides what data to include based on req.user.
router.get("/", requireAuth, getDashboard);

export default router;
