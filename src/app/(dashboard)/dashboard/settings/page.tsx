import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, RefreshCw, Plus } from "lucide-react";

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
    <div className="px-6 py-8 max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">Settings</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Manage your account and connected locations
        </p>
      </div>

      {/* Account */}
      <div className="bg-white rounded-xl border border-zinc-100 divide-y divide-zinc-50">
        <div className="px-6 py-4">
          <h2 className="text-sm font-semibold text-zinc-900">Account</h2>
        </div>
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-700">{profile?.full_name ?? "—"}</p>
            <p className="text-xs text-zinc-400">{user?.email}</p>
          </div>
          <Badge className={`text-xs ${plan === "trial" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"} border-0`}>
            {plan}
          </Badge>
        </div>
        {plan === "trial" && (
          <div className="px-6 py-4 bg-zinc-50">
            <p className="text-sm text-zinc-600">
              You're on a free trial.{" "}
              <a href="https://reviewsanalytics.ai/pricing" className="text-zinc-900 font-medium underline">
                Upgrade to Standard
              </a>{" "}
              — $89/location/month.
            </p>
          </div>
        )}
      </div>

      {/* Google connection */}
      <div className="bg-white rounded-xl border border-zinc-100 divide-y divide-zinc-50">
        <div className="px-6 py-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">Google Business Profile</h2>
          {tokenRow ? (
            <div className="flex items-center gap-1.5 text-xs text-emerald-600">
              <CheckCircle className="w-3.5 h-3.5" />
              Connected
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertTriangle className="w-3.5 h-3.5" />
              Not connected
            </div>
          )}
        </div>
        <div className="px-6 py-4 space-y-3">
          {tokenRow ? (
            <>
              <p className="text-xs text-zinc-500">
                Last refreshed:{" "}
                {new Date(tokenRow.updated_at).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric",
                })}
              </p>
              <p className="text-xs text-zinc-400">
                Scope: {tokenRow.scope}
              </p>
              <a href="/api/google/connect">
                <Button variant="outline" size="sm" className="gap-2">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reconnect
                </Button>
              </a>
            </>
          ) : (
            <a href="/api/google/connect">
              <Button size="sm" className="bg-zinc-900 hover:bg-zinc-800 text-white gap-2">
                <Plus className="w-3.5 h-3.5" />
                Connect Google Business Profile
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Locations */}
      <div className="bg-white rounded-xl border border-zinc-100 divide-y divide-zinc-50">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">Tracked Locations</h2>
            {locationCount > 0 && (
              <p className="text-xs text-zinc-400 mt-0.5">
                ${monthlyPrice.toLocaleString()}/month ({locationCount} × $89)
              </p>
            )}
          </div>
          <a href="/onboarding">
            <Button variant="outline" size="sm" className="gap-2">
              <Plus className="w-3.5 h-3.5" />
              Add location
            </Button>
          </a>
        </div>

        {!locations || locations.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-zinc-400">
            No locations tracked yet.{" "}
            <a href="/onboarding" className="text-zinc-700 underline">
              Add your first location
            </a>
          </div>
        ) : (
          locations.map((loc) => (
            <div key={loc.id} className="px-6 py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-zinc-900 truncate">{loc.name}</p>
                  {loc.connection_broken && (
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  )}
                </div>
                <p className="text-xs text-zinc-400 truncate">{loc.address}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium text-amber-500">
                  {loc.rating?.toFixed(1) ?? "—"}★
                </p>
                <p className="text-xs text-zinc-400">
                  {loc.review_count} reviews
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
