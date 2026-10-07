"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Shared building blocks for /login and /signup. Auth logic stays in each
// page; these only render.

// Supabase's Google auth provider isn't enabled, so the button dead-ends on a
// raw "provider is not enabled" error. Hidden until the provider is set up.
// This is app sign-in only — connecting Google Business Profile happens in
// onboarding (/api/google/*) and is unaffected.
export const GOOGLE_SIGN_IN_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_SIGN_IN_ENABLED === "true";

/** Raw network failures ("Failed to fetch") aren't something to show a customer. */
export function isNetworkError(message: string): boolean {
  return /failed to fetch|network|fetch failed|load failed/i.test(message);
}
export const NETWORK_ERROR_MESSAGE = "We couldn't reach Reviews Analytics. Check your connection and try again.";

export const AUTH_INPUT_CLASS =
  "h-11 rounded-lg border-zinc-200 bg-white px-3.5 text-[15px] text-zinc-900 placeholder:text-zinc-400 " +
  "motion-safe:transition-[border-color,box-shadow] hover:border-zinc-300 " +
  "focus-visible:border-zinc-900 focus-visible:ring-4 focus-visible:ring-zinc-900/10 " +
  "aria-invalid:border-neg aria-invalid:ring-neg/15";

export const PRIMARY_BUTTON_CLASS =
  "inline-flex w-full h-12 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-5 text-[15px] font-semibold text-white " +
  "shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_8px_20px_-8px_rgba(9,9,11,0.45)] " +
  "motion-safe:transition-[background-color,box-shadow,transform] hover:bg-zinc-800 " +
  "active:translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-zinc-900/20 focus-visible:ring-offset-2 " +
  "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-zinc-950";

export function Field({
  id,
  label,
  hint,
  error,
  optional,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  optional?: boolean;
  children: (describedBy: string | undefined) => React.ReactNode;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-baseline justify-between text-[13px] font-medium text-zinc-800">
        {label}
        {optional && <span className="text-xs font-normal text-zinc-400">Optional</span>}
      </label>
      {children(describedBy)}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-[13px] text-neg">
          <span aria-hidden="true" className="font-semibold">!</span>
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-zinc-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  describedBy,
  invalid,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={shown ? "text" : "password"}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={describedBy}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        className={cn(AUTH_INPUT_CLASS, "pr-11")}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Hide password" : "Show password"}
        aria-pressed={shown}
        aria-controls={id}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-zinc-400 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-900/30"
      >
        {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

/** Form-level message. role="alert" so screen readers announce it. */
export function FormAlert({ children, tone = "error" }: { children: React.ReactNode; tone?: "error" | "info" }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-4 py-3 text-sm leading-relaxed",
        tone === "error" ? "border-neg/25 bg-[#fbeeea] text-[#7a1f13]" : "border-zinc-200 bg-zinc-50 text-zinc-700"
      )}
    >
      {children}
    </div>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-2">
      <svg className="h-4 w-4 animate-spin motion-reduce:animate-none" fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      {label}
    </span>
  );
}

export function GoogleButton({
  onClick,
  loading,
  disabled,
  track,
}: {
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
  track: string;
}) {
  return (
    <>
      <div className="flex items-center gap-3" aria-hidden="true">
        <div className="h-px flex-1 bg-zinc-100" />
        <span className="text-xs text-zinc-400">or</span>
        <div className="h-px flex-1 bg-zinc-100" />
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        data-track={track}
        className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-zinc-200 bg-white text-sm font-medium text-zinc-900 motion-safe:transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-zinc-900/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <Spinner label="Connecting to Google…" />
        ) : (
          <>
            <GoogleIcon />
            Continue with Google
          </>
        )}
      </button>
    </>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("h-4 w-4 shrink-0", className)} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function LegalNote({ action }: { action: "signing in" | "creating an account" }) {
  return (
    <p className="text-center text-xs leading-relaxed text-zinc-500">
      {`By ${action} you agree to our `}
      <a href="https://reviewsanalytics.ai/terms" className="underline underline-offset-2 hover:text-zinc-800">
        Terms
      </a>
      {" and "}
      <a href="https://reviewsanalytics.ai/privacy" className="underline underline-offset-2 hover:text-zinc-800">
        Privacy Policy
      </a>
      .
    </p>
  );
}
