/**
 * CampusFlow — Auth Service
 * JWT signing, verification, and password hashing.
 *
 * Uses:
 *  - jsonwebtoken (HS256)
 *  - bcryptjs for password hashing (12 salt rounds)
 */

import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

// ── Config ────────────────────────────────────────────────────────────────────

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";
const BCRYPT_ROUNDS = 12;

if (!JWT_SECRET) {
  throw new Error(
    "[AuthService] FATAL: JWT_SECRET environment variable is not set. " +
    "Generate one with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"",
  );
}

// ── Token Operations ──────────────────────────────────────────────────────────

/**
 * Signs a JWT containing the student's identity.
 * The token is valid for 24 hours by default.
 *
 * Payload:
 *   { studentId: "STUDENT#123", rawId: "123", name: "Rohan Sharma", iat, exp }
 *
 * @param {string} studentId - Raw student ID (e.g. "123")
 * @param {string} name - Student display name
 * @returns {string} Signed JWT string
 */
export function generateToken(studentId, name) {
  const payload = {
    studentId: `STUDENT#${studentId}`, // DynamoDB PK format
    rawId: studentId,
    name,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    algorithm: "HS256",
    issuer: "campusflow",
    audience: "campusflow-app",
  });
}

/**
 * Verifies and decodes a JWT.
 * Throws if the token is invalid or expired.
 *
 * @param {string} token - JWT string (without "Bearer " prefix)
 * @returns {{ studentId: string, rawId: string, name: string, iat: number, exp: number }}
 * @throws {jwt.JsonWebTokenError} if invalid
 * @throws {jwt.TokenExpiredError} if expired
 */
export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET, {
    algorithms: ["HS256"],
    issuer: "campusflow",
    audience: "campusflow-app",
  });
}

// ── Password Operations ───────────────────────────────────────────────────────

/**
 * Hashes a plaintext password with bcrypt.
 * @param {string} password - Plaintext password
 * @returns {Promise<string>} bcrypt hash
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Compares a plaintext password against a bcrypt hash.
 * @param {string} password - Plaintext password
 * @param {string} hash - Stored bcrypt hash
 * @returns {Promise<boolean>} True if match
 */
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// ── Token Extraction Helper ────────────────────────────────────────────────────

/**
 * Extracts a Bearer token from an Authorization header string.
 * Returns null if the header is missing or malformed.
 *
 * @param {string|undefined} authorizationHeader
 * @returns {string|null} Raw JWT token or null
 */
export function extractBearerToken(authorizationHeader) {
  if (!authorizationHeader) return null;
  const parts = authorizationHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") return null;
  return parts[1];
}
