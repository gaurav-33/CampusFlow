/**
 * CampusFlow — Ingest Clipboard Handler
 * POST /api/ingest
 *
 * Protected by JWT Lambda Authorizer.
 * studentId is extracted from the authorizer context — never trusted from the body.
 *
 * Flow:
 *  1. Parse request body (rawText, source)
 *  2. Upsert student profile in DynamoDB (idempotent)
 *  3. Push message to SQS BedrockProcessingQueue
 *  4. Return { status: "queued", messageId }
 */

import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { putStudentProfile } from "../services/dynamoService.js";

// ── SQS Client ────────────────────────────────────────────────────────────────

const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || "ap-south-1",
});

const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL;

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

const VALID_SOURCES = ["CLIPBOARD", "WHATSAPP", "EMAIL", "MANUAL", "OTHER"];
const MAX_RAW_TEXT_LENGTH = 10000; // 10KB text limit

function validateBody(body) {
  if (!body.rawText || typeof body.rawText !== "string") {
    return "rawText is required and must be a string";
  }
  if (body.rawText.trim().length < 5) {
    return "rawText is too short (minimum 5 characters)";
  }
  if (body.rawText.length > MAX_RAW_TEXT_LENGTH) {
    return `rawText exceeds maximum length of ${MAX_RAW_TEXT_LENGTH} characters`;
  }
  if (body.source && !VALID_SOURCES.includes(body.source.toUpperCase())) {
    return `source must be one of: ${VALID_SOURCES.join(", ")}`;
  }
  return null;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS" || event.requestContext?.http?.method === "OPTIONS") {
    return response(200, {});
  }

  // ── Extract identity from JWT Authorizer context ────────────────────────────
  // This is set by jwtAuthorizer.js and is TRUSTED (API Gateway verified the JWT)
  const authContext = event.requestContext?.authorizer?.lambda || event.requestContext?.authorizer;
  const studentId = authContext?.studentId;   // "STUDENT#123"
  const rawId = authContext?.rawId;            // "123"
  const studentName = authContext?.name || "Student";

  if (!studentId) {
    return response(401, { error: "Unauthorized: missing authorizer context" });
  }

  console.info(`[IngestHandler] POST /api/ingest for ${studentId}`);

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return response(400, { error: "Invalid JSON body" });
  }

  const validationError = validateBody(body);
  if (validationError) {
    return response(400, { error: validationError });
  }

  const rawText = body.rawText.trim();
  const source = (body.source || "CLIPBOARD").toUpperCase();
  const ingestedAt = new Date().toISOString();

  // ── Upsert student profile (idempotent) ────────────────────────────────────
  try {
    await putStudentProfile(rawId, studentName);
  } catch (err) {
    console.error("[IngestHandler] Failed to upsert student profile:", err);
    // Non-fatal — continue to SQS push
  }

  // ── Push to SQS BedrockProcessingQueue ─────────────────────────────────────
  if (!SQS_QUEUE_URL) {
    console.error("[IngestHandler] SQS_QUEUE_URL is not configured");
    return response(500, { error: "Queue not configured" });
  }

  const sqsMessage = {
    studentId,   // DynamoDB PK format
    rawId,
    rawText,
    source,
    ingestedAt,
    studentName,
  };

  let messageId;
  try {
    const cmd = new SendMessageCommand({
      QueueUrl: SQS_QUEUE_URL,
      MessageBody: JSON.stringify(sqsMessage),
      MessageAttributes: {
        studentId: {
          DataType: "String",
          StringValue: studentId,
        },
        source: {
          DataType: "String",
          StringValue: source,
        },
      },
      // Message group deduplication is not used on Standard queue
      // Deduplication is handled at the DynamoDB level via EVENT SK hash
    });

    const result = await sqsClient.send(cmd);
    messageId = result.MessageId;
    console.info(`[IngestHandler] Queued message ${messageId} for ${studentId}`);
  } catch (err) {
    console.error("[IngestHandler] SQS SendMessage failed:", err);
    return response(502, {
      error: "Failed to queue message for processing. Please retry.",
    });
  }

  return response(202, {
    status: "queued",
    messageId,
    studentId,
    ingestedAt,
    message: "Your text is being processed by AI. Check dashboard in ~30 seconds.",
  });
};
