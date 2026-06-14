/**
 * CampusFlow — Get Dashboard Handler
 * GET /api/dashboard
 *
 * Protected by JWT Lambda Authorizer.
 * Returns: profile, upcoming events, top-3 nudges, and current health score.
 *
 * Response schema:
 * {
 *   profile: { name, healthScore, lastLogin, band, label, color },
 *   upcomingEvents: [ { eventId, title, timestamp, type, urgency, status } ],
 *   recentNudges: [ ...top 3 pending events sorted by urgency+proximity ],
 *   healthScore: { score, band, label, color, breakdown }
 * }
 */

import { queryByPK } from "../services/dynamoService.js";
import { computeHealthScore, selectNudges } from "../utils/healthScoreCalc.js";

// ── CORS Headers ──────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS" || event.requestContext?.http?.method === "OPTIONS") {
    return response(200, {});
  }

  // ── Extract identity from JWT Authorizer context ────────────────────────────
  const authContext = event.requestContext?.authorizer?.lambda || event.requestContext?.authorizer;
  const rawId = authContext?.rawId;
  const studentId = authContext?.studentId;

  if (!rawId) {
    return response(401, { error: "Unauthorized: missing authorizer context" });
  }

  console.info(`[DashboardHandler] GET /api/dashboard for ${studentId}`);

  // ── Fetch student data from DynamoDB ────────────────────────────────────────
  let profile, events, nudges, briefing;
  try {
    const items = await queryByPK(rawId);
    const today = new Date().toISOString().slice(0, 10);

    profile = items.find((i) => i.SK === "PROFILE") || null;
    events = items
      .filter((i) => i.SK.startsWith("EVENT#"))
      .map((e) => ({ ...e, eventId: e.SK }));
    nudges = items
      .filter((i) => i.SK.startsWith("NUDGE#"))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 10)
      .map(({ PK, SK, entityType, ...rest }) => ({ ...rest, nudgeId: SK }));
    briefing = items.find((i) => i.SK === `BRIEFING#${today}`) || null;
  } catch (err) {
    console.error("[DashboardHandler] DynamoDB query failed:", err);
    return response(500, { error: "Failed to fetch dashboard data" });
  }

  if (!profile) {
    return response(404, {
      error: "Student profile not found. Please register first.",
    });
  }

  // ── Compute hybrid health score from live events ────────────────────────────
  const healthScoreResult = computeHealthScore(events);

  // ── Sort upcoming events (chronological, then by urgency) ─────────────────
  const urgencyOrder = { critical: 0, medium: 1, low: 2 };
  const upcomingEvents = [...events]
    .sort((a, b) => {
      const tsA = a.timestamp ? new Date(a.timestamp).getTime() : Infinity;
      const tsB = b.timestamp ? new Date(b.timestamp).getTime() : Infinity;
      if (tsA !== tsB) return tsA - tsB; // chronological first
      return (urgencyOrder[a.urgency] ?? 3) - (urgencyOrder[b.urgency] ?? 3);
    })
    .map(({ PK, SK, GSI1PK, GSI1SK, entityType, ...rest }) => rest); // Strip DynamoDB internals

  // ── Select top 3 nudges (most urgent pending events) ─────────────────────
  const recentNudges = selectNudges(events, 3).map(
    ({ PK, SK, GSI1PK, GSI1SK, entityType, ...rest }) => rest,
  );

  // ── Build profile response (strip sensitive fields) ───────────────────────
  const { passwordHash, PK, SK, entityType, ...safeProfile } = profile;

  const dashboardResponse = {
    profile: {
      ...safeProfile,
      healthScore: healthScoreResult.score,
      band: healthScoreResult.band,
      label: healthScoreResult.label,
      color: healthScoreResult.color,
    },
    upcomingEvents,
    recentNudges,
    nudges,
    briefing: briefing ? { briefingText: briefing.briefingText, generatedAt: briefing.generatedAt } : null,
    healthScore: healthScoreResult,
    meta: {
      totalEvents: events.length,
      fetchedAt: new Date().toISOString(),
    },
  };

  console.info(
    `[DashboardHandler] Returning ${upcomingEvents.length} events, score: ${healthScoreResult.score} for ${studentId}`,
  );

  return response(200, dashboardResponse);
};
