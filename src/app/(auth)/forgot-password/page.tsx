"use client";

import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, MailCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { BrandLockup } from "@/components/auth/BrandPanel";
import { AUTH_INPUT_CLASS, Field, FormAlert, PRIMARY_BUTTON_CLASS, Spinner } from "@/components/auth/auth-ui";

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotInner />
    </Suspense>
  );
}

function ForgotInner() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/api/auth/callback?next=/reset-password`,
    });
    setBusy(false);
    submitting.current = false;
    // Same message whether or not the account exists — no account probing.
    if (error && /rate limit/i.test(error.message)) {
      setError("Too many requests right now. Please wait a minute and try again.");
      return;
    }
    setSent(true);
  }

  return (
    <div className="min-h-dvh bg-white flex flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-[380px] space-y-8">
        <div className="flex justify-center"><BrandLockup tone="light" /></div>
        {sent ? (
          <div className="space-y-4 text-center" role="status">
            <MailCheck className="mx-auto h-10 w-10 text-zinc-900" aria-hidden="true" />
            <h1 className="font-heading text-[26px] font-semibold text-zinc-950">Check your inbox</h1>
            <p className="text-[15px] text-zinc-600">
              If an account exists for <strong className="text-zinc-900">{email}</strong>, we sent a link to set a new password.
              Open it in this browser.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-2 text-center">
              <h1 className="font-heading text-[28px] font-semibold text-zinc-950">Reset your password</h1>
              <p className="text-[15px] text-zinc-500">We&apos;ll email you a link to choose a new one.</p>
            </div>
            {error && <FormAlert>{error}</FormAlert>}
            <form onSubmit={submit} className="space-y-4">
              <Field id="email" label="Email">
                {(describedBy) => (
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@restaurant.com"
                    aria-describedby={describedBy}
                    className={AUTH_INPUT_CLASS}
                  />
                )}
              </Field>
              <button type="submit" disabled={busy} className={PRIMARY_BUTTON_CLASS}>
                {busy ? <Spinner label="Sending…" /> : "Send reset link"}
              </button>
            </form>
          </>
        )}
        <a href="/login" className="flex items-center justify-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-950">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /> Back to sign in
        </a>
      </div>
    </div>
  );
}
