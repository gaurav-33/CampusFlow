/**
 * CampusFlow — PDF Ingest Handler
 * Triggered by: S3 PUT event on campusflow-uploads bucket
 *
 * Flow:
 *  1. Get S3 object key → extract studentId from path (uploads/{studentId}/file.pdf)
 *  2. Call Textract DetectDocumentText on the uploaded file
 *  3. Concatenate all LINE blocks into rawText
 *  4. Push message to same BedrockProcessingQueue as clipboard
 */

import { TextractClient, DetectDocumentTextCommand } from "@aws-sdk/client-textract";
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const textract = new TextractClient({ region: process.env.AWS_REGION || "ap-south-1" });
const s3 = new S3Client({ region: process.env.AWS_REGION || "ap-south-1" });
const sqs = new SQSClient({ region: process.env.AWS_REGION || "ap-south-1" });

// ── Limits ────────────────────────────────────────────────────────────────────
const MAX_FILE_BYTES = 10 * 1024 * 1024;   // 10 MB — must match bucket policy + presign handler
const MAX_TEXT_LENGTH = 50_000;            // 50KB of extracted text cap to Bedrock

const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL;

export const handler = async (event) => {
  const s3Record = event.Records[0].s3;
  const bucket = s3Record.bucket.name;
  const key = decodeURIComponent(s3Record.object.key.replace(/\+/g, " "));

  console.info(`[IngestPdf] Triggered for s3://${bucket}/${key}`);

  // Key format: uploads/{studentId}/{uuid}.pdf
  // Extract raw studentId from path
  const keyParts = key.split("/");
  if (keyParts.length < 3 || keyParts[0] !== "uploads") {
    console.warn(`[IngestPdf] Unexpected key format: ${key} — skipping`);
    return;
  }
  const rawId = keyParts[1];
  const studentId = `STUDENT#${rawId}`;

  // ── 1. Verify file size before calling Textract ─────────────────────────────
  // Double-check even though bucket policy enforces the cap,
  // in case a file was manually placed in S3 by a developer or admin.
  try {
    const head = await s3.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key })
    );
    const fileSize = head.ContentLength || 0;

    if (fileSize > MAX_FILE_BYTES) {
      console.warn(
        `[IngestPdf] File too large: ${(fileSize / 1024 / 1024).toFixed(1)} MB for ${studentId} — skipping Textract`
      );
      return; // Non-retriable — don't throw
    }

    if (fileSize < 512) {
      console.warn(`[IngestPdf] File suspiciously small (${fileSize} bytes) for ${studentId} — skipping`);
      return;
    }

    console.info(`[IngestPdf] File size OK: ${(fileSize / 1024).toFixed(0)} KB for ${studentId}`);
  } catch (err) {
    console.error("[IngestPdf] HeadObject failed:", err.message);
    // If we can't check size, allow through — Textract itself will reject bad files
  }

  // ── 1. Call Textract ────────────────────────────────────────────────────────
  let rawText;
  try {
    const result = await textract.send(
      new DetectDocumentTextCommand({
        Document: { S3Object: { Bucket: bucket, Name: key } },
      })
    );

    rawText = (result.Blocks || [])
      .filter((b) => b.BlockType === "LINE")
      .map((b) => b.Text)
      .join("\n")
      .trim();

    console.info(`[IngestPdf] Textract extracted ${rawText.length} chars for ${studentId}`);
  } catch (err) {
    console.error("[IngestPdf] Textract failed:", err);
    throw err; // Retriable
  }

  if (rawText.length < 20) {
    console.warn(`[IngestPdf] Extracted text too short (${rawText.length} chars) — blank or unreadable upload`);
    return;
  }

  // Cap extracted text — a 10MB PDF can produce enormous text that blows Bedrock token limits
  if (rawText.length > MAX_TEXT_LENGTH) {
    console.warn(
      `[IngestPdf] Extracted text truncated: ${rawText.length} → ${MAX_TEXT_LENGTH} chars for ${studentId}`
    );
    rawText = rawText.slice(0, MAX_TEXT_LENGTH);
  }

  // ── 2. Push to SQS — identical downstream flow as clipboard ────────────────
  const sqsMessage = {
    studentId,
    rawId,
    rawText,
    source: "PDF",
    ingestedAt: new Date().toISOString(),
    studentName: "Student", // Will be fetched from PROFILE in SQS processor
    s3Key: key,
  };

  try {
    const result = await sqs.send(
      new SendMessageCommand({
        QueueUrl: SQS_QUEUE_URL,
        MessageBody: JSON.stringify(sqsMessage),
        MessageAttributes: {
          studentId: { DataType: "String", StringValue: studentId },
          source: { DataType: "String", StringValue: "PDF" },
        },
      })
    );
    console.info(`[IngestPdf] Queued to SQS: ${result.MessageId} for ${studentId}`);
  } catch (err) {
    console.error("[IngestPdf] SQS push failed:", err);
    throw err;
  }
};
