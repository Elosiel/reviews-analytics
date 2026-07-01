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
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/locations", label: "Locations", icon: MapPin },
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

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-zinc-100">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-zinc-900 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-zinc-900 text-sm tracking-tight">
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
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
              {item.label === "Overview" && driftAlertCount > 0 && (
                <Badge className="ml-auto text-xs bg-red-100 text-red-700 border-0 px-1.5 py-0">
                  {driftAlertCount}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Drift alert callout */}
      {driftAlertCount > 0 && (
        <div className="mx-3 mb-3 rounded-lg bg-red-50 border border-red-100 p-3 space-y-1">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            <span className="text-xs font-medium text-red-700">
              {driftAlertCount} drift alert{driftAlertCount !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-xs text-red-600">
            Declining sentiment detected. Check your overview.
          </p>
        </div>
      )}

      {/* User */}
      <div className="px-3 pb-4 border-t border-zinc-100 pt-3">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar className="w-7 h-7">
            <AvatarImage src={user?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-zinc-200 text-zinc-700 text-xs font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-zinc-900 truncate">
              {user?.full_name ?? user?.email ?? "Account"}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-zinc-400 hover:text-zinc-700 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-zinc-50 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-56 bg-white border-r border-zinc-100 shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-56 bg-white border-r border-zinc-100 z-10">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-zinc-100">
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
          <span className="font-semibold text-zinc-900 text-sm tracking-tight">
            Reviews Analytics
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
