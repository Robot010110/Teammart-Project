// money.js — Cleanup Phase §11: comma-formatted display for large money
// amounts, kept strictly separate from the underlying numeric value.
// formatMoney is presentation-only; parseMoneyInput reverses exactly what
// formatMoney produces so a formatted input round-trips back to a plain
// number before it's ever sent to the backend or stored in state as the
// "real" value. Nothing in this app should ever submit/store a
// comma-containing string as numeric data — see MoneyInput.jsx.

export function formatMoney(value) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

// Strips thousands separators back to a plain numeric string, e.g.
// "1,000,000" -> "1000000", "12,000.50" -> "12000.50". Safe to call on
// already-plain input too.
export function parseMoneyInput(str) {
  return String(str).replace(/,/g, "");
}
