// Setup file for jsdom environment (hooks + UI tests).
// Also loaded in node environment — all DOM operations are guarded by typeof window.
// Does NOT connect to MongoDB — that is handled by setup.ts with a node-env guard.
import { vi } from "vitest";

// sonner is a toast library that requires a DOM portal — mock it out entirely
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
  Toaster: () => null,
}));

// next/navigation is not available in jsdom — provide a default mock so any
// component that calls usePathname / useRouter doesn't crash unless a test
// overrides it with its own vi.mock.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// api-client redirects to /login on 401 via window.location.href assignment
// — jsdom supports this but we silence the navigation side-effect.
// Guard: only run in browser-like environments (jsdom); skip in Node (services/api tests).
if (typeof window !== "undefined") {
  Object.defineProperty(window, "location", {
    value: { ...window.location, href: "/" },
    writable: true,
  });

  // jsdom does not implement window.matchMedia — stub it so components using
  // media queries (e.g. SidebarProvider via use-mobile hook) don't throw.
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}
