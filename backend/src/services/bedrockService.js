/**
 * CampusFlow — AWS Bedrock Service
 * Wraps Claude 3 Sonnet to extract structured academic events from raw text.
 *
 * Model: anthropic.claude-3-sonnet-20240229-v1:0
 * Region: ap-south-1
 *
 * IMPORTANT: Enable the model in AWS Console → Bedrock → Model Access first.
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

// ── Client Setup ──────────────────────────────────────────────────────────────

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.BEDROCK_REGION || process.env.AWS_REGION || "ap-south-1",
});

const buildPersona = (profile) => {
  if (!profile) return 'a college student';
  const { name, college, branch, year } = profile;
  const parts = [];
  if (year) parts.push(year);
  if (branch) parts.push(branch);
  const title = parts.length > 0 ? parts.join(' ') + ' student' : 'college student';
  
  let persona = `${name || 'a student'}`;
  if (college) {
    persona += `, a ${title} at ${college}`;
  } else if (parts.length > 0) {
    persona += `, a ${title}`;
  }
  return persona;
};

const MODEL_ID =
  process.env.BEDROCK_MODEL_ID ||
  "anthropic.claude-3-sonnet-20240229-v1:0";

// ── Prompt Template ───────────────────────────────────────────────────────────

/**
 * Builds the strict-JSON extraction prompt for Claude.
 * The prompt is engineered to:
 *  1. Prevent markdown wrapping (```json ... ```)
 *  2. Return ONLY a JSON array — no prose, no explanation
 *  3. Normalize urgency and type to known enum values
 *  4. Use ISO 8601 timestamps, inferring year when missing
 */
function buildExtractionPrompt(rawText, currentIsoDate) {
  return `You are an academic event extractor for Indian college students. Your ONLY output must be a raw JSON array with NO markdown, NO explanation, NO code fences, and NO prose before or after. If no events are found, return an empty array [].

Current date (for reference): ${currentIsoDate}

Extract all academic events, deadlines, exams, assignments, placement drives, fee deadlines, and important notices from the following text.

For each event return an object with EXACTLY these keys:
- "title": string (concise title, max 80 chars)
- "timestamp": string (ISO 8601, e.g. "2026-06-15T17:00:00+05:30") — infer the nearest future date if only a day/time is mentioned
- "type": one of ["exam", "assignment", "placement", "fee", "notice", "other"]
- "urgency": one of ["critical", "medium", "low"] — use "critical" if within 48h or placement/exam, "medium" if within 7 days, "low" otherwise

Text to extract from:
"""
${rawText}
"""

Output ONLY the JSON array. Example of valid output: [{"title":"Midterm Exam","timestamp":"2026-06-17T09:00:00+05:30","type":"exam","urgency":"critical"}]`;
}

// ── Core Extraction Function ───────────────────────────────────────────────────

/**
 * Calls Claude 3 Sonnet via Bedrock to extract structured events from raw text.
 *
 * @param {string} rawText - Unstructured student clipboard/WhatsApp text
 * @returns {Promise<Array<{title: string, timestamp: string, type: string, urgency: string}>>}
 *          Array of parsed event objects (empty array if none found)
 * @throws {Error} If Bedrock invocation fails after retries
 */
export async function extractEvents(rawText) {
  if (!rawText || rawText.trim().length === 0) {
    console.warn("[BedrockService] extractEvents called with empty rawText");
    return [];
  }

  const currentIsoDate = new Date().toISOString().split("T")[0];
  const prompt = buildExtractionPrompt(rawText.trim(), currentIsoDate);

  // Claude 3 Sonnet uses the Messages API format
  const requestBody = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 1024,
    temperature: 0.1, // Low temperature for deterministic structured output
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  };

  const cmd = new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(requestBody),
  });

  let rawResponse;
  try {
    const response = await bedrockClient.send(cmd);
    // Decode the Uint8Array body
    rawResponse = new TextDecoder("utf-8").decode(response.body);
  } catch (err) {
    console.error("[BedrockService] Bedrock InvokeModel failed:", {
      message: err.message,
      code: err.name,
      modelId: MODEL_ID,
    });
    throw new Error(`Bedrock invocation failed: ${err.message}`);
  }

  return parseBedrockResponse(rawResponse, rawText);
}

// ── Response Parser ───────────────────────────────────────────────────────────

/**
 * Parses the raw Bedrock API response and extracts the JSON event array.
 * Handles edge cases where Claude wraps output in markdown fences despite instructions.
 *
 * @param {string} rawResponse - Raw JSON string from Bedrock
 * @param {string} originalText - Original input (for error context)
 * @returns {Array<Object>} Validated event array
 */
function parseBedrockResponse(rawResponse, originalText) {
  let parsed;
  try {
    parsed = JSON.parse(rawResponse);
  } catch {
    console.error("[BedrockService] Failed to parse Bedrock response JSON:", rawResponse?.slice(0, 200));
    throw new Error("Bedrock returned invalid JSON response");
  }

  // Extract the text content from Claude's Messages API response
  const content = parsed?.content?.[0]?.text;
  if (!content) {
    console.error("[BedrockService] Unexpected Bedrock response structure:", JSON.stringify(parsed).slice(0, 200));
    throw new Error("Bedrock response missing content.text field");
  }

  // Parse the events array from Claude's text output
  return extractJsonFromText(content, originalText);
}

/**
 * Robustly extracts a JSON array from Claude's text output.
 * Handles markdown code fences, leading/trailing whitespace, and partial wrapping.
 *
 * @param {string} text - Claude's text output
 * @param {string} originalText - For logging context
 * @returns {Array<Object>} Validated events
 */
function extractJsonFromText(text, originalText) {
  let cleaned = text.trim();

  // Strip markdown code fences if Claude disobeyed the prompt
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }

  // Find the JSON array boundaries robustly
  const firstBracket = cleaned.indexOf("[");
  const lastBracket = cleaned.lastIndexOf("]");

  if (firstBracket === -1 || lastBracket === -1 || lastBracket <= firstBracket) {
    console.warn(
      "[BedrockService] No JSON array found in Claude response. Raw text:",
      cleaned.slice(0, 300),
    );
    return []; // Graceful degradation — don't crash SQS processor
  }

  const jsonSlice = cleaned.slice(firstBracket, lastBracket + 1);

  let events;
  try {
    events = JSON.parse(jsonSlice);
  } catch (parseErr) {
    console.error("[BedrockService] Failed to parse extracted JSON slice:", {
      error: parseErr.message,
      slice: jsonSlice.slice(0, 300),
    });
    return [];
  }

  if (!Array.isArray(events)) {
    console.warn("[BedrockService] Claude returned non-array JSON:", typeof events);
    return [];
  }

  // Validate and sanitize each event
  const validated = events
    .map((event) => sanitizeEvent(event))
    .filter(Boolean); // Remove null entries (invalid events)

  console.info(
    `[BedrockService] Extracted ${validated.length} events from ${events.length} raw items`,
  );

  return validated;
}

// ── Event Sanitizer ───────────────────────────────────────────────────────────

const VALID_TYPES = ["exam", "assignment", "placement", "fee", "notice", "other"];
const VALID_URGENCIES = ["critical", "medium", "low"];

/**
 * Validates and sanitizes a single event object from Claude's output.
 * Returns null for invalid events (they'll be filtered out).
 *
 * @param {any} event - Raw event from Claude
 * @returns {Object|null} Sanitized event or null
 */
function sanitizeEvent(event) {
  if (!event || typeof event !== "object") return null;

  const title = (event.title || "").trim().slice(0, 80);
  if (!title) {
    console.warn("[BedrockService] Skipping event with empty title:", event);
    return null;
  }

  // Validate/default timestamp
  let timestamp = event.timestamp;
  if (!timestamp || isNaN(Date.parse(timestamp))) {
    console.warn(
      `[BedrockService] Event "${title}" has invalid timestamp "${timestamp}", defaulting to +7 days`,
    );
    const defaultTs = new Date();
    defaultTs.setDate(defaultTs.getDate() + 7);
    timestamp = defaultTs.toISOString();
  }

  const type = VALID_TYPES.includes(event.type) ? event.type : "other";
  const urgency = VALID_URGENCIES.includes(event.urgency) ? event.urgency : "low";

  return { title, timestamp, type, urgency };
}

// ── Nudge Generation ──────────────────────────────────────────────────────────

/**
 * Generates a short, personalized push notification text.
 * Called by the Rule Engine when a nudge rule fires on a new EVENT#.
 *
 * @param {{ title: string, type: string, urgency: string }} ev
 * @param {Object} profile
 * @param {number} hoursLeft
 * @returns {Promise<string>}
 */
export const generateNudge = async (ev, profile, hoursLeft) => {
  const timeContext =
    hoursLeft < 1
      ? "less than an hour"
      : hoursLeft < 24
        ? `${Math.round(hoursLeft)} hours`
        : `${Math.round(hoursLeft / 24)} day(s)`;

  const prompt = `Write a short, friendly push notification (max 2 sentences) for ${buildPersona(profile)}.
Event: ${ev.title}. Type: ${ev.type}. Hours remaining: ${timeContext}. Urgency: ${ev.urgency}.
Rules: Be specific and action-oriented. Use the student's name once. No emojis. No quotes.
Return ONLY the notification text.`;

  const requestBody = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 200,
    temperature: 0.4,
    messages: [{ role: "user", content: prompt }],
  };

  const response = await bedrockClient.send(
    new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(requestBody),
    })
  );

  const body = JSON.parse(new TextDecoder("utf-8").decode(response.body));
  return (
    body.content?.[0]?.text?.trim() ||
    `Reminder: ${ev.title} is coming up. Don't miss it!`
  );
}

// ── Morning Briefing Generation ───────────────────────────────────────────────

/**
 * Generates a warm, personalized morning briefing for a student.
 * Called by the Morning Briefing Lambda at 7:30 AM IST daily.
 *
 * @param {{ profile: Object, healthScore: number, events: Array, date: string }} opts
 * @returns {Promise<string>}
 */
export const generateBriefing = async ({ profile, healthScore, events, date }) => {
  const eventSummary =
    events.length > 0
      ? events
          .map(
            (e) =>
              `- ${e.title} (${e.urgency} urgency${e.timestamp ? `, due ${e.timestamp.slice(0, 10)}` : ""})`
          )
          .join("\n")
      : "- No pending events today";

  const prompt = `Write a warm, personal morning briefing (3-4 sentences) for ${buildPersona(profile)}.
Date: ${date}. Academic Health Score: ${healthScore}/100.
Pending events:\n${eventSummary}
Rules: Mention the student's name once at the start. Highlight the most critical item. End with a brief motivational sentence. No emojis, flowing prose only. Max 250 words.
Return ONLY the briefing text.`;

  const requestBody = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 400,
    temperature: 0.5,
    messages: [{ role: "user", content: prompt }],
  };

  const response = await bedrockClient.send(
    new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(requestBody),
    })
  );

  const body = JSON.parse(new TextDecoder("utf-8").decode(response.body));
  return (
    body.content?.[0]?.text?.trim() ||
    `Good morning, ${profile.name}! Check your dashboard for today's events. Academic health score: ${healthScore}/100. Have a productive day!`
  );
}

export const generatePositiveNudge = async (ev, profile) => {
  const prompt = `Write a 1-sentence positive congratulation for ${buildPersona(profile)} for finishing a critical task (${ev.title}) early. Tell them to take a break. No emojis.`;

  const requestBody = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 150,
    temperature: 0.5,
    messages: [{ role: "user", content: prompt }],
  };

  const response = await bedrockClient.send(
    new InvokeModelCommand({
      modelId: MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(requestBody),
    })
  );

  const body = JSON.parse(new TextDecoder("utf-8").decode(response.body));
  return body.content?.[0]?.text?.trim() || "Great job finishing your task early!";
}
