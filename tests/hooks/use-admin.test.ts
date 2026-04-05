// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { createTestQueryWrapper } from "../helpers/query-wrapper";
import { useAdminUsers, useCreateUser, useDeleteUser, useCheckAlerts } from "@/hooks/use-admin";

const mockUser = {
  id: "user-1",
  name: "Alice",
  email: "alice@example.com",
  role: "user" as const,
  active: true,
};

describe("useAdminUsers", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ users: [mockUser] }), { status: 200 })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches admin users successfully", async () => {
    const wrapper = createTestQueryWrapper();
    const { result } = renderHook(() => useAdminUsers(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.users).toHaveLength(1);
    expect(result.current.data?.users[0].name).toBe("Alice");
  });

  it("enters error state when fetch fails", async () => {
    vi.restoreAllMocks();
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 })
    );
    const wrapper = createTestQueryWrapper();
    const { result } = renderHook(() => useAdminUsers(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useCreateUser", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls POST /api/admin/users on mutate", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockUser), { status: 200 })
    );
    const wrapper = createTestQueryWrapper();
    const { result } = renderHook(() => useCreateUser(), { wrapper });

    await act(async () => {
      result.current.mutate({ name: "Alice", email: "alice@example.com", role: "user" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/admin/users",
      expect.objectContaining({ method: "POST" })
    );
  });
});

describe("useDeleteUser", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls DELETE /api/admin/users/:id on mutate", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(null, { status: 204 })
    );
    const wrapper = createTestQueryWrapper();
    const { result } = renderHook(() => useDeleteUser(), { wrapper });

    await act(async () => {
      result.current.mutate("user-1");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/admin/users/user-1",
      expect.objectContaining({ method: "DELETE" })
    );
  });
});

describe("useCheckAlerts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls POST /api/admin/check-alerts on mutate", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 })
    );
    const wrapper = createTestQueryWrapper();
    const { result } = renderHook(() => useCheckAlerts(), { wrapper });

    await act(async () => {
      result.current.mutate();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/admin/check-alerts",
      expect.objectContaining({ method: "POST" })
    );
  });
});
