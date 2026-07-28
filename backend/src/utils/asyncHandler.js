// Wraps an async route/controller function so any thrown error (or
// rejected Promise) is automatically forwarded to next(err) — which sends
// it to our errorHandler middleware. Without this, every single controller
// function would need its own try/catch just to avoid crashing the server
// on an unhandled rejection.
//
// Usage:
//   router.get("/", asyncHandler(async (req, res) => { ... }));
export function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
