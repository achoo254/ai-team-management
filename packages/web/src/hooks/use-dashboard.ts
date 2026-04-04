

import { useQuery } from "@tanstack/react-query";

// Types for API responses
export interface EnhancedDashboardData {
  totalUsers: number;
  activeUsers: number;
  totalSeats: number;
  unresolvedAlerts: number;
  todaySchedules: number;
  usagePerSeat: { label: string; team: string; five_hour_pct: number | null; seven_day_pct: number | null }[];
  usageTrend: { date: string; avg_pct: number }[];
  teamUsage: { team: string; avg_pct: number }[];
}

export interface SeatUsageData {
  seats: {
    seat_id: string;
    seat_email: string;
    label: string;
    team: string;
    five_hour_pct: number | null;
    seven_day_pct: number | null;
    last_fetched_at: string | null;
    users: string[];
  }[];
}

/** Populated seat reference from Alert.seat_id */
export interface PopulatedSeat {
  _id: string;
  email: string;
  label: string;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
  return res.json();
}

export function useDashboardEnhanced() {
  return useQuery<EnhancedDashboardData>({
    queryKey: ["dashboard", "enhanced"],
    queryFn: () => fetchJson<EnhancedDashboardData>("/api/dashboard/enhanced"),
  });
}

export function useUsageBySeat() {
  return useQuery<SeatUsageData>({
    queryKey: ["dashboard", "usage-by-seat"],
    queryFn: () => fetchJson<SeatUsageData>("/api/dashboard/usage/by-seat"),
  });
}
