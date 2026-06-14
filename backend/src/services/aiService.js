import * as bedrock from './bedrockService.js';
import * as groq from './groqService.js';

// Get the provider from env var, defaulting to bedrock
// Options: 'bedrock', 'groq', (future: 'gemini')
const provider = process.env.AI_PROVIDER || 'bedrock';

export const extractEvents = async (rawText) => {
  console.info(`[AIService] Using provider: ${provider} for extractEvents`);
  if (provider === 'groq') return groq.extractEvents(rawText);
  // Default to Bedrock
  return bedrock.extractEvents(rawText);
};

export const generateNudge = async (ev, profile, hoursLeft) => {
  console.info(`[AIService] Using provider: ${provider} for generateNudge`);
  if (provider === 'groq') return groq.generateNudge(ev, profile, hoursLeft);
  // Default to Bedrock
  return bedrock.generateNudge(ev, profile, hoursLeft);
};

export const generateBriefing = async (opts) => {
  console.info(`[AIService] Using provider: ${provider} for generateBriefing`);
  if (provider === 'groq') return groq.generateBriefing(opts);
  // Default to Bedrock
  return bedrock.generateBriefing(opts);
};

export const generatePositiveNudge = async (ev, profile) => {
  console.info(`[AIService] Using provider: ${provider} for generatePositiveNudge`);
  if (provider === 'groq') return groq.generatePositiveNudge(ev, profile);
  // Default to Bedrock
  return bedrock.generatePositiveNudge(ev, profile);
};
