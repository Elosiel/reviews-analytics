"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, KeyRound, LogOut, ShieldOff, ShieldCheck } from "lucide-react";
import { Spinner } from "@/components/auth/auth-ui";
import { buttonClass, inputClass, secondaryButtonClass } from "@/components/admin/ui";
import { FEEDBACK_PRIORITIES, FEEDBACK_STATUSES } from "@/lib/telemetry/sanitize";

// Client controls for admin actions. They only call /api/super-admin/*,
// which re-verifies the admin (session + role + 2FA) on every request and
// writes the audit log. Nothing here is trusted on its own.

async function post(url: string, body: object, method = "POST"): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const running = useRef(false);
  async function run(fn: () => Promise<{ ok: boolean; data: Record<string, unknown> }>, success?: string) {
    if (running.current) return false;
    running.current = true;
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const r = await fn();
      if (!r.ok) {
        setError(String(r.data.error ?? "Something went wrong."));
        return false;
      }
      if (success) setDone(success);
      router.refresh();
      return true;
    } catch {
      setError("Network error — try again.");
      return false;
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return { busy, error, done, run };
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true" aria-label={title} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-base font-semibold text-zinc-950">{title}</h2>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

export function NoteForm({ url, placeholder = "Internal note — only admins see this" }: { url: string; placeholder?: string }) {
  const [note, setNote] = useState("");
  const { busy, error, run } = useAction();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (await run(() => post(url, { note }))) setNote("");
      }}
      className="space-y-2"
    >
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={placeholder}
        maxLength={5000}
        rows={3}
        required
        aria-label="Internal note"
        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus-visible:border-zinc-900 focus-visible:ring-4 focus-visible:ring-zinc-900/10"
      />
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
      <button disabled={busy || !note.trim()} className={buttonClass}>
        {busy ? <Spinner label="Saving…" /> : "Add note"}
      </button>
    </form>
  );
}

export function InternalToggle({ tenantId, isInternal }: { tenantId: string; isInternal: boolean }) {
  const { busy, error, run } = useAction();
  return (
    <div>
      <button
        disabled={busy}
        onClick={() => run(() => post(`/api/super-admin/customers/${tenantId}/flags`, { is_internal: !isInternal }))}
        className={secondaryButtonClass}
      >
        {busy ? <Spinner label="Saving…" /> : isInternal ? "Mark as customer" : "Mark as internal/test"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}

export function TrialEditor({ tenantId, currentEndsAt }: { tenantId: string; currentEndsAt: string | null }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentEndsAt ? currentEndsAt.slice(0, 16) : "");
  const [confirm, setConfirm] = useState("");
  const { busy, error, run } = useAction();
  return (
    <>
      <button onClick={() => setOpen(true)} className={secondaryButtonClass}>Change account trial end…</button>
      {open && (
        <Modal title="Change the account trial end" onClose={() => setOpen(false)}>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run(() => post(`/api/super-admin/customers/${tenantId}/trial`, { trial_ends_at: new Date(`${value}Z`).toISOString(), confirm }))) setOpen(false);
            }}
            className="space-y-3"
          >
            <p className="text-sm text-zinc-600">
              Applies to the account&apos;s 30-day trial and any location without its own extension. Location
              extensions (e.g. Terra Gaucha Tampa) are not changed. This is audited.
            </p>
            <label className="block text-xs font-medium text-zinc-700">
              New end (UTC)
              <input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} required className={`${inputClass} mt-1 w-full`} />
            </label>
            <label className="block text-xs font-medium text-zinc-700">
              Type CHANGE TRIAL to confirm
              <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className={`${inputClass} mt-1 w-full`} />
            </label>
            {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className={secondaryButtonClass}>Cancel</button>
              <button disabled={busy || confirm !== "CHANGE TRIAL" || !value} className={buttonClass}>
                {busy ? <Spinner label="Saving…" /> : "Change trial"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

type UserAction = "reset_password" | "disable" | "enable" | "sign_out";
const USER_ACTION_COPY: Record<UserAction, { title: string; body: string; button: string; success: string }> = {
  reset_password: {
    title: "Send a password reset email?",
    body: "The user gets Supabase's password-reset email and chooses a new password themselves. You never see it.",
    button: "Send reset email",
    success: "Reset email sent.",
  },
  disable: {
    title: "Disable this user?",
    body: "They're signed out everywhere and can't sign in until re-enabled. Their restaurant data is untouched.",
    button: "Disable user",
    success: "User disabled.",
  },
  enable: { title: "Re-enable this user?", body: "They can sign in again.", button: "Re-enable", success: "User re-enabled." },
  sign_out: { title: "Sign this user out everywhere?", body: "All of their sessions end immediately.", button: "Sign out everywhere", success: "Signed out." },
};

export function UserActions({
  userId,
  email,
  banned,
  isAdmin,
  confirmed,
}: {
  userId: string;
  email: string;
  banned: boolean;
  isAdmin: boolean;
  confirmed: boolean;
}) {
  const [pending, setPending] = useState<UserAction | null>(null);
  const [impersonating, setImpersonating] = useState(false);
  const [reason, setReason] = useState("");
  const { busy, error, done, run } = useAction();

  async function startImpersonation(e: React.FormEvent) {
    e.preventDefault();
    const ok = await run(() => post("/api/super-admin/impersonation/start", { userId, reason }));
    if (ok) window.location.assign("/dashboard");
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button onClick={() => setPending("reset_password")} className={secondaryButtonClass} title="Send password reset">
        <KeyRound className="h-3.5 w-3.5" aria-hidden="true" /> Reset
      </button>
      {!isAdmin &&
        (banned ? (
          <button onClick={() => setPending("enable")} className={secondaryButtonClass}>
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Enable
          </button>
        ) : (
          <button onClick={() => setPending("disable")} className={secondaryButtonClass}>
            <ShieldOff className="h-3.5 w-3.5" aria-hidden="true" /> Disable
          </button>
        ))}
      {!isAdmin && (
        <button onClick={() => setPending("sign_out")} className={secondaryButtonClass} title="Sign out everywhere">
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
      {!isAdmin && !banned && confirmed && (
        <button onClick={() => setImpersonating(true)} className={buttonClass}>
          <Eye className="h-3.5 w-3.5" aria-hidden="true" /> View as
        </button>
      )}
      {done && <span className="text-xs text-emerald-700">{done}</span>}
      {error && !pending && !impersonating && <span className="text-xs text-red-600" role="alert">{error}</span>}

      {pending && (
        <Modal title={USER_ACTION_COPY[pending].title} onClose={() => setPending(null)}>
          <p className="text-sm text-zinc-600">{USER_ACTION_COPY[pending].body}</p>
          <p className="mt-2 text-sm font-medium text-zinc-900">{email}</p>
          {error && <p className="mt-2 text-xs text-red-600" role="alert">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setPending(null)} className={secondaryButtonClass}>Cancel</button>
            <button
              disabled={busy}
              onClick={async () => {
                if (await run(() => post(`/api/super-admin/users/${userId}`, { action: pending }), USER_ACTION_COPY[pending].success)) setPending(null);
              }}
              className={pending === "disable" ? "inline-flex h-9 items-center rounded-lg bg-red-600 px-3.5 text-[13px] font-medium text-white hover:bg-red-700 disabled:opacity-50" : buttonClass}
            >
              {busy ? <Spinner label="Working…" /> : USER_ACTION_COPY[pending].button}
            </button>
          </div>
        </Modal>
      )}

      {impersonating && (
        <Modal title={`View the app as ${email}`} onClose={() => setImpersonating(false)}>
          <form onSubmit={startImpersonation} className="space-y-3">
            <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600">
              <li>Read-only: you can look, not change anything.</li>
              <li>Ends automatically after 30 minutes, or when you exit.</li>
              <li>Recorded in the audit log with your reason.</li>
            </ul>
            <label className="block text-xs font-medium text-zinc-700">
              Reason (required)
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                minLength={10}
                maxLength={500}
                required
                placeholder="e.g. Customer reported the heatmap is empty — checking what they see."
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus-visible:border-zinc-900 focus-visible:ring-4 focus-visible:ring-zinc-900/10"
              />
            </label>
            {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setImpersonating(false)} className={secondaryButtonClass}>Cancel</button>
              <button disabled={busy || reason.trim().length < 10} className={buttonClass}>
                {busy ? <Spinner label="Starting…" /> : "Start read-only view"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export function FeedbackControls({ id, status, priority }: { id: string; status: string; priority: string | null }) {
  const { busy, error, run } = useAction();
  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-xs font-medium text-zinc-700">
        Status
        <select
          defaultValue={status}
          disabled={busy}
          onChange={(e) => run(() => post(`/api/super-admin/feedback/${id}`, { status: e.target.value }, "PATCH"))}
          className={`${inputClass} mt-1 block`}
        >
          {FEEDBACK_STATUSES.map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
      </label>
      <label className="text-xs font-medium text-zinc-700">
        Priority
        <select
          defaultValue={priority ?? ""}
          disabled={busy}
          onChange={(e) => run(() => post(`/api/super-admin/feedback/${id}`, { priority: e.target.value || null }, "PATCH"))}
          className={`${inputClass} mt-1 block`}
        >
          <option value="">Not set</option>
          {FEEDBACK_PRIORITIES.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </label>
      {busy && <Spinner label="Saving…" />}
      {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
    </div>
  );
}
