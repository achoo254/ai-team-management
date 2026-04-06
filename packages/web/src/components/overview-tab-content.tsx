/**
 * Overview Tab Content
 * Renders the fleet-level overview panel (ex-BLD page) inside the Dashboard tabs.
 * Data is automatically scoped by the API based on the authenticated user's role:
 * - admin  → all company seats
 * - user   → user's own seat_ids
 */

import { RefreshCw, Download } from "lucide-react";
import { useQueryClient, useIsFetching } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useFleetKpis, useSeatStats, useRebalanceSuggestions } from "@/hooks/use-bld-metrics";
import { BldFleetKpiCards } from "@/components/bld-fleet-kpi-cards";
import { BldWwComparisonChart } from "@/components/bld-ww-comparison-chart";
import { BldDdComparisonChart } from "@/components/bld-dd-comparison-chart";
import { BldSeatStatsPanel } from "@/components/bld-seat-stats-panel";
import { BldActionsPanel } from "@/components/bld-actions-panel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { generateOverviewHtml } from "@/lib/export-overview-html";

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-60 rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}

export function OverviewTabContent() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();

  const fleetQuery = useFleetKpis();
  const seatStatsQuery = useSeatStats();
  const suggestionsQuery = useRebalanceSuggestions();

  // Track active refetching for spinner animation
  const bldFetching = useIsFetching({ queryKey: ["bld"] });
  const isRefreshing = bldFetching > 0;

  const isLoading =
    fleetQuery.isLoading || seatStatsQuery.isLoading || suggestionsQuery.isLoading;
  const hasError =
    fleetQuery.isError || seatStatsQuery.isError || suggestionsQuery.isError;

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ["bld"] });
  }

  function handleExportHtml() {
    if (!fleetQuery.data) return;
    const html = generateOverviewHtml({
      kpis: fleetQuery.data.kpis,
      wwHistory: fleetQuery.data.wwHistory,
      ddHistory: fleetQuery.data.ddHistory,
      seatStats: seatStatsQuery.data ?? null,
      suggestions: suggestionsQuery.data ?? [],
    });
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `overview-report-${date}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const showSpinner = isLoading || isRefreshing;

  return (
    <div className="space-y-6">
      {/* Sub-header with refresh + export buttons */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Tổng quan đội seat — chỉ tính seat active"
              : "Tổng quan các seat của bạn"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {fleetQuery.data && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportHtml}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              Xuất báo cáo
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={showSpinner}
            className="gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 transition-transform ${showSpinner ? "animate-spin" : ""}`} />
            Làm mới
          </Button>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && <OverviewSkeleton />}

      {/* Error state */}
      {!isLoading && hasError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          Không thể tải dữ liệu tổng quan. Vui lòng thử lại.
        </div>
      )}

      {/* Content */}
      {!isLoading && !hasError && fleetQuery.data && (
        <>
          {/* Empty state: user has no seats */}
          {fleetQuery.data.kpis.billableCount === 0 ? (
            <div className="rounded-lg border bg-muted/30 p-6 text-center">
              {isAdmin ? (
                <>
                  <p className="text-sm font-medium">Chưa có seat nào trong báo cáo tổng quan</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Bật tùy chọn "Đưa vào báo cáo tổng quan" trong phần sửa seat để hiển thị ở đây.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium">
                    Bạn chưa thuộc seat nào — liên hệ admin
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Admin cần thêm bạn vào ít nhất một seat để xem tổng quan.
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              <BldFleetKpiCards kpis={fleetQuery.data.kpis} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <BldWwComparisonChart data={fleetQuery.data.wwHistory} />
                <BldDdComparisonChart data={fleetQuery.data.ddHistory} />
              </div>
              {seatStatsQuery.data && (
                <BldSeatStatsPanel data={seatStatsQuery.data} />
              )}
              {suggestionsQuery.data && (
                <BldActionsPanel
                  suggestions={suggestionsQuery.data}
                  readOnly={!isAdmin}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
