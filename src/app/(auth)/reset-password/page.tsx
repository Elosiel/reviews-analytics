"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { BrandLockup } from "@/components/auth/BrandPanel";
import { Field, FormAlert, PasswordInput, PRIMARY_BUTTON_CLASS, Spinner } from "@/components/auth/auth-ui";

const MIN_PASSWORD = 6;

// Where both password-reset links land:
//   - "Forgot password?" (PKCE): /api/auth/callback exchanged the code, so a
//     recovery session already exists.
//   - A reset an admin triggered from the console: Supabase redirects here
//     with the recovery tokens in the URL fragment; we turn them into a session.
// Either way the user — and only the user — picks the new password.
export default function ResetPasswordPage() {
  const [ready, setReady] = useState<"checking" | "ok" | "invalid">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const access_token = hash.get("access_token");
      const refresh_token = hash.get("refresh_token");
      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
        // Don't leave tokens in the address bar / history.
        window.history.replaceState(null, "", window.location.pathname);
      }
      const { data } = await supabase.auth.getUser();
      setReady(data.user ? "ok" : "invalid");
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    if (password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters.`);
    if (password !== confirm) return setError("Passwords don't match.");
    submitting.current = true;
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    submitting.current = false;
    if (error) {
      setError(/different from the old/i.test(error.message) ? "Choose a password you haven't used before." : error.message);
      return;
    }
    setDone(true);
  }

  return (
    <div className="min-h-dvh bg-white flex flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-[380px] space-y-8">
        <div className="flex justify-center"><BrandLockup tone="light" /></div>
        {ready === "checking" && <div className="flex justify-center text-zinc-600"><Spinner label="Checking your link…" /></div>}
        {ready === "invalid" && (
          <div className="space-y-3 text-center">
            <h1 className="font-heading text-[26px] font-semibold text-zinc-950">This link has expired</h1>
            <p className="text-[15px] text-zinc-600">Reset links work once and for a limited time.</p>
            <a href="/forgot-password" className="inline-block text-sm font-semibold text-zinc-950 underline underline-offset-4">Send a new link</a>
          </div>
        )}
        {ready === "ok" && done && (
          <div className="space-y-4 text-center" role="status">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden="true" />
            <h1 className="font-heading text-[26px] font-semibold text-zinc-950">Password updated</h1>
            <a href="/dashboard" className={PRIMARY_BUTTON_CLASS}>Go to your dashboard</a>
          </div>
        )}
        {ready === "ok" && !done && (
          <>
            <div className="space-y-2 text-center">
              <h1 className="font-heading text-[28px] font-semibold text-zinc-950">Choose a new password</h1>
            </div>
            {error && <FormAlert>{error}</FormAlert>}
            <form onSubmit={submit} className="space-y-4">
              <Field id="password" label="New password" hint={`At least ${MIN_PASSWORD} characters.`}>
                {(d) => <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="new-password" describedBy={d} />}
              </Field>
              <Field id="confirm" label="Confirm new password">
                {(d) => <PasswordInput id="confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" describedBy={d} />}
              </Field>
              <button type="submit" disabled={busy} className={PRIMARY_BUTTON_CLASS}>
                {busy ? <Spinner label="Saving…" /> : "Save new password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
