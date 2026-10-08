export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}

export function cleanNote(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const n = v.trim();
  return n.length >= 1 && n.length <= 5000 ? n : null;
}
