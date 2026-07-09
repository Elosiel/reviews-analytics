"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import LogoMark from "@/components/shared/LogoMark";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [signupSent, setSignupSent] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get("error") === "auth_failed"
      ? "Sign-in failed. Please try again."
      : null
  );

  function toggleMode() {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    setError(null);
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEmailLoading(true);
    // Client created lazily — building the page must not require Supabase env
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setError(
        error.message === "Invalid login credentials"
          ? "Invalid email or password."
          : error.message
      );
      setEmailLoading(false);
      return;
    }
    // Full navigation so the middleware picks up the new session cookies
    window.location.assign("/dashboard");
  }

  async function handleEmailSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setEmailLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: fullName ? { full_name: fullName } : undefined,
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setEmailLoading(false);
      return;
    }
    if (data.session) {
      // Email confirmation is off — the account is ready immediately
      window.location.assign("/onboarding");
      return;
    }
    // Confirmation required — Supabase emailed a verify link
    setSignupSent(true);
    setEmailLoading(false);
  }

  async function handleGoogleSignIn() {
    setError(null);
    setGoogleLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
        queryParams: {
          // Request offline access so Supabase can refresh the session
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
    if (error) {
      setError("Google sign-in is not available yet. Use email and password.");
      setGoogleLoading(false);
    }
    // On success the page redirects — no need to reset loading
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-zinc-950 flex-col justify-between p-12">
        <div className="flex items-center gap-2.5">
          <LogoMark className="w-8 h-8" />
          <span className="text-white font-semibold text-lg tracking-tight">
            Reviews Analytics
          </span>
        </div>

        <div className="space-y-6">
          <blockquote className="space-y-3">
            <p className="text-zinc-200 text-2xl font-medium leading-relaxed">
              &ldquo;The reviews already tell you what to fix.{" "}
              <span className="text-white">
                You just can&apos;t see it through the noise.
              </span>
              &rdquo;
            </p>
          </blockquote>

          <div className="space-y-4">
            {[
              { stat: "93%", label: "of diners read reviews before visiting" },
              { stat: "61%", label: "chance a service issue causes a 1–2★ review" },
              { stat: "5–9%", label: "revenue lift per additional star (HBS)" },
            ].map((item) => (
              <div key={item.stat} className="flex items-center gap-4">
                <span className="text-emerald-400 font-bold text-xl w-16 shrink-0">
                  {item.stat}
                </span>
                <span className="text-zinc-400 text-sm">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-zinc-600 text-xs">
          © {new Date().getFullYear()} Reviews Analytics. Secure access to
          your Google Business Profile — your reviews stay in your hands.
        </p>
      </div>

      {/* Right panel — sign in form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-sm space-y-8">
          {/* Logo (mobile only) */}
          <div className="lg:hidden flex items-center justify-center gap-2.5">
            <LogoMark className="w-7 h-7" />
            <span className="font-semibold text-xl tracking-tight">
              Reviews Analytics
            </span>
          </div>

          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              {mode === "signin" ? "Sign in to your dashboard" : "Create your account"}
            </h1>
            <p className="text-sm text-zinc-500">
              {mode === "signin"
                ? "Access your restaurant sentiment intelligence"
                : "Start tracking what's costing you stars"}
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
              {error}
            </p>
          )}

          {signupSent ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-zinc-600 bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3">
                Check <strong>{email}</strong> for a confirmation link to finish creating your account.
              </p>
              <button
                onClick={() => {
                  setSignupSent(false);
                  setMode("signin");
                }}
                className="text-sm text-zinc-500 underline underline-offset-2 hover:text-zinc-700"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              {/* Email + password */}
              <form
                onSubmit={mode === "signin" ? handleEmailSignIn : handleEmailSignUp}
                className="space-y-3"
              >
                {mode === "signup" && (
                  <div className="space-y-1.5">
                    <label htmlFor="fullName" className="text-xs font-medium text-zinc-700">
                      Name
                    </label>
                    <Input
                      id="fullName"
                      type="text"
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your name"
                      className="h-11"
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <label
                    htmlFor="email"
                    className="text-xs font-medium text-zinc-700"
                  >
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@restaurant.com"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="password"
                    className="text-xs font-medium text-zinc-700"
                  >
                    Password
                  </label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-11"
                  />
                </div>
                {mode === "signup" && (
                  <div className="space-y-1.5">
                    <label htmlFor="confirmPassword" className="text-xs font-medium text-zinc-700">
                      Confirm password
                    </label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-11"
                    />
                  </div>
                )}
                <Button
                  type="submit"
                  disabled={emailLoading || googleLoading}
                  className="w-full h-11 bg-zinc-900 hover:bg-zinc-800 text-white font-medium"
                >
                  {emailLoading ? (
                    <Spinner label={mode === "signin" ? "Signing in…" : "Creating account…"} />
                  ) : mode === "signin" ? (
                    "Sign in"
                  ) : (
                    "Create account"
                  )}
                </Button>
              </form>

              <p className="text-center text-sm text-zinc-500">
                {mode === "signin" ? "Don't have an account?" : "Already have an account?"}{" "}
                <button
                  type="button"
                  onClick={toggleMode}
                  className="font-medium text-zinc-900 underline underline-offset-2 hover:text-zinc-700"
                >
                  {mode === "signin" ? "Sign up" : "Sign in"}
                </button>
              </p>
            </>
          )}

          {!signupSent && (
            <>
              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-zinc-100" />
                <span className="text-xs text-zinc-400">or</span>
                <div className="h-px flex-1 bg-zinc-100" />
              </div>

              <Button
                onClick={handleGoogleSignIn}
                disabled={googleLoading || emailLoading}
                variant="outline"
                className="w-full h-11 font-medium gap-3"
              >
                {googleLoading ? (
                  <Spinner label="Signing in…" />
                ) : (
                  <>
                    <GoogleIcon />
                    Continue with Google
                  </>
                )}
              </Button>

              <div className="space-y-3 rounded-lg bg-zinc-50 border border-zinc-100 p-4">
                <p className="text-xs font-medium text-zinc-700">
                  What we access
                </p>
                <ul className="space-y-1.5">
                  {[
                    "Your Google Business Profile locations",
                    "Reviews written about your locations",
                    "Basic Google account info (name, email)",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2 text-xs text-zinc-500">
                      <svg
                        className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-zinc-400 pt-1 border-t border-zinc-100">
                  Your reviews stay exactly as they are — we read them to power
                  your insights.
                </p>
              </div>
            </>
          )}

          <p className="text-center text-xs text-zinc-400">
            By signing in you agree to our{" "}
            <a href="https://reviewsanalytics.ai/terms" className="underline hover:text-zinc-600">
              Terms
            </a>{" "}
            and{" "}
            <a href="https://reviewsanalytics.ai/privacy" className="underline hover:text-zinc-600">
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-2">
      <svg
        className="animate-spin h-4 w-4"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      {label}
    </span>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}
