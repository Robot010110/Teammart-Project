import { apiRequest } from "./apiClient";

// cashierCleaningService.js — talks to /api/cashier-cleaning (the Cashier
// station-cleaning checklist, Morning shift only). Mirrors
// backend/src/controllers/cashierCleaningController.js one function per
// endpoint, same pattern as every other service file.

export function getTodayCleaningLog() {
  return apiRequest("/cashier-cleaning/today");
}

// items: [{ label, checked }]
export function submitCleaningLog(items) {
  return apiRequest("/cashier-cleaning", { method: "POST", body: { items } });
}
