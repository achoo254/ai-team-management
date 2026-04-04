import { Seat } from "@/models/seat";
import { User } from "@/models/user";
import { Team } from "@/models/team";
import { Schedule } from "@/models/schedule";
import { Alert } from "@/models/alert";
import { UsageSnapshot } from "@/models/usage-snapshot";

/** Seed minimal test data, return created docs */
export async function seedTestData() {
  const team = await Team.create({
    name: "dev",
    label: "Dev",
    color: "#3b82f6",
  });
  const seat = await Seat.create({
    email: "seat@test.com",
    label: "Test Seat",
    team: "dev",
    max_users: 2,
  });
  const user = await User.create({
    name: "Test User",
    email: "user@test.com",
    role: "admin",
    team: "dev",
    seat_id: seat._id,
  });
  return { team, seat, user };
}

/** Seed additional data for specific test scenarios */
export async function seedSchedule(seatId: string, userId: string) {
  return Schedule.create({
    seat_id: seatId,
    user_id: userId,
    day_of_week: 1,
    slot: "morning",
  });
}

export async function seedAlert(seatId: string) {
  return Alert.create({
    seat_id: seatId,
    type: "rate_limit",
    message: "Rate limit exceeded 80%",
    metadata: { window: "5h", pct: 85 },
  });
}

export async function seedUsageSnapshot(seatId: string) {
  return UsageSnapshot.create({
    seat_id: seatId,
    raw_response: {},
    five_hour_pct: 40,
    seven_day_pct: 50,
    fetched_at: new Date(),
  });
}
