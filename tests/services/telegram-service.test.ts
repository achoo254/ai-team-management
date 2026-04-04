import { describe, it, expect, vi, beforeEach } from "vitest";
import mongoose from "mongoose";
import { Seat } from "@/models/seat";
import { User } from "@/models/user";
import { UsageSnapshot } from "@/models/usage-snapshot";
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
import { sendWeeklyReport } from "@/services/telegram-service";

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

    it("includes snapshot data when snapshots exist", async () => {
      const { seat } = await seedBaseData();
      await UsageSnapshot.create({
        seat_id: seat._id,
        raw_response: {},
        five_hour_pct: 75,
        seven_day_pct: 50,
        fetched_at: new Date(),
      });

      await sendWeeklyReport();

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string);
      expect(body.text).toContain("75%");
      expect(body.text).toContain("50%");
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
});
