"use client";

import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowRight,
  Building2,
  ClipboardList,
  Lock,
  MailCheck,
  MapPin,
  ShieldAlert,
  Tags,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import BrandPanel, { BrandLockup } from "@/components/auth/BrandPanel";
import {
  AUTH_INPUT_CLASS,
  CheckIcon,
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
import { isValidEmail, safeNextPath } from "@/lib/team/invite-shared";

// /signup — the page sales emails, flyers and QR codes link to. It explains
// the product in a few seconds, then gets out of the way of the form.
// Account creation is the same Supabase email + password sign-up the app has
// always used; new accounts start on the trial plan (profiles.plan default).

const MIN_PASSWORD = 6; // Supabase Auth's configured minimum

const BENEFITS = [
  "Understand what customers mention most",
  "Discover recurring complaints before they become bigger problems",
  "Compare performance across multiple locations",
  "Give managers visibility into the insights that matter",
];

const STEPS = [
  { title: "Create your account", body: "Just your email and a password." },
  { title: "Connect your Google Business Profile", body: "Choose the locations you want to track." },
  { title: "See what your reviews are telling you", body: "Your last 90 days of reviews, analyzed and ranked." },
];

const DISCOVER = [
  {
    icon: Tags,
    title: "What's costing you stars",
    body: "Every review is sorted into food, service, atmosphere, value, wait time and cleanliness — then ranked by what guests mention most.",
  },
  {
    icon: MapPin,
    title: "Which location needs you first",
    body: "See every location side by side and spot the weak link on each category, instead of guessing from star averages.",
  },
  {
    icon: ShieldAlert,
    title: "What can't wait",
    body: "Reviews that mention health & safety, legal or discrimination concerns are flagged on their own, so they never get buried.",
  },
  {
    icon: ClipboardList,
    title: "What to do about it",
    body: "Weekly reports, draft SOPs and shift-meeting agendas built from what guests actually wrote.",
  },
];

const ACCESS = [
  "Your Google Business Profile locations",
  "Reviews written about your locations",
  "Basic Google account information needed to connect your account",
];

export default function SignupPage() {
  return (
    <Suspense>
      <SignupInner />
    </Suspense>
  );
}

type FieldErrors = Partial<Record<"email" | "password" | "confirmPassword", string>>;

function SignupInner() {
  const searchParams = useSearchParams();
  // Where to land after sign-up (e.g. back on a team invite) — same-site paths only.
  const next = safeNextPath(searchParams.get("next"));

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<React.ReactNode>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const submitting = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const busy = emailLoading || googleLoading;

  const loginHref = (withEmail?: string) => {
    const params = new URLSearchParams({
      ...(next ? { next } : {}),
      ...(withEmail ? { email: withEmail } : {}),
    });
    return `/login${params.size ? `?${params}` : ""}`;
  };

  function validate(): FieldErrors {
    const errs: FieldErrors = {};
    if (!email.trim()) errs.email = "Enter your email address.";
    else if (!isValidEmail(email.trim())) errs.email = "Enter a valid email address, like you@restaurant.com.";
    if (password.length < MIN_PASSWORD) errs.password = `Use at least ${MIN_PASSWORD} characters.`;
    if (!errs.password && confirmPassword !== password) errs.confirmPassword = "Passwords don't match.";
    return errs;
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    setError(null);
    const errs = validate();
    setFieldErrors(errs);
    const firstInvalid = (["email", "password", "confirmPassword"] as const).find((k) => errs[k]);
    if (firstInvalid) {
      formRef.current?.querySelector<HTMLInputElement>(`#${firstInvalid}`)?.focus();
      return;
    }

    submitting.current = true;
    setEmailLoading(true);
    const cleanEmail = email.trim();
    // Client created lazily — building the page must not require Supabase env
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: fullName.trim() ? { full_name: fullName.trim() } : undefined,
        emailRedirectTo: `${window.location.origin}/api/auth/callback${
          next ? `?next=${encodeURIComponent(next)}` : ""
        }`,
      },
    });
    if (error) {
      if (/already registered|already exists/i.test(error.message)) {
        setError(
          <>
            An account with this email already exists.{" "}
            <a href={loginHref(cleanEmail)} className="font-semibold underline underline-offset-2">
              Sign in instead
            </a>
            .
          </>
        );
      } else if (isNetworkError(error.message)) {
        setError(NETWORK_ERROR_MESSAGE);
      } else if (/rate limit/i.test(error.message)) {
        setError("Too many sign-up attempts right now. Please wait a minute and try again.");
      } else {
        setError(error.message);
      }
      setEmailLoading(false);
      submitting.current = false;
      return;
    }
    if (data.session) {
      // Email confirmation is off — the account is ready immediately
      window.location.assign(next ?? "/onboarding");
      return;
    }
    // Confirmation required — Supabase emailed a verify link
    setSentTo(cleanEmail);
    setEmailLoading(false);
    submitting.current = false;
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (error) {
      setError("Google sign-up is not available yet. Use email and password.");
      setGoogleLoading(false);
    }
  }

  function scrollTo(id: string, focusSelector?: string) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    if (focusSelector) {
      window.setTimeout(() => document.querySelector<HTMLElement>(focusSelector)?.focus({ preventScroll: true }), reduce ? 0 : 450);
    }
  }

  const clearFieldError = (k: keyof FieldErrors) =>
    setFieldErrors((prev) => (prev[k] ? { ...prev, [k]: undefined } : prev));

  return (
    <div className="bg-white">
      <div className="lg:grid lg:min-h-dvh lg:grid-cols-[11fr_9fr]">
        {/* ── Desktop marketing panel ── */}
        <BrandPanel
          footer={
            <div className="flex items-center justify-between gap-6">
              <span>© {new Date().getFullYear()} Reviews Analytics</span>
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-3 w-3" aria-hidden="true" />
                Read-only access to your Google reviews
              </span>
            </div>
          }
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-signal">
            Google review intelligence for restaurants
          </p>
          <h2 className="mt-5 font-heading text-[44px] xl:text-[52px] font-medium leading-[1.06] tracking-[-0.015em] text-white">
            Your customers are already telling you what to improve.
          </h2>
          <p className="mt-6 text-[17px] leading-relaxed text-zinc-400">
            Reviews Analytics turns your Google reviews into clear, actionable insights — so you can see what customers
            love, what frustrates them, and where each location can improve.
          </p>
          <ul className="mt-9 space-y-3.5">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-3 text-[15px] text-zinc-200">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-signal/15 text-signal">
                  <CheckIcon className="h-3 w-3" />
                </span>
                {b}
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
            <p className="max-w-[340px] text-sm leading-relaxed text-zinc-400">
              Turn thousands of individual reviews into decisions your team can actually use.
            </p>
            <button
              type="button"
              onClick={() => scrollTo("why")}
              data-track="signup_secondary_why"
              className="group inline-flex items-center gap-1.5 rounded text-sm font-medium text-zinc-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/60"
            >
              Why Reviews Analytics?
              <ArrowDown className="h-3.5 w-3.5 motion-safe:transition-transform group-hover:translate-y-0.5" />
            </button>
          </div>
        </BrandPanel>

        {/* ── Mobile / tablet: short value prop above the form ── */}
        <header className="bg-night px-5 pb-8 pt-6 sm:px-8 lg:hidden">
          <BrandLockup />
          <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-signal">
            Google review intelligence for restaurants
          </p>
          <p className="mt-3 max-w-xl font-heading text-[28px] sm:text-[34px] font-medium leading-[1.12] text-white">
            Your customers are already telling you what to improve.
          </p>
          <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-zinc-400">
            Turn your Google reviews into clear, actionable insights for every location.
          </p>
        </header>

        {/* ── Signup ── */}
        <main id="signup-form" className="flex flex-col px-5 py-8 sm:px-8 sm:py-12 lg:min-h-dvh lg:py-10 scroll-mt-4">
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-[400px] space-y-7">
              {sentTo ? (
                <div className="space-y-5 text-center" role="status">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-900">
                    <MailCheck className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="space-y-2">
                    <h1 className="font-heading text-[28px] font-semibold leading-tight tracking-tight text-zinc-950">
                      Check your inbox
                    </h1>
                    <p className="text-[15px] leading-relaxed text-zinc-600">
                      We sent a confirmation link to <strong className="text-zinc-900">{sentTo}</strong>. Open it to
                      finish creating your account — you&apos;ll go straight to connecting your Google Business
                      Profile.
                    </p>
                  </div>
                  <p className="text-sm text-zinc-500">
                    Nothing there after a few minutes? Check your spam folder, or{" "}
                    <button
                      type="button"
                      onClick={() => setSentTo(null)}
                      className="font-medium text-zinc-900 underline underline-offset-2"
                    >
                      try a different email
                    </button>
                    .
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <h1 className="font-heading text-[26px] sm:text-[30px] font-semibold leading-tight tracking-tight text-zinc-950">
                      Start your 30-day free trial
                    </h1>
                    <p className="text-[15px] leading-relaxed text-zinc-500">
                      Turn your Google reviews into actionable restaurant intelligence.
                    </p>
                  </div>

                  {error && <FormAlert>{error}</FormAlert>}

                  <form ref={formRef} onSubmit={handleSignUp} noValidate className="space-y-4">
                    <Field id="fullName" label="Your name" optional>
                      {(describedBy) => (
                        <Input
                          id="fullName"
                          type="text"
                          autoComplete="name"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Alex Rivera"
                          aria-describedby={describedBy}
                          disabled={busy}
                          className={AUTH_INPUT_CLASS}
                        />
                      )}
                    </Field>
                    <Field id="email" label="Email" error={fieldErrors.email}>
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
                          onChange={(e) => {
                            setEmail(e.target.value);
                            clearFieldError("email");
                          }}
                          placeholder="you@restaurant.com"
                          aria-describedby={describedBy}
                          aria-invalid={!!fieldErrors.email || undefined}
                          disabled={busy}
                          className={AUTH_INPUT_CLASS}
                        />
                      )}
                    </Field>
                    <Field
                      id="password"
                      label="Password"
                      hint={`At least ${MIN_PASSWORD} characters.`}
                      error={fieldErrors.password}
                    >
                      {(describedBy) => (
                        <PasswordInput
                          id="password"
                          value={password}
                          onChange={(v) => {
                            setPassword(v);
                            clearFieldError("password");
                          }}
                          autoComplete="new-password"
                          describedBy={describedBy}
                          invalid={!!fieldErrors.password}
                          disabled={busy}
                        />
                      )}
                    </Field>
                    <Field id="confirmPassword" label="Confirm password" error={fieldErrors.confirmPassword}>
                      {(describedBy) => (
                        <PasswordInput
                          id="confirmPassword"
                          value={confirmPassword}
                          onChange={(v) => {
                            setConfirmPassword(v);
                            clearFieldError("confirmPassword");
                          }}
                          autoComplete="new-password"
                          describedBy={describedBy}
                          invalid={!!fieldErrors.confirmPassword}
                          disabled={busy}
                        />
                      )}
                    </Field>
                    <button
                      type="submit"
                      id="signup_primary_cta"
                      data-track="signup_primary_cta"
                      disabled={busy}
                      aria-busy={emailLoading}
                      className={`${PRIMARY_BUTTON_CLASS} mt-2`}
                    >
                      {emailLoading ? (
                        <Spinner label="Creating your account…" />
                      ) : (
                        <>
                          Start My Free Trial
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </>
                      )}
                    </button>
                  </form>

                  {GOOGLE_SIGN_IN_ENABLED && (
                    <GoogleButton
                      onClick={handleGoogle}
                      loading={googleLoading}
                      disabled={busy}
                      track="signup_google_connect"
                    />
                  )}

                  <p className="text-center text-sm text-zinc-600">
                    Already have an account?{" "}
                    <a
                      href={loginHref()}
                      id="signup_to_login"
                      data-track="signup_to_login"
                      className="group inline-flex items-center gap-1 rounded font-semibold text-zinc-950 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20"
                    >
                      Sign in
                      <ArrowRight className="h-3.5 w-3.5 motion-safe:transition-transform group-hover:translate-x-0.5" />
                    </a>
                  </p>

                  <ol className="space-y-3 border-t border-zinc-100 pt-6" aria-label="How getting started works">
                    {STEPS.map((s, i) => (
                      <li key={s.title} className="flex items-start gap-3">
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-[11px] font-semibold text-zinc-700 tabular-nums"
                          aria-hidden="true"
                        >
                          {i + 1}
                        </span>
                        <div>
                          <p className="text-sm font-medium text-zinc-900">{s.title}</p>
                          <p className="text-[13px] text-zinc-500">{s.body}</p>
                        </div>
                      </li>
                    ))}
                  </ol>

                  <LegalNote action="creating an account" />
                </>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* ── Why Reviews Analytics (secondary CTA target; benefits + trust on mobile) ── */}
      <section id="why" aria-labelledby="why-title" className="scroll-mt-0 border-t border-zinc-100 bg-zinc-50">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 lg:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-signal-ink">Why Reviews Analytics</p>
            <h2 id="why-title" className="mt-3 font-heading text-[28px] sm:text-[34px] font-semibold leading-tight tracking-tight text-zinc-950">
              See what your reviews have been trying to tell you.
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-zinc-600">
              Reviews Analytics reads your locations&apos; Google reviews from the last 90 days and turns them into a short,
              ranked list of what to protect and what to fix.
            </p>
          </div>

          {/* The desktop panel already lists these; repeat them here for phones. */}
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:hidden">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-[15px] text-zinc-800">
                <CheckIcon className="mt-0.5 text-signal-ink" />
                {b}
              </li>
            ))}
          </ul>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {DISCOVER.map((d) => (
              <div key={d.title} className="rounded-2xl border border-zinc-200 bg-white p-5">
                <d.icon className="h-5 w-5 text-signal-ink" aria-hidden="true" />
                <h3 className="mt-4 text-[15px] font-semibold text-zinc-950">{d.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{d.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
              <div className="flex items-center gap-2.5">
                <Building2 className="h-5 w-5 text-signal-ink" aria-hidden="true" />
                <h3 className="text-[15px] font-semibold text-zinc-950">One restaurant or fifty locations</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                Understand each location on its own, or see the bigger picture across your whole group — which location
                is the weak link, and on what.
              </p>
              <div className="mt-4 flex items-start gap-2.5 border-t border-zinc-100 pt-4">
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-signal-ink" aria-hidden="true" />
                <p className="text-sm leading-relaxed text-zinc-600">
                  Invite your managers and partners at no extra cost — everyone signs in with their own login and works
                  from the same insights.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6">
              <div className="flex items-center gap-2.5">
                <Lock className="h-5 w-5 text-signal-ink" aria-hidden="true" />
                <h3 className="text-[15px] font-semibold text-zinc-950">What we access</h3>
              </div>
              <ul className="mt-3 space-y-2">
                {ACCESS.map((a) => (
                  <li key={a} className="flex items-start gap-2.5 text-sm text-zinc-700">
                    <CheckIcon className="mt-0.5 text-signal-ink" />
                    {a}
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-zinc-100 pt-4 text-sm leading-relaxed text-zinc-600">
                Your reviews stay exactly where they are. Reviews Analytics only reads the data needed to generate your
                insights — it never posts, replies to, or changes anything on Google.
              </p>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center gap-3 text-center">
            <button
              type="button"
              onClick={() => scrollTo("signup-form", sentTo ? undefined : "#email")}
              data-track="signup_bottom_cta"
              className={`${PRIMARY_BUTTON_CLASS} sm:w-auto sm:px-8`}
            >
              Start My Free Trial
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <p className="text-sm text-zinc-500">30-day free trial · Read-only access to your Google reviews</p>
          </div>
        </div>
      </section>
    </div>
  );
}
