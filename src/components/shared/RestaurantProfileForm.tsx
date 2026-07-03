"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RestaurantProfile } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { currentTenantId } from "@/lib/tenant";
import { cn } from "@/lib/utils";

const PRICE_POINTS: RestaurantProfile["price_point"][] = ["$", "$$", "$$$", "$$$$"];

// A fresh tenant starts blank — no demo prefill on a page a real owner fills in.
export const EMPTY_PROFILE: RestaurantProfile = {
  mission: "",
  cuisine_style: "",
  target_guests: "",
  price_point: "$$",
  goals: "",
  notes: "",
  website_url: "",
  menu_url: "",
};

interface RestaurantProfileFormProps {
  /** Server-loaded profile for this tenant (no flash). Falls back to blank. */
  initialProfile?: RestaurantProfile;
  /** Compact spacing for the onboarding step */
  compact?: boolean;
  submitLabel?: string;
  onSaved?: (profile: RestaurantProfile) => void;
}

/**
 * The questions that teach the AI who this restaurant is. Every
 * recommendation on the dashboard is written against these answers.
 * Persisted to the tenant_profiles table (RLS-scoped to the tenant).
 */
export default function RestaurantProfileForm({
  initialProfile,
  compact = false,
  submitLabel = "Save profile",
  onSaved,
}: RestaurantProfileFormProps) {
  const [profile, setProfile] = useState<RestaurantProfile>(
    initialProfile ?? EMPTY_PROFILE
  );
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof RestaurantProfile>(
    key: K,
    value: RestaurantProfile[K]
  ) {
    setProfile((p) => ({ ...p, [key]: value }));
    setSaved(false);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const tenantId = await currentTenantId();
      if (!tenantId) throw new Error("no-tenant");
      const supabase = createClient();
      // Only the profile columns — website_url / menu_url are owned by the
      // links form, so we leave them untouched on conflict.
      const { error: dbError } = await supabase.from("tenant_profiles").upsert(
        {
          tenant_id: tenantId,
          mission: profile.mission,
          cuisine_style: profile.cuisine_style,
          target_guests: profile.target_guests,
          price_point: profile.price_point,
          goals: profile.goals,
          notes: profile.notes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id" }
      );
      if (dbError) throw dbError;
      setSaved(true);
      onSaved?.(profile);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Couldn't save just now — please try again in a moment.");
    } finally {
      setSaving(false);
    }
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
          disabled={saving}
          className="bg-forest hover:bg-forest-soft text-paper h-10 px-6 disabled:opacity-50"
        >
          {saving ? "Saving…" : submitLabel}
        </Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-pos font-medium">
            <Check className="w-4 h-4" />
            Saved — recommendations will use this
          </span>
        )}
        {error && (
          <span className="text-sm text-neg font-medium" role="alert">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}
