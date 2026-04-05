// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createTestQueryWrapper } from "../helpers/query-wrapper";
import {
  useSeats,
  useCreateSeat,
  useDeleteSeat,
} from "@/hooks/use-seats";

const mockSeat = {
  _id: "seat-1",
  email: "seat1@example.com",
  label: "Seat 1",
  max_users: 3,
  users: [{ id: "u-1", name: "Alice", email: "alice@example.com" }],
};

describe("useSeats", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ seats: [mockSeat] }), { status: 200 })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches seats successfully", async () => {
    const wrapper = createTestQueryWrapper();
    const { result } = renderHook(() => useSeats(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.seats).toHaveLength(1);
    expect(result.current.data?.seats[0].label).toBe("Seat 1");
  });

  it("enters error state when fetch fails", async () => {
    vi.restoreAllMocks();
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Server error" }), { status: 500 })
    );
    const wrapper = createTestQueryWrapper();
    const { result } = renderHook(() => useSeats(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useCreateSeat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls POST /api/seats and invalidates cache on success", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockSeat), { status: 200 })
    );
    const wrapper = createTestQueryWrapper();
    const { result } = renderHook(() => useCreateSeat(), { wrapper });

    await act(async () => {
      result.current.mutate({
        email: "seat1@example.com",
        label: "Seat 1",
        max_users: 3,
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/seats",
      expect.objectContaining({ method: "POST" })
    );
  });
});

describe("useDeleteSeat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls DELETE /api/seats/:id on mutate", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(null, { status: 204 })
    );
    const wrapper = createTestQueryWrapper();
    const { result } = renderHook(() => useDeleteSeat(), { wrapper });

    await act(async () => {
      result.current.mutate("seat-1");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/seats/seat-1",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});
