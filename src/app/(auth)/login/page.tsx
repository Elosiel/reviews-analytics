"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleGoogleSignIn() {
    setLoading(true);
    await supabase.auth.signInWithOAuth({
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
    // No need to setLoading(false) — page will redirect
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-zinc-950 flex-col justify-between p-12">
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold text-lg tracking-tight">
            Reviews Analytics
          </span>
        </div>

        <div className="space-y-6">
          <blockquote className="space-y-3">
            <p className="text-zinc-200 text-2xl font-medium leading-relaxed">
              "The reviews already tell you what to fix.{" "}
              <span className="text-white">
                You just can't see it through the noise.
              </span>
              "
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
          © {new Date().getFullYear()} Reviews Analytics. Read-only access to
          your Google Business Profile. We never post on your behalf.
        </p>
      </div>

      {/* Right panel — sign in form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 bg-white">
        <div className="w-full max-w-sm space-y-8">
          {/* Logo (mobile only) */}
          <div className="lg:hidden text-center">
            <span className="font-semibold text-xl tracking-tight">
              Reviews Analytics
            </span>
          </div>

          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Sign in to your dashboard
            </h1>
            <p className="text-sm text-zinc-500">
              Access your restaurant sentiment intelligence
            </p>
          </div>

          <div className="space-y-4">
            <Button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full h-11 bg-zinc-900 hover:bg-zinc-800 text-white font-medium gap-3"
            >
              {loading ? (
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
                  Signing in…
                </span>
              ) : (
                <>
                  <GoogleIcon />
                  Continue with Google
                </>
              )}
            </Button>
          </div>

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
              We never post, reply, or modify anything on your behalf.
            </p>
          </div>

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
