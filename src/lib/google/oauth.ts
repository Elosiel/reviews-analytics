/**
 * Google Business Profile OAuth helpers — READ-ONLY.
 *
 * v1.0 never writes back to Google. No replies, no posts.
 * The user-facing consent copy should say:
 * "We need access to your Google reviews to build your report.
 *  Your listing and reviews stay exactly as they are."
 *
 * Scope note: `business.manage` is currently the only scope the GBP API
 * accepts for reviews.list and batchGetReviews, even for read-only access.
 * Google has not published a narrower read-only scope as of June 2025.
 * VERIFY this before requesting approval:
 * https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list
 *
 * APIs to enable in Google Cloud Console:
 * - Google Business Profile API
 * - My Business Business Information API
 */

const GOOGLE_OAUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

// READ-ONLY intent — business.manage is the minimal available scope for GBP reviews.
// Verify against current Google docs before submitting for API approval.
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/business.manage",
  "openid",
  "email",
  "profile",
].join(" ");

export function getGoogleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`,
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `${GOOGLE_OAUTH_BASE}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/google/callback`,
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${await res.text()}`);
  }

  return res.json();
}

export async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    // Caller must set location.connection_broken = true and send the
    // "we haven't been able to read your reviews since [date]" alert.
    // A broken connection = stale ranked list, which is as bad for trust
    // as a missed reply was in a write-path product.
    throw new Error(`Token refresh failed: ${await res.text()}`);
  }

  return res.json();
}
