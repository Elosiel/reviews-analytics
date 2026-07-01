/**
 * Google Business Profile API client.
 * Docs: https://developers.google.com/my-business/reference/businessinformation/rest
 */

const GBP_BASE = "https://mybusinessbusinessinformation.googleapis.com/v1";
const REVIEWS_BASE = "https://mybusiness.googleapis.com/v4";

async function gbpFetch(url: string, accessToken: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`GBP API error ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

/** List all accounts the user has access to */
export async function listAccounts(accessToken: string) {
  return gbpFetch(`${GBP_BASE}/accounts`, accessToken);
}

/** List all locations under an account */
export async function listLocations(accessToken: string, accountId: string) {
  return gbpFetch(
    `${GBP_BASE}/${accountId}/locations?readMask=name,title,storefrontAddress,metadata`,
    accessToken
  );
}

/** Fetch reviews for a location (paginated) */
export async function listReviews(
  accessToken: string,
  accountId: string,
  locationId: string,
  pageToken?: string
) {
  const params = new URLSearchParams({ pageSize: "50" });
  if (pageToken) params.set("pageToken", pageToken);

  return gbpFetch(
    `${REVIEWS_BASE}/${accountId}/locations/${locationId}/reviews?${params}`,
    accessToken
  );
}
