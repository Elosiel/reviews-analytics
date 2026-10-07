"use client";

import { useState } from "react";
import { Loader2, Users } from "lucide-react";
import LogoMark from "@/components/shared/LogoMark";
import { createClient } from "@/lib/supabase/client";

export type InviteStatus = "ready" | "invalid" | "used" | "expired";

const DEAD_LINK: Record<Exclude<InviteStatus, "ready">, string> = {
  invalid: "This invite link isn't valid. Ask the account owner to send you a new one.",
  used: "This invite has already been used. If that wasn't you, ask the account owner for a new one.",
  expired: "This invite has expired. Ask the account owner to send you a new one.",
};

export default function InviteAccept({
  token,
  status,
  invitedEmail,
  restaurantName,
  inviterName,
  signedInEmail,
}: {
  token: string;
  status: InviteStatus;
  invitedEmail: string | null;
  restaurantName: string;
  inviterName: string;
  signedInEmail: string | null;
}) {
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = `/invite/${token}`;
  const loginHref = (mode: "signin" | "signup") =>
    `/${mode === "signup" ? "signup" : "login"}?${new URLSearchParams({ next, ...(invitedEmail ? { email: invitedEmail } : {}) })}`;

  async function join() {
    setJoining(true);
    setError(null);
    try {
      const res = await fetch("/api/team/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "We couldn't accept the invite. Please try again.");
      window.location.assign("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "We couldn't accept the invite. Please try again.");
      setJoining(false);
    }
  }

  async function switchAccount() {
    await createClient().auth.signOut();
    window.location.assign(loginHref("signin"));
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-paper rounded-2xl border border-line p-8 space-y-6">
        <div className="flex items-center gap-2.5">
          <LogoMark className="w-7 h-7" />
          <span className="font-heading text-base font-semibold text-ink">Reviews Analytics</span>
        </div>

        {status !== "ready" ? (
          <div className="space-y-2">
            <h1 className="font-heading text-xl font-semibold text-ink">This invite can&apos;t be used</h1>
            <p className="text-sm text-ink-soft leading-relaxed">{DEAD_LINK[status]}</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-full bg-[#eef6f1] flex items-center justify-center">
                <Users className="w-5 h-5 text-forest" />
              </div>
              <h1 className="font-heading text-xl font-semibold text-ink">
                Join {restaurantName}
              </h1>
              <p className="text-sm text-ink-soft leading-relaxed">
                {`${inviterName} invited `}
                <span className="font-medium text-ink">{invitedEmail}</span>
                {" to their team. You'll see the same review insights, reports, and meeting agendas."}
              </p>
            </div>

            {!signedInEmail ? (
              <div className="space-y-2.5">
                <a
                  href={loginHref("signup")}
                  className="block text-center rounded-lg bg-forest text-paper text-sm font-medium px-4 py-2.5 hover:bg-forest-soft"
                >
                  Create your account
                </a>
                <a
                  href={loginHref("signin")}
                  className="block text-center rounded-lg border border-line text-ink text-sm font-medium px-4 py-2.5 hover:border-ink-faint"
                >
                  I already have an account — sign in
                </a>
                <p className="text-xs text-ink-faint text-center">
                  Use {invitedEmail} — the invite only works for that address.
                </p>
              </div>
            ) : signedInEmail !== invitedEmail ? (
              <div className="space-y-3">
                <p className="text-sm text-neg bg-[#fbeeea] rounded-lg px-4 py-3">
                  {`You're signed in as ${signedInEmail}, but this invite is for ${invitedEmail}.`}
                </p>
                <button
                  onClick={switchAccount}
                  className="w-full rounded-lg bg-forest text-paper text-sm font-medium px-4 py-2.5 hover:bg-forest-soft"
                >
                  Sign out and use {invitedEmail}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={join}
                  disabled={joining}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-forest text-paper text-sm font-medium px-4 py-2.5 hover:bg-forest-soft disabled:opacity-60"
                >
                  {joining && <Loader2 className="w-4 h-4 animate-spin" />}
                  Join {restaurantName}
                </button>
                {error && <p className="text-sm text-neg">{error}</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
