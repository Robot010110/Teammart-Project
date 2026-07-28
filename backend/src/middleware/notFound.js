// Catches any request that didn't match a route above it in app.js.
// Kept as its own file (instead of an inline app.use in app.js) so it
// reads consistently alongside errorHandler.js.
export function notFound(req, res) {
  res.status(404).json({ error: "Not found" });
}
