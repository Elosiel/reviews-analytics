"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { KeyRound, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import LogoMark from "@/components/shared/LogoMark";
import { Spinner } from "@/components/auth/auth-ui";

// Super Admin sign-in: email + password (Supabase Auth), then a mandatory
// authenticator-app code. First sign-in enrolls the authenticator. Access is
// decided server-side (/api/super-admin/me, the console layout and every
// admin API) — this page only drives the steps.

type Step = "password" | "checking" | "enroll" | "challenge" | "denied";

export default function SuperAdminLoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const params = useSearchParams();
  const [step, setStep] = useState<Step>(params.get("step") === "mfa" ? "checking" : "password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);

  const prepareMfa = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      setError("Couldn't load two-factor settings. Try again.");
      setStep("password");
      return;
    }
    const verified = data.totp.find((f) => f.status === "verified");
    if (verified) {
      setFactorId(verified.id);
      setStep("challenge");
      return;
    }
    // Clear any half-finished enrollment, then start a fresh one.
    for (const f of data.all.filter((f) => f.factor_type === "totp" && f.status !== "verified")) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
    const enrolled = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Reviews Analytics admin" });
    if (enrolled.error || !enrolled.data) {
      setError(
        enrolled.error?.message?.includes("disabled")
          ? "Authenticator (TOTP) two-factor is turned off for this Supabase project. Enable it under Authentication → Multi-Factor, then try again."
          : "Couldn't start two-factor setup. Try again."
      );
      setStep("password");
      return;
    }
    setFactorId(enrolled.data.id);
    setQr(enrolled.data.totp.qr_code);
    setSecret(enrolled.data.totp.secret);
    setStep("enroll");
  }, []);

  const routeByStatus = useCallback(async () => {
    setStep("checking");
    const res = await fetch("/api/super-admin/me", { cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (data.status === "ok") {
      window.location.assign("/super-admin");
    } else if (data.status === "mfa_required") {
      await prepareMfa();
    } else if (data.status === "forbidden") {
      await createClient().auth.signOut();
      setStep("denied");
    } else {
      setStep("password");
    }
  }, [prepareMfa]);

  useEffect(() => {
    // Arrived signed-in but without two-factor (redirected from the console).
    // Deferred so the state updates don't run synchronously inside the effect.
    if (params.get("step") === "mfa") void Promise.resolve().then(routeByStatus);
  }, [params, routeByStatus]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
    setPassword("");
    if (error) {
      setError(error.message === "Invalid login credentials" ? "Email or password is incorrect." : error.message);
      setBusy(false);
      submitting.current = false;
      return;
    }
    await routeByStatus();
    setBusy(false);
    submitting.current = false;
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.mfa.challengeAndVerify({ factorId, code: code.trim() });
    if (error) {
      setError("That code didn't work. Codes change every 30 seconds — try the current one.");
      setBusy(false);
      submitting.current = false;
      return;
    }
    window.location.assign("/super-admin");
  }

  return (
    <div className="min-h-dvh bg-night flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-[400px]">
        <div className="flex items-center gap-2.5 mb-8">
          <LogoMark className="h-8 w-8" />
          <div>
            <p className="text-[15px] font-semibold text-white leading-tight">Reviews Analytics</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-signal">Admin console</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 space-y-5">
          {error && (
            <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-200">
              {error}
            </p>
          )}

          {step === "password" && (
            <form onSubmit={signIn} className="space-y-4">
              <div>
                <h1 className="text-lg font-semibold text-white">Sign in</h1>
                <p className="text-sm text-zinc-400 mt-1">Internal access for the Reviews Analytics team.</p>
              </div>
              <AdminField label="Email" id="admin-email">
                <input
                  id="admin-email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="admin-input"
                />
              </AdminField>
              <AdminField label="Password" id="admin-password">
                <input
                  id="admin-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="admin-input"
                />
              </AdminField>
              <SubmitButton busy={busy} label="Continue" busyLabel="Signing in…" />
            </form>
          )}

          {step === "checking" && (
            <div className="flex items-center gap-2 text-sm text-zinc-300">
              <Spinner label="Checking access…" />
            </div>
          )}

          {step === "enroll" && (
            <form onSubmit={verify} className="space-y-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-signal shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h1 className="text-lg font-semibold text-white">Set up two-factor authentication</h1>
                  <p className="text-sm text-zinc-400 mt-1">
                    Required for admin access. Scan this with an authenticator app (1Password, Google Authenticator,
                    Authy…), then enter the 6-digit code.
                  </p>
                </div>
              </div>
              {qr && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="Two-factor QR code" className="mx-auto h-44 w-44 rounded-lg bg-white p-2" />
              )}
              {secret && (
                <p className="text-center text-xs text-zinc-400">
                  Can&apos;t scan? Enter this key: <code className="text-zinc-200 break-all">{secret}</code>
                </p>
              )}
              <CodeInput value={code} onChange={setCode} />
              <SubmitButton busy={busy} label="Verify and continue" busyLabel="Verifying…" />
            </form>
          )}

          {step === "challenge" && (
            <form onSubmit={verify} className="space-y-4">
              <div className="flex items-start gap-3">
                <KeyRound className="h-5 w-5 text-signal shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h1 className="text-lg font-semibold text-white">Two-factor code</h1>
                  <p className="text-sm text-zinc-400 mt-1">Enter the 6-digit code from your authenticator app.</p>
                </div>
              </div>
              <CodeInput value={code} onChange={setCode} />
              <SubmitButton busy={busy} label="Verify" busyLabel="Verifying…" />
            </form>
          )}

          {step === "denied" && (
            <div className="space-y-3">
              <h1 className="text-lg font-semibold text-white">No admin access</h1>
              <p className="text-sm text-zinc-400">
                This account doesn&apos;t have Reviews Analytics admin access. You&apos;ve been signed out of the admin
                console.
              </p>
              <a href="/login" className="inline-block text-sm font-medium text-signal hover:underline">
                Go to the customer sign-in →
              </a>
            </div>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-zinc-500">Access is logged. Every admin action is audited.</p>
      </div>
    </div>
  );
}

function AdminField({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-zinc-300">
        {label}
      </label>
      {children}
    </div>
  );
}

function CodeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <AdminField label="6-digit code" id="admin-code">
      <input
        id="admin-code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        className="admin-input text-center text-lg tracking-[0.5em] tabular-nums"
      />
    </AdminField>
  );
}

function SubmitButton({ busy, label, busyLabel }: { busy: boolean; label: string; busyLabel: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="w-full h-11 rounded-lg bg-signal text-night text-sm font-semibold hover:bg-[#6ff0f5] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-signal/30 disabled:opacity-60 motion-safe:transition-colors"
    >
      {busy ? <span className="inline-flex justify-center w-full"><Spinner label={busyLabel} /></span> : label}
    </button>
  );
}
