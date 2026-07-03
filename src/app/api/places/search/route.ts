import { NextResponse } from "next/server";

/**
 * Public place search for the /preview teaser — Google Places Text Search
 * (New). Proxied server-side so the API key never ships to the browser and
 * the response is normalized to exactly what the teaser needs.
 *
 * Returns { places: [...] } or { places: null } when no key is configured
 * (the teaser then stays in demo mode).
 */
export async function GET(request: Request) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return NextResponse.json({ places: null });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 3) return NextResponse.json({ places: [] });

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount",
    },
    body: JSON.stringify({
      textQuery: q,
      includedType: "restaurant",
      maxResultCount: 10,
    }),
    // Public data; short cache keeps repeat keystrokes cheap
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    console.error("Places search failed:", res.status, await res.text());
    return NextResponse.json({ places: [] }, { status: 200 });
  }

  const data = await res.json();
  type GPlace = {
    id: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    rating?: number;
    userRatingCount?: number;
  };
  const places = ((data.places ?? []) as GPlace[]).map((p) => ({
    id: p.id,
    name: p.displayName?.text ?? "Unknown",
    address: p.formattedAddress ?? "",
    rating: p.rating ?? 0,
    total_reviews: p.userRatingCount ?? 0,
  }));

  return NextResponse.json({ places });
}
