/**
 * CampusFlow — Email Ingest Handler
 * Triggered by: SES inbound rule (saves raw email to S3, then fires this Lambda)
 *
 * Flow:
 *  1. SES action: save raw email to S3 under key = messageId
 *  2. This Lambda fires with the SES event
 *  3. Fetch raw MIME email from S3
 *  4. Parse with mailparser — extract plain text body
 *  5. Extract studentId from "To" address: {rawId}@sync.campusflow.com
 *  6. Push to BedrockProcessingQueue (identical downstream to clipboard)
 */

import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { simpleParser } from "mailparser";

const s3 = new S3Client({ region: process.env.AWS_REGION || "ap-south-1" });
const sqs = new SQSClient({ region: process.env.AWS_REGION || "ap-south-1" });

const EMAIL_BUCKET = process.env.EMAIL_BUCKET;
const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL;
const SYNC_DOMAIN = process.env.SYNC_EMAIL_DOMAIN || "sync.campusflow.com";

export const handler = async (event) => {
  const sesRecord = event.Records[0].ses;
  const messageId = sesRecord.mail.messageId;
  const destination = sesRecord.mail.destination;

  console.info(`[IngestEmail] Received email messageId: ${messageId}`);
  console.info(`[IngestEmail] Destination(s): ${destination.join(", ")}`);

  // ── 1. Extract studentId from "To" address ─────────────────────────────────
  // e.g. "abc123@sync.campusflow.com" → rawId = "abc123"
  const toAddress = destination.find((addr) => addr.includes(SYNC_DOMAIN));
  if (!toAddress) {
    console.warn(`[IngestEmail] No CampusFlow address in destination, skipping`);
    return;
  }

  const rawId = toAddress.split("@")[0].toLowerCase();
  const studentId = `STUDENT#${rawId}`;

  // ── 2. Fetch raw MIME email from S3 ───────────────────────────────────────
  let rawMime;
  try {
    const obj = await s3.send(
      new GetObjectCommand({ Bucket: EMAIL_BUCKET, Key: messageId })
    );
    rawMime = await obj.Body.transformToString("utf-8");
  } catch (err) {
    console.error("[IngestEmail] Failed to fetch email from S3:", err);
    throw err; // Retriable
  }

  // ── 3. Parse MIME with mailparser ─────────────────────────────────────────
  let parsed;
  try {
    parsed = await simpleParser(rawMime);
  } catch (err) {
    console.error("[IngestEmail] mailparser failed:", err);
    return; // Malformed MIME — non-retriable
  }

  // Prefer plain text; fallback to stripping HTML tags
  let bodyText = parsed.text;
  if (!bodyText && parsed.html) {
    bodyText = parsed.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }

  if (!bodyText || bodyText.trim().length < 20) {
    console.info(`[IngestEmail] Email body too short after parsing, skipping`);
    return;
  }

  const subject = parsed.subject || "";
  // Prepend subject so Bedrock sees it as part of the context
  const rawText = subject ? `Subject: ${subject}\n\n${bodyText}` : bodyText;

  console.info(
    `[IngestEmail] Parsed email for ${studentId}, body length: ${rawText.length}`
  );

  // ── 4. Push to SQS ─────────────────────────────────────────────────────────
  const sqsMessage = {
    studentId,
    rawId,
    rawText: rawText.slice(0, 10000), // 10KB cap
    source: "EMAIL",
    ingestedAt: new Date().toISOString(),
    studentName: "Student",
    emailSubject: subject,
  };

  try {
    const result = await sqs.send(
      new SendMessageCommand({
        QueueUrl: SQS_QUEUE_URL,
        MessageBody: JSON.stringify(sqsMessage),
        MessageAttributes: {
          studentId: { DataType: "String", StringValue: studentId },
          source: { DataType: "String", StringValue: "EMAIL" },
        },
      })
    );
    console.info(`[IngestEmail] Queued to SQS: ${result.MessageId} for ${studentId}`);
  } catch (err) {
    console.error("[IngestEmail] SQS push failed:", err);
    throw err;
  }
};
