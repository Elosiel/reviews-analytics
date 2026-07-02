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
import type {
  ClaudeAnalysisRequest,
  ClaudeAnalysisResponse,
  RankedIssue,
  RestaurantProfile,
  SentimentCategory,
} from "@/types";

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

/**
 * Recommendation generation — runs at rollup time, per ranked issue.
 * Unlike classification (which stays objective), this is where the
 * restaurant profile matters: the same complaint means different things
 * at a date-night spot vs a sports bar. Output is one short, operator-
 * ready paragraph the owner can act on before tonight's service.
 */
export async function generateRecommendation(
  issue: Pick<
    RankedIssue,
    "category" | "location_name" | "mention_count" | "avg_sentiment_score" | "sentiment_delta" | "quotes"
  >,
  profile: RestaurantProfile
): Promise<string> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 300,
    system: `You are an experienced restaurant operations consultant. Given a review-sentiment issue and the restaurant's profile, write ONE short paragraph (3-4 sentences) recommending a concrete, specific action the owner could take this week. Ground it in the guest quotes. Use the profile — mission, target guests, price point, goals — to judge what matters most. Frame it as a supportive recommendation, never an order: prefer "we'd recommend", "consider", "it may be worth" over imperatives — the owner decides, you advise. Plain language: guests, tables, shifts, dollars. No preamble, no bullet points, no headers. Recommend operational changes inside the restaurant only — do not suggest contacting or replying to reviewers.`,
    messages: [
      {
        role: "user",
        content: `RESTAURANT PROFILE
Mission: ${profile.mission}
Style: ${profile.cuisine_style}
Target guests: ${profile.target_guests}
Price point: ${profile.price_point}
Goals: ${profile.goals}
Notes: ${profile.notes}

ISSUE
Category: ${issue.category} at ${issue.location_name}
Mentions (30d): ${issue.mention_count} · Avg sentiment: ${issue.avg_sentiment_score.toFixed(2)}${issue.sentiment_delta !== null ? ` · Change vs prior: ${issue.sentiment_delta.toFixed(2)}` : ""}
Guest quotes:
${issue.quotes.map((q) => `- "${q}"`).join("\n")}

Write the recommendation.`,
      },
    ],
  });

  return message.content[0]?.type === "text" ? message.content[0].text.trim() : "";
}
