import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/google/oauth";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// AES-256-GCM encryption for tokens at rest
function encryptToken(plaintext: string): string {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  // Store as iv:tag:encrypted (all hex)
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

// Exported so the refresh helper can use it
export function decryptToken(ciphertext: string): string {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY!, "hex");
  const [ivHex, tagHex, encryptedHex] = ciphertext.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

// Handles the OAuth callback from Google after the user grants access.
// Exchanges the code for tokens, encrypts them, and stores in google_tokens.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  if (error || !code || !state) {
    const reason = error ?? "missing_code";
    return NextResponse.redirect(
      `${appUrl}/onboarding?error=${reason}`
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${appUrl}/login`);
  }

  // Verify CSRF state
  const expectedState = user.user_metadata?.google_oauth_state;
  if (!expectedState || expectedState !== state) {
    return NextResponse.redirect(`${appUrl}/onboarding?error=invalid_state`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    // Encrypt tokens before storing
    const accessEnc = Buffer.from(encryptToken(tokens.access_token));
    const refreshEnc = Buffer.from(encryptToken(tokens.refresh_token));
    const expiresAt = Math.floor(Date.now() / 1000) + (tokens.expires_in ?? 3600);

    // Get tenant_id from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile) throw new Error("Profile not found");

    // Upsert — replace if already connected
    await supabase.from("google_tokens").upsert(
      {
        user_id: user.id,
        tenant_id: profile.tenant_id,
        access_token_enc: accessEnc,
        refresh_token_enc: refreshEnc,
        expires_at: expiresAt,
        scope: tokens.scope ?? "",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    // Clear the CSRF state from user metadata
    await supabase.auth.updateUser({
      data: { google_oauth_state: null },
    });

    // Redirect back to onboarding to pick locations
    return NextResponse.redirect(`${appUrl}/onboarding?gbp=connected`);
  } catch (err) {
    console.error("Google callback error:", err);
    return NextResponse.redirect(
      `${appUrl}/onboarding?error=token_exchange_failed`
    );
  }
}
