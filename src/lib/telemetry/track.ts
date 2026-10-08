"use client";

import type { ClientEventType } from "@/lib/telemetry/sanitize";

/**
 * Fire-and-forget product event from the browser. Survives page navigation
 * (sendBeacon / keepalive). Identity, tenant and impersonation are stamped
 * server-side from the session — never sent from here.
 */
export function track(type: ClientEventType, metadata: Record<string, string | number | boolean> = {}): void {
  try {
    const body = JSON.stringify({ type, metadata });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
  } catch {
    // Telemetry never interrupts the user.
  }
}
