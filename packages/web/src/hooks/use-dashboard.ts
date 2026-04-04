import { useQuery } from "@tanstack/react-query";

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
  team: string;
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
}

// Daily usage trend point
export interface UsageTrendPoint {
  date: string;
  avg_7d_pct: number;
  avg_5h_pct: number;
}

// Team breakdown stats
export interface TeamUsageItem {
  team: string;
  avg_5h_pct: number;
  avg_7d_pct: number;
  seat_count: number;
  user_count: number;
}

// Today schedule entry
export interface TodayScheduleItem {
  start_hour: number;
  end_hour: number;
  usage_budget_pct: number | null;
  name: string;
  seat_label: string;
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
  unresolvedAlerts: number;
  todaySchedules: TodayScheduleItem[];
  usagePerSeat: SeatUsageItem[];
  usageTrend: UsageTrendPoint[];
  teamUsage: TeamUsageItem[];
  overBudgetSeats: OverBudgetSeat[];
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
  avg_impact_ratio: number | null;
  avg_delta_5h: number;
  avg_delta_7d: number;
  total_sessions: number;
  waste_sessions: number;
  total_resets: number;
  total_hours: number;
}

export interface EfficiencyPerSeat {
  seat_id: string;
  label: string;
  avg_utilization: number;
  avg_delta_5h: number;
  avg_delta_7d: number;
  avg_impact_ratio: number | null;
  session_count: number;
  waste_count: number;
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
}

export interface EfficiencyData {
  summary: EfficiencySummary;
  perSeat: EfficiencyPerSeat[];
  perUser: EfficiencyPerUser[];
  dailyTrend: { date: string; avg_utilization: number; avg_delta_5h: number; sessions: number }[];
  activeSessions: ActiveSessionLive[];
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
  });
}
