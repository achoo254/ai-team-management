"use client";

import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { UserMenu } from "@/components/layout/user-menu";


const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/seats": "Seats",
  "/schedule": "Lịch phân ca",
  "/log-usage": "Log Usage",
  "/teams": "Teams",
  "/alerts": "Cảnh báo",
  "/admin": "Admin",
};

function getPageTitle(pathname: string): string {
  if (pathname === "/") return "Dashboard";
  const match = Object.entries(pageTitles).find(
    ([key]) => key !== "/" && pathname.startsWith(key)
  );
  return match ? match[1] : "Dashboard";
}

export function Header() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="flex h-14 items-center gap-3 border-b bg-background px-4 lg:px-6">
      {/* Mobile: hamburger trigger */}
      <SidebarTrigger className="lg:hidden" />

      <h1 className="flex-1 text-base font-semibold lg:text-lg">{title}</h1>

      <UserMenu />
    </header>
  );
}
