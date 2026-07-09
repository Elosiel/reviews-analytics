"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Loader2, MapPin, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const US_STATES = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
  ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"],
  ["DE", "Delaware"], ["DC", "Washington DC"], ["FL", "Florida"],
  ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"],
  ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"],
  ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"],
  ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"],
  ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"],
  ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"],
  ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"],
  ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"],
  ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"],
  ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"],
  ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"],
  ["WI", "Wisconsin"], ["WY", "Wyoming"],
] as const;

interface SearchResult {
  id: string; // place_id
  name: string;
  address: string;
  rating: number;
  total_reviews: number;
}

type QueuedLocation = SearchResult;

interface Customer {
  user_id: string;
  tenant_id: string;
  full_name: string | null;
  email: string;
  location_count: number;
}

interface ImportOutcome {
  place_id: string;
  name: string;
  reviews_inserted?: number;
  error?: string;
}

export default function PlacesImportTool() {
  // ── Customer lookup ──
  const [email, setEmail] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  // ── Restaurant search ──
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Queue + submit ──
  const [queue, setQueue] = useState<QueuedLocation[]>([]);
  const [importing, setImporting] = useState(false);
  const [outcomes, setOutcomes] = useState<ImportOutcome[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  async function lookupCustomer() {
    if (!email.trim()) return;
    setLookingUp(true);
    setLookupError(null);
    setCustomer(null);
    try {
      const res = await fetch(`/api/admin/lookup-customer?email=${encodeURIComponent(email.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lookup failed");
      if (!data.customer) {
        setLookupError("No account found for that email. They need to sign in via Google once first.");
      } else {
        setCustomer(data.customer);
      }
    } catch (e: unknown) {
      setLookupError(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLookingUp(false);
    }
  }

  function scheduleSearch(name: string, cityVal: string, stateVal: string) {
    if (debounce.current) clearTimeout(debounce.current);
    const q = name.trim();
    if (q.length < 3) {
      setResults(null);
      setSearching(false);
      return;
    }
    const stateName = US_STATES.find(([code]) => code === stateVal)?.[1] ?? "";
    const full = [q, cityVal.trim(), stateName].filter(Boolean).join(", ");
    setSearching(true);
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/search?q=${encodeURIComponent(full)}`);
        const data = await res.json();
        setResults(Array.isArray(data.places) ? data.places : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  }

  function addToQueue(r: SearchResult) {
    setQueue((prev) => (prev.some((q) => q.id === r.id) ? prev : [...prev, r]));
  }

  function removeFromQueue(id: string) {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  }

  async function runImport() {
    if (!customer || queue.length === 0) return;
    setImporting(true);
    setImportError(null);
    setOutcomes(null);
    try {
      const res = await fetch("/api/admin/import-places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: customer.tenant_id,
          user_id: customer.user_id,
          locations: queue.map((q) => ({ name: q.name, place_id: q.id })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setOutcomes(data.results ?? []);
      setQueue([]);
    } catch (e: unknown) {
      setImportError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Import restaurants from Google</h1>
        <p className="text-zinc-500 mt-1">
          Search, select any number of locations, and pull their reviews into a customer&apos;s account.
        </p>
      </div>

      {/* ── Step 1: customer ── */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-3">
        <h2 className="text-sm font-semibold text-zinc-900">1. Customer</h2>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="customer@restaurant.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookupCustomer()}
            className="h-10"
          />
          <Button onClick={lookupCustomer} disabled={lookingUp || !email.trim()} className="shrink-0">
            {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : "Find"}
          </Button>
        </div>
        <p className="text-xs text-zinc-400">
          They need to have signed in at least once via Google (/login) — this doesn&apos;t create the account.
        </p>
        {lookupError && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{lookupError}</p>
        )}
        {customer && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-sm text-emerald-900">
            {customer.full_name ?? customer.email} — {customer.location_count} location
            {customer.location_count !== 1 ? "s" : ""} already tracked
          </div>
        )}
      </div>

      {/* ── Step 2: search + select ── */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-zinc-900">2. Find their locations</h2>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            {searching ? (
              <Loader2 className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 animate-spin" />
            ) : (
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            )}
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                scheduleSearch(e.target.value, city, stateCode);
              }}
              placeholder="Restaurant name…"
              className="h-10 pl-9"
            />
          </div>
          <div className="relative sm:w-40">
            <MapPin className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              value={city}
              onChange={(e) => {
                setCity(e.target.value);
                scheduleSearch(query, e.target.value, stateCode);
              }}
              placeholder="City"
              className="h-10 pl-9"
            />
          </div>
          <select
            value={stateCode}
            onChange={(e) => {
              setStateCode(e.target.value);
              scheduleSearch(query, city, e.target.value);
            }}
            className="sm:w-36 h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-700"
          >
            <option value="">All states</option>
            {US_STATES.map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
        </div>

        {results && (
          <div className="space-y-1.5">
            {results.map((r) => {
              const queued = queue.some((q) => q.id === r.id);
              return (
                <button
                  key={r.id}
                  onClick={() => addToQueue(r)}
                  disabled={queued}
                  className="w-full text-left bg-zinc-50 rounded-lg border border-zinc-100 px-3 py-2.5 hover:border-zinc-300 transition-colors flex items-center gap-3 disabled:opacity-50"
                >
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-zinc-900 truncate">{r.name}</span>
                    <span className="block text-xs text-zinc-400 truncate">{r.address}</span>
                  </span>
                  {r.rating > 0 && (
                    <span className="text-xs text-zinc-500 tabular-nums shrink-0">
                      {r.rating.toFixed(1)}★ ({r.total_reviews})
                    </span>
                  )}
                  {queued ? (
                    <span className="text-xs font-medium text-emerald-600 shrink-0">Added</span>
                  ) : (
                    <Plus className="w-4 h-4 text-zinc-400 shrink-0" />
                  )}
                </button>
              );
            })}
            {results.length === 0 && !searching && (
              <p className="text-sm text-zinc-400 text-center py-3">No restaurants found for “{query}”.</p>
            )}
          </div>
        )}
      </div>

      {/* ── Step 3: queue + submit ── */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">
            3. Locations to import ({queue.length})
          </h2>
          {queue.length > 0 && (
            <button onClick={() => setQueue([])} className="text-xs text-zinc-400 hover:text-zinc-600">
              Clear all
            </button>
          )}
        </div>

        {queue.length === 0 ? (
          <p className="text-sm text-zinc-400">Add restaurants from the search above — any number.</p>
        ) : (
          <div className="space-y-1.5">
            {queue.map((q) => (
              <div key={q.id} className="flex items-center gap-3 bg-zinc-50 rounded-lg px-3 py-2">
                <span className="flex-1 min-w-0 text-sm text-zinc-900 truncate">{q.name}</span>
                <button onClick={() => removeFromQueue(q.id)} className="text-zinc-400 hover:text-red-500 shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {importError && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{importError}</p>
        )}

        <Button
          onClick={runImport}
          disabled={!customer || queue.length === 0 || importing}
          className="w-full bg-zinc-900 hover:bg-zinc-800 text-white h-11"
        >
          {importing ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Pulling reviews…
            </span>
          ) : (
            `Import ${queue.length || ""} location${queue.length !== 1 ? "s" : ""} & analyze`
          )}
        </Button>
        {!customer && (
          <p className="text-xs text-zinc-400 text-center">Find a customer above first.</p>
        )}
      </div>

      {/* ── Results ── */}
      {outcomes && (
        <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-2">
          <h2 className="text-sm font-semibold text-zinc-900">Results</h2>
          {outcomes.map((o) => (
            <div key={o.place_id} className="flex items-center justify-between text-sm py-1">
              <span className="text-zinc-700">{o.name}</span>
              {o.error ? (
                <span className="text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> {o.error}
                </span>
              ) : (
                <span className="text-emerald-600">{o.reviews_inserted} review{o.reviews_inserted !== 1 ? "s" : ""} pulled</span>
              )}
            </div>
          ))}
          <p className="text-xs text-zinc-400 pt-2 border-t border-zinc-100">
            Analysis + rollup recompute kicked off in the background — check the customer&apos;s dashboard in a minute.
          </p>
        </div>
      )}
    </div>
  );
}
