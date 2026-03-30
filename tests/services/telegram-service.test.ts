import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";
import { Seat } from "@/models/seat";
import { User } from "@/models/user";
import { UsageLog } from "@/models/usage-log";
import { Team } from "@/models/team";

// Single top-level mock — hoisted before any module evaluation
vi.mock("@/lib/config", () => ({
  config: {
    appUrl: "http://localhost:3000",
    telegram: { botToken: "test-token", chatId: "123", topicId: "" },
    anthropic: { baseUrl: "", adminKey: "", version: "" },
    alerts: { highUsagePct: 80, inactivityWeeks: 1 },
  },
}));

// Import service after mock declaration so it receives the mocked config
import { sendWeeklyReport, sendLogReminder } from "@/services/telegram-service";

/** Get Monday of current week as YYYY-MM-DD using same local-time logic as the service */
function currentWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.getFullYear(), now.getMonth(), diff);
  return monday.toISOString().split("T")[0];
}

/** Seed minimal data: team, seat, user */
async function seedBaseData() {
  const team = await Team.create({ name: "dev", label: "Dev", color: "#3b82f6" });
  const seat = await Seat.create({ email: "seat@telegram.com", label: "TG Seat", team: "dev", max_users: 2 });
  const user = await User.create({
    name: "TG User",
    email: "tguser@test.com",
    role: "user",
    team: "dev",
    seat_id: seat._id,
    active: true,
  });
  return { team, seat, user };
}

describe("telegram-service", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    // Defensively clear all collections before each test to eliminate cross-file
    // state leakage that can occur when vitest runs files sequentially in singleFork.
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      const collections = await mongoose.connection.db.collections();
      await Promise.all(collections.map((c) => c.deleteMany({})));
    }
    // mockReset clears call history and queued responses between each test
    fetchSpy = vi.spyOn(global, "fetch").mockReset().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
  });

  describe("sendWeeklyReport()", () => {
    it("calls Telegram API with correct URL format", async () => {
      await seedBaseData();

      await sendWeeklyReport();

      expect(fetchSpy).toHaveBeenCalledOnce();
      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toBe("https://api.telegram.org/bottest-token/sendMessage");
    });

    it("sends request with POST method and JSON content-type", async () => {
      await seedBaseData();

      await sendWeeklyReport();

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(init.method).toBe("POST");
      expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    });

    it("includes HTML content in the body with parse_mode HTML", async () => {
      await seedBaseData();

      await sendWeeklyReport();

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.parse_mode).toBe("HTML");
      expect(body.chat_id).toBe("123");
      expect(typeof body.text).toBe("string");
      expect(body.text).toContain("<b>");
    });

    it("includes seat label in report body", async () => {
      await seedBaseData();

      await sendWeeklyReport();

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.text).toContain("TG Seat");
    });

    it("includes usage log data when logs exist for current week", async () => {
      const { seat, user } = await seedBaseData();
      await UsageLog.create({
        seat_email: seat.email,
        week_start: currentWeekStart(),
        weekly_all_pct: 75,
        weekly_sonnet_pct: 40,
        user_id: user._id,
      });

      await sendWeeklyReport();

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.text).toContain("75%");
    });

    it("includes inline keyboard with app links in reply_markup", async () => {
      await seedBaseData();

      await sendWeeklyReport();

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.reply_markup).toBeDefined();
      expect(body.reply_markup.inline_keyboard).toBeDefined();
      // At least one button must reference the configured appUrl
      const allButtons = body.reply_markup.inline_keyboard.flat() as Array<{ url?: string }>;
      expect(allButtons.some((btn) => btn.url?.includes("http://localhost:3000"))).toBe(true);
    });

    it("returns undefined (resolves silently) even when seats DB is empty", async () => {
      // No seats seeded — service builds an empty report and still calls Telegram
      await expect(sendWeeklyReport()).resolves.toBeUndefined();
      // The service should still call fetch (sends an empty-stats report)
      expect(fetchSpy).toHaveBeenCalledOnce();
    });
  });

  describe("sendLogReminder()", () => {
    it("calls Telegram API when there are seats without logs this week", async () => {
      await seedBaseData();
      // No UsageLog created — seat is missing this week's log

      await sendLogReminder();

      expect(fetchSpy).toHaveBeenCalledOnce();
      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toBe("https://api.telegram.org/bottest-token/sendMessage");
    });

    it("includes seat label of missing seats in reminder message", async () => {
      await seedBaseData();

      await sendLogReminder();

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.text).toContain("TG Seat");
      expect(body.text).toContain("Nhắc log usage");
    });

    it("does NOT call Telegram API when all seats have already logged this week", async () => {
      const { seat, user } = await seedBaseData();
      await UsageLog.create({
        seat_email: seat.email,
        week_start: currentWeekStart(),
        weekly_all_pct: 40,
        weekly_sonnet_pct: 20,
        user_id: user._id,
      });

      await sendLogReminder();

      // All seats have logged → missing.length === 0 → returns early, no fetch call
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("sends HTML parse_mode in reminder body", async () => {
      await seedBaseData();

      await sendLogReminder();

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.parse_mode).toBe("HTML");
      expect(body.chat_id).toBe("123");
    });

    it("includes member names in reminder when users are assigned to missing seat", async () => {
      await seedBaseData();
      // User seeded with active: true — their name should appear in the reminder

      await sendLogReminder();

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.text).toContain("TG User");
    });

    it("does NOT call Telegram API when there are no seats at all", async () => {
      // No seats seeded — missing list will be empty
      await sendLogReminder();

      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
