"use client";

import { useState } from "react";
import { Check, ExternalLink, Globe, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { currentTenantId } from "@/lib/tenant";
import { cn } from "@/lib/utils";

/** "marisolmiami.com" → "https://marisolmiami.com"; leaves valid URLs alone. */
function normalizeUrl(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

function isValidUrl(raw: string): boolean {
  if (!raw.trim()) return true; // empty is allowed
  try {
    const u = new URL(normalizeUrl(raw));
    return u.hostname.includes(".");
  } catch {
    return false;
  }
}

function domainOf(url: string): string {
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

interface RestaurantLinksProps {
  initialWebsite?: string;
  initialMenu?: string;
}

/**
 * Where the AI learns your public face — the website (voice, story, hours)
 * and the online menu (dish names, prices). Persisted onto
 * tenant_profiles.website_url / menu_url (RLS-scoped to the tenant).
 */
export default function RestaurantLinks({
  initialWebsite = "",
  initialMenu = "",
}: RestaurantLinksProps) {
  const [website, setWebsite] = useState(initialWebsite);
  const [menu, setMenu] = useState(initialMenu);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const websiteOk = isValidUrl(website);
  const menuOk = isValidUrl(menu);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!websiteOk || !menuOk) return;
    setSaving(true);
    setError(null);
    try {
      const tenantId = await currentTenantId();
      if (!tenantId) throw new Error("no-tenant");
      const nextWebsite = normalizeUrl(website);
      const nextMenu = normalizeUrl(menu);
      const supabase = createClient();
      // Only the link columns — the profile form owns the rest, so they
      // stay untouched on conflict.
      const { error: dbError } = await supabase.from("tenant_profiles").upsert(
        {
          tenant_id: tenantId,
          website_url: nextWebsite,
          menu_url: nextMenu,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id" }
      );
      if (dbError) throw dbError;
      setWebsite(nextWebsite);
      setMenu(nextMenu);
      setSaved(true);
      setTouched(false);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Couldn't save just now — please try again in a moment.");
    } finally {
      setSaving(false);
    }
  }

  const fieldClass =
    "w-full rounded-xl border bg-paper pl-10 pr-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-forest/40 focus:border-forest/40";

  const FIELDS = [
    {
      id: "website",
      icon: Globe,
      label: "Website",
      hint: "The AI reads it for your story, hours, and how you talk about yourselves.",
      placeholder: "yourrestaurant.com",
      value: website,
      set: setWebsite,
      ok: websiteOk,
    },
    {
      id: "menu",
      icon: UtensilsCrossed,
      label: "Online menu",
      hint: "Dish names and prices make recommendations concrete. Skip it if the menu lives on your site.",
      placeholder: "yourrestaurant.com/menus",
      value: menu,
      set: setMenu,
      ok: menuOk,
    },
  ];

  return (
    <form onSubmit={handleSave} className="space-y-5">
      {FIELDS.map((f) => {
        const Icon = f.icon;
        return (
          <div key={f.id} className="space-y-1.5">
            <label htmlFor={`link-${f.id}`} className="block">
              <span className="text-sm font-medium text-ink">{f.label}</span>
              <span className="block text-xs text-ink-faint mt-0.5">{f.hint}</span>
            </label>
            <div className="relative">
              <Icon className="w-4 h-4 text-ink-faint absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id={`link-${f.id}`}
                type="text"
                inputMode="url"
                value={f.value}
                onChange={(e) => {
                  f.set(e.target.value);
                  setTouched(true);
                  setSaved(false);
                }}
                placeholder={f.placeholder}
                className={cn(
                  fieldClass,
                  f.ok ? "border-line" : "border-neg/50 focus:ring-neg/30 focus:border-neg/50"
                )}
              />
              {f.value && f.ok && (
                <a
                  href={normalizeUrl(f.value)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Open ${domainOf(f.value)}`}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-forest transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
            {!f.ok && (
              <p className="text-xs text-neg" role="alert">
                That doesn&apos;t look like a web address — try something like{" "}
                {f.placeholder}
              </p>
            )}
          </div>
        );
      })}

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={!websiteOk || !menuOk || !touched || saving}
          className="bg-forest hover:bg-forest-soft text-paper h-10 px-6 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save links"}
        </Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-pos font-medium">
            <Check className="w-4 h-4" />
            Saved — the AI will read these
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
