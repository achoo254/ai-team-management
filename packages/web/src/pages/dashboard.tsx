import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router";
import type { DashboardRange } from "@/hooks/use-dashboard";
import { useDashboardEnhanced } from "@/hooks/use-dashboard";
import { useAuth } from "@/hooks/use-auth";
import { useUserSettings, useUpdateUserSettings } from "@/hooks/use-user-settings";
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
  const [range, setRange] = useState<DashboardRange>("day");
  const [seatIds, setSeatIds] = useState<string[]>([]);
  const { user } = useAuth();
  const { data } = useDashboardEnhanced(range, seatIds);
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: userSettings } = useUserSettings();
  const updateSettings = useUpdateUserSettings();
  const initialized = useRef(false);

  // Load persisted filters once on mount; ?seat= param overrides saved filters
  useEffect(() => {
    if (userSettings && !initialized.current) {
      const seatParam = searchParams.get("seat");
      if (seatParam) {
        setSeatIds([seatParam]);
      } else {
        const saved = userSettings.dashboard_filter_seat_ids ?? [];
        if (saved.length > 0) setSeatIds(saved);
      }
      if (userSettings.dashboard_default_range) setRange(userSettings.dashboard_default_range);
      initialized.current = true;
    }
  }, [userSettings, searchParams]);

  // Persist filter changes (debounced 1s)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleSeatFilterChange = useCallback(
    (ids: string[]) => {
      setSeatIds(ids);
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        updateSettings.mutate({ dashboard_filter_seat_ids: ids });
      }, 1000);
    },
    [updateSettings],
  );

  // Persist range change
  const rangeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleRangeChange = useCallback(
    (r: DashboardRange) => {
      setRange(r);
      clearTimeout(rangeTimer.current);
      rangeTimer.current = setTimeout(() => {
        updateSettings.mutate({ dashboard_default_range: r });
      }, 1000);
    },
    [updateSettings],
  );

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
        {/* Sticky bar: tabs + filters — desktop only */}
        <div className="lg:sticky lg:top-0 lg:z-30 lg:bg-background lg:pb-2 lg:-mt-6 lg:pt-6 lg:-mx-6 lg:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="detail">Chi tiết</TabsTrigger>
              <TabsTrigger value="overview">Tổng quan</TabsTrigger>
            </TabsList>
            {activeTab === "detail" && (
              <div className="flex flex-wrap items-center gap-2">
                <DashboardSeatFilter value={seatIds} onChange={handleSeatFilterChange} />
                <DashboardRangeFilter value={range} onChange={handleRangeChange} />
              </div>
            )}
          </div>
        </div>

        {/* ── Chi tiết tab ─────────────────────────────────────────────────── */}
        <TabsContent value="detail" className="space-y-6 mt-4">

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

          {/* Row 5: Usage efficiency summary */}
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
