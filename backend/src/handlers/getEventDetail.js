/**
 * CampusFlow — Get Event Detail Handler
 * GET /api/events/{eventId}
 *
 * Protected by JWT Lambda Authorizer.
 * eventId is the URL-encoded EVENT# sort key (e.g. "EVENT%232026-06-15T10%3A00%3A00Z%23abc12")
 *
 * Returns the full event object for the Event Detail screen.
 */

import { getEventBySK } from "../services/dynamoService.js";

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

  // ── Extract eventId from path parameters ────────────────────────────────────
  // API Gateway passes path params in event.pathParameters
  const encodedEventId = event.pathParameters?.eventId;

  if (!encodedEventId) {
    return response(400, { error: "eventId path parameter is required" });
  }

  // Decode URL-encoded SK (e.g. EVENT%232026... → EVENT#2026...)
  let sk;
  try {
    sk = decodeURIComponent(encodedEventId);
  } catch {
    return response(400, { error: "Invalid eventId encoding" });
  }

  // Validate it's an event SK and belongs to events (security check)
  if (!sk.startsWith("EVENT#")) {
    return response(400, { error: "Invalid eventId format" });
  }

  console.info(`[EventDetailHandler] GET /api/events/${sk} for ${studentId}`);

  // ── Fetch event from DynamoDB ───────────────────────────────────────────────
  let eventItem;
  try {
    eventItem = await getEventBySK(rawId, sk);
  } catch (err) {
    console.error("[EventDetailHandler] DynamoDB GetItem failed:", err);
    return response(500, { error: "Failed to fetch event" });
  }

  if (!eventItem) {
    return response(404, { error: "Event not found" });
  }

  // Security: ensure the event belongs to the authenticated student
  // This is redundant due to DynamoDB PK scoping, but adds defense-in-depth
  if (!eventItem.PK.endsWith(rawId) && eventItem.PK !== studentId) {
    console.warn(
      `[EventDetailHandler] Ownership mismatch: ${studentId} attempted to access ${eventItem.PK}`,
    );
    return response(403, { error: "Forbidden" });
  }

  // Strip DynamoDB internal fields before returning
  const { PK, SK, GSI1PK, GSI1SK, entityType, ...safeEvent } = eventItem;

  const eventResponse = {
    ...safeEvent,
    eventId: SK, // Expose SK as eventId for frontend use
  };

  console.info(
    `[EventDetailHandler] Returning event: ${safeEvent.title} for ${studentId}`,
  );

  return response(200, { event: eventResponse });
};
