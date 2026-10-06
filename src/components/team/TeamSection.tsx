"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface Teammate {
  id: string;
  email: string;
  full_name: string | null;
  team_role: "owner" | "member";
}

export interface PendingInvite {
  id: string;
  email: string;
  expires_at: string;
}

async function call(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data?.error as string) ?? "Something went wrong. Please try again.");
  return data ?? {};
}

/**
 * Settings → Team. Everyone sees who's on the account; only owners invite,
 * revoke invites, and remove teammates (the API enforces this too).
 */
export default function TeamSection({
  isOwner,
  currentUserId,
  teammates,
  invites,
}: {
  isOwner: boolean;
  currentUserId: string;
  teammates: Teammate[];
  invites: PendingInvite[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastInvite, setLastInvite] = useState<{ email: string; url: string; emailed: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy("invite");
    setError(null);
    setCopied(false);
    try {
      const data = await call("/api/team/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setLastInvite({ email: email.trim().toLowerCase(), url: String(data.invite_url), emailed: Boolean(data.emailed) });
      setEmail("");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "We couldn't send the invite.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(kind: "invite" | "member", id: string, label: string) {
    const question =
      kind === "member"
        ? `Remove ${label} from the team? They'll lose access to this restaurant's data right away.`
        : `Cancel the invite for ${label}? The link they received will stop working.`;
    if (!confirm(question)) return;
    setBusy(id);
    setError(null);
    try {
      await call(kind === "member" ? `/api/team/members/${id}` : `/api/team/invites/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "That didn't work. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function copyLink(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  return (
    <div className="bg-paper rounded-2xl border border-line divide-y divide-line-soft">
      <div className="px-6 py-4">
        <h2 className="text-sm font-semibold text-ink">Team</h2>
        <p className="text-xs text-ink-faint mt-0.5">
          Everyone on the team sees the same restaurant data. Teammates are free — you pay per location.
        </p>
      </div>

      {teammates.map((t) => (
        <div key={t.id} className="px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-ink truncate">
              {t.full_name || t.email}
              {t.id === currentUserId && <span className="text-ink-faint"> (you)</span>}
            </p>
            {t.full_name && <p className="text-xs text-ink-faint truncate">{t.email}</p>}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span
              className={`text-[11px] font-semibold uppercase tracking-wide rounded-full px-2.5 py-1 ${
                t.team_role === "owner" ? "bg-[#eef6f1] text-pos" : "bg-line-soft text-ink-soft"
              }`}
            >
              {t.team_role}
            </span>
            {isOwner && t.id !== currentUserId && (
              <button
                onClick={() => remove("member", t.id, t.email)}
                disabled={busy === t.id}
                className="text-xs text-ink-faint hover:text-neg"
              >
                {busy === t.id ? "Removing…" : "Remove"}
              </button>
            )}
          </div>
        </div>
      ))}

      {invites.map((inv) => (
        <div key={inv.id} className="px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-ink-soft truncate">{inv.email}</p>
            <p className="text-xs text-ink-faint">
              Invite pending · expires{" "}
              {new Date(inv.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </p>
          </div>
          {isOwner && (
            <button
              onClick={() => remove("invite", inv.id, inv.email)}
              disabled={busy === inv.id}
              className="inline-flex items-center gap-1 text-xs text-ink-faint hover:text-neg shrink-0"
            >
              <X className="w-3 h-3" />
              {busy === inv.id ? "Cancelling…" : "Cancel invite"}
            </button>
          )}
        </div>
      ))}

      {isOwner ? (
        <div className="px-6 py-4 space-y-3">
          <form onSubmit={invite} className="flex gap-2">
            <Input
              type="email"
              required
              placeholder="teammate@restaurant.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
            />
            <Button
              type="submit"
              size="sm"
              disabled={busy === "invite" || !email}
              className="bg-forest hover:bg-forest-soft text-paper gap-2 h-9"
            >
              {busy === "invite" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              Invite
            </Button>
          </form>

          {lastInvite && (
            <div className="rounded-lg bg-cream/70 border border-line-soft p-3 space-y-2">
              <p className="text-xs text-ink-soft">
                {lastInvite.emailed
                  ? `Invite emailed to ${lastInvite.email}. You can also send them this link:`
                  : `Email isn't set up yet, so send ${lastInvite.email} this link yourself:`}
              </p>
              <div className="flex gap-2">
                <input readOnly value={lastInvite.url} className="flex-1 min-w-0 text-xs bg-paper border border-line rounded-md px-2 py-1.5 text-ink-soft" />
                <button
                  onClick={() => copyLink(lastInvite.url)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-forest shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="text-[11px] text-ink-faint">The link only works for {lastInvite.email} and expires in 14 days.</p>
            </div>
          )}
          {error && <p className="text-sm text-neg">{error}</p>}
        </div>
      ) : (
        <div className="px-6 py-3.5">
          <p className="text-xs text-ink-faint">Only the account owner can invite or remove teammates.</p>
        </div>
      )}
    </div>
  );
}
