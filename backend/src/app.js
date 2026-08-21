import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { prisma } from "./lib/prisma.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import authRoutes from "./routes/auth.routes.js";
import zonesRoutes from "./routes/zones.routes.js";
import marketsRoutes from "./routes/markets.routes.js";
import employeesRoutes from "./routes/employees.routes.js";
import tasksRoutes from "./routes/tasks.routes.js";
import activitiesRoutes from "./routes/activities.routes.js";
import suddenTasksRoutes from "./routes/suddenTasks.routes.js";
import attendanceRoutes from "./routes/attendance.routes.js";
import productsRoutes from "./routes/products.routes.js";
import itemReportsRoutes from "./routes/itemReports.routes.js";
import cashierCleaningRoutes from "./routes/cashierCleaning.routes.js";
import priceReportsRoutes from "./routes/priceReports.routes.js";
import leaveRequestsRoutes from "./routes/leaveRequests.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import wastedOverallRoutes from "./routes/wastedOverall.routes.js";
import totalSalesRoutes from "./routes/totalSales.routes.js";
import cardSalesRoutes from "./routes/cardSales.routes.js";
import countingAssignmentsRoutes from "./routes/countingAssignments.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";

export const app = express();

// Security headers (CSP, X-Frame-Options, etc.) — safe defaults for a
// JSON-only API; this app serves no HTML from the backend.
app.use(helmet());

// CORS_ORIGIN — comma-separated allowlist (e.g. "https://app.teammart.com").
// Unset in dev so the Vite frontend (localhost:5173) keeps working without
// extra setup; set it before deploying to production. Not enforced by
// default so this change can't break an existing deployment that hasn't
// set the env var yet.
const corsOrigins = process.env.CORS_ORIGIN?.split(",").map((o) => o.trim());
app.use(cors(corsOrigins ? { origin: corsOrigins } : undefined));

// Explicit body size limit rather than relying on express's implicit
// default — this is the one place a request body enters the app.
app.use(express.json({ limit: "1mb" }));

// Request logging — "dev" (concise, colored) locally, "combined" (Apache
// common log + referrer/user-agent) once NODE_ENV=production so requests
// are traceable in production logs.
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Registered before the rate limiter — a monitoring probe hitting this
// every few seconds shouldn't ever be able to trip a limit meant for
// user-facing endpoints.
app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "ok" });
  } catch (err) {
    res.status(503).json({ status: "error", db: "unreachable" });
  }
});

// Defense-in-depth rate limit across the rest of the API; the tight limit
// that actually matters for brute force lives on the login routes
// themselves (see routes/auth.routes.js).
app.use("/api", apiLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/zones", zonesRoutes);
app.use("/api/markets", marketsRoutes);
app.use("/api/employees", employeesRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/activities", activitiesRoutes);
app.use("/api/sudden-tasks", suddenTasksRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/item-reports", itemReportsRoutes);
app.use("/api/cashier-cleaning", cashierCleaningRoutes);
app.use("/api/price-reports", priceReportsRoutes);
app.use("/api/leave-requests", leaveRequestsRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/conversations", chatRoutes);
app.use("/api/wasted-overall", wastedOverallRoutes);
app.use("/api/total-sales", totalSalesRoutes);
app.use("/api/card-sales", cardSalesRoutes);
app.use("/api/counting-assignments", countingAssignmentsRoutes);

app.use(notFound);

// Must be registered last — Express identifies it as an error handler
// by its 4-argument signature.
app.use(errorHandler);
