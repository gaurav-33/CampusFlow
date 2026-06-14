import Groq from 'groq-sdk';

// Initialize Groq client
// Use a dummy key if not provided to prevent app crash if someone is using bedrock exclusively
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || 'dummy-key' });

const EXTRACT_PROMPT = (text, currentDate) => `You are an academic calendar extraction engine for Indian college students.
Current date (for reference): ${currentDate}

Extract ALL events, deadlines, and notices from the text below.

Return ONLY a valid JSON array. No markdown. No explanation. No preamble.
Each object must have exactly these keys:
- title: string (concise, max 60 chars)
- timestamp: ISO 8601 string, or null if no date found
- type: one of [exam, assignment, notice, placement, fee, hostel, transport, event, other]
- urgency: one of [critical, high, medium, low]

Rules:
- If text contains no academic events, return: []
- "placement", "drive", "registration" → type: placement
- "fee", "payment", "due" → type: fee
- Deadlines within 24h → urgency: critical
- Deadlines within 72h → urgency: high
- Assume Indian timezone (IST) if no timezone given

Text to extract from:
---
${text}
---`;

export const extractEvents = async (rawText) => {
  const currentIsoDate = new Date().toISOString().split("T")[0];
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0,
    max_tokens: 1024,
    messages: [{ role: 'user', content: EXTRACT_PROMPT(rawText, currentIsoDate) }],
  });

  const text = completion.choices[0].message.content.trim();
  try {
    return JSON.parse(text);
  } catch {
    // Strip accidental markdown fences
    const clean = text.replace(/```json?|```/g, '').trim();
    return JSON.parse(clean);
  }
};

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

export const generateNudge = async (ev, profile, hoursLeft) => {
  const timeContext =
    hoursLeft < 1
      ? "less than an hour"
      : hoursLeft < 24
        ? `${Math.round(hoursLeft)} hours`
        : `${Math.round(hoursLeft / 24)} day(s)`;

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.4,
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `Write a short, friendly push notification (max 2 sentences) for ${buildPersona(profile)}.
Event: ${ev.title}. Type: ${ev.type}. Hours remaining: ${timeContext}.
Urgency: ${ev.urgency}. Be specific, warm, and action-oriented. No emojis.
Return ONLY the notification text. No quotes, no preamble.`
    }],
  });
  return completion.choices[0].message.content.trim();
};

export const generateBriefing = async ({ profile, healthScore, events, date }) => {
  const eventSummary = events.length > 0
      ? events.map((e) => `- ${e.title} (${e.urgency} urgency${e.timestamp ? `, due ${e.timestamp.slice(0, 10)}` : ""})`).join("\n")
      : "- No pending events today";

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.5,
    max_tokens: 350,
    messages: [{
      role: 'user',
      content: `Write a warm, personal morning briefing (3-4 sentences) for ${buildPersona(profile)}.
Date: ${date}
Today's pending events:\n${eventSummary}
Health score: ${healthScore}/100.
Be specific, human, and action-oriented. Mention the most critical item first. No emojis, flowing prose only.`
    }],
  });
  return completion.choices[0].message.content.trim();
};

export const generatePositiveNudge = async (ev, profile) => {
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    temperature: 0.5,
    max_tokens: 100,
    messages: [{
      role: 'user',
      content: `Write a 1-sentence positive congratulation for ${buildPersona(profile)} for finishing a critical task (${ev.title}) a day early. Tell them to take a break. No emojis.`
    }],
  });
  return completion.choices[0].message.content.trim();
};
