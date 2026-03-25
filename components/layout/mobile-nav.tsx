"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  BarChart3,
  Menu,
  Monitor,
  Users,
  AlertTriangle,
  Settings,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";

const bottomItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Lịch", href: "/schedule", icon: Calendar },
  { label: "Log", href: "/log-usage", icon: BarChart3 },
];

const sheetItems = [
  { label: "Seats", href: "/seats", icon: Monitor },
  { label: "Teams", href: "/teams", icon: Users },
  { label: "Cảnh báo", href: "/alerts", icon: AlertTriangle },
  { label: "Admin", href: "/admin", icon: Settings, adminOnly: true },
];

export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);

  const visibleSheetItems = sheetItems.filter(
    (item) => !item.adminOnly || user?.role === "admin"
  );

  function handleSheetNav(href: string) {
    setSheetOpen(false);
    router.push(href);
  }

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background lg:hidden">
        <div className="flex h-16 items-stretch">
          {bottomItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <button
            onClick={() => setSheetOpen(true)}
            className="flex flex-1 flex-col items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Menu className="h-5 w-5" />
            <span>Thêm</span>
          </button>
        </div>
      </nav>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="pb-safe">
          <SheetHeader className="mb-4">
            <SheetTitle>Điều hướng</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-1">
            {visibleSheetItems.map((item) => {
              const active = isActive(item.href);
              return (
                <button
                  key={item.href}
                  onClick={() => handleSheetNav(item.href)}
                  className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm transition-colors ${
                    active
                      ? "bg-accent text-accent-foreground font-medium"
                      : "hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
