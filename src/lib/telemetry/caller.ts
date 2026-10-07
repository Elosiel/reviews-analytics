import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { IMP_META_COOKIE, parseImpersonationMeta } from "@/lib/admin/impersonation-shared";

export interface Caller {
  userId: string;
  email: string | null;
  tenantId: string;
  /** Set when this session is an admin's "view as" session. */
  impersonationSessionId: string | null;
}

/**
 * Who is calling, from the verified session only — tenant comes from the
 * caller's own profile row, never from the request. Impersonation is
 * confirmed against the database (an open session for this exact user).
 */
export async function getCaller(): Promise<Caller | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = error ? null : data?.claims;
  if (!claims?.sub) return null;
  const { data: profile } = await supabase.from("profiles").select("tenant_id, email").eq("id", claims.sub).maybeSingle();
  if (!profile?.tenant_id) return null;

  let impersonationSessionId: string | null = null;
  const meta = parseImpersonationMeta((await cookies()).get(IMP_META_COOKIE)?.value);
  if (meta) {
    const { data: imp } = await createServiceClient()
      .from("impersonation_sessions")
      .select("id")
      .eq("id", meta.id)
      .eq("target_user_id", claims.sub)
      .is("ended_at", null)
      .maybeSingle();
    impersonationSessionId = imp?.id ?? null;
  }
  return { userId: claims.sub, email: profile.email ?? (claims.email as string | undefined) ?? null, tenantId: profile.tenant_id, impersonationSessionId };
}
