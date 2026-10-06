/**
 * Parses JSON from a model reply that may wrap it in a markdown fence
 * (```json … ```) or add a sentence around it, despite instructions not to.
 *
 * Dependency-free on purpose (no "@/" imports): the unit tests in tests/
 * run it directly under Node's type stripping.
 */
export function parseModelJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    // Last resort: the outermost {...} or [...] span in the reply.
    const start = candidate.search(/[[{]/);
    const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"));
    if (start === -1 || end <= start) throw new SyntaxError("No JSON found in model reply");
    return JSON.parse(candidate.slice(start, end + 1));
  }
}
