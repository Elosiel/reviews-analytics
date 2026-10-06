import { Resend } from "resend";
import { INVITE_TTL_DAYS } from "@/lib/team/invite-token";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * Emails a team invite. Returns false (and the owner copies the link from
 * Settings instead) when Resend isn't configured or the send fails.
 */
export async function sendInviteEmail(opts: {
  to: string;
  inviteUrl: string;
  inviterName: string;
  restaurantName: string;
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) return false;
  const inviter = esc(opts.inviterName);
  const restaurant = esc(opts.restaurantName);
  const url = esc(opts.inviteUrl);
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM,
      to: opts.to,
      subject: `${opts.inviterName} invited you to ${opts.restaurantName} on Reviews Analytics`,
      html: `
        <div style="font-family: -apple-system, Segoe UI, Helvetica, Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #1d1a14;">
          <p style="font-size: 16px;">${inviter} invited you to join <strong>${restaurant}</strong> on Reviews Analytics.</p>
          <p style="font-size: 14px; color: #5f594c;">You'll see the same review insights, reports, and meeting agendas as the rest of the team.</p>
          <p style="margin: 28px 0;">
            <a href="${url}" style="background: #17402f; color: #fffdf8; text-decoration: none; padding: 12px 22px; border-radius: 10px; font-weight: 600;">Accept invite</a>
          </p>
          <p style="font-size: 12px; color: #97907f;">This link works for this email address only and expires in ${INVITE_TTL_DAYS} days. If you weren't expecting it, you can ignore this email.</p>
        </div>`,
    });
    if (error) {
      console.error("Invite email failed:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Invite email failed:", err);
    return false;
  }
}
