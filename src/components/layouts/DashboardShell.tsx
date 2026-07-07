"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  MapPin,
  Settings,
  LogOut,
  Menu,
  X,
  AlertTriangle,
  Reply,
  UtensilsCrossed,
  ClipboardList,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import LogoMark from "@/components/shared/LogoMark";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/locations", label: "Locations", icon: MapPin },
  { href: "/dashboard/sops", label: "SOPs", icon: ClipboardList },
  { href: "/dashboard/meetings", label: "Meetings", icon: Users },
  { href: "/dashboard/restaurant", label: "Your restaurant", icon: UtensilsCrossed },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

interface DashboardShellProps {
  children: React.ReactNode;
  user?: { email?: string; full_name?: string; avatar_url?: string } | null;
  driftAlertCount?: number;
}

export default function DashboardShell({
  children,
  user,
  driftAlertCount = 0,
}: DashboardShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? "?";

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-line-soft">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <LogoMark className="w-7 h-7" />
          <span className="font-heading font-semibold text-ink text-[15px] tracking-tight">
            Reviews Analytics
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors",
                isActive
                  ? "bg-forest text-paper"
                  : "text-ink-soft hover:bg-line-soft hover:text-ink"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
              {item.label === "Overview" && driftAlertCount > 0 && (
                <span className="ml-auto text-[11px] font-semibold bg-[#fbeeea] text-neg rounded-full px-1.5 py-0.5 tabular-nums">
                  {driftAlertCount}
                </span>
              )}
            </Link>
          );
        })}

        {/* Respond tier teaser — not part of 1.0 */}
        <div
          className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-ink-faint/70 cursor-default select-none"
          title="Answering reviews is on the roadmap"
        >
          <Reply className="w-4 h-4 shrink-0" />
          Respond
          <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide bg-line-soft text-ink-faint rounded-full px-2 py-0.5">
            Soon
          </span>
        </div>
      </nav>

      {/* Drift alert callout */}
      {driftAlertCount > 0 && (
        <div className="mx-3 mb-3 rounded-xl bg-[#fbeeea] border border-neg/20 p-3 space-y-1">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-neg" />
            <span className="text-xs font-semibold text-[#7a1f13]">
              {driftAlertCount} drift alert{driftAlertCount !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-xs text-[#8a5347]">
            Declining sentiment detected. Check your overview.
          </p>
        </div>
      )}

      {/* User */}
      <div className="px-3 pb-4 border-t border-line-soft pt-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar className="w-7 h-7">
            <AvatarImage src={user?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-forest/10 text-forest text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-ink truncate">
              {user?.full_name ?? user?.email ?? "Account"}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-ink-faint hover:text-ink transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-cream overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-60 bg-paper border-r border-line shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-ink/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-60 bg-paper border-r border-line z-10">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-paper border-b border-line">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            className="h-8 w-8"
          >
            {mobileOpen ? (
              <X className="w-4 h-4" />
            ) : (
              <Menu className="w-4 h-4" />
            )}
          </Button>
          <span className="font-heading font-semibold text-ink text-sm tracking-tight">
            Reviews Analytics
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
