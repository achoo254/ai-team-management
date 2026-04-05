import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type {
  FleetKpisResponse,
  SeatStatsResponse,
  RebalanceSuggestion,
} from "@repo/shared/types";

const STALE_TIME = 5 * 60 * 1000; // 5 minutes

export function useFleetKpis(enabled = true) {
  return useQuery<FleetKpisResponse>({
    queryKey: ["bld", "fleet-kpis"],
    queryFn: () => api.get<FleetKpisResponse>("/api/bld/fleet-kpis"),
    staleTime: STALE_TIME,
    enabled,
  });
}

export function useSeatStats(enabled = true) {
  return useQuery<SeatStatsResponse>({
    queryKey: ["bld", "seat-stats"],
    queryFn: () => api.get<SeatStatsResponse>("/api/bld/seat-stats"),
    staleTime: STALE_TIME,
    enabled,
  });
}

export function useRebalanceSuggestions(enabled = true) {
  return useQuery<RebalanceSuggestion[]>({
    queryKey: ["bld", "rebalance-suggestions"],
    queryFn: () => api.get<RebalanceSuggestion[]>("/api/bld/rebalance-suggestions"),
    staleTime: STALE_TIME,
    enabled,
  });
}
