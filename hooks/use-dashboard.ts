"use client";

import { useQuery } from "@tanstack/react-query";

// Types for API responses
export interface EnhancedDashboardData {
  totalUsers: number;
  activeUsers: number;
  totalSeats: number;
  unresolvedAlerts: number;
  todaySchedules: number;
  usagePerSeat: { label: string; team: string; all_pct: number; sonnet_pct: number }[];
  usageTrend: { week_start: string; avg_all: number; avg_sonnet: number }[];
  teamUsage: { team: string; avg_pct: number }[];
}

export interface SeatUsageData {
  seats: {
    seat_id: string;
    seat_email: string;
    label: string;
    team: string;
    weekly_all_pct: number;
    weekly_sonnet_pct: number;
    last_logged: string | null;
    users: string[];
  }[];
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
