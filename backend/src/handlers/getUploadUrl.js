/**
 * CampusFlow — Get Upload URL Handler
 * POST /api/upload/presign
 *
 * Protected by JWT. Returns a presigned S3 PUT URL for PDF/image uploads.
 * The frontend uploads the file directly to S3 — no binary data flows through Lambda.
 *
 * Abuse Protection (multi-layer):
 *  1. ContentType whitelist — only PDF and images allowed
 *  2. File size cap — client-declared fileSize validated against MAX_FILE_BYTES
 *     The S3 bucket policy enforces this hard cap server-side independently
 *  3. Per-student daily rate limit — max DAILY_UPLOAD_LIMIT uploads per student per day
 *     Counter stored in DynamoDB with TTL auto-reset at midnight UTC
 *
 * S3 key format: uploads/{rawId}/{uuid}.{ext}
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";
import { checkAndIncrementUploadCount } from "../services/dynamoService.js";

const s3 = new S3Client({ region: process.env.AWS_REGION || "ap-south-1" });

const UPLOADS_BUCKET = process.env.UPLOADS_BUCKET;
const PRESIGN_TTL_SECONDS = 300;   // Presigned URL valid for 5 minutes

// ── Limits ───────────────────────────────────────────────────────────────────
const MAX_FILE_BYTES = 10 * 1024 * 1024;  // 10 MB hard cap
const MIN_FILE_BYTES = 1024;              // 1 KB minimum — reject obviously empty files
const DAILY_UPLOAD_LIMIT = 10;            // Max uploads per student per calendar day

// ── Allowed Types ─────────────────────────────────────────────────────────────
const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
]);

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(statusCode, body) {
  return { statusCode, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

function getExtension(contentType) {
  const map = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
  };
  return map[contentType] || "bin";
}

export const handler = async (event) => {
  if (event.requestContext?.http?.method === "OPTIONS") {
    return response(200, {});
  }

  // ── Extract identity from JWT Authorizer ───────────────────────────────────
  const authContext =
    event.requestContext?.authorizer?.lambda || event.requestContext?.authorizer;
  const rawId = authContext?.rawId;

  if (!rawId) {
    return response(401, { error: "Unauthorized" });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return response(400, { error: "Invalid JSON body" });
  }

  const contentType = (body.contentType || "application/pdf").toLowerCase();

  // ── Validate content type ─────────────────────────────────────────────────
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return response(400, {
      error: `Unsupported file type. Allowed: ${[...ALLOWED_CONTENT_TYPES].join(", ")}`,
    });
  }

  // ── Validate client-declared file size ────────────────────────────────────
  // The client MUST send the file size in bytes before upload.
  // This is a soft check — the S3 bucket policy is the hard enforcer.
  const declaredSize = Number(body.fileSizeBytes);

  if (!declaredSize || isNaN(declaredSize)) {
    return response(400, {
      error: "fileSizeBytes is required. Provide the file size in bytes before uploading.",
    });
  }

  if (declaredSize < MIN_FILE_BYTES) {
    return response(400, {
      error: `File is too small (${declaredSize} bytes). Minimum size is ${MIN_FILE_BYTES} bytes.`,
    });
  }

  if (declaredSize > MAX_FILE_BYTES) {
    return response(413, {
      error: `File too large (${(declaredSize / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is ${MAX_FILE_BYTES / 1024 / 1024} MB.`,
      maxBytes: MAX_FILE_BYTES,
    });
  }

  // ── Per-student daily rate limit ──────────────────────────────────────────
  let rateLimitResult;
  try {
    rateLimitResult = await checkAndIncrementUploadCount(rawId, DAILY_UPLOAD_LIMIT);
  } catch (err) {
    // Rate limit check failure is non-fatal — log and allow through
    // Better to occasionally over-serve than to block legitimate users
    console.error("[GetUploadUrl] Rate limit check failed (allowing through):", err.message);
    rateLimitResult = { allowed: true, currentCount: -1, remaining: -1 };
  }

  if (!rateLimitResult.allowed) {
    return response(429, {
      error: `Daily upload limit reached (${DAILY_UPLOAD_LIMIT} uploads per day). Try again tomorrow.`,
      limit: DAILY_UPLOAD_LIMIT,
      resetsAt: "midnight UTC",
    });
  }

  if (!UPLOADS_BUCKET) {
    console.error("[GetUploadUrl] UPLOADS_BUCKET env var not set");
    return response(500, { error: "Upload bucket not configured" });
  }

  // ── Generate presigned PUT URL ────────────────────────────────────────────
  const fileId = uuidv4();
  const ext = getExtension(contentType);
  const s3Key = `uploads/${rawId}/${fileId}.${ext}`;

  try {
    const putCommand = new PutObjectCommand({
      Bucket: UPLOADS_BUCKET,
      Key: s3Key,
      ContentType: contentType,
      ContentLength: declaredSize,  // Signed into URL — S3 validates exact match on upload
      Metadata: {
        studentId: rawId,
        declaredSize: String(declaredSize),
        uploadedAt: new Date().toISOString(),
      },
    });

    const uploadUrl = await getSignedUrl(s3, putCommand, {
      expiresIn: PRESIGN_TTL_SECONDS,
    });

    console.info(
      `[GetUploadUrl] Presigned URL for ${rawId} → s3://${UPLOADS_BUCKET}/${s3Key} (${(declaredSize / 1024).toFixed(0)} KB | daily uploads: ${rateLimitResult.currentCount}/${DAILY_UPLOAD_LIMIT})`
    );

    return response(200, {
      uploadUrl,
      s3Key,
      fileId,
      expiresIn: PRESIGN_TTL_SECONDS,
      rateLimit: {
        used: rateLimitResult.currentCount,
        limit: DAILY_UPLOAD_LIMIT,
        remaining: rateLimitResult.remaining,
      },
      instructions: {
        method: "PUT",
        headers: {
          "Content-Type": contentType,
          "Content-Length": declaredSize,
        },
        note: "Headers must match exactly — S3 will reject mismatches.",
      },
    });
  } catch (err) {
    console.error("[GetUploadUrl] Failed to generate presigned URL:", err);
    return response(500, { error: "Failed to generate upload URL" });
  }
};
