// problemTypes.js — the real market-problem type catalog, shared by
// ReportsProblemsSection.jsx (Supervisor, where these are reported) and
// AdminDashboard.jsx (where they surface in Attention Required). One
// source of truth so the two screens can't drift on wording.
//
// `value` stays real English text — it's persisted server-side via
// createMarketProblem and read back as-is, so it can't become a
// language-dependent translation key (that would corrupt already-saved
// records). `labelKey` is the separate translation key a display
// component uses to show it in the current language.
export const PROBLEM_TYPES = [
  { value: "Freezer not working", labelKey: "sup.freezerNotWorking" },
  { value: "Electricity problem", labelKey: "sup.electricityProblem" },
  { value: "Computer not working", labelKey: "sup.computerNotWorking" },
  { value: "Cashier monitor not working", labelKey: "sup.cashierMonitorNotWorking" },
  { value: "Door broken", labelKey: "sup.doorBroken" },
  { value: "Equipment problem", labelKey: "sup.equipmentProblem" },
  { value: "Internet/network problem", labelKey: "sup.internetNetworkProblem" },
  { value: "Other market problem", labelKey: "sup.otherMarketProblem" },
];
export const PROBLEM_TYPE_LABEL = Object.fromEntries(PROBLEM_TYPES.map((pt) => [pt.value, pt.labelKey]));
