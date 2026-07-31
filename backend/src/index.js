import "dotenv/config";
import { app } from "./app.js";
import { prisma } from "./lib/prisma.js";

// Fail fast and loud if the app can't actually issue valid tokens,
// instead of booting successfully and only discovering the problem when
// the first login opaquely 500s (jsonwebtoken throws if the secret is
// undefined).
if (!process.env.JWT_SECRET) {
  console.error("FATAL: JWT_SECRET is not set. Copy .env.example to .env and set a real value.");
  process.exit(1);
}

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log(`TEAMMART backend running on http://localhost:${PORT}`);
});

// Anything that escapes Express's request/response cycle (e.g. a DB
// connection error during startup, a bug in a non-request code path)
// would otherwise crash the process silently or leave it in an undefined
// state. Log it clearly and exit so a process manager can restart cleanly
// instead of running on in a broken state.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  process.exit(1);
});

// Graceful shutdown — stop accepting new connections, let in-flight
// requests finish, then close the DB pool. Matters for zero-downtime
// deploys/restarts under a process manager that sends SIGTERM.
function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
