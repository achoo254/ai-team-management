import { useQuery } from "@tanstack/react-query";
import type { QuotaForecast, StaleSeatInfo, TokenFailureInfo, UrgentForecastItem } from "@repo/shared/types";
export type { QuotaForecast, QuotaForecastResult, QuotaForecastStatus, StaleSeatInfo, TokenFailureInfo, UrgentForecastItem } from "@repo/shared/types";

// Per-seat extra usage info
export interface SeatExtraUsage {
  is_enabled: boolean;
  monthly_limit: number | null;
  used_credits: number | null;
  utilization: number | null;
}

// Rich per-seat usage data from enhanced endpoint
export interface SeatUsageItem {
  seat_id: string;
  label: string;
  owner_name?: string | null;
  five_hour_pct: number | null;
  five_hour_resets_at: string | null;
  seven_day_pct: number | null;
  seven_day_resets_at: string | null;
  seven_day_sonnet_pct: number | null;
  seven_day_opus_pct: number | null;
  extra_usage: SeatExtraUsage | null;
  last_fetched_at: string | null;
  user_count: number;
  max_users: number;
  users: string[];
  session_count_7d: number;
  burn_rate_7d_avg: number;
}

// Per-seat usage trend point (one row per seat per time bucket)
export interface UsageTrendPoint {
  date: string;
  seat_id: string;
  seat_label: string;
  five_hour_pct: number;
  seven_day_pct: number;
}

// Over-budget seat indicator
export interface OverBudgetSeat {
  seat_id: string;
  user_name: string;
  delta: number;
}

// Full enhanced dashboard response
export interface EnhancedDashboardData {
  totalUsers: number;
  activeUsers: number;
  totalSeats: number;
  unreadAlerts: number;
  tokenIssueCount: number;
  fullSeatCount: number;
  todayActiveSeats: number;
  usagePerSeat: SeatUsageItem[];
  usageTrend: UsageTrendPoint[];
  overBudgetSeats: OverBudgetSeat[];
  // Phase 1 data quality fields
  stale_seats: StaleSeatInfo[];
  token_failures: TokenFailureInfo[];
  urgent_forecasts: UrgentForecastItem[];
}

export type DashboardRange = "day" | "week" | "month" | "3month" | "6month";

/** Compute the concrete date range string for a DashboardRange relative to today */
export function formatRangeDate(range: DashboardRange): string {
  const now = new Date();
  const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

  if (range === "day") return fmt(now);

  const from = new Date(now);
  if (range === "week") from.setDate(from.getDate() - 7);
  else if (range === "month") from.setDate(from.getDate() - 30);
  else if (range === "3month") from.setMonth(from.getMonth() - 3);
  else if (range === "6month") from.setMonth(from.getMonth() - 6);

  return `${fmt(from)} – ${fmt(now)}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
  return res.json();
}

// Efficiency metrics
export interface EfficiencySummary {
  avg_utilization: number;
  avg_delta_5h: number;
  avg_delta_7d: number;
  avg_sonnet_7d: number;
  avg_opus_7d: number;
  peak_max: number;
  peak_min: number;
  stddev_util: number;
  tier_full: number;   // ≥80% utilization
  tier_good: number;   // 50-80%
  tier_low: number;    // 10-50%
  tier_waste: number;  // <10%
  total_sessions: number;
  waste_sessions: number;
  total_resets: number;
  total_hours: number;
}

export interface SparklinePoint {
  seat_id: string;
  seat_label: string;
  window_start: string;
  window_end: string;
  utilization_pct: number;
  delta_7d_pct: number;
  duration_hours: number;
  is_waste: boolean;
}

export interface EfficiencyRankedSeat {
  seat_id: string;
  label: string;
  avg_utilization: number;
  session_count: number;
}

export interface EfficiencyPerSeat {
  seat_id: string;
  label: string;
  avg_utilization: number;
  avg_delta_5h: number;
  avg_delta_7d: number;
  session_count: number;
  waste_count: number;
}

export interface EfficiencyCoverage {
  has_data: boolean;
  seats_with_data: number;
  seats_total: number;
  missing_seat_ids: string[];
  missing_seat_labels: string[];
}

export interface EfficiencyPerUser {
  user_id: string;
  name: string;
  avg_utilization: number;
  avg_delta_5h: number;
  session_count: number;
  total_hours: number;
}

export interface ActiveSessionLive {
  seat_id: string;
  user_name: string;
  delta_5h: number;
  delta_7d: number;
  reset_count: number;
  started_at: string;
  last_activity_at: string | null;
}

export interface EfficiencyData {
  summary: EfficiencySummary;
  sparkline: SparklinePoint[];
  perSeat: EfficiencyPerSeat[];
  perUser: EfficiencyPerUser[];
  dailyTrend: { date: string; avg_utilization: number; avg_delta_5h: number; sessions: number }[];
  activeSessions: ActiveSessionLive[];
  topSeats: EfficiencyRankedSeat[];
  bottomSeats: EfficiencyRankedSeat[];
  coverage: EfficiencyCoverage;
  quota_forecast: QuotaForecast;
}

export interface PeakHourCell {
  dow: number; // 0=Sun..6=Sat
  hour: number; // 0-23
  avg_util: number; // % of 5h budget used (avg)
  max_util: number; // % peak
  window_count: number;
}

export interface PeakHoursData {
  grid: PeakHourCell[];
}

export function usePeakHours(range: DashboardRange = "month", seatIds?: string[]) {
  const qs = buildDashboardQuery(range, seatIds);
  const key = seatIds && seatIds.length > 0 ? seatIds.join(",") : "all";
  return useQuery<PeakHoursData>({
    queryKey: ["dashboard", "peak-hours", range, key],
    queryFn: () => fetchJson<PeakHoursData>(`/api/dashboard/peak-hours?${qs}`),
  });
}

/** Build query string fragment from range + optional seatIds filter */
function buildDashboardQuery(range: DashboardRange, seatIds?: string[]): string {
  const parts = [`range=${range}`];
  if (seatIds && seatIds.length > 0) parts.push(`seatIds=${seatIds.join(",")}`);
  return parts.join("&");
}

export function useEfficiency(range: DashboardRange = "month", seatIds?: string[]) {
  const qs = buildDashboardQuery(range, seatIds);
  const key = seatIds && seatIds.length > 0 ? seatIds.join(",") : "all";
  return useQuery<EfficiencyData>({
    queryKey: ["dashboard", "efficiency", range, key],
    queryFn: () => fetchJson<EfficiencyData>(`/api/dashboard/efficiency?${qs}`),
    refetchInterval: 60_000, // refresh every minute for live data
  });
}

export function useDashboardEnhanced(range: DashboardRange = "month", seatIds?: string[]) {
  const qs = buildDashboardQuery(range, seatIds);
  const key = seatIds && seatIds.length > 0 ? seatIds.join(",") : "all";
  return useQuery<EnhancedDashboardData>({
    queryKey: ["dashboard", "enhanced", range, key],
    queryFn: () =>
      fetchJson<EnhancedDashboardData>(`/api/dashboard/enhanced?${qs}`),
    refetchInterval: 5 * 60_000, // sync with usage collector cron (5 min)
  });
}

// Personal dashboard types
export interface MyActivityItem {
  seat_label: string;
  hour: number;
  delta_5h_pct: number;
}

export interface MySeatItem {
  seat_id: string;
  label: string;
  role: "owner" | "member";
}

export interface MyUsageRank {
  rank: number;
  total: number;
  avgDelta5h: number;
}

export interface MyEfficiencySeatRow {
  seat_id: string;
  label: string;
  avg_utilization: number;
  window_count: number;
}

export interface MyEfficiencyData {
  my_avg_utilization: number;
  my_waste_count: number;
  my_window_count: number;
  my_sonnet_avg: number;
  my_opus_avg: number;
  my_top_seats: MyEfficiencySeatRow[];
  my_bottom_seats: MyEfficiencySeatRow[];
}

export interface PersonalDashboardData {
  myActivityToday: MyActivityItem[];
  mySeats: MySeatItem[];
  myUsageRank: MyUsageRank | null;
  myEfficiency: MyEfficiencyData | null;
}

export function usePersonalDashboard() {
  return useQuery<PersonalDashboardData>({
    queryKey: ["dashboard", "personal"],
    queryFn: () => fetchJson<PersonalDashboardData>("/api/dashboard/personal"),
    refetchInterval: 60_000, // refresh every minute
  });
}
