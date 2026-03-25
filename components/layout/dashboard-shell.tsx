"use client";

import { AuthProvider } from "@/components/providers/auth-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SidebarProvider>
        <TooltipProvider>
          <div className="flex min-h-screen w-full">
            <AppSidebar />
            <div className="flex flex-1 flex-col">
              <Header />
              <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6">
                {children}
              </main>
              <MobileNav />
            </div>
          </div>
        </TooltipProvider>
      </SidebarProvider>
    </AuthProvider>
  );
}
