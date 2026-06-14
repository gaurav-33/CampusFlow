/**
 * CampusFlow — Rule Engine Handler
 * Triggered by: DynamoDB Streams on CampusFlowTable (NEW_IMAGE, INSERT events only)
 *
 * Flow per new EVENT# record:
 *  1. Filter: only process INSERT events for EVENT# SKs
 *  2. Extract studentId from PK, pull student context (profile + all pending events)
 *  3. Evaluate 10 rules to determine if a nudge should fire
 *  4. If shouldNudge: generate personalized push text via Bedrock
 *  5. Write NUDGE# record to DynamoDB
 *  6. Send push notification via SNS (Expo push token)
 *  7. Recompute health score and update PROFILE
 */

import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { generateNudge } from "../services/aiService.js";
import {
  getStudentData,
  putNudge,
  updateHealthScore,
  updatePushToken,
} from "../services/dynamoService.js";
import { computeHealthScore } from "../utils/healthScoreCalc.js";

const sns = new SNSClient({ region: process.env.AWS_REGION || "ap-south-1" });

const SNS_TOPIC_ARN = process.env.SNS_TOPIC_ARN;

// ── Rule Definitions ──────────────────────────────────────────────────────────
// Each rule returns true if a nudge should fire for this event.
const RULES = [
  // R-01: Any critical urgency event
  (ev) => ev.urgency === "critical",
  // R-02: Assignment due within 48 hours
  (ev, hoursLeft) => ev.type === "assignment" && hoursLeft < 48 && hoursLeft > 0,
  // R-03: Exam due within 72 hours
  (ev, hoursLeft) => ev.type === "exam" && hoursLeft < 72 && hoursLeft > 0,
  // R-04: Any placement event (always nudge — high stakes)
  (ev) => ev.type === "placement",
  // R-05: Fee deadline within 7 days
  (ev, hoursLeft) => ev.type === "fee" && hoursLeft < 168 && hoursLeft > 0,
  // R-06: High urgency hostel/notice
  (ev) => ev.urgency === "high" && (ev.type === "hostel" || ev.type === "notice"),
  // R-07: Any event with null timestamp (undated) that is critical/high
  (ev) => !ev.timestamp && (ev.urgency === "critical" || ev.urgency === "high"),
];

function evaluateRules(ev, hoursLeft) {
  return RULES.some((rule) => {
    try {
      return rule(ev, hoursLeft);
    } catch {
      return false;
    }
  });
}

// ── Handler ───────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  console.info(`[RuleEngine] Processing ${event.Records?.length ?? 0} stream records`);

  for (const record of event.Records) {
    try {
      await processStreamRecord(record);
    } catch (err) {
      // Don't fail the entire batch — log and continue
      console.error("[RuleEngine] Failed to process stream record:", err.message);
    }
  }
};

async function processStreamRecord(record) {
  // Only process new INSERT events
  if (record.eventName !== "INSERT") return;

  const newImage = record.dynamodb?.NewImage;
  if (!newImage) return;

  // Only process EVENT# records
  const sk = newImage.SK?.S;
  if (!sk || !sk.startsWith("EVENT#")) return;

  const pk = newImage.PK?.S;
  if (!pk || !pk.startsWith("STUDENT#")) return;

  // Extract raw studentId from PK (e.g. "STUDENT#abc123" → "abc123")
  const rawId = pk.replace("STUDENT#", "");

  const ev = {
    title: newImage.title?.S || "Unknown Event",
    type: newImage.type?.S || "other",
    urgency: newImage.urgency?.S || "low",
    timestamp: newImage.timestamp?.S || null,
    sk,
  };

  console.info(`[RuleEngine] Evaluating event: "${ev.title}" | type: ${ev.type} | urgency: ${ev.urgency}`);

  // ── Calculate hours left until event ────────────────────────────────────────
  const hoursLeft = ev.timestamp
    ? (new Date(ev.timestamp) - new Date()) / 3_600_000
    : 999;

  // ── Evaluate rules ──────────────────────────────────────────────────────────
  const shouldNudge = evaluateRules(ev, hoursLeft);

  // ── Fetch full student context ──────────────────────────────────────────────
  const { profile, events } = await getStudentData(rawId);

  // ── Generate nudge if rules fire ────────────────────────────────────────────
  if (shouldNudge && profile) {
    console.info(`[RuleEngine] Nudge triggered for "${ev.title}" → generating via Bedrock`);

    let nudgeText;
    try {
      nudgeText = await generateNudge(ev, profile, Math.round(hoursLeft));
    } catch (err) {
      console.error("[RuleEngine] Bedrock nudge generation failed:", err.message);
      nudgeText = `Reminder: ${ev.title} is coming up. Stay on top of it!`;
    }

    // Write NUDGE# record to DynamoDB
    try {
      await putNudge(rawId, {
        eventRef: ev.title,
        nudgeText,
        urgency: ev.urgency,
        eventType: ev.type,
        eventSK: ev.sk,
      });
      console.info(`[RuleEngine] NUDGE# written for ${rawId}`);
    } catch (err) {
      console.error("[RuleEngine] Failed to write NUDGE# record:", err.message);
    }

    // Send push notification via SNS
    if (profile.expoPushToken && SNS_TOPIC_ARN) {
      try {
        await sns.send(
          new PublishCommand({
            TopicArn: SNS_TOPIC_ARN,
            Message: JSON.stringify({
              token: profile.expoPushToken,
              title: "CampusFlow",
              body: nudgeText,
              data: { eventType: ev.type, urgency: ev.urgency },
            }),
            Subject: "CampusFlow Nudge",
          })
        );
        console.info(`[RuleEngine] Push notification sent for ${rawId}`);
      } catch (err) {
        console.error("[RuleEngine] SNS publish failed:", err.message);
        // Non-fatal — nudge record is already written
      }
    } else {
      console.info(`[RuleEngine] No expoPushToken for ${rawId} — skipping push`);
    }
  }

  // ── Always recompute health score ──────────────────────────────────────────
  try {
    const { score } = computeHealthScore(events);
    await updateHealthScore(rawId, score);
    console.info(`[RuleEngine] Health score updated: ${score} for ${rawId}`);
  } catch (err) {
    console.warn("[RuleEngine] Health score update failed (non-fatal):", err.message);
  }
}
