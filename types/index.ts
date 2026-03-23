export interface Seat {
  _id: string;
  email: string;
  label: string;
  team: "dev" | "mkt";
  max_users: number;
  created_at: string;
}

export interface User {
  _id: string;
  name: string;
  email?: string;
  role: "admin" | "user";
  team: "dev" | "mkt";
  seat_id: string | null;
  active: boolean;
  created_at: string;
}

export interface Schedule {
  _id: string;
  seat_id: string;
  user_id: string;
  day_of_week: number; // 0-6 (Sun-Sat)
  slot: "morning" | "afternoon";
  created_at: string;
}

export interface Alert {
  _id: string;
  seat_email: string;
  type: "high_usage" | "no_activity";
  message: string;
  resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface Team {
  _id: string;
  name: string;
  label: string;
  color: string;
  created_at: string;
}

export interface UsageLog {
  _id: string;
  seat_email: string;
  week_start: string;
  weekly_all_pct: number;
  weekly_sonnet_pct: number;
  user_id: string;
  logged_at: string;
}

// Populated variants (with referenced docs expanded)
export interface SchedulePopulated extends Omit<Schedule, "seat_id" | "user_id"> {
  seat_id: Seat;
  user_id: User;
}

export interface UsageLogPopulated extends Omit<UsageLog, "user_id"> {
  user_id: User;
}

// API response wrapper
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

// Auth
export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  team: "dev" | "mkt";
}
