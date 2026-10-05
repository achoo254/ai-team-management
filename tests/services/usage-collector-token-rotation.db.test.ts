/**
 * A successful OAuth refresh revokes the previous access token immediately, so a
 * collector request issued just before the refresh comes back as HTTP 401 even
 * though the credential is healthy. Production raised false "token failure"
 * alerts on roughly 62% of all refreshes this way. These tests pin the recovery:
 * a 401 is only reported once the stored token is confirmed unchanged.
 */

import { describe, it, expect, vi, afterEach } from "vitest";

// The collector decrypts the stored token before every request. What is under
// test is which token gets used, not the cipher, so encryption is identity here.
vi.mock("../../packages/api/src/lib/encryption.js", () => ({
  encrypt: (s: string) => s,
  decrypt: (s: string) => s,
  isEncryptionConfigured: () => true,
}));

import { Seat } from "@/models/seat";
import { UsageSnapshot } from "@/models/usage-snapshot";
import { collectAllUsage } from "@/services/usage-collector-service";

const USAGE_BODY = {
  five_hour: { utilization: 12, resets_at: "2026-08-17T20:00:00Z" },
  seven_day: { utilization: 34, resets_at: "2026-08-22T00:00:00Z" },
};

const UNAUTHORIZED = JSON.stringify({
  type: "error",
  error: { type: "authentication_error", message: "Invalid authentication credentials" },
});

/** Pull the credential the collector actually authorised a request with. */
function sentCredential(init: RequestInit | undefined): string {
  const headers = (init?.headers ?? {}) as Record<string, string>;
  return String(headers.Authorization ?? "").replace(/^Bearer /, "");
}

async function createSeat(label: string, token: string) {
  return Seat.create({
    email: `${label.toLowerCase()}@test.com`,
    label,
    token_active: true,
    oauth_credential: {
      access_token: token,
      refresh_token: "refresh",
      expires_at: new Date(Date.now() + 3_600_000),
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("usage collector — token rotated mid-request", () => {
  it("retries with the new token instead of reporting a token failure", async () => {
    const seat = await createSeat("Rotate", "old-tok");
    const attempted: string[] = [];

    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      const sent = sentCredential(init);
      attempted.push(sent);
      if (sent === "old-tok") {
        // Stand in for the refresh cron committing a new token while this
        // request is still in flight — Anthropic kills the old one at that point.
        await Seat.findByIdAndUpdate(seat._id, {
          "oauth_credential.access_token": "new-tok",
        });
        return new Response(UNAUTHORIZED, { status: 401 });
      }
      return new Response(JSON.stringify(USAGE_BODY), { status: 200 });
    }));

    const result = await collectAllUsage();

    expect(attempted).toEqual(["old-tok", "new-tok"]);
    expect(result).toMatchObject({ success: 1, errors: 0 });

    const after = await Seat.findById(seat._id).lean();
    expect(after!.last_fetch_error).toBeNull();
    expect(await UsageSnapshot.countDocuments({ seat_id: seat._id })).toBe(1);
  });

  it("reports the failure when the stored token is unchanged", async () => {
    const seat = await createSeat("Dead", "dead-tok");

    const fetchMock = vi.fn(async () => new Response(UNAUTHORIZED, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await collectAllUsage();

    // One attempt only: with nothing rotated there is no second token to try.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ success: 0, errors: 1 });

    const after = await Seat.findById(seat._id).lean();
    expect(after!.last_fetch_error).toContain("401");
    expect(await UsageSnapshot.countDocuments({ seat_id: seat._id })).toBe(0);
  });

  it("leaves token_active set so a fetch error is not mistaken for a dead refresh token", async () => {
    const seat = await createSeat("Soft", "soft-tok");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(UNAUTHORIZED, { status: 401 })));

    await collectAllUsage();

    const after = await Seat.findById(seat._id).lean();
    expect(after!.token_active).toBe(true);
  });
});
