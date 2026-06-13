/**
 * CampusFlow — Hybrid Health Score Calculator
 *
 * Computes a 0–100 "student health score" from academic event data.
 * Higher score = healthier academic state (less overdue, less pending critical).
 *
 * Formula Components:
 *
 *  Component 1 — Urgency Penalty (static load)
 *    urgency_penalty = (critical_pending × 20) + (medium_pending × 8) + (low_pending × 3)
 *
 *  Component 2 — Time-Proximity Penalty (deadline pressure)
 *    proximity_penalty = (critical_events_within_24h × 10) + (medium_events_within_24h × 5)
 *
 *  Component 3 — Completion Bonus (rewards finishing tasks)
 *    completion_ratio = completed_count / total_count  (0 if no events)
 *    completion_bonus = completion_ratio × 15
 *
 *  Final Score:
 *    score = clamp(100 - urgency_penalty - proximity_penalty + completion_bonus, 0, 100)
 */

// ── Constants ──────────────────────────────────────────────────────────────────

const URGENCY_PENALTY = {
  critical: 20,
  medium: 8,
  low: 3,
};

const PROXIMITY_PENALTY = {
  critical: 10,
  medium: 5,
  low: 0,
};

const COMPLETION_BONUS_MAX = 15;    // Max bonus for 100% completion
const PROXIMITY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// ── Risk Bands ─────────────────────────────────────────────────────────────────

/**
 * Maps a numeric health score to a human-readable risk band.
 * Used by the dashboard for color coding.
 *
 * @param {number} score - 0–100 health score
 * @returns {{ band: string, label: string, color: string }}
 */
export function getScoreBand(score) {
  if (score >= 80) return { band: "healthy",  label: "On Track",       color: "#22C55E" }; // Green
  if (score >= 60) return { band: "moderate", label: "Needs Attention", color: "#F59E0B" }; // Amber
  if (score >= 40) return { band: "stressed", label: "High Load",       color: "#EF4444" }; // Red
  return              { band: "critical", label: "Critical Overload", color: "#7C3AED" }; // Purple
}

// ── Main Calculator ────────────────────────────────────────────────────────────

/**
 * Computes the hybrid health score from a list of DynamoDB event items.
 *
 * @param {Array<Object>} events - Array of event items from DynamoDB.
 *   Each event must have: { urgency, status, timestamp }
 * @param {Date} [referenceTime] - Reference point for proximity calc (default: now)
 * @returns {{
 *   score: number,          // Final clamped score 0–100
 *   band: string,           // "healthy" | "moderate" | "stressed" | "critical"
 *   label: string,          // Human-readable band label
 *   color: string,          // Hex color for frontend
 *   breakdown: {            // Individual components for transparency/debugging
 *     urgencyPenalty: number,
 *     proximityPenalty: number,
 *     completionBonus: number,
 *     pendingCritical: number,
 *     pendingMedium: number,
 *     pendingLow: number,
 *     completedCount: number,
 *     totalCount: number
 *   }
 * }}
 */
export function computeHealthScore(events = [], referenceTime = new Date()) {
  if (!Array.isArray(events) || events.length === 0) {
    // No events → perfect score (nothing to worry about)
    const band = getScoreBand(100);
    return {
      score: 100,
      ...band,
      breakdown: {
        urgencyPenalty: 0,
        proximityPenalty: 0,
        completionBonus: 0,
        pendingCritical: 0,
        pendingMedium: 0,
        pendingLow: 0,
        completedCount: 0,
        totalCount: 0,
      },
    };
  }

  const refMs = referenceTime.getTime();

  // ── Counters ────────────────────────────────────────────────────────────────
  let pendingCritical = 0;
  let pendingMedium = 0;
  let pendingLow = 0;
  let proximityPenalty = 0;
  let completedCount = 0;
  const totalCount = events.length;

  for (const event of events) {
    const isPending = event.status !== "completed";
    const urgency = (event.urgency || "low").toLowerCase();
    const eventMs = event.timestamp ? new Date(event.timestamp).getTime() : Infinity;
    const msUntilDue = eventMs - refMs;

    if (isPending) {
      // ── Component 1: Urgency Penalty ────────────────────────────────────
      if (urgency === "critical") pendingCritical++;
      else if (urgency === "medium") pendingMedium++;
      else pendingLow++;

      // ── Component 2: Time-Proximity Penalty ─────────────────────────────
      // Only apply if event is due within 24h (and not already overdue past 7 days)
      if (msUntilDue >= 0 && msUntilDue <= PROXIMITY_WINDOW_MS) {
        proximityPenalty += PROXIMITY_PENALTY[urgency] || 0;
      } else if (msUntilDue < 0) {
        // Overdue event: double the urgency penalty
        if (urgency === "critical") pendingCritical++;      // counts twice
        else if (urgency === "medium") pendingMedium++;
        // Overdue events are automatically critical-level proximity too
        proximityPenalty += PROXIMITY_PENALTY.critical;
      }
    } else {
      // ── Component 3: Completion Counter ──────────────────────────────────
      completedCount++;
    }
  }

  // ── Compute Components ───────────────────────────────────────────────────────
  const urgencyPenalty =
    pendingCritical * URGENCY_PENALTY.critical +
    pendingMedium * URGENCY_PENALTY.medium +
    pendingLow * URGENCY_PENALTY.low;

  const completionRatio = totalCount > 0 ? completedCount / totalCount : 0;
  const completionBonus = Math.round(completionRatio * COMPLETION_BONUS_MAX);

  // ── Final Score ───────────────────────────────────────────────────────────────
  const rawScore = 100 - urgencyPenalty - proximityPenalty + completionBonus;
  const score = Math.max(0, Math.min(100, Math.round(rawScore)));

  const bandInfo = getScoreBand(score);

  return {
    score,
    ...bandInfo,
    breakdown: {
      urgencyPenalty,
      proximityPenalty,
      completionBonus,
      pendingCritical,
      pendingMedium,
      pendingLow,
      completedCount,
      totalCount,
    },
  };
}

// ── Nudge Selector ─────────────────────────────────────────────────────────────

/**
 * Selects the top N most urgent pending events to surface as "nudges" on the dashboard.
 *
 * Priority order:
 *  1. critical events closest to deadline
 *  2. medium events closest to deadline
 *  3. low events closest to deadline
 *
 * @param {Array<Object>} events - All event items
 * @param {number} [limit=3] - Maximum number of nudges to return
 * @returns {Array<Object>} Top N nudge events
 */
export function selectNudges(events = [], limit = 3) {
  const urgencyOrder = { critical: 0, medium: 1, low: 2 };
  const now = Date.now();

  return events
    .filter((e) => e.status !== "completed")
    .map((e) => ({
      ...e,
      _urgencyRank: urgencyOrder[e.urgency] ?? 3,
      _msUntilDue: e.timestamp ? Math.abs(new Date(e.timestamp).getTime() - now) : Infinity,
    }))
    .sort((a, b) => {
      // Sort by urgency first, then by proximity to deadline
      if (a._urgencyRank !== b._urgencyRank) return a._urgencyRank - b._urgencyRank;
      return a._msUntilDue - b._msUntilDue;
    })
    .slice(0, limit)
    .map(({ _urgencyRank, _msUntilDue, ...event }) => event); // Strip internal fields
}
