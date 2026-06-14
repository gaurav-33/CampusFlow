/**
 * CampusFlow — DynamoDB Service Layer
 * Single-Table Design on CampusFlowData
 *
 * Table Schema:
 *   PK (String)  |  SK (String)                              | Entity
 *   -------------|-------------------------------------------|-------------------
 *   STUDENT#<id> | PROFILE                                   | Student Profile
 *   STUDENT#<id> | EVENT#<iso_timestamp>#<hash>              | Academic Event
 *   STUDENT#<id> | CREDENTIAL#<id>                           | Auth credentials
 *
 * Region: ap-south-1
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  GetCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { createHash } from "crypto";

// ── Client Setup ──────────────────────────────────────────────────────────────

const rawClient = new DynamoDBClient({
  region: process.env.AWS_REGION || "ap-south-1",
});

const docClient = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
});

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "CampusFlowData";

// ── Key Helpers ───────────────────────────────────────────────────────────────

/**
 * Generates a DynamoDB SK for an event.
 * Format: EVENT#<iso_timestamp>#<8-char-hash>
 * The hash ensures uniqueness even when two events share the same timestamp.
 *
 * @param {string} isoTimestamp - ISO 8601 timestamp string
 * @param {string} title - Event title (used as hash seed)
 * @returns {string} Sort key
 */
export function makeEventSK(isoTimestamp, title) {
  const hash = createHash("sha256")
    .update(`${isoTimestamp}${title}${Date.now()}`)
    .digest("hex")
    .slice(0, 8);
  return `EVENT#${isoTimestamp}#${hash}`;
}

/**
 * Generates a Student PK.
 * @param {string} studentId - Raw student identifier (e.g. "123")
 * @returns {string} Partition key
 */
export function makeStudentPK(studentId) {
  // Accept both raw "123" and already-formatted "STUDENT#123"
  if (studentId.startsWith("STUDENT#")) return studentId;
  return `STUDENT#${studentId}`;
}

// ── Generic Write ─────────────────────────────────────────────────────────────

/**
 * Generic PutItem — overwrites if the item already exists.
 * @param {Object} item - Full DynamoDB item including PK and SK
 */
export async function putItem(item) {
  const cmd = new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
  });
  return docClient.send(cmd);
}

// ── Student Profile ───────────────────────────────────────────────────────────

/**
 * Upserts a student profile.
 * Uses UpdateCommand to avoid overwriting healthScore if the profile exists.
 *
 * @param {string} studentId - Raw student ID
 * @param {string} name - Student full name
 * @param {string} [passwordHash] - bcrypt password hash (only on registration)
 */
export async function putStudentProfile(studentId, name, passwordHash = null) {
  const PK = makeStudentPK(studentId);
  const now = new Date().toISOString();

  // Build the update expression dynamically
  const expressionParts = [
    "#name = :name",
    "#lastLogin = :lastLogin",
    "#entityType = :entityType",
  ];
  const expressionValues = {
    ":name": name,
    ":lastLogin": now,
    ":entityType": "PROFILE",
    ":defaultScore": 100,
  };
  const expressionNames = {
    "#name": "name",
    "#lastLogin": "lastLogin",
    "#entityType": "entityType",
  };

  if (passwordHash) {
    expressionParts.push("#passwordHash = :passwordHash");
    expressionValues[":passwordHash"] = passwordHash;
    expressionNames["#passwordHash"] = "passwordHash";
    expressionParts.push("#createdAt = if_not_exists(#createdAt, :lastLogin)");
    expressionNames["#createdAt"] = "createdAt";
  }

  // Initialize healthScore to 100 only if it doesn't exist yet
  const cmd = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { PK, SK: "PROFILE" },
    UpdateExpression: `SET ${expressionParts.join(", ")}, #healthScore = if_not_exists(#healthScore, :defaultScore)`,
    ExpressionAttributeNames: {
      ...expressionNames,
      "#healthScore": "healthScore",
    },
    ExpressionAttributeValues: expressionValues,
    ReturnValues: "ALL_NEW",
  });

  const result = await docClient.send(cmd);
  return result.Attributes;
}

/**
 * Retrieves a student profile including passwordHash (for auth).
 * @param {string} studentId - Raw student ID
 * @returns {Object|null} Profile item or null
 */
export async function getStudentProfile(studentId) {
  const PK = makeStudentPK(studentId);
  const cmd = new GetCommand({
    TableName: TABLE_NAME,
    Key: { PK, SK: "PROFILE" },
  });
  const result = await docClient.send(cmd);
  return result.Item || null;
}

// ── Events ────────────────────────────────────────────────────────────────────

/**
 * Writes a parsed academic event from Bedrock to DynamoDB.
 *
 * @param {string} studentId - Raw student ID
 * @param {Object} event - Parsed event object from Bedrock
 * @param {string} event.title
 * @param {string} event.timestamp - ISO 8601
 * @param {string} event.type - "exam" | "assignment" | "placement" | "other"
 * @param {string} event.urgency - "critical" | "medium" | "low"
 * @returns {string} The generated SK of the event
 */
export async function putEvent(studentId, event) {
  const PK = makeStudentPK(studentId);
  const SK = makeEventSK(event.timestamp, event.title);

  const item = {
    PK,
    SK,
    entityType: "EVENT",
    title: event.title,
    timestamp: event.timestamp,
    type: event.type || "other",
    urgency: event.urgency || "low",
    status: "pending",
    createdAt: new Date().toISOString(),
    // GSI support (future): allow querying by urgency
    GSI1PK: `URGENCY#${event.urgency}`,
    GSI1SK: event.timestamp,
  };

  await putItem(item);
  return SK;
}

/**
 * Fetches a single event by its sort key.
 *
 * @param {string} studentId - Raw student ID
 * @param {string} sk - Full SK string (e.g. "EVENT#2026-06-15T10:00:00Z#abc12")
 * @returns {Object|null} Event item or null
 */
export async function getEventBySK(studentId, sk) {
  const PK = makeStudentPK(studentId);
  const cmd = new GetCommand({
    TableName: TABLE_NAME,
    Key: { PK, SK: sk },
  });
  const result = await docClient.send(cmd);
  return result.Item || null;
}

// ── Bulk Queries ──────────────────────────────────────────────────────────────

/**
 * Queries ALL items for a student (PROFILE + all EVENT# records).
 * Uses begins_with on SK to scope to the student's partition.
 *
 * @param {string} studentId - Raw student ID
 * @returns {Array<Object>} All DynamoDB items for the student
 */
export async function queryByPK(studentId) {
  const PK = makeStudentPK(studentId);
  const cmd = new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "#PK = :pk",
    ExpressionAttributeNames: { "#PK": "PK" },
    ExpressionAttributeValues: { ":pk": PK },
    ScanIndexForward: true, // ascending SK order → events sorted chronologically
  });
  const result = await docClient.send(cmd);
  return result.Items || [];
}

/**
 * High-level helper that returns a structured student data object.
 * Separates the PROFILE item from EVENT# items.
 *
 * @param {string} studentId - Raw student ID
 * @returns {{ profile: Object|null, events: Array<Object> }}
 */
export async function getStudentData(studentId) {
  const items = await queryByPK(studentId);

  const profile = items.find((item) => item.SK === "PROFILE") || null;
  const events = items
    .filter((item) => item.SK.startsWith("EVENT#"))
    .map((event) => ({
      ...event,
      // Expose the SK as eventId for frontend reference
      eventId: event.SK,
    }));

  return { profile, events };
}

// ── Health Score Update ───────────────────────────────────────────────────────

/**
 * Updates the healthScore field on the student's PROFILE item.
 * Called by the SQS processor after Bedrock extracts events.
 *
 * @param {string} studentId - Raw student ID
 * @param {number} score - Computed health score (0–100)
 */
export async function updateHealthScore(studentId, score) {
  const PK = makeStudentPK(studentId);
  const clampedScore = Math.max(0, Math.min(100, Math.round(score)));

  const cmd = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { PK, SK: "PROFILE" },
    UpdateExpression: "SET #healthScore = :score, #updatedAt = :updatedAt",
    ExpressionAttributeNames: {
      "#healthScore": "healthScore",
      "#updatedAt": "updatedAt",
    },
    ExpressionAttributeValues: {
      ":score": clampedScore,
      ":updatedAt": new Date().toISOString(),
    },
  });

  return docClient.send(cmd);
}

// ── Event Status Update ───────────────────────────────────────────────────────

/**
 * Marks an event as completed.
 * @param {string} studentId - Raw student ID
 * @param {string} sk - Full event SK
 */
export async function markEventCompleted(studentId, sk) {
  const PK = makeStudentPK(studentId);
  const cmd = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { PK, SK: sk },
    UpdateExpression:
      "SET #status = :status, #completedAt = :completedAt",
    ExpressionAttributeNames: {
      "#status": "status",
      "#completedAt": "completedAt",
    },
    ExpressionAttributeValues: {
      ":status": "completed",
      ":completedAt": new Date().toISOString(),
    },
    ConditionExpression: "attribute_exists(#status)", // Guard: item must exist
  });

  return docClient.send(cmd);
}

// ── Nudge Records ─────────────────────────────────────────────────────────────

/**
 * Writes a NUDGE# record to DynamoDB.
 * Called by the Rule Engine after Bedrock generates nudge text.
 *
 * @param {string} studentId - Raw student ID
 * @param {{ eventRef: string, nudgeText: string, urgency: string, eventType: string, eventSK: string }} nudge
 */
export async function putNudge(studentId, nudge) {
  const PK = makeStudentPK(studentId);
  const now = new Date().toISOString();
  const SK = `NUDGE#${now}`;

  const item = {
    PK,
    SK,
    entityType: "NUDGE",
    eventRef: nudge.eventRef,
    nudgeText: nudge.nudgeText,
    urgency: nudge.urgency || "low",
    eventType: nudge.eventType || "other",
    eventSK: nudge.eventSK,
    read: false,
    createdAt: now,
  };

  return putItem(item);
}

// ── Briefing Records ──────────────────────────────────────────────────────────

/**
 * Writes or overwrites a BRIEFING#{date} record for a student.
 * Safe to re-run — overwrites today's briefing if already generated.
 *
 * @param {string} studentId - Raw student ID
 * @param {string} date - ISO date string YYYY-MM-DD
 * @param {string} briefingText - Generated briefing text from Bedrock
 */
export async function putBriefing(studentId, date, briefingText) {
  const PK = makeStudentPK(studentId);
  const SK = `BRIEFING#${date}`;
  const now = new Date().toISOString();

  const item = {
    PK,
    SK,
    entityType: "BRIEFING",
    briefingText,
    date,
    generatedAt: now,
  };

  return putItem(item);
}

// ── Flexible Profile Update ───────────────────────────────────────────────────

/**
 * Updates arbitrary allowed fields on the student PROFILE item.
 * Used by updateProfile.js handler for push token registration and metadata updates.
 *
 * @param {string} studentId - Raw student ID
 * @param {Object} fields - Key-value pairs to update (already validated by handler)
 */
export async function updateStudentProfile(studentId, fields) {
  const PK = makeStudentPK(studentId);
  const now = new Date().toISOString();

  const expressionParts = ["#updatedAt = :updatedAt"];
  const expressionValues = { ":updatedAt": now };
  const expressionNames = { "#updatedAt": "updatedAt" };

  for (const [key, value] of Object.entries(fields)) {
    const placeholder = `#f_${key}`;
    const valuePlaceholder = `:v_${key}`;
    expressionParts.push(`${placeholder} = ${valuePlaceholder}`);
    expressionValues[valuePlaceholder] = value;
    expressionNames[placeholder] = key;
  }

  const cmd = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { PK, SK: "PROFILE" },
    UpdateExpression: `SET ${expressionParts.join(", ")}`,
    ExpressionAttributeNames: expressionNames,
    ExpressionAttributeValues: expressionValues,
    ReturnValues: "ALL_NEW",
  });

  const result = await docClient.send(cmd);
  return result.Attributes;
}

// ── Upload Rate Limiting ───────────────────────────────────────────────────────

/**
 * Atomically increments a per-student upload counter for today.
 * Uses DynamoDB's atomic ADD operation — race-condition safe.
 *
 * Key format:  PK = STUDENT#<id>  SK = UPLOAD_COUNT#<YYYY-MM-DD>
 * TTL is set to 48 hours from now so DynamoDB auto-deletes stale counters.
 *
 * @param {string} studentId - Raw student ID
 * @param {number} limit - Maximum uploads allowed per day
 * @returns {{ allowed: boolean, currentCount: number, remaining: number }}
 */
export async function checkAndIncrementUploadCount(studentId, limit) {
  const PK = makeStudentPK(studentId);
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const SK = `UPLOAD_COUNT#${today}`;

  // TTL = midnight of tomorrow + 24 hours buffer (48 hours from now total)
  const ttlSeconds = Math.floor(Date.now() / 1000) + 172800; // 48 hours

  // Atomic increment — ADD initialises to 0 if the item doesn't exist
  const cmd = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { PK, SK },
    UpdateExpression: "ADD #count :inc SET #ttl = if_not_exists(#ttl, :ttl), #date = if_not_exists(#date, :date)",
    ExpressionAttributeNames: {
      "#count": "count",
      "#ttl": "ttl",
      "#date": "date",
    },
    ExpressionAttributeValues: {
      ":inc": 1,
      ":ttl": ttlSeconds,
      ":date": today,
    },
    ReturnValues: "ALL_NEW",
  });

  const result = await docClient.send(cmd);
  const currentCount = result.Attributes?.count ?? 1;
  const remaining = Math.max(0, limit - currentCount);
  const allowed = currentCount <= limit;

  console.info(
    `[RateLimit] Upload count for ${studentId} on ${today}: ${currentCount}/${limit} (allowed: ${allowed})`
  );

  return { allowed, currentCount, remaining, date: today };
}
