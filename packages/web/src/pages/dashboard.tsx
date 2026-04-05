import { useState } from "react";
import { useSearchParams } from "react-router";
import type { DashboardRange } from "@/hooks/use-dashboard";
import { useDashboardEnhanced } from "@/hooks/use-dashboard";
import { useAuth } from "@/hooks/use-auth";
import { DashboardRangeFilter } from "@/components/dashboard-range-filter";
import { DashboardSeatFilter } from "@/components/dashboard-seat-filter";
import { DashboardStatOverview } from "@/components/dashboard-stat-overview";
import { DashboardSeatUsageChart } from "@/components/dashboard-seat-usage-chart";
import { DashboardTrendChart } from "@/components/dashboard-trend-chart";
import { DashboardSeatEfficiency } from "@/components/dashboard-seat-efficiency";
import { DashboardDetailTable } from "@/components/dashboard-detail-table";
import { DashboardEfficiency } from "@/components/dashboard-efficiency";
import { DashboardPeakHoursHeatmap } from "@/components/dashboard-peak-hours-heatmap";
import { DashboardWelcome } from "@/components/dashboard-welcome";
import { DashboardPersonalContext } from "@/components/dashboard-personal-context";
import { WatchEmptyStateBanner } from "@/components/watch-empty-state-banner";
import { StaleDataBanner } from "@/components/stale-data-banner";
import { TokenFailurePanel } from "@/components/token-failure-panel";
import { ForecastUrgentCard } from "@/components/forecast-urgent-card";
import { OverviewTabContent } from "@/components/overview-tab-content";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type TabValue = "detail" | "overview";

export default function DashboardPage() {
  const [range, setRange] = useState<DashboardRange>("month");
  const [seatIds, setSeatIds] = useState<string[]>([]);
  const { user } = useAuth();
  const { data } = useDashboardEnhanced(range, seatIds);
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab: TabValue =
    searchParams.get("tab") === "overview" ? "overview" : "detail";

  function handleTabChange(value: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === "detail") {
          next.delete("tab");
        } else {
          next.set("tab", value);
        }
        return next;
      },
      { replace: true }
    );
  }

  // Show welcome for non-admin users with no seats
  if (
    user?.role !== "admin" &&
    data &&
    data.usagePerSeat.length === 0 &&
    data.totalSeats === 0
  ) {
    return <DashboardWelcome />;
  }

  const staleSeats = data?.stale_seats ?? [];
  const tokenFailures = data?.token_failures ?? [];
  const urgentForecasts = data?.urgent_forecasts ?? [];

  return (
    <div className="space-y-6">
      {/* Top-most: stale data warning banner (dismissible per session) */}
      <StaleDataBanner staleSeats={staleSeats} />
      <WatchEmptyStateBanner />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="detail">Chi tiết</TabsTrigger>
          <TabsTrigger value="overview">Tổng quan</TabsTrigger>
        </TabsList>

        {/* ── Chi tiết tab ─────────────────────────────────────────────────── */}
        <TabsContent value="detail" className="space-y-6 mt-4">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <DashboardSeatFilter value={seatIds} onChange={setSeatIds} />
            <DashboardRangeFilter value={range} onChange={setRange} />
          </div>

          {/* Row 1: Key metrics */}
          <DashboardStatOverview range={range} seatIds={seatIds} />

          {/* Urgent forecast card — admin only */}
          {user?.role === "admin" && urgentForecasts.length > 0 && (
            <ForecastUrgentCard forecasts={urgentForecasts} />
          )}

          {/* Row 2: Charts */}
          <div className="grid gap-6 xl:grid-cols-2">
            <DashboardSeatUsageChart range={range} seatIds={seatIds} />
            <DashboardTrendChart range={range} seatIds={seatIds} />
          </div>

          {/* Row 3: Personal context (non-admin only) */}
          {user?.role !== "admin" && <DashboardPersonalContext />}

          {/* Row 4: Seat efficiency */}
          <DashboardSeatEfficiency range={range} seatIds={seatIds} />

          {/* Row 5: Usage efficiency */}
          <DashboardEfficiency range={range} seatIds={seatIds} />

          {/* Peak hours heatmap */}
          <DashboardPeakHoursHeatmap range={range} seatIds={seatIds} />

          {/* Admin section: token failure panel */}
          {user?.role === "admin" && tokenFailures.length > 0 && (
            <TokenFailurePanel failures={tokenFailures} />
          )}

          {/* Full detail table */}
          <DashboardDetailTable range={range} seatIds={seatIds} />
        </TabsContent>

        {/* ── Tổng quan tab ────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-4">
          <OverviewTabContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}
