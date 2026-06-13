/**
 * CampusFlow — SQS Batch Processor
 * Triggered by: BedrockProcessingQueue (SQS Event Source)
 *
 * NO JWT auth — this is an internal Lambda triggered by SQS, not API Gateway.
 *
 * Flow per SQS record:
 *  1. Parse message body (studentId, rawText)
 *  2. Call Bedrock (Claude 3 Sonnet) to extract events from rawText
 *  3. Write each parsed event to DynamoDB
 *  4. Recompute hybrid health score from all student events
 *  5. Update healthScore on PROFILE item
 *
 * Partial Batch Failure:
 *  Returns { batchItemFailures } so SQS only retries failed records,
 *  not the entire batch. Requires FunctionResponseTypes: [ReportBatchItemFailures].
 */

import { extractEvents } from "../services/bedrockService.js";
import {
  putEvent,
  getStudentData,
  updateHealthScore,
  makeStudentPK,
} from "../services/dynamoService.js";
import { computeHealthScore } from "../utils/healthScoreCalc.js";

// ── Handler ───────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  console.info(
    `[SqsProcessor] Processing batch of ${event.Records?.length ?? 0} records`,
  );

  const batchItemFailures = [];

  for (const record of event.Records) {
    const messageId = record.messageId;

    try {
      await processRecord(record);
      console.info(`[SqsProcessor] ✓ Processed messageId: ${messageId}`);
    } catch (err) {
      // Report this record as failed — SQS will retry it
      console.error(`[SqsProcessor] ✗ Failed messageId: ${messageId}`, err);
      batchItemFailures.push({ itemIdentifier: messageId });
    }
  }

  // Returning batchItemFailures allows SQS to retry ONLY failed messages
  return { batchItemFailures };
};

// ── Per-Record Processing ─────────────────────────────────────────────────────

async function processRecord(record) {
  // ── 1. Parse SQS message body ─────────────────────────────────────────────
  let messageBody;
  try {
    messageBody = JSON.parse(record.body);
  } catch (parseErr) {
    // Malformed JSON is unrecoverable — log and do NOT retry
    console.error(
      "[SqsProcessor] Malformed SQS message body, skipping:",
      record.body?.slice(0, 200),
    );
    return; // Don't throw — no point retrying bad JSON
  }

  const { studentId, rawId, rawText, source, ingestedAt } = messageBody;

  if (!studentId || !rawText) {
    console.warn("[SqsProcessor] Missing studentId or rawText in message, skipping");
    return;
  }

  console.info(
    `[SqsProcessor] Processing for ${studentId} | source: ${source} | ingestedAt: ${ingestedAt}`,
  );

  // ── 2. Call Bedrock to extract structured events ──────────────────────────
  let events;
  try {
    events = await extractEvents(rawText);
  } catch (bedrockErr) {
    // Bedrock failures are retriable (throttling, transient errors)
    console.error("[SqsProcessor] Bedrock extraction failed:", bedrockErr.message);
    throw bedrockErr; // Re-throw → SQS will retry this record
  }

  if (!events || events.length === 0) {
    console.info(`[SqsProcessor] No events extracted for ${studentId} — nothing to write`);
    // Don't fail the message — empty extraction is valid (no events in text)
    return;
  }

  console.info(
    `[SqsProcessor] Bedrock extracted ${events.length} events for ${studentId}`,
  );

  // ── 3. Write events to DynamoDB ───────────────────────────────────────────
  const writtenSKs = [];
  for (const event of events) {
    try {
      const sk = await putEvent(rawId, event);
      writtenSKs.push(sk);
      console.info(`[SqsProcessor] Wrote event: ${event.title} → ${sk}`);
    } catch (writeErr) {
      // Individual event write failure — log but continue processing others
      console.error(
        `[SqsProcessor] Failed to write event "${event.title}":`,
        writeErr.message,
      );
    }
  }

  if (writtenSKs.length === 0) {
    console.warn(`[SqsProcessor] All event writes failed for ${studentId}`);
    throw new Error("All DynamoDB event writes failed");
  }

  // ── 4. Recompute hybrid health score ──────────────────────────────────────
  // Fetch ALL current events for the student (not just newly added ones)
  let studentData;
  try {
    studentData = await getStudentData(rawId);
  } catch (fetchErr) {
    console.warn(
      "[SqsProcessor] Could not fetch student data for health score update:",
      fetchErr.message,
    );
    // Non-fatal — health score will be recomputed on next dashboard load
    return;
  }

  const { score } = computeHealthScore(studentData.events);

  // ── 5. Update PROFILE health score ───────────────────────────────────────
  try {
    await updateHealthScore(rawId, score);
    console.info(
      `[SqsProcessor] Updated health score for ${studentId}: ${score}`,
    );
  } catch (updateErr) {
    console.warn(
      "[SqsProcessor] Failed to update health score (non-fatal):",
      updateErr.message,
    );
  }
}
