"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Building2,
  ClipboardList,
  Gauge,
  LogOut,
  MapPin,
  Menu,
  MessageSquareText,
  ServerCog,
  Settings,
  Users,
  X,
} from "lucide-react";
import LogoMark from "@/components/shared/LogoMark";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/super-admin", label: "Overview", icon: Gauge, exact: true },
  { href: "/super-admin/customers", label: "Customers", icon: Building2 },
  { href: "/super-admin/users", label: "Users", icon: Users },
  { href: "/super-admin/locations", label: "Locations", icon: MapPin },
  { href: "/super-admin/activity", label: "Activity", icon: Activity },
  { href: "/super-admin/feedback", label: "Feedback", icon: MessageSquareText },
  { href: "/super-admin/system", label: "System health", icon: ServerCog },
  { href: "/super-admin/audit-log", label: "Audit log", icon: ClipboardList },
  { href: "/super-admin/settings", label: "Settings", icon: Settings },
];

export default function AdminShell({ email, role, children }: { email: string; role: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await createClient().auth.signOut();
    window.location.assign("/super-admin/login");
  }

  const nav = (
    <nav className="flex-1 space-y-0.5 px-3 py-4" aria-label="Admin">
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium motion-safe:transition-colors",
              active ? "bg-white/10 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
            )}
          >
            <item.icon className={cn("h-4 w-4", active ? "text-signal" : "")} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/10">
      <LogoMark className="h-7 w-7" />
      <div>
        <p className="text-sm font-semibold text-white leading-tight">Reviews Analytics</p>
        <p className="text-[10px] uppercase tracking-[0.2em] text-signal">Control center</p>
      </div>
    </div>
  );

  const footer = (
    <div className="border-t border-white/10 px-4 py-4">
      <p className="truncate text-xs text-zinc-300" title={email}>{email}</p>
      <p className="text-[11px] text-zinc-500">{role.replace("_", " ")} · 2FA verified</p>
      <button
        onClick={signOut}
        className="mt-3 inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white"
      >
        <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
        Sign out
      </button>
    </div>
  );

  return (
    <div className="min-h-dvh bg-zinc-50 text-zinc-900 lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="hidden lg:flex lg:sticky lg:top-0 lg:h-dvh flex-col bg-night">
        {brand}
        {nav}
        {footer}
      </aside>

      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between bg-night px-4 py-3">
        <div className="flex items-center gap-2">
          <LogoMark className="h-6 w-6" />
          <span className="text-sm font-semibold text-white">Control center</span>
        </div>
        <button onClick={() => setOpen(true)} aria-label="Open navigation" className="text-zinc-300">
          <Menu className="h-5 w-5" />
        </button>
      </header>
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="flex w-64 flex-col bg-night">
            <div className="flex justify-end px-3 pt-3">
              <button onClick={() => setOpen(false)} aria-label="Close navigation" className="text-zinc-400">
                <X className="h-5 w-5" />
              </button>
            </div>
            {brand}
            {nav}
            {footer}
          </div>
          <button className="flex-1 bg-black/40" aria-label="Close navigation" onClick={() => setOpen(false)} />
        </div>
      )}

      <main className="min-w-0 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}
