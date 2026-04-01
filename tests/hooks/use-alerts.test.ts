// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createTestQueryWrapper } from "../helpers/query-wrapper";
import { useAlerts, useResolveAlert } from "@/hooks/use-alerts";

const mockAlert = {
  _id: "alert-1",
  seat_id: { _id: "seat-1", email: "seat1@example.com", label: "Seat 1" },
  type: "high_usage",
  message: "Usage exceeded 80%",
  resolved: false,
  created_at: "2026-03-24T08:00:00.000Z",
};

describe("useAlerts", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ alerts: [mockAlert] }), { status: 200 })
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
    expect(result.current.data?.alerts[0].type).toBe("high_usage");
  });

  it("fetches alerts with resolved=0 filter", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ alerts: [mockAlert] }), { status: 200 })
    );
    const wrapper = createTestQueryWrapper();
    const { result } = renderHook(() => useAlerts(0), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/alerts?resolved=0",
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

describe("useResolveAlert", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls PUT /api/alerts/:id/resolve on mutate", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const wrapper = createTestQueryWrapper();
    const { result } = renderHook(() => useResolveAlert(), { wrapper });

    await act(async () => {
      result.current.mutate("alert-1");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/alerts/alert-1/resolve",
      expect.objectContaining({ method: "PUT" })
    );
  });
});
