/**
 * Claude sentiment analysis — the classification engine.
 *
 * Rules (locked from spec):
 * - Fixed taxonomy: food | service | atmosphere | value | wait_time | cleanliness
 * - Claude ONLY — no OpenAI.
 * - Every review is classified regardless of star rating.
 *   5★ reviews power "what they love" (positive sentiment matters).
 * - A single review can hit multiple categories.
 * - Danger flags are surfaced in UI even with no publish path.
 * - Model: claude-sonnet-4-6 (latest capable model).
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ClaudeAnalysisRequest, ClaudeAnalysisResponse, SentimentCategory } from "@/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const VALID_CATEGORIES: SentimentCategory[] = [
  "food", "service", "atmosphere", "value", "wait_time", "cleanliness",
];

const SYSTEM_PROMPT = `You are a restaurant review sentiment analyst. Your job is to classify guest reviews into fixed operational categories and detect danger flags.

FIXED CATEGORY TAXONOMY (use ONLY these — do not invent new ones):
- food: quality, taste, temperature, presentation, freshness of food and drinks
- service: staff attitude, attentiveness, friendliness, professionalism, order accuracy
- atmosphere: ambiance, decor, noise level, cleanliness of the dining space, music
- value: price vs quality, portion sizes, deals, bang for buck
- wait_time: time to be seated, time for food to arrive, time for bill
- cleanliness: hygiene of bathrooms, tables, kitchen visible areas, dishes

RULES:
1. A review may mention multiple categories — include all that are relevant.
2. Only include a category if the review meaningfully mentions it.
3. sentiment_score: -1.0 (very negative) to +1.0 (very positive). Use the full range.
4. confidence: 0.0 to 1.0. High confidence = explicit clear mention.
5. Danger flags — set to true if the review contains:
   - health_safety: food poisoning, allergen issues, pests, unsafe food handling
   - legal: threats of lawsuits, discrimination claims, HIPAA mentions
   - discrimination: racial, gender, disability, or other protected class complaints
   - physical_safety: fights, injuries, dangerous conditions, security incidents

OUTPUT: Return ONLY valid JSON matching this exact schema, no markdown, no explanation:
{
  "categories": [
    { "category": "<one of the 6>", "sentiment_score": <-1.0 to 1.0>, "confidence": <0.0 to 1.0> }
  ],
  "danger_flags": {
    "health_safety": <bool>,
    "legal": <bool>,
    "discrimination": <bool>,
    "physical_safety": <bool>
  }
}`;

export async function analyzeReview(
  req: ClaudeAnalysisRequest
): Promise<ClaudeAnalysisResponse> {
  const userMessage = `Star rating: ${req.star_rating}/5
Review text: "${req.review_text}"

Classify this review.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [{ role: "user", content: userMessage }],
    system: SYSTEM_PROMPT,
  });

  const text =
    message.content[0]?.type === "text" ? message.content[0].text : "";

  let parsed: ClaudeAnalysisResponse;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Claude returned invalid JSON: ${text.slice(0, 200)}`);
  }

  // Validate — reject any categories not in the fixed taxonomy
  parsed.categories = (parsed.categories ?? []).filter((c) =>
    VALID_CATEGORIES.includes(c.category)
  );

  // Clamp scores to valid range
  parsed.categories = parsed.categories.map((c) => ({
    ...c,
    sentiment_score: Math.max(-1, Math.min(1, c.sentiment_score)),
    confidence: Math.max(0, Math.min(1, c.confidence)),
  }));

  // Default danger flags if missing
  const flags = parsed.danger_flags ?? {};
  parsed.danger_flags = {
    health_safety: flags.health_safety ?? false,
    legal: flags.legal ?? false,
    discrimination: flags.discrimination ?? false,
    physical_safety: flags.physical_safety ?? false,
  };

  return parsed;
}
