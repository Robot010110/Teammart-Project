// zoneMetrics.js — every number the Regional Manager home page shows,
// derived in one place from data the backend genuinely returns. Nothing
// here is invented: each metric below names the real field it comes from,
// and any metric whose source has no rows yet returns null so the UI can
// render "—" instead of a fabricated percentage.
//
// Sources:
//   markets    GET /api/markets  (marketsController.listMarkets) —
//              employeesCount, activeCount (checked in and not yet
//              checked out today), currentRating (latest MarketRating,
//              1-10), status, supervisor.
//   problems   GET /api/market-problems?zoneId= — open MarketProblem
//              rows across the RM's own zones.
//   activities GET /api/activities/company — the RM's own-zone activity
//              feed, self-scoped server-side to their zones.

function pct(part, whole) {
  if (!whole) return null;
  return Math.max(0, Math.min(100, (part / whole) * 100));
}

export function computeZoneMetrics({ markets, problems, activities }) {
  const marketList = markets ?? [];
  const problemList = problems ?? [];
  const activityList = activities ?? [];

  const totalEmployees = marketList.reduce((sum, m) => sum + (m.employeesCount ?? 0), 0);
  const activeNow = marketList.reduce((sum, m) => sum + (m.activeCount ?? 0), 0);

  // Attendance — real check-in state right now, not a stored score.
  const attendance = markets ? pct(activeNow, totalEmployees) : null;

  // Task Completion — of the activities actually logged in this zone's
  // recent window, how many a supervisor has approved. PENDING and
  // REJECTED both count against completion, which is what makes this a
  // completion rate rather than an approval rate of reviewed-only rows.
  const approved = activityList.filter((a) => a.status === "APPROVED").length;
  const taskCompletion = activities ? pct(approved, activityList.length) : null;

  // Store Readiness — the average of each market's latest real
  // MarketRating (1-10, written by this RM on a visit), scaled to a
  // percentage. Markets never rated yet are excluded rather than
  // counted as zero.
  const rated = marketList.filter((m) => m.currentRating != null);
  const storeReadiness = rated.length ? Math.max(0, Math.min(100, (rated.reduce((sum, m) => sum + m.currentRating, 0) / rated.length) * 10)) : null;

  // Operational Health — the share of markets with no open problem
  // report against them. This deliberately replaces the reference
  // mockup's "Employee Engagement", which has no real source anywhere
  // in this backend; inventing a number for it would have made the
  // whole card untrustworthy.
  const marketsWithProblems = new Set(problemList.map((p) => p.marketId ?? p.market?.id).filter(Boolean));
  const operationalHealth = markets && problems ? pct(marketList.length - marketsWithProblems.size, marketList.length) : null;

  const parts = [attendance, taskCompletion, storeReadiness, operationalHealth].filter((v) => v != null);
  const overall = parts.length ? parts.reduce((sum, v) => sum + v, 0) / parts.length : null;

  return {
    overall,
    metrics: [
      { key: "attendance", label: "Attendance", value: attendance },
      { key: "tasks", label: "Task Completion", value: taskCompletion },
      { key: "readiness", label: "Store Readiness", value: storeReadiness },
      // "Market Health" rather than "Operational Health" purely so the
      // label survives a 360px screen without truncating.
      { key: "health", label: "Market Health", value: operationalHealth },
    ],
    totalEmployees,
    activeNow,
    // Distinct assigned supervisors across the zone — "Unassigned" is
    // the string listMarkets returns for a market with no supervisor,
    // so it must not be counted as a person.
    supervisorCount: new Set(
      marketList.flatMap((m) => [m.supervisor, m.overlookingSupervisor]).filter((name) => name && name !== "Unassigned")
    ).size,
    marketCount: marketList.length,
    openProblemCount: problemList.length,
  };
}
