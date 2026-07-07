"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS } from "@/lib/design";
import { MOCK_SOPS, MOCK_SOP_EVIDENCE, MOCK_DRIFT_ALERTS } from "@/lib/mock-data";
import type { Sop, SopStatus } from "@/types";
import SopCard from "@/components/dashboard/SopCard";
import SopDetailModal from "@/components/dashboard/SopDetailModal";

const STATUS_ORDER: Record<SopStatus, number> = { draft: 0, active: 1, archived: 2 };

export default function SopsPage() {
  const [sops, setSops] = useState<Sop[]>(MOCK_SOPS);
  const [openSop, setOpenSop] = useState<Sop | null>(null);

  function activate(id: string) {
    setSops((prev) => {
      const target = prev.find((s) => s.id === id);
      if (!target) return prev;
      const now = new Date().toISOString();
      return prev.map((s) => {
        if (s.id === id) return { ...s, status: "active" as const, activated_at: now, updated_at: now };
        if (s.category === target.category && s.status === "active") {
          return { ...s, status: "archived" as const, updated_at: now };
        }
        return s;
      });
    });
    setOpenSop(null);
  }

  function archive(id: string) {
    setSops((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: "archived" as const, updated_at: new Date().toISOString() } : s
      )
    );
    setOpenSop(null);
  }

  function saveContent(id: string, title: string, content: string) {
    setSops((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, title, content, updated_at: new Date().toISOString() } : s
      )
    );
    setOpenSop((prev) => (prev && prev.id === id ? { ...prev, title, content } : prev));
  }

  const draftsNeedingReview = sops.filter((s) => s.status === "draft" && s.ai_generated);

  // Categories with an unresolved drift alert but no SOP drafted for it yet
  const categoriesWithSop = new Set(sops.map((s) => s.category));
  const undrafted = MOCK_DRIFT_ALERTS.filter(
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
              <Button size="sm" variant="outline">
                Draft SOP
              </Button>
            </div>
          ))}
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
          evidence={MOCK_SOP_EVIDENCE[openSop.id] ?? []}
          onClose={() => setOpenSop(null)}
          onActivate={() => activate(openSop.id)}
          onArchive={() => archive(openSop.id)}
          onSave={(title, content) => saveContent(openSop.id, title, content)}
        />
      )}
    </div>
  );
}
