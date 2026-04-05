// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { type ReactNode, createContext } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AuthContext, type AuthUser } from "@/components/auth-provider";

const mockUser: AuthUser = {
  _id: "user-1",
  name: "Alice",
  email: "alice@example.com",
  role: "admin",
};

function makeWrapper(value: { user: AuthUser | null; loading: boolean; logout: () => Promise<void> }) {
  return ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

describe("useAuth", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns user and loading from AuthContext", () => {
    const wrapper = makeWrapper({ user: mockUser, loading: false, logout: vi.fn() });
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.loading).toBe(false);
  });

  it("returns null user when not authenticated", () => {
    const wrapper = makeWrapper({ user: null, loading: false, logout: vi.fn() });
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user).toBeNull();
  });

  it("throws when used outside AuthProvider", () => {
    // renderHook without wrapper means no AuthContext provider
    expect(() => renderHook(() => useAuth())).toThrow(
      "useAuth must be used within AuthProvider"
    );
  });

  it("exposes logout function from context", async () => {
    const logoutFn = vi.fn().mockResolvedValue(undefined);
    const wrapper = makeWrapper({ user: mockUser, loading: false, logout: logoutFn });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await result.current.logout();
    expect(logoutFn).toHaveBeenCalledOnce();
  });
});
