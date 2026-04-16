import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock encryption (always configured)
vi.mock("@/lib/encryption", () => ({
  isEncryptionConfigured: () => true,
  decrypt: (v: string) => v,
}));

// Mock Seat
vi.mock("@/models/seat", () => ({
  Seat: {
    find: vi.fn().mockReturnValue({ sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) }),
  },
}));

// Mock UsageSnapshot
vi.mock("@/models/usage-snapshot", () => ({
  UsageSnapshot: { aggregate: vi.fn().mockResolvedValue([]) },
}));

// Mock bld-metrics-service
vi.mock("@/services/bld-metrics-service", () => ({
  computeFleetKpis: vi.fn().mockResolvedValue(null),
}));

// Mock User — will be controlled per test
const mockSave = vi.fn().mockResolvedValue(undefined);
const mockMarkModified = vi.fn();
let mockUsers: any[] = [];
vi.mock("@/models/user", () => ({
  User: {
    find: vi.fn().mockImplementation(() => mockUsers),
    findById: vi.fn().mockImplementation(() => null),
  },
}));

import { User } from "@/models/user";
import { checkAndSendScheduledReports } from "@/services/telegram-service";

/** Build a user with schedule settings. */
function makeUser(opts: {
  id?: string;
  name?: string;
  reportDays?: number[];
  reportHour?: number;
  lastSentAt?: Date | null;
}) {
  return {
    _id: opts.id ?? "user-1",
    name: opts.name ?? "Tester",
    telegram_bot_token: "enc-token",
    telegram_chat_id: "123",
    telegram_topic_id: null,
    notification_settings: {
      report_enabled: true,
      report_days: opts.reportDays ?? [5],
      report_hour: opts.reportHour ?? 9,
      last_report_sent_at: opts.lastSentAt ?? null,
    },
    save: mockSave,
    markModified: mockMarkModified,
  };
}

describe("checkAndSendScheduledReports — fixed schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsers = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("queries users matching current VN day + hour", async () => {
    // Friday 9:00 VN = 02:00 UTC
    vi.setSystemTime(new Date("2026-04-17T02:00:00Z"));
    mockUsers = [];

    await checkAndSendScheduledReports();

    // Verify the query includes day=5 and hour=9
    const findCall = vi.mocked(User.find).mock.calls[0];
    expect(findCall[0]).toMatchObject({
      "notification_settings.report_enabled": true,
      "notification_settings.report_days": 5,
      "notification_settings.report_hour": 9,
    });
  });

  it("skips user already sent today (dedup via last_report_sent_at)", async () => {
    vi.setSystemTime(new Date("2026-04-17T02:00:00Z")); // Fri 9AM VN
    const user = makeUser({
      lastSentAt: new Date("2026-04-17T01:00:00Z"), // same VN date
    });
    mockUsers = [user];

    await checkAndSendScheduledReports();

    // save() should NOT be called — user was skipped
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("updates last_report_sent_at after successful send", async () => {
    vi.setSystemTime(new Date("2026-04-17T02:00:00Z"));
    // findById returns user with watched_seats for sendUserReport
    const user = makeUser({ lastSentAt: null });
    mockUsers = [user];
    vi.mocked(User.findById).mockResolvedValueOnce(user as any);

    await checkAndSendScheduledReports();

    expect(mockSave).toHaveBeenCalled();
    expect(user.notification_settings.last_report_sent_at).toBeInstanceOf(Date);
  });

  it("sends if last sent was a different VN date", async () => {
    vi.setSystemTime(new Date("2026-04-17T02:00:00Z"));
    const user = makeUser({
      lastSentAt: new Date("2026-04-10T02:00:00Z"), // last Friday
    });
    mockUsers = [user];
    vi.mocked(User.findById).mockResolvedValueOnce(user as any);

    await checkAndSendScheduledReports();

    expect(mockSave).toHaveBeenCalled();
  });

  it("does nothing when User.find returns empty", async () => {
    vi.setSystemTime(new Date("2026-04-17T02:00:00Z"));
    mockUsers = [];

    await checkAndSendScheduledReports();

    expect(mockSave).not.toHaveBeenCalled();
  });
});
