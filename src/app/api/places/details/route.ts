import { NextResponse } from "next/server";

/**
 * Place details for the /preview teaser — fetches the handful of public
 * reviews Google exposes for any place (max ~5, by design). That ceiling
 * is the product's hook: the full history requires the owner to connect
 * their Business Profile.
 */
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

  const res = await fetch(
    `https://places.googleapis.com/v1/places/${id}`,
    {
      headers: {
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask":
          "id,displayName,formattedAddress,rating,userRatingCount,reviews",
      },
      next: { revalidate: 300 },
    }
  );

  if (!res.ok) {
    console.error("Places details failed:", res.status, await res.text());
    return NextResponse.json({ place: null }, { status: 200 });
  }

  const p = await res.json();
  type GReview = {
    authorAttribution?: { displayName?: string };
    rating?: number;
    text?: { text?: string };
    relativePublishTimeDescription?: string;
  };
  const place = {
    id: p.id as string,
    name: (p.displayName?.text as string) ?? "Unknown",
    address: (p.formattedAddress as string) ?? "",
    rating: (p.rating as number) ?? 0,
    total_reviews: (p.userRatingCount as number) ?? 0,
    sample_reviews: (((p.reviews ?? []) as GReview[]).slice(0, 3)).map((r) => ({
      author: r.authorAttribution?.displayName ?? "A Google user",
      rating: r.rating ?? 0,
      text: r.text?.text ?? "",
      relative_time: r.relativePublishTimeDescription ?? "",
    })),
  };

  return NextResponse.json({ place });
}
