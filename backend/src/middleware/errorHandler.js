// Catches anything thrown or passed to next(err) in route handlers.
// Keeps error responses consistent and stops stack traces from leaking
// to clients in production.
export function errorHandler(err, req, res, next) {
  console.error(err);

  // Prisma throws errors with a `code` like "P2025" (record not found) —
  // translate the common ones into friendlier HTTP responses instead of a
  // generic 500.
  if (err.code === "P2025") {
    return res.status(404).json({ error: "Record not found" });
  }
  if (err.code === "P2002") {
    return res.status(409).json({ error: `Duplicate value for: ${err.meta?.target}` });
  }

  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }

  const isDev = process.env.NODE_ENV !== "production";
  res.status(500).json({
    error: "Internal server error",
    ...(isDev ? { detail: err.message } : {}),
  });
}
