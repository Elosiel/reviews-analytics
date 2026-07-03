import { NextResponse } from "next/server";

/**
 * Place details for the /preview teaser — fetches the handful of public
 * reviews Google exposes for any place (max ~5, by design). That ceiling
 * is the product's hook: the full history requires the owner to connect
 * their Business Profile.
 *
 * Recency matters for the pitch, so reviews come from the legacy Place
 * Details API (`reviews_sort=newest`) — the new Places API only returns
 * its "most relevant" five with no sort option. The new API still supplies
 * name/address/rating; legacy reviews are used when available, with the
 * new API's reviews (sorted newest-first) as fallback.
 */

type SampleReview = {
  author: string;
  rating: number;
  text: string;
  relative_time: string;
};

export async function GET(request: Request) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return NextResponse.json({ place: null });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();
  // Place IDs are alphanumeric with _ and -; reject anything else before
  // it touches the URL path.
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) {
    return NextResponse.json({ place: null }, { status: 400 });
  }

  const [newRes, legacyRes] = await Promise.all([
    fetch(`https://places.googleapis.com/v1/places/${id}`, {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "id,displayName,formattedAddress,rating,userRatingCount,reviews",
      },
      next: { revalidate: 300 },
    }),
    fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${id}&fields=reviews&reviews_sort=newest&key=${key}`,
      { next: { revalidate: 300 } }
    ).catch(() => null),
  ]);

  if (!newRes.ok) {
    console.error("Places details failed:", newRes.status, await newRes.text());
    return NextResponse.json({ place: null }, { status: 200 });
  }

  const p = await newRes.json();

  // Newest-first reviews from the legacy API when it's enabled on the key.
  let sample_reviews: SampleReview[] = [];
  if (legacyRes?.ok) {
    type LegacyReview = {
      author_name?: string;
      rating?: number;
      text?: string;
      relative_time_description?: string;
      time?: number;
    };
    try {
      const legacy = await legacyRes.json();
      if (legacy.status === "OK" && Array.isArray(legacy.result?.reviews)) {
        sample_reviews = (legacy.result.reviews as LegacyReview[])
          .slice()
          .sort((a, b) => (b.time ?? 0) - (a.time ?? 0))
          .slice(0, 3)
          .map((r) => ({
            author: r.author_name ?? "A Google user",
            rating: r.rating ?? 0,
            text: r.text ?? "",
            relative_time: r.relative_time_description ?? "",
          }));
      }
    } catch {
      // fall through to the new API's reviews
    }
  }

  // Fallback: the new API's five "most relevant", re-sorted newest-first.
  if (sample_reviews.length === 0) {
    type GReview = {
      authorAttribution?: { displayName?: string };
      rating?: number;
      text?: { text?: string };
      relativePublishTimeDescription?: string;
      publishTime?: string;
    };
    sample_reviews = ((p.reviews ?? []) as GReview[])
      .slice()
      .sort(
        (a, b) =>
          (Date.parse(b.publishTime ?? "") || 0) -
          (Date.parse(a.publishTime ?? "") || 0)
      )
      .slice(0, 3)
      .map((r) => ({
        author: r.authorAttribution?.displayName ?? "A Google user",
        rating: r.rating ?? 0,
        text: r.text?.text ?? "",
        relative_time: r.relativePublishTimeDescription ?? "",
      }));
  }

  const place = {
    id: p.id as string,
    name: (p.displayName?.text as string) ?? "Unknown",
    address: (p.formattedAddress as string) ?? "",
    rating: (p.rating as number) ?? 0,
    total_reviews: (p.userRatingCount as number) ?? 0,
    sample_reviews,
  };

  return NextResponse.json({ place });
}
