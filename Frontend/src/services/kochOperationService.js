import { apiRequest } from "./apiClient";

// kochOperationService.js — talks to /api/koch-operations (Koch
// Operation). Mirrors backend/src/controllers/kochOperationsController.js
// one function per endpoint. Identity/market/department are never sent
// here — the backend derives all of that from the authenticated
// employee's own token.

// The real Koch product catalog — never hardcoded in the frontend.
export function listKochProducts() {
  return apiRequest("/koch-operations/products");
}

export function listMyKochOperations() {
  return apiRequest("/koch-operations");
}

// payload (Worker):  { operationType: "CUSTOMIZATION" | "DISCOUNT_CUSTOMIZATION", evidenceUrl }
// payload (Cashier): { evidenceUrl, products: [{ kochProductId, quantity }] }
export function createKochOperation(payload) {
  return apiRequest("/koch-operations", { method: "POST", body: payload });
}
