import { FileText, Link2, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import RestaurantProfileForm, {
  EMPTY_PROFILE,
} from "@/components/shared/RestaurantProfileForm";
import RestaurantDocuments from "@/components/shared/RestaurantDocuments";
import RestaurantLinks from "@/components/shared/RestaurantLinks";
import type { RestaurantProfile, TenantDocument } from "@/types";

/**
 * "Your restaurant" — the single place the owner teaches the AI who they
 * are: profile answers, website links, and uploaded documents (menus,
 * promotions, wine lists). Everything here is read from / written to
 * Supabase (tenant_profiles + tenant_documents + Storage), RLS-scoped to
 * the tenant, so it persists across devices and sessions.
 */
export default async function RestaurantPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("id", user!.id)
    .single();
  const tenantId: string | null = profileRow?.tenant_id ?? null;

  const { data: ctx } = tenantId
    ? await supabase
        .from("tenant_profiles")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle()
    : { data: null };

  const { data: docRows } = tenantId
    ? await supabase
        .from("tenant_documents")
        .select(
          "id, kind, title, file_name, mime_type, size_bytes, storage_path, status, uploaded_at"
        )
        .eq("tenant_id", tenantId)
        .order("uploaded_at", { ascending: false })
    : { data: null };

  const profile: RestaurantProfile = ctx
    ? {
        mission: ctx.mission ?? "",
        cuisine_style: ctx.cuisine_style ?? "",
        target_guests: ctx.target_guests ?? "",
        price_point: ctx.price_point ?? "$$",
        goals: ctx.goals ?? "",
        notes: ctx.notes ?? "",
        website_url: ctx.website_url ?? "",
        menu_url: ctx.menu_url ?? "",
      }
    : EMPTY_PROFILE;

  const documents = (docRows ?? []) as TenantDocument[];

  return (
    <div className="px-6 py-10 max-w-3xl mx-auto space-y-7">
      {/* ── Editorial header ── */}
      <div className="max-w-2xl">
        <p className="text-[11px] uppercase tracking-[0.16em] text-ink-faint font-medium">
          Your restaurant
        </p>
        <h1 className="font-heading text-[28px] leading-snug font-semibold text-ink mt-1.5">
          The more we know, the sharper the advice.
        </h1>
        <p className="text-sm text-ink-soft mt-2 leading-relaxed">
          Everything on this page is context for the AI — your menu, your
          promotions, your website, your goals. Recommendations stop being
          generic advice and start sounding like someone who actually eats
          at your restaurant. Your listing and reviews stay exactly as they
          are.
        </p>
      </div>

      {/* ── Website & menu links ── */}
      <div className="bg-paper rounded-2xl border border-line">
        <div className="px-6 py-5 border-b border-line-soft">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-forest" />
            <h2 className="font-heading text-lg font-semibold text-ink">
              Website & menu
            </h2>
          </div>
          <p className="text-xs text-ink-soft mt-1">
            Your public face. The AI reads these to learn your voice, your
            dishes, and what you promise guests.
          </p>
        </div>
        <div className="px-6 py-5">
          <RestaurantLinks
            initialWebsite={profile.website_url}
            initialMenu={profile.menu_url}
          />
        </div>
      </div>

      {/* ── Documents ── */}
      <div className="bg-paper rounded-2xl border border-line">
        <div className="px-6 py-5 border-b border-line-soft">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-forest" />
            <h2 className="font-heading text-lg font-semibold text-ink">
              Documents
            </h2>
          </div>
          <p className="text-xs text-ink-soft mt-1">
            Menus, promotions, wine lists, brand notes — anything a great
            consultant would ask to see on day one. When a guest complains
            about value, the AI that has read your menu gives better advice
            than one guessing at your prices.
          </p>
        </div>
        <div className="px-6 py-5">
          <RestaurantDocuments tenantId={tenantId} initialDocuments={documents} />
        </div>
      </div>

      {/* ── Profile ── */}
      <div className="bg-paper rounded-2xl border border-line">
        <div className="px-6 py-5 border-b border-line-soft">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-forest" />
            <h2 className="font-heading text-lg font-semibold text-ink">
              Restaurant profile
            </h2>
          </div>
          <p className="text-xs text-ink-soft mt-1">
            The questions that set the tone. Every recommendation on your
            dashboard is written against these answers — keep them current.
          </p>
        </div>
        <div className="px-6 py-5">
          <RestaurantProfileForm initialProfile={profile} />
        </div>
      </div>
    </div>
  );
}
