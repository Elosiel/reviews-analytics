import { redirect } from "next/navigation";

// Shown when the deployment is missing required configuration.
// Reflects the runtime environment, so it must not be prerendered.
export const dynamic = "force-dynamic";

const REQUIRED_NOW = [
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    hint: "Supabase → Project Settings → API → Project URL",
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    hint: "Supabase → Project Settings → API → anon public key",
  },
] as const;

const REQUIRED_LATER = [
  { name: "TOKEN_ENCRYPTION_KEY", hint: "openssl rand -hex 32" },
  { name: "CRON_SECRET", hint: "openssl rand -hex 32" },
  { name: "ANTHROPIC_API_KEY", hint: "console.anthropic.com" },
  { name: "RESEND_API_KEY", hint: "resend.com → API Keys" },
  { name: "GOOGLE_CLIENT_ID", hint: "Google Cloud → Credentials (Phase 2)" },
  { name: "GOOGLE_CLIENT_SECRET", hint: "Google Cloud → Credentials (Phase 2)" },
] as const;

export default function SetupRequiredPage() {
  const missingNow = REQUIRED_NOW.filter((v) => !process.env[v.name]);

  // Everything critical is configured — nothing to see here
  if (missingNow.length === 0) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl space-y-8">
        <div className="space-y-3">
          <span className="text-white font-semibold text-lg tracking-tight">
            Reviews Analytics
          </span>
          <h1 className="text-2xl font-semibold text-white">
            Almost there — this deployment needs configuration
          </h1>
          <p className="text-zinc-400 text-sm leading-relaxed">
            The app is deployed but can&apos;t start because required
            environment variables are missing. Add them in{" "}
            <span className="text-zinc-200">
              Vercel → Project → Settings → Environment Variables
            </span>{" "}
            (for Production and Preview), then redeploy.
          </p>
        </div>

        <div className="rounded-xl border border-red-900/50 bg-red-950/30 p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-red-400">
            Missing — required to start
          </p>
          <ul className="space-y-2.5">
            {missingNow.map((v) => (
              <li key={v.name} className="space-y-0.5">
                <code className="text-sm text-red-200 font-mono">{v.name}</code>
                <p className="text-xs text-zinc-500">{v.hint}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Also needed before full launch
          </p>
          <ul className="space-y-2">
            {REQUIRED_LATER.map((v) => {
              const isSet = Boolean(process.env[v.name]);
              return (
                <li key={v.name} className="flex items-center gap-2.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      isSet ? "bg-emerald-400" : "bg-zinc-600"
                    }`}
                  />
                  <code className="text-sm text-zinc-300 font-mono">
                    {v.name}
                  </code>
                  <span className="text-xs text-zinc-600 ml-auto">
                    {isSet ? "set" : v.hint}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="text-xs text-zinc-600">
          Full step-by-step instructions:{" "}
          <a
            href="https://github.com/Elosiel/reviews-analytics/blob/main/docs/DEPLOYMENT.md"
            className="text-zinc-400 underline hover:text-zinc-200"
          >
            docs/DEPLOYMENT.md
          </a>
        </p>
      </div>
    </div>
  );
}
