"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  Info,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

interface ImportOutcome {
  place_id: string;
  name: string;
  reviews_inserted?: number;
  error?: string;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "w-3.5 h-3.5",
            i <= Math.round(rating) ? "fill-gold text-gold" : "fill-line text-line"
          )}
        />
      ))}
    </span>
  );
}

export default function ImportReviewsSearch() {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [queue, setQueue] = useState<SearchResult[]>([]);
  const [importing, setImporting] = useState(false);
  const [outcomes, setOutcomes] = useState<ImportOutcome[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

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

  function handleQueryChange(value: string) {
    setQuery(value);
    scheduleSearch(value, city, stateCode);
  }
  function handleCityChange(value: string) {
    setCity(value);
    scheduleSearch(query, value, stateCode);
  }
  function handleStateChange(value: string) {
    setStateCode(value);
    scheduleSearch(query, city, value);
  }

  function addToQueue(r: SearchResult) {
    setQueue((prev) => (prev.some((q) => q.id === r.id) ? prev : [...prev, r]));
  }
  function removeFromQueue(id: string) {
    setQueue((prev) => prev.filter((q) => q.id !== id));
  }

  async function runImport() {
    if (queue.length === 0) return;
    setImporting(true);
    setImportError(null);
    setOutcomes(null);
    try {
      const res = await fetch("/api/reviews/import-places/self", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locations: queue.map((q) => ({ name: q.name, place_id: q.id })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setOutcomes(data.results ?? []);
      setQueue([]);
      setResults(null);
      setQuery("");
    } catch (e: unknown) {
      setImportError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.16em] text-ink-faint font-medium">
          Temporary bridge · while Google approves full access
        </p>
        <h1 className="font-heading text-[28px] font-semibold text-ink mt-1.5">
          Bring in your reviews now
        </h1>
        <p className="text-sm text-ink-soft mt-1.5 max-w-lg">
          Search your restaurants below and we&apos;ll pull real reviews in
          today — real data, not a placeholder — so you can start seeing
          what&apos;s costing you stars while your Business Profile
          connection is pending.
        </p>
      </div>

      {/* ── Search ── */}
      <div className="bg-cream rounded-2xl border border-line p-5 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            {searching ? (
              <Loader2 className="w-4 h-4 text-ink-faint absolute left-4 top-1/2 -translate-y-1/2 animate-spin" />
            ) : (
              <Search className="w-4 h-4 text-ink-faint absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            )}
            <input
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Find your restaurant…"
              className="w-full rounded-2xl border border-line bg-paper pl-11 pr-4 py-3 text-[15px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-forest/40 focus:border-forest/40 shadow-sm"
            />
          </div>
          <div className="relative sm:w-40">
            <MapPin className="w-4 h-4 text-ink-faint absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={city}
              onChange={(e) => handleCityChange(e.target.value)}
              placeholder="City"
              className="w-full rounded-2xl border border-line bg-paper pl-11 pr-4 py-3 text-[15px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-forest/40 focus:border-forest/40 shadow-sm"
            />
          </div>
          <select
            value={stateCode}
            onChange={(e) => handleStateChange(e.target.value)}
            className={cn(
              "sm:w-40 rounded-2xl border border-line bg-paper px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-forest/40 focus:border-forest/40 shadow-sm appearance-none cursor-pointer",
              stateCode ? "text-ink" : "text-ink-faint"
            )}
          >
            <option value="">All states</option>
            {US_STATES.map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </select>
        </div>
        <p className="text-xs text-ink-faint text-center">
          Type the name, then narrow by city or state. Name-only searches list A–Z.
        </p>

        {results && (
          <div className="space-y-2 pt-1">
            {results.map((r) => {
              const queued = queue.some((q) => q.id === r.id);
              return (
                <button
                  key={r.id}
                  onClick={() => addToQueue(r)}
                  disabled={queued}
                  className="w-full text-left bg-paper rounded-2xl border border-line px-4 py-3 hover:border-forest/40 hover:shadow-sm transition-all flex items-center gap-3 disabled:opacity-70"
                >
                  <MapPin className="w-4 h-4 text-forest shrink-0" />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-ink truncate">{r.name}</span>
                    <span className="block text-xs text-ink-faint truncate">{r.address}</span>
                  </span>
                  {r.rating > 0 && (
                    <span className="hidden sm:flex items-center gap-1.5 shrink-0">
                      <Stars rating={r.rating} />
                      <span className="text-xs text-ink-faint">({r.total_reviews})</span>
                    </span>
                  )}
                  {queued ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-forest shrink-0">
                      <Check className="w-3.5 h-3.5" /> Added
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-forest shrink-0">Add</span>
                  )}
                </button>
              );
            })}
            {results.length === 0 && !searching && (
              <p className="text-center py-4 text-sm text-ink-faint">
                No restaurants found for &ldquo;{query}&rdquo;.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Queue ── */}
      {queue.length > 0 && (
        <div className="bg-paper rounded-2xl border border-line p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">
              {queue.length} location{queue.length !== 1 ? "s" : ""} ready to import
            </p>
            <button onClick={() => setQueue([])} className="text-xs text-ink-faint hover:text-ink">
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {queue.map((q) => (
              <span
                key={q.id}
                className="inline-flex items-center gap-1.5 bg-line-soft text-ink text-xs font-medium rounded-full pl-3 pr-1.5 py-1"
              >
                {q.name}
                <button
                  onClick={() => removeFromQueue(q.id)}
                  className="text-ink-faint hover:text-neg rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          {importError && (
            <p className="text-sm text-neg bg-[#fbeeea] rounded-lg px-3 py-2">{importError}</p>
          )}

          <Button
            onClick={runImport}
            disabled={importing}
            className="w-full bg-forest hover:bg-forest-soft text-paper h-11 gap-2"
          >
            {importing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Pulling reviews…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Import & analyze {queue.length} location{queue.length !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </div>
      )}

      {/* ── Results ── */}
      {outcomes && (
        <div className="bg-paper rounded-2xl border border-forest/25 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-forest" />
            <p className="font-heading text-[15px] font-semibold text-ink">Reviews pulled in</p>
          </div>
          <div className="divide-y divide-line-soft">
            {outcomes.map((o) => (
              <div key={o.place_id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-ink">{o.name}</span>
                {o.error ? (
                  <span className="text-neg text-xs">{o.error}</span>
                ) : (
                  <span className="text-forest text-xs font-medium">
                    {o.reviews_inserted} review{o.reviews_inserted !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-ink-faint pt-1 border-t border-line-soft">
            Analyzing now — check your{" "}
            <Link href="/dashboard" className="text-forest underline underline-offset-2">
              overview
            </Link>{" "}
            in a minute for your first ranked report.
          </p>
        </div>
      )}

      <p className="text-xs text-ink-faint flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        Google shows up to 5 recent reviews per location this way — enough
        to get real signal today. Once your Business Profile connects, we
        switch to your complete review history automatically.
      </p>
    </div>
  );
}
