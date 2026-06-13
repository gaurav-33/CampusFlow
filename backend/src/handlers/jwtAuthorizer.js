/**
 * CampusFlow — JWT Lambda Authorizer
 *
 * API Gateway Lambda Authorizer (REQUEST type).
 * Validates Bearer JWTs on all protected routes.
 *
 * Flow:
 *  1. Extract Authorization header from the request
 *  2. Verify JWT signature and expiry
 *  3. Return an IAM policy (Allow/Deny) + studentId in context
 *
 * Protected routes (configured in template.yaml):
 *   POST /api/ingest
 *   GET  /api/dashboard
 *   GET  /api/events/{eventId}
 *
 * Public routes (no authorizer):
 *   POST /api/auth/register
 *   POST /api/auth/login
 */

import { verifyToken, extractBearerToken } from "../services/authService.js";

// ── IAM Policy Builder ────────────────────────────────────────────────────────

/**
 * Generates an API Gateway IAM policy document.
 *
 * @param {string} principalId - The authenticated principal (studentId)
 * @param {"Allow"|"Deny"} effect - IAM effect
 * @param {string} resource - The API Gateway ARN resource string
 * @param {Object} [context] - Additional context passed to downstream Lambda via $context.authorizer
 * @returns {Object} API Gateway authorizer response
 */
function buildPolicy(principalId, effect, resource, context = {}) {
  return {
    isAuthorized: effect === "Allow",
    context: {
      ...context,
      principalId,
    },
  };
}

// ── Main Authorizer Handler ───────────────────────────────────────────────────

/**
 * Lambda Authorizer entry point.
 * Called by API Gateway before routing to the actual Lambda.
 *
 * @param {Object} event - API Gateway Authorizer event
 * @param {Object} event.headers - Request headers
 * @param {string} event.methodArn - The ARN of the called API method
 */
export const handler = async (event) => {
  console.info("[JwtAuthorizer] Authorizer invoked for:", event.methodArn);

  // Extract the token from the Authorization header
  // API Gateway normalizes header names to lowercase in HTTP API
  const authHeader =
    event.headers?.Authorization ||
    event.headers?.authorization;

  const token = extractBearerToken(authHeader);

  if (!token) {
    console.warn("[JwtAuthorizer] Missing or malformed Authorization header");
    // Returning a policy with Deny effect (more explicit than throwing "Unauthorized")
    return buildPolicy("anonymous", "Deny", event.methodArn, {
      error: "Missing or malformed Authorization header",
    });
  }

  try {
    const decoded = verifyToken(token);

    console.info(`[JwtAuthorizer] Token valid for: ${decoded.studentId}`);

    // Allow — pass studentId and name to downstream Lambda via context
    return buildPolicy(decoded.studentId, "Allow", event.methodArn, {
      studentId: decoded.studentId, // DynamoDB PK format: "STUDENT#123"
      rawId: decoded.rawId,          // Raw ID: "123"
      name: decoded.name,
    });
  } catch (err) {
    console.warn("[JwtAuthorizer] Token verification failed:", err.message);

    // Map JWT-specific errors to useful context (helpful for frontend debugging)
    const errorType = err.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "TOKEN_INVALID";

    return buildPolicy("anonymous", "Deny", event.methodArn, {
      error: errorType,
    });
  }
};
