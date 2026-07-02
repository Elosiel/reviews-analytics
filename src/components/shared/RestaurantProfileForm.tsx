"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RestaurantProfile } from "@/types";
import { MOCK_PROFILE } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "ra_restaurant_profile";
const PRICE_POINTS: RestaurantProfile["price_point"][] = ["$", "$$", "$$$", "$$$$"];

export function loadProfile(): RestaurantProfile {
  if (typeof window === "undefined") return MOCK_PROFILE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? { ...MOCK_PROFILE, ...JSON.parse(raw) } : MOCK_PROFILE;
  } catch {
    return MOCK_PROFILE;
  }
}

interface RestaurantProfileFormProps {
  /** Compact spacing for the onboarding step */
  compact?: boolean;
  submitLabel?: string;
  onSaved?: (profile: RestaurantProfile) => void;
}

/**
 * The questions that teach the AI who this restaurant is. Every
 * recommendation on the dashboard is written against these answers.
 * Stored locally for the demo; maps 1:1 to the tenant_profiles table
 * once the live pipeline is wired.
 */
export default function RestaurantProfileForm({
  compact = false,
  submitLabel = "Save profile",
  onSaved,
}: RestaurantProfileFormProps) {
  const [profile, setProfile] = useState<RestaurantProfile>(MOCK_PROFILE);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Async so SSR markup matches the first client render, then the
    // saved profile (if any) loads from localStorage
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setProfile(loadProfile());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function set<K extends keyof RestaurantProfile>(
    key: K,
    value: RestaurantProfile[K]
  ) {
    setProfile((p) => ({ ...p, [key]: value }));
    setSaved(false);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    setSaved(true);
    onSaved?.(profile);
    setTimeout(() => setSaved(false), 2500);
  }

  const fieldClass =
    "w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-forest/40 focus:border-forest/40";

  const FIELDS: {
    key: keyof Pick<
      RestaurantProfile,
      "mission" | "cuisine_style" | "target_guests" | "goals" | "notes"
    >;
    label: string;
    hint: string;
    placeholder: string;
    rows?: number;
  }[] = [
    {
      key: "mission",
      label: "What is your restaurant about?",
      hint: "In your own words — this sets the tone for every recommendation.",
      placeholder:
        "e.g. Coastal Latin cooking that makes an ordinary Tuesday feel like a night away.",
      rows: 2,
    },
    {
      key: "cuisine_style",
      label: "Cuisine & service style",
      hint: "Cuisine, service model, vibe.",
      placeholder: "e.g. Coastal Latin, upscale-casual full service",
    },
    {
      key: "target_guests",
      label: "Who are your guests?",
      hint: "Who you're built for — the AI weighs complaints from your core guests heavier.",
      placeholder: "e.g. Date nights, business dinners, neighborhood regulars",
    },
    {
      key: "goals",
      label: "What are your goals this year?",
      hint: "Ratings targets, growth plans, what success looks like.",
      placeholder: "e.g. Hold 4.5★ across all locations, grow private events",
      rows: 2,
    },
    {
      key: "notes",
      label: "Anything else the AI should know?",
      hint: "Location quirks, recent changes, sensitivities.",
      placeholder:
        "e.g. Wynwood skews younger and louder; we just changed chefs at Downtown.",
      rows: 2,
    },
  ];

  return (
    <form onSubmit={handleSave} className={cn("space-y-5", compact && "space-y-4")}>
      {FIELDS.slice(0, 3).map((f) => (
        <div key={f.key} className="space-y-1.5">
          <label className="block">
            <span className="text-sm font-medium text-ink">{f.label}</span>
            <span className="block text-xs text-ink-faint mt-0.5">{f.hint}</span>
          </label>
          {f.rows ? (
            <textarea
              value={profile[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
              placeholder={f.placeholder}
              rows={f.rows}
              className={cn(fieldClass, "resize-none")}
            />
          ) : (
            <input
              type="text"
              value={profile[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
              placeholder={f.placeholder}
              className={fieldClass}
            />
          )}
        </div>
      ))}

      {/* Price point */}
      <div className="space-y-1.5">
        <label className="block">
          <span className="text-sm font-medium text-ink">Price point</span>
          <span className="block text-xs text-ink-faint mt-0.5">
            Guests forgive different things at different price points.
          </span>
        </label>
        <div className="flex gap-2">
          {PRICE_POINTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => set("price_point", p)}
              className={cn(
                "flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all",
                profile.price_point === p
                  ? "bg-forest text-paper border-forest"
                  : "bg-paper text-ink-soft border-line hover:border-ink-faint"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {FIELDS.slice(3).map((f) => (
        <div key={f.key} className="space-y-1.5">
          <label className="block">
            <span className="text-sm font-medium text-ink">{f.label}</span>
            <span className="block text-xs text-ink-faint mt-0.5">{f.hint}</span>
          </label>
          {f.rows ? (
            <textarea
              value={profile[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
              placeholder={f.placeholder}
              rows={f.rows}
              className={cn(fieldClass, "resize-none")}
            />
          ) : (
            <input
              type="text"
              value={profile[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
              placeholder={f.placeholder}
              className={fieldClass}
            />
          )}
        </div>
      ))}

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          className="bg-forest hover:bg-forest-soft text-paper h-10 px-6"
        >
          {submitLabel}
        </Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-pos font-medium">
            <Check className="w-4 h-4" />
            Saved — recommendations will use this
          </span>
        )}
      </div>
    </form>
  );
}
