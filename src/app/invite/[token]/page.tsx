import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { hashInviteToken } from "@/lib/team/invite-token";
import { inviteLinkStatus, normalizeEmail, restaurantDisplayName } from "@/lib/team/invite-shared";
import InviteAccept, { type InviteStatus } from "@/components/team/InviteAccept";

// The link token is the secret: the invite is looked up by its hash with the
// service role (invites aren't readable by outsiders), and the page shows
// only what the invitee needs — who invited them, to what, for which email.
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const service = createServiceClient();

  const { data: invite } = await service
    .from("team_invites")
    .select("email, tenant_id, invited_by, expires_at, accepted_at")
    .eq("token_hash", hashInviteToken(token))
    .maybeSingle();

  const status: InviteStatus = inviteLinkStatus(invite);

  let restaurantName = "a restaurant";
  let inviterName = "Someone";
  if (invite) {
    const [{ data: locations }, { data: inviter }] = await Promise.all([
      service.from("locations").select("name").eq("tenant_id", invite.tenant_id),
      invite.invited_by
        ? service.from("profiles").select("full_name, email").eq("id", invite.invited_by).single()
        : Promise.resolve({ data: null }),
    ]);
    restaurantName = restaurantDisplayName((locations ?? []).map((l) => l.name));
    inviterName = inviter?.full_name || inviter?.email || inviterName;
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <InviteAccept
      token={token}
      status={status}
      invitedEmail={invite?.email ?? null}
      restaurantName={restaurantName}
      inviterName={inviterName}
      signedInEmail={user?.email ? normalizeEmail(user.email) : null}
    />
  );
}
