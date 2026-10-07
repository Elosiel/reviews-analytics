import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/admin/auth";

// Lets the admin sign-in page know which step comes next. Reveals nothing
// beyond the caller's own status.
export async function GET() {
  const { access } = await getAdminAccess();
  if (access.ok) return NextResponse.json({ status: "ok", role: access.role });
  return NextResponse.json({ status: access.reason }, { status: access.reason === "unauthenticated" ? 401 : 200 });
}
