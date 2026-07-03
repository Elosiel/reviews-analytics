"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  Lock,
  MapPin,
  Search,
  Star,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CATEGORIES, CATEGORY_LABELS, scoreInk, fmtScore } from "@/lib/design";
import {
  HAS_MAPS_KEY,
  searchDemoPlaces,
  mapEmbedUrl,
  type PreviewPlace,
} from "@/lib/preview-demo";

interface LiveSearchResult {
  id: string;
  name: string;
  address: string;
  rating: number;
  total_reviews: number;
}

function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "w-4 h-4",
            i <= Math.round(rating)
              ? "fill-gold text-gold"
              : "fill-line text-line"
          )}
        />
      ))}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(50, Math.abs(score) * 50);
  const isNeg = score < 0;
  return (
    <div className="relative h-1.5 bg-line-soft rounded-full w-full overflow-hidden">
      <div className="absolute left-1/2 top-0 h-full w-px bg-ink-faint/40" />
      <div
        className={cn(
          "absolute top-0 h-full rounded-full",
          isNeg ? "bg-neg right-1/2" : "bg-pos left-1/2"
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function RestaurantTeaser() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PreviewPlace | null>(null);
  const [liveResults, setLiveResults] = useState<LiveSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const demoResults = useMemo(() => searchDemoPlaces(query), [query]);

  // Cancel any in-flight debounce on unmount
  useEffect(() => {
    const t = debounce;
    return () => {
      if (t.current) clearTimeout(t.current);
    };
  }, []);

  // Live search against Google Places, debounced. Demo mode when no key.
  function handleQueryChange(value: string) {
    setQuery(value);
    if (!HAS_MAPS_KEY) return;
    if (debounce.current) clearTimeout(debounce.current);
    const q = value.trim();
    if (q.length < 3) {
      setLiveResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setLiveResults(Array.isArray(data.places) ? data.places : []);
      } catch {
        setLiveResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
  }

  async function selectLive(result: LiveSearchResult) {
    setLoadingId(result.id);
    try {
      const res = await fetch(`/api/places/details?id=${encodeURIComponent(result.id)}`);
      const data = await res.json();
      if (data.place) {
        setSelected({ ...data.place, is_live: true } as PreviewPlace);
      }
    } finally {
      setLoadingId(null);
    }
  }

  if (selected) {
    return <PlaceResult place={selected} onBack={() => setSelected(null)} />;
  }

  const liveMode = HAS_MAPS_KEY && query.trim().length >= 3;

  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="relative">
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
          className="w-full rounded-2xl border border-line bg-paper pl-11 pr-4 py-3.5 text-[15px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-forest/40 focus:border-forest/40 shadow-sm"
        />
      </div>

      <p className="text-xs text-ink-faint text-center">
        {HAS_MAPS_KEY
          ? "Search any restaurant — live Google data. Or start from a sample below."
          : "Preview uses sample restaurants. Once your Business Profile is connected, this reads your real reviews."}
      </p>

      {/* Live results */}
      {liveMode && liveResults && (
        <div className="space-y-2">
          {liveResults.map((r) => (
            <button
              key={r.id}
              onClick={() => selectLive(r)}
              disabled={loadingId !== null}
              className="w-full text-left bg-paper rounded-2xl border border-line px-4 py-3 hover:border-forest/40 hover:shadow-sm transition-all flex items-center gap-3 disabled:opacity-60"
            >
              <MapPin className="w-4 h-4 text-forest shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-ink truncate">
                  {r.name}
                </span>
                <span className="block text-xs text-ink-faint truncate">
                  {r.address}
                </span>
              </span>
              {r.rating > 0 && (
                <span className="text-sm font-semibold text-ink tabular-nums shrink-0">
                  {r.rating.toFixed(1)}
                  <span className="text-gold"> ★</span>
                  <span className="text-xs text-ink-faint font-normal">
                    {" "}
                    ({r.total_reviews})
                  </span>
                </span>
              )}
              {loadingId === r.id ? (
                <Loader2 className="w-4 h-4 text-forest animate-spin shrink-0" />
              ) : (
                <ArrowRight className="w-4 h-4 text-ink-faint shrink-0" />
              )}
            </button>
          ))}
          {liveResults.length === 0 && !searching && (
            <p className="text-center py-4 text-sm text-ink-faint">
              No restaurants found for “{query}”.
            </p>
          )}
        </div>
      )}

      {/* Sample picker */}
      {!liveMode && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {demoResults.map((place) => (
            <button
              key={place.id}
              onClick={() => setSelected(place)}
              className="text-left bg-paper rounded-2xl border border-line p-4 hover:border-forest/40 hover:shadow-sm transition-all group"
            >
              <p className="font-heading font-semibold text-ink text-[15px] leading-snug">
                {place.name}
              </p>
              <p className="text-xs text-ink-faint mt-1 flex items-center gap-1">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{place.address}</span>
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Stars rating={place.rating} />
                <span className="text-sm font-semibold text-ink tabular-nums">
                  {place.rating.toFixed(1)}
                </span>
                <span className="text-xs text-ink-faint">
                  ({place.total_reviews})
                </span>
              </div>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-forest opacity-0 group-hover:opacity-100 transition-opacity">
                Preview <ArrowRight className="w-3 h-3" />
              </span>
            </button>
          ))}
          {demoResults.length === 0 && (
            <p className="col-span-full text-center py-8 text-sm text-ink-faint">
              No sample matches “{query}”. Try{" "}
              <button
                onClick={() => setQuery("")}
                className="text-forest underline underline-offset-2"
              >
                clearing the search
              </button>
              .
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function PlaceResult({
  place,
  onBack,
}: {
  place: PreviewPlace;
  onBack: () => void;
}) {
  const embed = mapEmbedUrl(place);

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Search again
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* ── The public sliver ── */}
        <div className="bg-paper rounded-2xl border border-line overflow-hidden">
          {/* Map */}
          <div className="relative h-40 bg-gradient-to-br from-[#e8ede6] to-[#d7e2d3] border-b border-line">
            {/* Always show placeholder — embedded maps require separate API enablement */}
            <div
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
                backgroundSize: "22px 22px",
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-1">
                <MapPin className="w-7 h-7 text-forest fill-forest/20" />
                <span className="text-[11px] text-ink-soft font-medium">
                  {place.name.split("—").pop()?.trim()}
                </span>
              </div>
            </div>
          </div>

          <div className="p-5">
            <p className="text-[11px] uppercase tracking-[0.14em] text-ink-faint font-medium">
              Public on Google
            </p>
            <h3 className="font-heading text-lg font-semibold text-ink mt-1">
              {place.name}
            </h3>
            <div className="flex items-center gap-2 mt-1.5">
              <Stars rating={place.rating} />
              <span className="text-sm font-semibold text-ink tabular-nums">
                {place.rating.toFixed(1)}
              </span>
              <span className="text-xs text-ink-faint">
                {place.total_reviews} reviews
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-[11px] font-medium text-ink-faint uppercase tracking-[0.14em]">
                A few of the {place.total_reviews} reviews
              </p>
              {place.sample_reviews.length === 0 && (
                <p className="text-sm text-ink-faint italic">
                  Google returned no public review text for this listing.
                </p>
              )}
              {place.sample_reviews.map((r, i) => (
                <div key={i} className="border-l-2 border-line pl-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink">
                      {r.author}
                    </span>
                    <Stars rating={r.rating} className="scale-90 origin-left" />
                    <span className="text-xs text-ink-faint">
                      {r.relative_time}
                    </span>
                  </div>
                  <p className="text-sm text-ink-soft italic mt-0.5 leading-relaxed">
                    &ldquo;{r.text}&rdquo;
                  </p>
                </div>
              ))}
            </div>

            <p className="text-xs text-ink-faint mt-4 pt-3 border-t border-line-soft">
              This is all Google shows the public — a handful of{" "}
              {place.total_reviews} reviews, no pattern, no priorities.
            </p>
          </div>
        </div>

        {/* ── The locked full analysis ── */}
        <div className="bg-paper rounded-2xl border border-forest/25 overflow-hidden relative">
          <div className="px-5 py-4 border-b border-line-soft bg-[#faf8f2] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-forest" />
              <p className="font-heading text-[15px] font-semibold text-ink">
                Your full analysis
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-forest bg-[#eef6f1] rounded-full px-2 py-0.5">
              <Lock className="w-3 h-3" /> Locked
            </span>
          </div>

          {/* Blurred category breakdown.
              Samples carry illustrative scores; live places get neutral
              placeholders — we never invent numbers for a real business. */}
          <div className="relative">
            <div className="p-5 space-y-3 blur-[3px] select-none pointer-events-none">
              {place.locked_categories
                ? place.locked_categories.map((c) => (
                    <div key={c.category} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-ink">
                          {CATEGORY_LABELS[c.category]}
                        </span>
                        <span
                          className="text-xs font-bold tabular-nums"
                          style={{ color: scoreInk(c.score) }}
                        >
                          {fmtScore(c.score)}
                        </span>
                      </div>
                      <ScoreBar score={c.score} />
                      <p className="text-xs text-ink-faint">{c.label}</p>
                    </div>
                  ))
                : CATEGORIES.map((cat) => (
                    <div key={cat} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-ink">
                          {CATEGORY_LABELS[cat]}
                        </span>
                        <span className="text-xs font-bold text-ink-faint">
                          ?
                        </span>
                      </div>
                      <div className="h-1.5 bg-line-soft rounded-full w-full" />
                      <p className="text-xs text-ink-faint">
                        Unlocks when your Business Profile is connected.
                      </p>
                    </div>
                  ))}
            </div>

            {/* Unlock overlay */}
            <div className="absolute inset-0 flex items-center justify-center p-5">
              <div className="bg-paper/80 backdrop-blur-sm rounded-2xl border border-line shadow-sm p-5 text-center max-w-xs">
                <div className="w-10 h-10 rounded-full bg-forest text-paper flex items-center justify-center mx-auto mb-3">
                  <Lock className="w-4 h-4" />
                </div>
                <p className="font-heading text-base font-semibold text-ink leading-snug">
                  Read all {place.total_reviews} reviews, not 3
                </p>
                <p className="text-sm text-ink-soft mt-1.5 leading-relaxed">
                  Connect your Business Profile and we&apos;ll rank exactly
                  what&apos;s costing you stars — with the quotes to prove it.
                </p>
                <a href="/login">
                  <Button className="mt-4 w-full bg-forest hover:bg-forest-soft text-paper gap-2">
                    Get started <ArrowRight className="w-4 h-4" />
                  </Button>
                </a>
                <p className="text-[11px] text-ink-faint mt-2.5">
                  Read-only — your listing and reviews stay exactly as they are.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
