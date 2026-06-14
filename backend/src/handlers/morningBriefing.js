/**
 * CampusFlow — Morning Briefing Handler
 * Triggered by: EventBridge cron rule at 7:30 AM IST daily
 *   cron(0 2 * * ? *)  ← 2:00 UTC = 7:30 AM IST
 *
 * Flow:
 *  1. Scan PROFILE records to get all active student IDs
 *  2. For each student, fetch their top 5 pending events
 *  3. Call Bedrock Claude to generate a warm, personalized 3-4 sentence briefing
 *  4. Write BRIEFING#{date} record to DynamoDB (overwrite if re-run today)
 *
 * Note: At hackathon/demo scale, scanning all students is fine.
 * Production: add a GSI or maintain a separate "active students" list.
 */

import {
  DynamoDBClient,
  ScanCommand,
} from "@aws-sdk/client-dynamodb";
import { generateBriefing } from "../services/aiService.js";
import { getStudentData, putBriefing } from "../services/dynamoService.js";

const dynamoRaw = new DynamoDBClient({
  region: process.env.AWS_REGION || "ap-south-1",
});

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "CampusFlowData";

// ── Handler ───────────────────────────────────────────────────────────────────

export const handler = async () => {
  console.info("[MorningBriefing] Starting daily briefing generation");

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // ── 1. Scan all PROFILE records to get active student IDs ─────────────────
  let studentIds;
  try {
    studentIds = await getAllStudentIds();
    console.info(`[MorningBriefing] Found ${studentIds.length} students`);
  } catch (err) {
    console.error("[MorningBriefing] Failed to scan student IDs:", err);
    throw err;
  }

  // ── 2. Generate briefings per student ──────────────────────────────────────
  let generated = 0;
  let failed = 0;

  for (const rawId of studentIds) {
    try {
      await generateStudentBriefing(rawId, today);
      generated++;
    } catch (err) {
      console.error(`[MorningBriefing] Failed for student ${rawId}:`, err.message);
      failed++;
    }
  }

  console.info(
    `[MorningBriefing] Done. Generated: ${generated}, Failed: ${failed}`
  );
};

// ── Per-student Briefing ───────────────────────────────────────────────────────

async function generateStudentBriefing(rawId, today) {
  // Fetch all student data
  const { profile, events } = await getStudentData(rawId);

  if (!profile) {
    console.warn(`[MorningBriefing] No PROFILE for ${rawId} — skipping`);
    return;
  }

  const studentName = profile.name || "Student";
  const healthScore = profile.healthScore ?? 70;

  // Filter to top 5 upcoming pending events
  const pendingEvents = events
    .filter((e) => e.status === "pending")
    .sort((a, b) => {
      // Critical first, then by timestamp
      const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const ua = urgencyOrder[a.urgency] ?? 3;
      const ub = urgencyOrder[b.urgency] ?? 3;
      if (ua !== ub) return ua - ub;
      return (a.timestamp || "9999").localeCompare(b.timestamp || "9999");
    })
    .slice(0, 5);

  if (pendingEvents.length === 0) {
    console.info(`[MorningBriefing] No pending events for ${rawId} — generating generic briefing`);
  }

  // ── Call Bedrock ────────────────────────────────────────────────────────────
  let briefingText;
  try {
    briefingText = await generateBriefing({
      studentName,
      healthScore,
      events: pendingEvents,
      date: today,
    });
  } catch (err) {
    console.error(
      `[MorningBriefing] Bedrock failed for ${rawId}:`,
      err.message
    );
    // Fallback: generate a minimal briefing without AI
    const topEvent = pendingEvents[0];
    briefingText = topEvent
      ? `Good morning, ${studentName}! You have ${pendingEvents.length} upcoming event(s). Your most critical is "${topEvent.title}". Academic health score: ${healthScore}/100. Stay focused today!`
      : `Good morning, ${studentName}! Your academic calendar is clear today. Academic health score: ${healthScore}/100. Keep it up!`;
  }

  // ── Write BRIEFING# record ──────────────────────────────────────────────────
  await putBriefing(rawId, today, briefingText);
  console.info(`[MorningBriefing] Briefing written for ${rawId} on ${today}`);
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Scans the table for all PROFILE records and returns raw student IDs.
 * Uses a FilterExpression to avoid scanning EVENT# or CREDENTIAL# records.
 */
async function getAllStudentIds() {
  const studentIds = [];
  let lastEvaluatedKey;

  do {
    const result = await dynamoRaw.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "SK = :sk",
        ExpressionAttributeValues: {
          ":sk": { S: "PROFILE" },
        },
        ProjectionExpression: "PK",
        ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey }),
      })
    );

    for (const item of result.Items || []) {
      const pk = item.PK?.S;
      if (pk?.startsWith("STUDENT#")) {
        studentIds.push(pk.replace("STUDENT#", ""));
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return studentIds;
}
