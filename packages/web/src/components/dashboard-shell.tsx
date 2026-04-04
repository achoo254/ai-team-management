import { Outlet } from 'react-router'
import { SidebarProvider } from '@/components/ui/sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppSidebar } from '@/components/app-sidebar'
import { Header } from '@/components/header'
import { MobileNav } from '@/components/mobile-nav'
import { useForegroundMessages } from '@/hooks/use-fcm'

export function DashboardShell() {
  useForegroundMessages()

  return (
    <SidebarProvider>
      <TooltipProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar />
          <div className="flex flex-1 flex-col min-w-0">
            <Header />
            <main className="flex-1 p-4 lg:p-6 pb-20 lg:pb-6 overflow-hidden">
              <Outlet />
            </main>
            <MobileNav />
          </div>
        </div>
      </TooltipProvider>
    </SidebarProvider>
  )
}
