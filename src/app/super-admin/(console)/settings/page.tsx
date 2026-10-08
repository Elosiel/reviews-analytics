import { requireAdminPage } from "@/lib/admin/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { ADMIN_ROLES } from "@/lib/admin/access";
import { Badge, Card, PageHeader, Table, fmtDate, td, th } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdminPage();
  const service = createServiceClient();
  const { data: admins } = await service.from("admin_users").select("user_id, role, granted_at, disabled_at").order("granted_at");
  const ids = (admins ?? []).map((a) => a.user_id);
  const { data: profiles } = ids.length ? await service.from("profiles").select("id, email, full_name").in("id", ids) : { data: [] };
  const byId = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Settings" subtitle="Who can use the control center." />
      <Table>
        <thead>
          <tr>
            <th className={th}>Admin</th>
            <th className={th}>Role</th>
            <th className={th}>Since</th>
            <th className={th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {(admins ?? []).map((a) => (
            <tr key={a.user_id}>
              <td className={td}>{byId[a.user_id]?.email ?? a.user_id}</td>
              <td className={td}><Badge tone="dark">{a.role.replace("_", " ")}</Badge></td>
              <td className={td}>{fmtDate(a.granted_at)}</td>
              <td className={td}>{a.disabled_at ? <Badge tone="red">disabled</Badge> : <Badge tone="green">active</Badge>}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Card title="Adding or removing admins">
        <div className="space-y-2 text-sm text-zinc-700">
          <p>
            Admin roles can&apos;t be granted from this console or anywhere in the app — only by the Supabase project owner,
            so a compromised admin session can&apos;t create more admins.
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Create the login in Supabase → Authentication → Users → Add user (they set the password there or via the email).</li>
            <li>
              In Supabase → SQL Editor run: <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">select public.grant_admin_role(&apos;person@reviewsanalytics.ai&apos;);</code>
            </li>
            <li>They sign in at /super-admin/login and set up two-factor on first sign-in.</li>
          </ol>
          <p>
            To remove access: <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs">update public.admin_users set disabled_at = now() where user_id = &apos;…&apos;;</code>
          </p>
          <p className="text-xs text-zinc-500">Roles: {ADMIN_ROLES.join(", ")}. Today only super_admin is in use; the others are reserved with narrower permissions.</p>
        </div>
      </Card>
    </div>
  );
}
