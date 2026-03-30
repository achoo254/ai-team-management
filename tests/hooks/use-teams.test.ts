// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createTestQueryWrapper } from "../helpers/query-wrapper";
import { useTeams, useCreateTeam, useDeleteTeam } from "@/hooks/use-teams";

const mockTeam = {
  _id: "team-1",
  name: "dev",
  label: "Development",
  color: "#3b82f6",
  user_count: 5,
  seat_count: 2,
};

describe("useTeams", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ teams: [mockTeam] }), { status: 200 })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches teams successfully", async () => {
    const wrapper = createTestQueryWrapper();
    const { result } = renderHook(() => useTeams(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.teams).toHaveLength(1);
    expect(result.current.data?.teams[0].name).toBe("dev");
  });

  it("enters error state when fetch fails", async () => {
    vi.restoreAllMocks();
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Not found" }), { status: 500 })
    );
    const wrapper = createTestQueryWrapper();
    const { result } = renderHook(() => useTeams(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useCreateTeam", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls POST /api/teams on mutate", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockTeam), { status: 200 })
    );
    const wrapper = createTestQueryWrapper();
    const { result } = renderHook(() => useCreateTeam(), { wrapper });

    await act(async () => {
      result.current.mutate({ name: "dev", label: "Development", color: "#3b82f6" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/teams",
      expect.objectContaining({ method: "POST" })
    );
  });
});

describe("useDeleteTeam", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls DELETE /api/teams/:id on mutate", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(null, { status: 204 })
    );
    const wrapper = createTestQueryWrapper();
    const { result } = renderHook(() => useDeleteTeam(), { wrapper });

    await act(async () => {
      result.current.mutate("team-1");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/teams/team-1",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});
