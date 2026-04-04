import { useLocation } from "react-router";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/seats": "Seats",
  "/schedule": "Lịch phân ca",
  "/usage": "Usage",
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
  const location = useLocation();
  const title = getPageTitle(location.pathname);

  return (
    <header className="flex h-14 items-center gap-3 border-b bg-background px-4 lg:px-6">
      {/* Mobile: hamburger trigger */}
      <SidebarTrigger className="lg:hidden" />

      <h1 className="flex-1 text-base font-semibold lg:text-lg">{title}</h1>

      <ThemeToggle />
      <UserMenu />
    </header>
  );
}
