import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import zonesRoutes from "./routes/zones.routes.js";
import marketsRoutes from "./routes/markets.routes.js";
import employeesRoutes from "./routes/employees.routes.js";
import tasksRoutes from "./routes/tasks.routes.js";
import activitiesRoutes from "./routes/activities.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import reportsRoutes from "./routes/reports.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";

export const app = express();

// In dev this allows the Vite frontend (localhost:5173) to call the API.
// Lock this down to your real frontend origin before deploying.
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/zones", zonesRoutes);
app.use("/api/markets", marketsRoutes);
app.use("/api/employees", employeesRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/activities", activitiesRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/profile", profileRoutes);

app.use(notFound);

// Must be registered last — Express identifies it as an error handler
// by its 4-argument signature.
app.use(errorHandler);
