"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Step = "connect" | "select" | "syncing" | "done";

interface GBPLocation {
  google_location_id: string;
  google_account_id: string;
  name: string;
  address: string;
}

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
    if (searchParams.get("error")) {
      setError(`Google connection failed: ${searchParams.get("error")}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [locations, setLocations] = useState<GBPLocation[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Called after Google Business Profile OAuth completes and returns to this page
  // with ?gbp=connected in the URL
  async function fetchLocations() {
    setLoadingLocations(true);
    setError(null);
    try {
      const res = await fetch("/api/locations/sync");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setLocations(data.locations ?? []);
      setStep("select");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load locations.");
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
      setStep("syncing");
      // Give the initial sync a moment, then move to done
      setTimeout(() => setStep("done"), 3000);
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
            {(["connect", "select", "done"] as const).map((s, i) => {
              const labels = ["Connect Google", "Select Locations", "You're all set"];
              const stepOrder = ["connect", "select", "syncing", "done"];
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
                  We need read-only access to your Google reviews to build your
                  ranked report. We never post anything on your behalf.
                </p>
              </div>

              <div className="rounded-lg bg-zinc-50 border border-zinc-100 p-5 space-y-3">
                <p className="text-sm font-medium text-zinc-700">
                  What we'll access
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
                    Read-only access only. We never post, reply, or modify
                    anything on Google on your behalf.
                  </p>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-500 bg-red-50 rounded-lg px-4 py-3">
                  {error}
                </p>
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
                  Connect Google Business Profile
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
                After connecting, you'll choose which of your locations to track.
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
                  <p className="text-zinc-500">No locations found on this account.</p>
                  <p className="text-sm text-zinc-400">
                    Make sure you're connected to the correct Google account.
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

          {/* ── STEP 3: Syncing ── */}
          {step === "syncing" && (
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
                  We're fetching and analyzing your review history. This takes a
                  moment for the first sync.
                </p>
              </div>
              <div className="space-y-2 text-left max-w-xs mx-auto">
                {[
                  "Connecting to Google Business Profile",
                  "Fetching review history",
                  "Running sentiment analysis",
                  "Building your ranked report",
                ].map((msg, i) => (
                  <div key={msg} className="flex items-center gap-2 text-sm text-zinc-500">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }} />
                    {msg}
                  </div>
                ))}
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
                  You're all set
                </h2>
                <p className="text-zinc-500">
                  Your locations are connected. Your first ranked report is
                  ready.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  onClick={() => router.push("/dashboard")}
                  className="bg-zinc-900 hover:bg-zinc-800 text-white h-11 px-8"
                >
                  Go to my dashboard
                </Button>
              </div>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {Array.from(selected).slice(0, 5).map((id) => {
                  const loc = locations.find((l) => l.google_location_id === id);
                  return loc ? (
                    <Badge key={id} variant="secondary" className="text-xs">
                      {loc.name}
                    </Badge>
                  ) : null;
                })}
                {selected.size > 5 && (
                  <Badge variant="secondary" className="text-xs">
                    +{selected.size - 5} more
                  </Badge>
                )}
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
