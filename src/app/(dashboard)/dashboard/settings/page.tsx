import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, RefreshCw, Plus, Sparkles } from "lucide-react";
import DeleteLocationButton from "@/components/dashboard/DeleteLocationButton";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, plan, tenant_id")
    .eq("id", user!.id)
    .single();

  const { data: locations } = await supabase
    .from("locations")
    .select("id, name, address, rating, review_count, connection_broken, last_synced_at")
    .order("name");

  const { data: tokenRow } = await supabase
    .from("google_tokens")
    .select("updated_at, scope")
    .eq("user_id", user!.id)
    .single();

  const plan = profile?.plan ?? "trial";
  const locationCount = locations?.length ?? 0;
  const monthlyPrice = locationCount * 89;

  return (
    <div className="px-6 py-10 max-w-2xl mx-auto space-y-7">
      <div>
        <p className="text-[11px] uppercase tracking-[0.16em] text-ink-faint font-medium">
          Settings
        </p>
        <h1 className="font-heading text-[28px] font-semibold text-ink mt-1.5">
          Your account
        </h1>
      </div>

      {/* Restaurant context now lives on its own page */}
      <a
        href="/dashboard/restaurant"
        className="block bg-paper rounded-2xl border border-line px-6 py-5 hover:border-forest/40 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-forest" />
          <h2 className="font-heading text-lg font-semibold text-ink">
            Your restaurant
          </h2>
          <span className="ml-auto text-xs font-medium text-forest opacity-0 group-hover:opacity-100 transition-opacity">
            Open →
          </span>
        </div>
        <p className="text-xs text-ink-soft mt-1">
          Profile, website, menus, and documents — everything the AI knows
          about you moved to its own page.
        </p>
      </a>

      {/* Account */}
      <div className="bg-paper rounded-2xl border border-line divide-y divide-line-soft">
        <div className="px-6 py-4">
          <h2 className="text-sm font-semibold text-ink">Account</h2>
        </div>
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-ink">{profile?.full_name ?? "—"}</p>
            <p className="text-xs text-ink-faint">{user?.email}</p>
          </div>
          <span
            className={`text-[11px] font-semibold uppercase tracking-wide rounded-full px-2.5 py-1 ${
              plan === "trial"
                ? "bg-[#f4dbb1] text-[#5c430e]"
                : "bg-[#eef6f1] text-pos"
            }`}
          >
            {plan}
          </span>
        </div>
        {plan === "trial" && (
          <div className="px-6 py-4 bg-cream/60">
            <p className="text-sm text-ink-soft">
              You&apos;re on a free trial.{" "}
              <a
                href="https://reviewsanalytics.ai/pricing"
                className="text-forest font-medium underline underline-offset-2"
              >
                Upgrade to Standard
              </a>{" "}
              — $89/location/month.
            </p>
          </div>
        )}
      </div>

      {/* Google connection */}
      <div className="bg-paper rounded-2xl border border-line divide-y divide-line-soft">
        <div className="px-6 py-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">
            Google Business Profile
          </h2>
          {tokenRow ? (
            <div className="flex items-center gap-1.5 text-xs text-pos font-medium">
              <CheckCircle className="w-3.5 h-3.5" />
              Connected
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-neg font-medium">
              <AlertTriangle className="w-3.5 h-3.5" />
              Not connected
            </div>
          )}
        </div>
        <div className="px-6 py-4 space-y-3">
          {tokenRow ? (
            <>
              <p className="text-xs text-ink-soft">
                Last refreshed:{" "}
                {new Date(tokenRow.updated_at).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                })}
              </p>
              <p className="text-xs text-ink-faint">Scope: {tokenRow.scope}</p>
              <a href="/api/google/connect">
                <Button variant="outline" size="sm" className="gap-2">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reconnect
                </Button>
              </a>
            </>
          ) : (
            <a href="/api/google/connect">
              <Button
                size="sm"
                className="bg-forest hover:bg-forest-soft text-paper gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                Connect Google Business Profile
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Locations */}
      <div className="bg-paper rounded-2xl border border-line divide-y divide-line-soft">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink">Tracked Locations</h2>
            {locationCount > 0 && (
              <p className="text-xs text-ink-faint mt-0.5">
                ${monthlyPrice.toLocaleString()}/month ({locationCount} × $89)
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <a href="/dashboard/settings/import">
              <Button variant="outline" size="sm" className="gap-2">
                <Sparkles className="w-3.5 h-3.5" />
                Search & import now
              </Button>
            </a>
            <a href="/onboarding">
              <Button variant="outline" size="sm" className="gap-2">
                <Plus className="w-3.5 h-3.5" />
                Add location
              </Button>
            </a>
          </div>
        </div>

        {!tokenRow && (
          <div className="px-6 py-3 bg-cream/60">
            <p className="text-xs text-ink-soft">
              Waiting on Google&apos;s official Business Profile approval?{" "}
              <a
                href="/dashboard/settings/import"
                className="text-forest font-medium underline underline-offset-2"
              >
                Search & import your reviews now
              </a>{" "}
              — real data, temporary bridge, no waiting.
            </p>
          </div>
        )}

        {!locations || locations.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-ink-faint">
            No locations tracked yet.{" "}
            <a href="/onboarding" className="text-forest underline underline-offset-2">
              Add your first location
            </a>
          </div>
        ) : (
          locations.map((loc) => (
            <div
              key={loc.id}
              className="px-6 py-4 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-ink truncate">
                    {loc.name}
                  </p>
                  {loc.connection_broken && (
                    <AlertTriangle className="w-3.5 h-3.5 text-neg shrink-0" />
                  )}
                </div>
                <p className="text-xs text-ink-faint truncate">{loc.address}</p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <p className="text-sm font-semibold text-ink tabular-nums">
                    {loc.rating?.toFixed(1) ?? "—"}
                    <span className="text-gold">★</span>
                  </p>
                  <p className="text-xs text-ink-faint">
                    {loc.review_count} reviews
                  </p>
                </div>
                <DeleteLocationButton locationId={loc.id} locationName={loc.name} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
