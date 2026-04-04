import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/components/auth-provider'
import { DashboardShell } from '@/components/dashboard-shell'
import LoginPage from '@/pages/login'
import DashboardPage from '@/pages/dashboard'
import SeatsPage from '@/pages/seats'
import TeamsPage from '@/pages/teams'
import SchedulePage from '@/pages/schedule'
import AlertsPage from '@/pages/alerts'
import AdminPage from '@/pages/admin'
import UsagePage from '@/pages/usage'
import SettingsPage from '@/pages/settings'

export default function App() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AuthProvider><DashboardShell /></AuthProvider>}>
            <Route index element={<DashboardPage />} />
            <Route path="seats" element={<SeatsPage />} />
            <Route path="teams" element={<TeamsPage />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="usage" element={<UsagePage />} />
            <Route path="usage-metrics" element={<Navigate to="/usage" replace />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  )
}
