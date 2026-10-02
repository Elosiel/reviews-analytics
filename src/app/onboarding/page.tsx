"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import RestaurantProfileForm from "@/components/shared/RestaurantProfileForm";
import { oauthCallbackErrorMessage, type GoogleErrorKind } from "@/lib/google/errors";

type Step = "connect" | "select" | "profile" | "syncing" | "done";

interface GBPLocation {
  google_location_id: string;
  google_account_id: string;
  name: string;
  address: string;
}

interface SyncResult {
  location_id: string;
  location_name: string;
  inserted: number;
  average_rating?: number | null;
  total_review_count?: number | null;
  error?: string;
  error_kind?: GoogleErrorKind;
}

const PRIVACY_POLICY_URL = "https://reviewsanalytics.ai/privacy";
const GOOGLE_PERMISSIONS_URL = "https://myaccount.google.com/permissions";

// A connection that needs the user to go back through Google's consent.
const needsReconnect = (kind: GoogleErrorKind | null) =>
  kind === "reconnect" || kind === "permission";

export default function OnboardingPage() {
  return (
    <Suspense>
      <OnboardingInner />
    </Suspense>
  );
}

function OnboardingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("connect");

  // Auto-advance to location selection if returning from Google OAuth
  useEffect(() => {
    if (searchParams.get("gbp") === "connected") {
      fetchLocations();
    }
    const callbackError = searchParams.get("error");
    if (callbackError) {
      setError(oauthCallbackErrorMessage(callbackError));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [locations, setLocations] = useState<GBPLocation[]>([]);
  const [accountCount, setAccountCount] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set only when loading locations from Google failed (not for OAuth
  // callback errors) — those can be retried without reconnecting.
  const [locationsErrorKind, setLocationsErrorKind] = useState<GoogleErrorKind | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncErrorKind, setSyncErrorKind] = useState<GoogleErrorKind | null>(null);
  const [syncResults, setSyncResults] = useState<SyncResult[]>([]);

  // Called after Google Business Profile OAuth completes and returns to this page
  // with ?gbp=connected in the URL
  async function fetchLocations() {
    setLoadingLocations(true);
    setError(null);
    setLocationsErrorKind(null);
    try {
      const res = await fetch("/api/locations/sync");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setLocationsErrorKind(data?.kind ?? "unavailable");
        throw new Error(data?.error ?? "We couldn't load your locations from Google. Try again in a moment.");
      }
      setLocations(data.locations ?? []);
      setAccountCount(typeof data.account_count === "number" ? data.account_count : null);
      setStep("select");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "We couldn't load your locations from Google.");
    } finally {
      setLoadingLocations(false);
    }
  }

  function toggleLocation(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // Runs the real first sync — replaces the old fixed-delay fake timer.
  // Called after the restaurant profile is saved, and again on retry.
  async function runInitialSync() {
    setStep("syncing");
    setSyncError(null);
    setSyncErrorKind(null);
    try {
      const res = await fetch("/api/reviews/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "manual" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        throw new Error("We couldn't start the import. Try again in a moment.");
      }
      if (data.no_locations) {
        setSyncErrorKind("reconnect");
        throw new Error(
          "None of your locations can be imported right now — the Google connection needs to be renewed. Reconnect Google to continue."
        );
      }
      const results: SyncResult[] = data.results ?? [];
      const failed = results.find((r) => r.error);
      if (failed) {
        setSyncErrorKind(failed.error_kind ?? "unavailable");
        throw new Error(`${failed.location_name}: ${failed.error}`);
      }
      setSyncResults(results);
      setStep("done");
    } catch (e: unknown) {
      setSyncError(e instanceof Error ? e.message : "We couldn't import your reviews.");
    }
  }

  const importedCount = syncResults.reduce((sum, r) => sum + r.inserted, 0);

  async function saveAndSync() {
    if (selected.size === 0) return;
    setSaving(true);
    setError(null);
    try {
      const payload = locations.filter((l) => selected.has(l.google_location_id));
      const res = await fetch("/api/locations/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locations: payload }),
      });
      if (!res.ok) throw new Error(await res.text());
      // Locations saved — now learn who the restaurant is before syncing
      setStep("profile");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save locations.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-zinc-100 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <span className="font-semibold text-zinc-900 tracking-tight">
            Reviews Analytics
          </span>
          <span className="text-xs text-zinc-400">Setup</span>
        </div>
      </header>

      {/* Step progress */}
      <div className="bg-white border-b border-zinc-100">
        <div className="max-w-2xl mx-auto px-6 py-3">
          <div className="flex items-center gap-2">
            {(["connect", "select", "profile", "done"] as const).map((s, i) => {
              const labels = ["Connect Google", "Select Locations", "Your Restaurant", "You're all set"];
              const stepOrder = ["connect", "select", "profile", "syncing", "done"];
              const current = stepOrder.indexOf(step);
              const thisIdx = stepOrder.indexOf(s === "done" ? "done" : s);
              const isComplete = current > thisIdx;
              const isActive = s === step || (step === "syncing" && s === "done");
              return (
                <div key={s} className="flex items-center gap-2">
                  {i > 0 && (
                    <div className={`h-px w-8 ${isComplete ? "bg-emerald-400" : "bg-zinc-200"}`} />
                  )}
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-medium ${
                        isComplete
                          ? "bg-emerald-500 text-white"
                          : isActive
                          ? "bg-zinc-900 text-white"
                          : "bg-zinc-100 text-zinc-400"
                      }`}
                    >
                      {isComplete ? "✓" : i + 1}
                    </div>
                    <span
                      className={`text-xs hidden sm:block ${
                        isActive ? "text-zinc-900 font-medium" : "text-zinc-400"
                      }`}
                    >
                      {labels[i]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 flex items-start justify-center px-6 py-12">
        <div className="w-full max-w-2xl space-y-6">

          {/* ── STEP 1: Connect Google Business Profile ── */}
          {step === "connect" && (
            <div className="bg-white rounded-xl border border-zinc-200 p-8 space-y-6">
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold text-zinc-900">
                  Connect your Google Business Profile
                </h1>
                <p className="text-zinc-500">
                  We need access to your Google reviews to build your ranked
                  report. Your listing and reviews stay exactly as they are.
                </p>
              </div>

              <div className="rounded-lg bg-zinc-50 border border-zinc-100 p-5 space-y-3">
                <p className="text-sm font-medium text-zinc-700">
                  What we&apos;ll access
                </p>
                <ul className="space-y-2">
                  {[
                    "Your Google Business Profile locations",
                    "Reviews left by guests at your locations",
                    "Location names and addresses",
                  ].map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-2 text-sm text-zinc-600"
                    >
                      <svg
                        className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0"
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
                <div className="pt-2 border-t border-zinc-100">
                  <p className="text-xs text-zinc-400">
                    Secure access — your Google listing and reviews stay
                    exactly as they are.
                  </p>
                </div>
              </div>

              {/* Google's consent screen describes the whole business.manage
                  scope — the only one its Business Profile API offers. Explain
                  that here, before the redirect, so it isn't a surprise there. */}
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-5 space-y-3">
                <p className="text-sm font-medium text-zinc-800">
                  Why does Google show broad permissions?
                </p>
                <p className="text-sm text-zinc-600 leading-relaxed">
                  Google bundles all Business Profile access into one
                  permission, so its screen may say an app can create, edit, or
                  delete listings, or make another Google user the owner of
                  your business listing. That&apos;s Google&apos;s standard
                  wording — every app that connects to Google Business Profile
                  sees this same screen.
                </p>
                <ul className="space-y-1.5 text-sm text-zinc-600">
                  <li>
                    <span className="font-medium text-zinc-800">What we do:</span>{" "}
                    read your locations and reviews to build your reports.
                  </li>
                  <li>
                    <span className="font-medium text-zinc-800">What we never do:</span>{" "}
                    post or reply to reviews, edit or delete your listing, or
                    change its owners or managers.
                  </li>
                  <li>
                    <span className="font-medium text-zinc-800">You stay in control:</span>{" "}
                    you remain the owner, and you can revoke our access anytime
                    in your{" "}
                    <a
                      href={GOOGLE_PERMISSIONS_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:text-zinc-900"
                    >
                      Google Account permissions
                    </a>
                    .
                  </li>
                </ul>
                <p className="text-xs text-zinc-500">
                  Details in our{" "}
                  <a
                    href={PRIVACY_POLICY_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-zinc-700"
                  >
                    Privacy Policy
                  </a>
                  .
                </p>
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3 space-y-2">
                  <p>{error}</p>
                  {locationsErrorKind && !needsReconnect(locationsErrorKind) && (
                    <button
                      onClick={fetchLocations}
                      disabled={loadingLocations}
                      className="font-medium underline underline-offset-2"
                    >
                      {loadingLocations ? "Retrying…" : "Try again"}
                    </button>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={() => {
                    // Redirect to Google Business Profile OAuth
                    window.location.href = "/api/google/connect";
                  }}
                  className="bg-zinc-900 hover:bg-zinc-800 text-white h-11 px-6 gap-2"
                >
                  <GoogleIcon />
                  {needsReconnect(locationsErrorKind) ? "Reconnect Google" : "Connect Google Business Profile"}
                </Button>

                {/* Dev shortcut — skip OAuth if credentials not set up yet */}
                {process.env.NODE_ENV === "development" && (
                  <Button
                    variant="outline"
                    onClick={fetchLocations}
                    disabled={loadingLocations}
                    className="h-11"
                  >
                    {loadingLocations ? "Loading…" : "Skip (dev mode)"}
                  </Button>
                )}
              </div>

              <p className="text-xs text-zinc-400">
                After connecting, you&apos;ll choose which of your locations to track.
              </p>
            </div>
          )}

          {/* ── STEP 2: Select locations ── */}
          {step === "select" && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-zinc-200 p-8 space-y-2">
                <h1 className="text-2xl font-semibold text-zinc-900">
                  Select your locations
                </h1>
                <p className="text-zinc-500">
                  Choose which locations to track. You can add or remove
                  locations later in Settings.
                </p>
              </div>

              {loadingLocations ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-xl" />
                  ))}
                </div>
              ) : locations.length === 0 ? (
                <div className="bg-white rounded-xl border border-zinc-200 p-8 text-center space-y-2">
                  <p className="text-zinc-500">
                    {accountCount === 0
                      ? "Connected — but this Google account doesn't own or manage any Business Profiles."
                      : "Connected — but no locations were found on the Business Profiles this Google account manages."}
                  </p>
                  <p className="text-sm text-zinc-400">
                    Make sure you signed in with the Google account that owns or
                    manages your restaurant&apos;s listing.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setStep("connect")}
                    className="mt-4"
                  >
                    Try a different account
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {locations.map((loc) => {
                      const isSelected = selected.has(loc.google_location_id);
                      return (
                        <button
                          key={loc.google_location_id}
                          onClick={() => toggleLocation(loc.google_location_id)}
                          className={`w-full text-left bg-white rounded-xl border-2 p-5 transition-all ${
                            isSelected
                              ? "border-zinc-900 shadow-sm"
                              : "border-zinc-100 hover:border-zinc-200"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <p className="font-medium text-zinc-900">
                                {loc.name}
                              </p>
                              <p className="text-sm text-zinc-500">
                                {loc.address}
                              </p>
                            </div>
                            <div
                              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? "border-zinc-900 bg-zinc-900"
                                  : "border-zinc-300"
                              }`}
                            >
                              {isSelected && (
                                <svg
                                  className="w-3 h-3 text-white"
                                  fill="currentColor"
                                  viewBox="0 0 20 20"
                                >
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {error && (
                    <p className="text-sm text-red-500 bg-red-50 rounded-lg px-4 py-3">
                      {error}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm text-zinc-500">
                      {selected.size} of {locations.length} selected
                      {selected.size > 0 && (
                        <span className="text-zinc-400 ml-1">
                          · ${(selected.size * 89).toLocaleString()}/mo
                        </span>
                      )}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          if (selected.size === locations.length) {
                            setSelected(new Set());
                          } else {
                            setSelected(
                              new Set(locations.map((l) => l.google_location_id))
                            );
                          }
                        }}
                        className="text-sm"
                      >
                        {selected.size === locations.length
                          ? "Deselect all"
                          : "Select all"}
                      </Button>
                      <Button
                        onClick={saveAndSync}
                        disabled={selected.size === 0 || saving}
                        className="bg-zinc-900 hover:bg-zinc-800 text-white"
                      >
                        {saving
                          ? "Saving…"
                          : `Track ${selected.size} location${selected.size !== 1 ? "s" : ""}`}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── STEP 3: Restaurant profile — teach the AI who you are ── */}
          {step === "profile" && (
            <div className="bg-white rounded-xl border border-zinc-200 p-8 space-y-6">
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold text-zinc-900">
                  Tell us about your restaurant
                </h1>
                <p className="text-zinc-500">
                  Two minutes that make every recommendation smarter. The AI
                  uses this to judge what matters — a noise complaint means
                  something different at a date-night spot than a sports bar.
                </p>
              </div>
              <RestaurantProfileForm
                submitLabel="Save & start first sync"
                onSaved={runInitialSync}
              />
            </div>
          )}

          {/* ── STEP 4: Syncing ── */}
          {step === "syncing" && !syncError && (
            <div className="bg-white rounded-xl border border-zinc-200 p-12 text-center space-y-6">
              <div className="flex justify-center">
                <div className="w-14 h-14 rounded-full bg-zinc-100 flex items-center justify-center">
                  <svg
                    className="animate-spin h-7 w-7 text-zinc-600"
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
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-zinc-900">
                  Pulling your reviews…
                </h2>
                <p className="text-zinc-500">
                  We&apos;re fetching your review history from Google. This takes a
                  moment for the first sync — don&apos;t close this tab.
                </p>
              </div>
              <div className="space-y-2 text-left max-w-xs mx-auto">
                {[
                  "Connecting to Google Business Profile",
                  "Fetching review history",
                  "Saving to your account",
                ].map((msg, i) => (
                  <div key={msg} className="flex items-center gap-2 text-sm text-zinc-500">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                    {msg}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 4: Sync failed ── */}
          {step === "syncing" && syncError && (
            <div className="bg-white rounded-xl border border-zinc-200 p-12 text-center space-y-6">
              <div className="flex justify-center">
                <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
                  <svg className="h-7 w-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-zinc-900">
                  We couldn&apos;t pull your reviews
                </h2>
                <p className="text-zinc-500">{syncError}</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {needsReconnect(syncErrorKind) ? (
                  <Button
                    onClick={() => {
                      window.location.href = "/api/google/connect";
                    }}
                    className="bg-zinc-900 hover:bg-zinc-800 text-white h-11 px-8 gap-2"
                  >
                    <GoogleIcon />
                    Reconnect Google
                  </Button>
                ) : (
                  <Button
                    onClick={runInitialSync}
                    className="bg-zinc-900 hover:bg-zinc-800 text-white h-11 px-8"
                  >
                    Try again
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ── STEP 4: Done ── */}
          {step === "done" && (
            <div className="bg-white rounded-xl border border-zinc-200 p-12 text-center space-y-6">
              <div className="flex justify-center">
                <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                  <svg
                    className="h-7 w-7 text-emerald-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-zinc-900">
                  You&apos;re all set
                </h2>
                <p className="text-zinc-500">
                  {importedCount > 0
                    ? `Connected to Google — ${importedCount} review${importedCount !== 1 ? "s" : ""} imported. We're analyzing them now; your rankings fill in over the next few minutes, and your reviews are already on the dashboard.`
                    : "Connected to Google. These locations don't have any reviews on Google yet — new ones will come in automatically."}
                </p>
              </div>

              {/* Straight from Google's reviews response — the listing's own
                  rating and review total, before any analysis has run. */}
              {syncResults.length > 0 && (
                <div className="rounded-lg border border-zinc-100 divide-y divide-zinc-100 text-left">
                  {syncResults.map((r) => (
                    <div key={r.location_id} className="flex items-center justify-between gap-4 px-4 py-3">
                      <span className="text-sm font-medium text-zinc-900 truncate">
                        {r.location_name}
                      </span>
                      <span className="text-sm text-zinc-500 tabular-nums shrink-0">
                        {typeof r.average_rating === "number" && (
                          <>
                            {r.average_rating.toFixed(1)}
                            <span className="text-amber-500">★</span>
                            {" · "}
                          </>
                        )}
                        {r.total_review_count ?? 0} review{r.total_review_count !== 1 ? "s" : ""} on Google
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={() => router.push("/dashboard")}
                  className="bg-zinc-900 hover:bg-zinc-800 text-white h-11 px-8"
                >
                  Go to my dashboard
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}
