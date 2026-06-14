/**
 * CampusFlow — Update Profile Handler
 * PATCH /api/profile
 *
 * Protected by JWT. Used by onboarding to:
 *  - Save Expo push token to PROFILE (critical for nudge delivery)
 *  - Update student metadata (college, branch, year)
 */

import { updateStudentProfile } from "../services/dynamoService.js";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "PATCH, OPTIONS",
};

function response(statusCode, body) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

export const handler = async (event) => {
  if (event.requestContext?.http?.method === "OPTIONS") {
    return response(200, {});
  }

  const authContext =
    event.requestContext?.authorizer?.lambda || event.requestContext?.authorizer;
  const rawId = authContext?.rawId;

  if (!rawId) {
    return response(401, { error: "Unauthorized" });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return response(400, { error: "Invalid JSON body" });
  }

  // Whitelist of updatable fields
  const allowedFields = ["expoPushToken", "college", "branch", "year", "name"];
  const updates = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return response(400, {
      error: `No valid fields provided. Allowed: ${allowedFields.join(", ")}`,
    });
  }

  try {
    const updated = await updateStudentProfile(rawId, updates);
    console.info(`[UpdateProfile] Updated profile for ${rawId}:`, Object.keys(updates));
    return response(200, {
      status: "updated",
      studentId: rawId,
      updatedFields: Object.keys(updates),
    });
  } catch (err) {
    console.error("[UpdateProfile] Failed:", err);
    return response(500, { error: "Failed to update profile" });
  }
};
