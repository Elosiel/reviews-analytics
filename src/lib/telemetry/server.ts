import { createServiceClient } from "@/lib/supabase/service";
import {
  safeErrorMessage,
  sanitizeEventMetadata,
  type ErrorCategory,
  type EventType,
} from "@/lib/telemetry/sanitize";

// Server-side recording of product events and application errors. Both go
// through the service role into tables customers can't read or write, and
// both are best-effort: telemetry must never break the request it observes.

export async function recordEvent(e: {
  type: EventType;
  tenantId: string | null;
  userId: string | null;
  locationId?: string | null;
  metadata?: Record<string, unknown>;
  impersonationSessionId?: string | null;
}): Promise<void> {
  try {
    const { error } = await createServiceClient().from("product_events").insert({
      event_type: e.type,
      tenant_id: e.tenantId,
      user_id: e.userId,
      location_id: e.locationId ?? null,
      metadata: sanitizeEventMetadata(e.metadata ?? {}),
      impersonation_session_id: e.impersonationSessionId ?? null,
    });
    if (error) console.error("recordEvent failed:", error.message);
  } catch (err) {
    console.error("recordEvent failed:", err instanceof Error ? err.message : err);
  }
}

/**
 * Logs a failure for the System Health view. The message is scrubbed of
 * anything credential-like and stack traces are never stored.
 */
export async function logAppError(e: {
  category: ErrorCategory;
  source: string;
  error: unknown;
  tenantId?: string | null;
  userId?: string | null;
  requestId?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { error } = await createServiceClient().from("app_errors").insert({
      category: e.category,
      source: e.source.slice(0, 120),
      message: safeErrorMessage(e.error),
      tenant_id: e.tenantId ?? null,
      user_id: e.userId ?? null,
      request_id: e.requestId ?? null,
      details: sanitizeEventMetadata(e.details ?? {}),
    });
    if (error) console.error("logAppError failed:", error.message);
  } catch (err) {
    console.error("logAppError failed:", err instanceof Error ? err.message : err);
  }
}
