"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bug, CheckCircle2, HelpCircle, Lightbulb, MessageCircle, Sparkles, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { track } from "@/lib/telemetry/track";
import type { FeedbackType } from "@/lib/telemetry/sanitize";

const TYPES: { value: FeedbackType; label: string; hint: string; icon: React.ElementType }[] = [
  { value: "bug", label: "Report a bug", hint: "Something isn't working", icon: Bug },
  { value: "improvement", label: "Suggest an improvement", hint: "Make something better", icon: Lightbulb },
  { value: "feature", label: "Request a feature", hint: "Something new you need", icon: Sparkles },
  { value: "support", label: "I need help", hint: "Question or problem", icon: HelpCircle },
  { value: "general", label: "General feedback", hint: "Anything else", icon: MessageCircle },
];

/**
 * "Feedback & help" — a sidebar button that opens a short form. We already
 * know who the user is, their account and the page they're on; the form
 * only asks for what we can't know.
 */
export default function FeedbackWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const submitting = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    dialogRef.current?.querySelector<HTMLElement>("button, input, textarea")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function openForm() {
    setOpen(true);
    track("feedback_opened", { path: pathname });
  }

  function close() {
    setOpen(false);
    // Keep a half-written message if they close by accident; reset after a send.
    if (sent) {
      setSent(false);
      setType(null);
      setSubject("");
      setMessage("");
      setRating(null);
    }
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!type || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          subject,
          message,
          rating,
          route: pathname,
          viewport: { w: window.innerWidth, h: window.innerHeight },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "We couldn't send that. Please try again.");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't send that. Please try again.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={openForm}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-line-soft hover:text-ink"
      >
        <MessageCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
        Feedback &amp; help
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" onClick={close}>
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-paper p-6 shadow-xl sm:max-w-lg sm:rounded-2xl"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 id="feedback-title" className="font-heading text-lg font-semibold text-ink">
                  {sent ? "Thank you" : "Help us improve"}
                </h2>
                {!sent && <p className="mt-0.5 text-sm text-ink-soft">Tell the Reviews Analytics team what&apos;s on your mind.</p>}
              </div>
              <button onClick={close} aria-label="Close" className="text-ink-faint hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>

            {sent ? (
              <div className="space-y-4 py-2 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-pos" aria-hidden="true" />
                <p className="text-sm text-ink" role="status">
                  Thank you — we received your feedback. Your input helps us improve Reviews Analytics.
                </p>
                <button onClick={close} className="rounded-lg bg-forest px-4 py-2 text-sm font-medium text-paper hover:bg-forest-soft">
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <fieldset>
                  <legend className="mb-2 text-xs font-medium text-ink">What is it about?</legend>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {TYPES.map((t) => (
                      <label
                        key={t.value}
                        className={cn(
                          "flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors",
                          type === t.value ? "border-forest bg-[#eef6f1]" : "border-line hover:border-ink-faint"
                        )}
                      >
                        <input
                          type="radio"
                          name="feedback-type"
                          value={t.value}
                          checked={type === t.value}
                          onChange={() => setType(t.value)}
                          className="sr-only"
                        />
                        <t.icon className={cn("mt-0.5 h-4 w-4 shrink-0", type === t.value ? "text-forest" : "text-ink-faint")} aria-hidden="true" />
                        <span>
                          <span className="block text-sm font-medium text-ink">{t.label}</span>
                          <span className="block text-xs text-ink-faint">{t.hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="space-y-1.5">
                  <label htmlFor="feedback-subject" className="text-xs font-medium text-ink">Subject</label>
                  <input
                    id="feedback-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    maxLength={200}
                    required
                    placeholder={type === "bug" ? "e.g. Heatmap is empty for Tampa" : "A few words"}
                    className="h-10 w-full rounded-lg border border-line bg-paper px-3 text-sm text-ink outline-none focus-visible:border-forest focus-visible:ring-4 focus-visible:ring-forest/15"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="feedback-message" className="text-xs font-medium text-ink">Message</label>
                  <textarea
                    id="feedback-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={5000}
                    required
                    rows={5}
                    placeholder={type === "bug" ? "What happened, and what did you expect?" : "Tell us more"}
                    className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus-visible:border-forest focus-visible:ring-4 focus-visible:ring-forest/15"
                  />
                </div>

                <fieldset>
                  <legend className="text-xs font-medium text-ink">
                    How is your experience with Reviews Analytics? <span className="font-normal text-ink-faint">(optional)</span>
                  </legend>
                  <div className="mt-1.5 flex gap-1" role="radiogroup">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={rating === n}
                        aria-label={`${n} out of 5`}
                        onClick={() => setRating(rating === n ? null : n)}
                        className="rounded p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40"
                      >
                        <Star className={cn("h-6 w-6", rating && n <= rating ? "fill-gold text-gold" : "text-line")} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </fieldset>

                <p className="text-[11px] text-ink-faint">
                  We&apos;ll include your account, this page and your browser type so we can look into it — nothing else.
                </p>
                {error && (
                  <p role="alert" className="rounded-lg bg-[#fbeeea] px-3 py-2 text-sm text-neg">{error}</p>
                )}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={close} className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:border-ink-faint">
                    Cancel
                  </button>
                  <button
                    disabled={busy || !type || !subject.trim() || !message.trim()}
                    className="rounded-lg bg-forest px-4 py-2 text-sm font-medium text-paper hover:bg-forest-soft disabled:opacity-50"
                  >
                    {busy ? "Sending…" : "Send"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
