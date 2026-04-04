// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createTestQueryWrapper } from "../helpers/query-wrapper";
import { useAlerts, useUnreadAlertCount, useMarkAlertsRead } from "@/hooks/use-alerts";

const mockAlert = {
  _id: "alert-1",
  seat_id: { _id: "seat-1", email: "seat1@example.com", label: "Seat 1" },
  type: "rate_limit",
  message: "Rate limit exceeded 80%",
  metadata: { session: "5h", pct: 85 },
  read_by: [],
  created_at: "2026-03-24T08:00:00.000Z",
};

describe("useAlerts", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ alerts: [mockAlert], has_more: false }), { status: 200 })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches alerts without filter", async () => {
    const wrapper = createTestQueryWrapper();
    const { result } = renderHook(() => useAlerts(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.alerts).toHaveLength(1);
    expect(result.current.data?.alerts[0].type).toBe("rate_limit");
  });

  it("fetches alerts with type filter", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ alerts: [mockAlert], has_more: false }), { status: 200 })
    );
    const wrapper = createTestQueryWrapper();
    const { result } = renderHook(() => useAlerts({ type: "rate_limit" }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/alerts?type=rate_limit",
      expect.any(Object)
    );
  });

  it("enters error state when fetch fails", async () => {
    vi.restoreAllMocks();
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Server error" }), { status: 500 })
    );
    const wrapper = createTestQueryWrapper();
    const { result } = renderHook(() => useAlerts(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useUnreadAlertCount", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches unread count", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ count: 5 }), { status: 200 })
    );
    const wrapper = createTestQueryWrapper();
    const { result } = renderHook(() => useUnreadAlertCount(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.count).toBe(5);
  });
});

describe("useMarkAlertsRead", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls POST /api/alerts/mark-read", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ updated: 2 }), { status: 200 })
    );
    const wrapper = createTestQueryWrapper();
    const { result } = renderHook(() => useMarkAlertsRead(), { wrapper });

    await act(async () => {
      result.current.mutate(["alert-1", "alert-2"]);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/alerts/mark-read",
      expect.objectContaining({ method: "POST" })
    );
  });
});
