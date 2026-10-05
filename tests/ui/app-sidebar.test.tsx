// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";

// react-router is used for real via MemoryRouter. A vi.mock factory does not
// take effect for this dependency, so a mocked useLocation would silently fall
// through to the real one and fail on the missing Router context.

// SidebarProvider uses use-mobile which calls window.matchMedia — not in jsdom
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

// Mock useAuth hook
vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

import { useAuth } from "@/hooks/use-auth";

const adminUser = {
  _id: "user-1",
  name: "Alice Admin",
  email: "alice@example.com",
  role: "admin" as const,
  team: "dev" as const,
};

const regularUser = {
  _id: "user-2",
  name: "Bob User",
  email: "bob@example.com",
  role: "user" as const,
  team: "mkt" as const,
};

function renderSidebar(initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <SidebarProvider>
        <AppSidebar />
      </SidebarProvider>
    </MemoryRouter>
  );
}

describe("AppSidebar", () => {
  it("renders brand name", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: regularUser,
      loading: false,
      logout: vi.fn(),
    });
    renderSidebar();
    expect(screen.getByText("Claude Teams")).toBeDefined();
  });

  it("renders common nav items for regular user", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: regularUser,
      loading: false,
      logout: vi.fn(),
    });
    renderSidebar();
    expect(screen.getByText("Dashboard")).toBeDefined();
    expect(screen.getByText("Seats")).toBeDefined();
    expect(screen.getByText("Teams")).toBeDefined();
    // Admin item should NOT appear for regular user
    expect(screen.queryByText("Admin")).toBeNull();
  });

  it("renders Admin nav item for admin user", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: adminUser,
      loading: false,
      logout: vi.fn(),
    });
    renderSidebar();
    expect(screen.getByText("Admin")).toBeDefined();
  });

  it("renders user name and email in footer", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: adminUser,
      loading: false,
      logout: vi.fn(),
    });
    renderSidebar();
    expect(screen.getByText("Alice Admin")).toBeDefined();
    expect(screen.getByText("alice@example.com")).toBeDefined();
  });

  it("renders the user's role badge in the footer", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: adminUser,
      loading: false,
      logout: vi.fn(),
    });
    renderSidebar();
    expect(screen.getByText("admin")).toBeDefined();
  });

  it("marks the active route from the current location", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: regularUser,
      loading: false,
      logout: vi.fn(),
    });
    renderSidebar("/seats");
    // base-ui renders the state flag as a valueless `data-active` attribute,
    // so presence — not value — is what marks the active item.
    expect(screen.getByText("Seats").closest("a")).toHaveProperty("dataset.active");
    expect(screen.getByText("Dashboard").closest("a")?.hasAttribute("data-active")).toBe(false);
  });
});
