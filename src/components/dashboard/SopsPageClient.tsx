"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS } from "@/lib/design";
import type { DriftAlert, Sop, SopStatus } from "@/types";
import SopCard from "@/components/dashboard/SopCard";
import SopDetailModal from "@/components/dashboard/SopDetailModal";

const STATUS_ORDER: Record<SopStatus, number> = { draft: 0, active: 1, archived: 2 };

interface SopsPageClientProps {
  initialSops: Sop[];
  evidence: Record<string, { location_name: string; quote: string }[]>;
  driftAlerts: DriftAlert[];
  // Demo mode (no real locations yet): mutations stay local, no API calls
  demo: boolean;
}

export default function SopsPageClient({
  initialSops,
  evidence,
  driftAlerts,
  demo,
}: SopsPageClientProps) {
  const router = useRouter();
  const [sops, setSops] = useState<Sop[]>(initialSops);
  const [openSop, setOpenSop] = useState<Sop | null>(null);
  const [drafting, setDrafting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function patchSop(id: string, body: Record<string, unknown>): Promise<Sop | null> {
    const res = await fetch(`/api/sops/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Update failed");
      return null;
    }
    return data.data as Sop;
  }

  async function activate(id: string) {
    setError(null);
    if (demo) {
      const target = sops.find((s) => s.id === id);
      if (!target) return;
      const now = new Date().toISOString();
      setSops((prev) =>
        prev.map((s) => {
          if (s.id === id) return { ...s, status: "active" as const, activated_at: now, updated_at: now };
          if (s.category === target.category && s.status === "active")
            return { ...s, status: "archived" as const, updated_at: now };
          return s;
        })
      );
      setOpenSop(null);
      return;
    }
    const updated = await patchSop(id, { status: "active" });
    if (updated) {
      setSops((prev) =>
        prev.map((s) => {
          if (s.id === id) return updated;
          if (s.category === updated.category && s.id !== id && s.status === "active")
            return { ...s, status: "archived" as const };
          return s;
        })
      );
      setOpenSop(null);
      router.refresh();
    }
  }

  async function archive(id: string) {
    setError(null);
    if (demo) {
      setSops((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, status: "archived" as const, updated_at: new Date().toISOString() } : s
        )
      );
      setOpenSop(null);
      return;
    }
    const updated = await patchSop(id, { status: "archived" });
    if (updated) {
      setSops((prev) => prev.map((s) => (s.id === id ? updated : s)));
      setOpenSop(null);
      router.refresh();
    }
  }

  async function saveContent(id: string, title: string, content: string) {
    setError(null);
    if (demo) {
      setSops((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, title, content, updated_at: new Date().toISOString() } : s
        )
      );
      setOpenSop((prev) => (prev && prev.id === id ? { ...prev, title, content } : prev));
      return;
    }
    const updated = await patchSop(id, { title, content });
    if (updated) {
      setSops((prev) => prev.map((s) => (s.id === id ? updated : s)));
      setOpenSop((prev) => (prev && prev.id === id ? updated : prev));
    }
  }

  async function draftFromAlert(alert: DriftAlert) {
    setError(null);
    if (demo) return;
    setDrafting(alert.id);
    try {
      const res = await fetch("/api/sops/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: alert.category, drift_alert_id: alert.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Draft failed");
      setSops((prev) => [data.data as Sop, ...prev]);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Draft failed");
    } finally {
      setDrafting(null);
    }
  }

  const draftsNeedingReview = sops.filter((s) => s.status === "draft" && s.ai_generated);

  // Categories with an unresolved drift alert but no SOP drafted for it yet
  const categoriesWithSop = new Set(sops.map((s) => s.category));
  const undrafted = driftAlerts.filter(
    (a) => !a.resolved && !categoriesWithSop.has(a.category)
  );

  const sorted = [...sops].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  return (
    <div className="px-6 py-10 max-w-4xl mx-auto space-y-7">
      <div className="max-w-2xl">
        <p className="text-[11px] uppercase tracking-[0.16em] text-ink-faint font-medium">
          Standard Operating Procedures
        </p>
        <h1 className="font-heading text-[28px] leading-snug font-semibold text-ink mt-1.5">
          Turn recurring complaints into a standard the whole group follows.
        </h1>
        <p className="text-sm text-ink-soft mt-2 leading-relaxed">
          One SOP per category, shared brand-wide — the moat here is the same as
          everywhere else: comparing locations, not managing them one at a time.
          RAAI drafts a suggestion when a category shows sustained negative drift;
          you review, edit, and activate it. Nothing here changes on its own.
        </p>
      </div>

      {error && (
        <p className="text-sm text-neg bg-[#fbeeea] rounded-lg px-4 py-3">{error}</p>
      )}

      {draftsNeedingReview.length > 0 && (
        <div className="rounded-2xl bg-[#f0f4ee] border border-forest/20 p-4 flex items-start gap-3">
          <Sparkles className="w-4 h-4 text-forest shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-forest">
              {draftsNeedingReview.length} SOP draft{draftsNeedingReview.length !== 1 ? "s" : ""} waiting on your review
            </p>
            <p className="text-xs text-[#2c3d2f] mt-0.5">
              Drafted from recent drift alerts. Nothing activates until you approve it below.
            </p>
          </div>
        </div>
      )}

      {undrafted.length > 0 && (
        <div className="rounded-2xl bg-cream border border-line-soft p-4 space-y-2">
          {undrafted.map((alert) => (
            <div key={alert.id} className="flex items-center justify-between gap-3">
              <p className="text-sm text-ink-soft">
                <strong className="text-ink">{CATEGORY_LABELS[alert.category]}</strong> has an
                unresolved drift alert with no SOP yet.
              </p>
              <Button
                size="sm"
                variant="outline"
                disabled={drafting !== null}
                onClick={() => draftFromAlert(alert)}
                className="gap-2"
              >
                {drafting === alert.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Draft SOP
              </Button>
            </div>
          ))}
        </div>
      )}

      {sorted.length === 0 && (
        <div className="rounded-2xl bg-paper border border-line p-8 text-center">
          <p className="text-sm text-ink-soft">
            No SOPs yet. When a category shows sustained negative drift, a draft
            will be suggested here for your review.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((sop) => (
          <SopCard key={sop.id} sop={sop} onOpen={() => setOpenSop(sop)} />
        ))}
      </div>

      {openSop && (
        <SopDetailModal
          sop={openSop}
          evidence={evidence[openSop.id] ?? []}
          onClose={() => setOpenSop(null)}
          onActivate={() => activate(openSop.id)}
          onArchive={() => archive(openSop.id)}
          onSave={(title, content) => saveContent(openSop.id, title, content)}
        />
      )}
    </div>
  );
}
