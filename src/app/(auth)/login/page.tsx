"use client";

import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import BrandPanel, { BrandLockup } from "@/components/auth/BrandPanel";
import {
  AUTH_INPUT_CLASS,
  Field,
  FormAlert,
  GOOGLE_SIGN_IN_ENABLED,
  GoogleButton,
  isNetworkError,
  LegalNote,
  NETWORK_ERROR_MESSAGE,
  PasswordInput,
  PRIMARY_BUTTON_CLASS,
  Spinner,
} from "@/components/auth/auth-ui";
import { safeNextPath } from "@/lib/team/invite-shared";

// /login is for existing customers only. New accounts are created on
// /signup; the middleware forwards old /login?mode=signup links there.

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}

const STATS = [
  { stat: "93%", label: "of diners read reviews before visiting" },
  { stat: "5–9%", label: "revenue lift per additional star (Harvard Business School)" },
];

function LoginInner() {
  const searchParams = useSearchParams();
  // Where to land after auth (e.g. back on a team invite) — same-site paths only.
  const next = safeNextPath(searchParams.get("next"));
  const prefillEmail = searchParams.get("email") ?? "";

  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "auth_failed" ? "Sign-in failed. Please try again." : null
  );
  // Guards against a double submit before React re-renders the disabled button.
  const submitting = useRef(false);
  const busy = emailLoading || googleLoading;

  const signupHref = `/signup${
    next || prefillEmail
      ? `?${new URLSearchParams({ ...(next ? { next } : {}), ...(prefillEmail ? { email: prefillEmail } : {}) })}`
      : ""
  }`;

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setError(null);
    setEmailLoading(true);
    // Client created lazily — building the page must not require Supabase env
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "That email and password don't match an account. Check them and try again."
          : error.message === "Email not confirmed"
            ? "Please confirm your email first — open the confirmation link we sent you, then sign in."
            : isNetworkError(error.message)
              ? NETWORK_ERROR_MESSAGE
              : error.message
      );
      setEmailLoading(false);
      submitting.current = false;
      return;
    }
    // Full navigation so the middleware picks up the new session cookies
    window.location.assign(next ?? "/dashboard");
  }

  async function handleGoogleSignIn() {
    setError(null);
    setGoogleLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
        // Request offline access so Supabase can refresh the session
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) {
      setError("Google sign-in is not available yet. Use email and password.");
      setGoogleLoading(false);
    }
    // On success the page redirects — no need to reset loading
  }

  return (
    <div className="min-h-dvh grid lg:grid-cols-2 bg-white">
      <BrandPanel
        footer={
          <>
            © {new Date().getFullYear()} Reviews Analytics · Read-only access to your Google Business Profile — your
            reviews stay in your hands.
          </>
        }
      >
        <figure className="space-y-10">
          <blockquote>
            <p className="font-heading text-[34px] xl:text-[40px] leading-[1.15] font-medium tracking-[-0.01em] text-zinc-300">
              &ldquo;The reviews already tell you what to fix.{" "}
              <span className="text-white">You just can&apos;t see it through the noise.</span>&rdquo;
            </p>
          </blockquote>
          <dl className="grid grid-cols-2 gap-8 border-t border-white/10 pt-8">
            {STATS.map((s) => (
              <div key={s.stat} className="space-y-2">
                <dt className="sr-only">{s.label}</dt>
                <dd className="text-[32px] font-semibold leading-none tracking-tight text-signal tabular-nums">
                  {s.stat}
                </dd>
                <dd className="text-sm leading-relaxed text-zinc-400">{s.label}</dd>
              </div>
            ))}
          </dl>
        </figure>
      </BrandPanel>

      <main className="flex min-h-dvh flex-col px-5 py-8 sm:px-8 lg:min-h-0 lg:py-10">
        <div className="lg:hidden flex justify-center pt-2 pb-10">
          <BrandLockup tone="light" />
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-[380px] space-y-8">
            <div className="space-y-2 text-center">
              <h1 className="font-heading text-[28px] font-semibold leading-tight tracking-tight text-zinc-950">
                Sign in to your dashboard
              </h1>
              <p className="text-[15px] text-zinc-500">Access your restaurant sentiment intelligence</p>
            </div>

            {error && <FormAlert>{error}</FormAlert>}

            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <Field id="email" label="Email">
                {(describedBy) => (
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@restaurant.com"
                    aria-describedby={describedBy}
                    disabled={busy}
                    className={AUTH_INPUT_CLASS}
                  />
                )}
              </Field>
              <Field id="password" label="Password">
                {(describedBy) => (
                  <PasswordInput
                    id="password"
                    value={password}
                    onChange={setPassword}
                    autoComplete="current-password"
                    describedBy={describedBy}
                    disabled={busy}
                  />
                )}
              </Field>
              <button
                type="submit"
                id="login_submit"
                data-track="login_submit"
                disabled={busy}
                aria-busy={emailLoading}
                className={PRIMARY_BUTTON_CLASS}
              >
                {emailLoading ? <Spinner label="Signing in…" /> : "Sign in"}
              </button>
            </form>

            {GOOGLE_SIGN_IN_ENABLED && (
              <GoogleButton
                onClick={handleGoogleSignIn}
                loading={googleLoading}
                disabled={busy}
                track="login_google"
              />
            )}

            <div className="rounded-xl border border-zinc-100 bg-zinc-50/70 px-5 py-4 text-center">
              <p className="text-sm text-zinc-600">Don&apos;t have an account?</p>
              <a
                href={signupHref}
                id="login_to_signup_cta"
                data-track="login_to_signup_cta"
                className="group mt-1 inline-flex items-center gap-1.5 rounded text-sm font-semibold text-zinc-950 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20"
              >
                Start your free trial
                <ArrowRight className="h-3.5 w-3.5 motion-safe:transition-transform group-hover:translate-x-0.5" />
              </a>
            </div>

            <LegalNote action="signing in" />
          </div>
        </div>
      </main>
    </div>
  );
}
