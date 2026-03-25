"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Monitor,
  Calendar,
  BarChart3,
  Users,
  AlertTriangle,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Seats", href: "/seats", icon: Monitor },
  { label: "Lịch phân ca", href: "/schedule", icon: Calendar },
  { label: "Log Usage", href: "/log-usage", icon: BarChart3 },
  { label: "Teams", href: "/teams", icon: Users },
  { label: "Cảnh báo", href: "/alerts", icon: AlertTriangle },
  { label: "Admin", href: "/admin", icon: Settings, adminOnly: true },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const visibleItems = navItems.filter(
    (item) => !item.adminOnly || user?.role === "admin"
  );

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <span className="text-lg font-semibold tracking-tight">Claude Teams</span>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      render={<Link href={item.href} />}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t px-4 py-3">
        {user && (
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            </div>
            <Badge variant="secondary" className="shrink-0 uppercase text-xs">
              {user.team}
            </Badge>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
