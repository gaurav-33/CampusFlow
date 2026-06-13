/**
 * CampusFlow — Auth Handler
 * POST /api/auth/register
 * POST /api/auth/login
 *
 * These routes are PUBLIC (no JWT authorizer on them in template.yaml).
 */

import { getStudentProfile, putStudentProfile } from "../services/dynamoService.js";
import {
  generateToken,
  hashPassword,
  verifyPassword,
} from "../services/authService.js";

// ── CORS Headers ──────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateRegistration(body) {
  const { studentId, name, password } = body;
  if (!studentId || typeof studentId !== "string" || studentId.trim().length === 0) {
    return "studentId is required";
  }
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return "name is required";
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    return "password must be at least 8 characters";
  }
  // studentId must be alphanumeric + dashes/underscores only
  if (!/^[a-zA-Z0-9_-]{1,50}$/.test(studentId.trim())) {
    return "studentId must be 1–50 alphanumeric characters (dashes/underscores allowed)";
  }
  return null;
}

// ── POST /api/auth/register ────────────────────────────────────────────────────

export async function register(event) {
  console.info("[AuthHandler] POST /api/auth/register");

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return response(400, { error: "Invalid JSON body" });
  }

  const validationError = validateRegistration(body);
  if (validationError) {
    return response(400, { error: validationError });
  }

  const { studentId, name, password } = body;
  const trimmedId = studentId.trim();

  // Check if student already exists
  const existing = await getStudentProfile(trimmedId);
  if (existing) {
    return response(409, {
      error: "Student ID already registered. Use /api/auth/login.",
    });
  }

  try {
    const passwordHash = await hashPassword(password);

    // Create profile in DynamoDB
    await putStudentProfile(trimmedId, name.trim(), passwordHash);

    // Issue JWT
    const token = generateToken(trimmedId, name.trim());

    console.info(`[AuthHandler] Registered student: STUDENT#${trimmedId}`);

    return response(201, {
      message: "Registration successful",
      studentId: trimmedId,
      name: name.trim(),
      token,
      expiresIn: "24h",
    });
  } catch (err) {
    console.error("[AuthHandler] Registration error:", err);
    return response(500, { error: "Registration failed. Please try again." });
  }
}

// ── POST /api/auth/login ──────────────────────────────────────────────────────

export async function login(event) {
  console.info("[AuthHandler] POST /api/auth/login");

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return response(400, { error: "Invalid JSON body" });
  }

  const { studentId, password } = body;
  if (!studentId || !password) {
    return response(400, { error: "studentId and password are required" });
  }

  try {
    const profile = await getStudentProfile(studentId.trim());

    if (!profile || !profile.passwordHash) {
      // Use the same message for both "not found" and "wrong password" to prevent enumeration
      return response(401, { error: "Invalid credentials" });
    }

    const passwordValid = await verifyPassword(password, profile.passwordHash);
    if (!passwordValid) {
      return response(401, { error: "Invalid credentials" });
    }

    // Update lastLogin timestamp
    await putStudentProfile(studentId.trim(), profile.name);

    const token = generateToken(studentId.trim(), profile.name);

    console.info(`[AuthHandler] Login successful: STUDENT#${studentId.trim()}`);

    return response(200, {
      message: "Login successful",
      studentId: studentId.trim(),
      name: profile.name,
      healthScore: profile.healthScore ?? 100,
      token,
      expiresIn: "24h",
    });
  } catch (err) {
    console.error("[AuthHandler] Login error:", err);
    return response(500, { error: "Login failed. Please try again." });
  }
}

// ── Lambda Entry Point ────────────────────────────────────────────────────────

/**
 * Unified handler for both register and login routes.
 * API Gateway routes to this Lambda for both POST /api/auth/register and POST /api/auth/login.
 */
export const handler = async (event) => {
  const path = event.path || event.rawPath || "";

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS" || event.requestContext?.http?.method === "OPTIONS") {
    return response(200, {});
  }

  if (path.endsWith("/register")) {
    return register(event);
  }
  if (path.endsWith("/login")) {
    return login(event);
  }

  return response(404, { error: "Not found" });
};
