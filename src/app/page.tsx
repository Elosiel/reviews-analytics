import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  // Supabase falls back to the Site URL (this page) when an email-confirm
  // redirect isn't on its allowlist. Forward the one-time code to the auth
  // callback instead of dropping it, so the sign-up still completes.
  const { code } = await searchParams;
  if (code) {
    redirect(`/api/auth/callback?code=${encodeURIComponent(code)}`);
  }

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    redirect("/setup-required");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
