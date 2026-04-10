import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api-client";

export interface ClaudeSession {
  _id: string;
  session_id: string;
  device_id: string;
  user_id: string;
  seat_id: string | null;
  profile_email: string;
  subscription_type: string | null;
  rate_limit_tier: string | null;
  model: string;
  started_at: string;
  ended_at: string;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_read: number;
  total_cache_write: number;
  message_count: number;
  received_at: string;
}

export interface ClaudeSessionsFilters {
  seat_id?: string;
  profile_email?: string;
  since?: string; // ISO
  until?: string; // ISO
  limit?: number;
}

export interface ClaudeSessionsResponse {
  sessions: ClaudeSession[];
  total: number;
}

function buildQs(filters: ClaudeSessionsFilters): string {
  const params = new URLSearchParams();
  if (filters.seat_id) params.set("seat_id", filters.seat_id);
  if (filters.profile_email) params.set("profile_email", filters.profile_email);
  if (filters.since) params.set("since", filters.since);
  if (filters.until) params.set("until", filters.until);
  if (filters.limit) params.set("limit", String(filters.limit));
  return params.toString();
}

export function useClaudeSessions(filters: ClaudeSessionsFilters) {
  return useQuery<ClaudeSessionsResponse>({
    queryKey: ["claude-sessions", filters],
    queryFn: () => {
      const qs = buildQs(filters);
      return api.get(`/api/claude-sessions${qs ? `?${qs}` : ""}`);
    },
    staleTime: 60_000,
  });
}
