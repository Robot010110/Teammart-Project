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
  // Foreign key violation — e.g. deleting a Zone that still has Markets,
  // or a Market that still has Employees. Without this, it fell through
  // to the generic 500 below (safe, just unhelpful to the caller). Some
  // FK violations come back as a known P2003; others (confirmed via a
  // live DELETE against a referenced Zone) surface as a
  // PrismaClientUnknownRequestError with no `.code` at all, only a
  // Postgres error message — so both are checked here.
  if (err.code === "P2003" || /foreign key constraint/i.test(err.message ?? "")) {
    return res.status(409).json({ error: "This record is still referenced by other data and can't be changed." });
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
