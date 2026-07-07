"use client";

import { useState } from "react";
import { X, Check, Archive, Pencil, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CATEGORY_LABELS } from "@/lib/design";
import type { Sop } from "@/types";

interface SopDetailModalProps {
  sop: Sop;
  evidence: { location_name: string; quote: string }[];
  onClose: () => void;
  onActivate: () => void;
  onArchive: () => void;
  onSave: (title: string, content: string) => void;
}

export default function SopDetailModal({
  sop,
  evidence,
  onClose,
  onActivate,
  onArchive,
  onSave,
}: SopDetailModalProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(sop.title);
  const [content, setContent] = useState(sop.content);

  function handleSave() {
    onSave(title, content);
    setEditing(false);
  }

  function handleCancel() {
    setTitle(sop.title);
    setContent(sop.content);
    setEditing(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/50 flex items-center justify-center p-4">
      <div className="bg-paper rounded-2xl shadow-xl w-full max-w-lg border border-line max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-line-soft">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.14em] text-ink-faint mb-0.5 font-medium">
              {CATEGORY_LABELS[sop.category]} SOP
            </p>
            {editing ? (
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="font-heading text-lg font-semibold text-ink bg-transparent border-b border-line focus:outline-none w-full"
              />
            ) : (
              <h2 className="font-heading text-lg font-semibold text-ink">{sop.title}</h2>
            )}
          </div>
          <button onClick={onClose} className="text-ink-faint hover:text-ink shrink-0 ml-3">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          {sop.source_summary && (
            <div className="rounded-xl bg-cream border border-line-soft p-3 flex items-start gap-2">
              {sop.ai_generated && (
                <Sparkles className="w-3.5 h-3.5 text-forest shrink-0 mt-0.5" />
              )}
              <p className="text-xs text-ink-soft">{sop.source_summary}</p>
            </div>
          )}

          {editing ? (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              className="w-full text-sm text-ink-soft leading-relaxed border border-line rounded-xl p-3 focus:outline-none focus:border-forest"
            />
          ) : (
            <p className="text-sm text-ink-soft leading-relaxed whitespace-pre-line">
              {sop.content}
            </p>
          )}

          {evidence.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-ink-faint uppercase tracking-[0.14em] mb-2">
                What guests are saying · last 30 days
              </p>
              <div className="space-y-2">
                {evidence.map((e, i) => (
                  <blockquote
                    key={i}
                    className="border-l-2 border-line pl-3 text-sm text-ink-soft italic"
                  >
                    &ldquo;{e.quote}&rdquo;{" "}
                    <span className="not-italic text-xs text-ink-faint">
                      — {e.location_name}
                    </span>
                  </blockquote>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-2 border-t border-line-soft pt-4">
          {editing ? (
            <>
              <Button variant="outline" className="flex-1" onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-forest hover:bg-forest-soft text-paper"
                onClick={handleSave}
              >
                Save
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" className="gap-1.5" onClick={() => setEditing(true)}>
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
              {sop.status !== "archived" && (
                <Button variant="outline" className="gap-1.5" onClick={onArchive}>
                  <Archive className="w-3.5 h-3.5" /> Archive
                </Button>
              )}
              {sop.status === "draft" && (
                <Button
                  className="flex-1 bg-forest hover:bg-forest-soft text-paper gap-1.5"
                  onClick={onActivate}
                >
                  <Check className="w-3.5 h-3.5" /> Approve & activate
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
