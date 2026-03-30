import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock config before importing service — anthropic-service reads config at module load time
vi.mock("@/lib/config", () => ({
  config: {
    anthropic: {
      baseUrl: "https://api.anthropic.com",
      adminKey: "test-key",
      version: "2023-06-01",
    },
    telegram: { botToken: "", chatId: "", topicId: "" },
    appUrl: "",
    alerts: { highUsagePct: 80, inactivityWeeks: 1 },
  },
}));

// Import after mock is hoisted
import { getClaudeCodeUsage, getMembers } from "@/services/anthropic-service";

/** Build a mock Response with JSON body */
function mockJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Build a mock error Response with plain text body */
function mockErrorResponse(status: number, text: string): Response {
  return new Response(text, { status });
}

describe("anthropic-service", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // mockReset clears call history AND removes any leftover mockResolvedValueOnce queues
    fetchSpy = vi.spyOn(global, "fetch").mockReset();
  });

  describe("getClaudeCodeUsage(date)", () => {
    it("calls the correct Anthropic usage endpoint with the date parameter", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockJsonResponse({ data: [], has_more: false }),
      );

      await getClaudeCodeUsage("2026-03-23");

      expect(fetchSpy).toHaveBeenCalledOnce();
      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain("/v1/organizations/usage_report/claude_code");
      expect(calledUrl).toContain("starting_at=2026-03-23");
    });

    it("sends correct auth headers (x-api-key, anthropic-version)", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockJsonResponse({ data: [], has_more: false }),
      );

      await getClaudeCodeUsage("2026-03-23");

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers["x-api-key"]).toBe("test-key");
      expect(headers["anthropic-version"]).toBe("2023-06-01");
    });

    it("returns parsed data array from response", async () => {
      const mockData = [
        { seat_email: "a@test.com", usage: 80 },
        { seat_email: "b@test.com", usage: 50 },
      ];
      fetchSpy.mockResolvedValueOnce(
        mockJsonResponse({ data: mockData, has_more: false }),
      );

      const result = await getClaudeCodeUsage("2026-03-23");

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ seat_email: "a@test.com", usage: 80 });
    });

    it("throws Error with status and body when API returns 500", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockErrorResponse(500, "Internal Server Error"),
      );

      await expect(getClaudeCodeUsage("2026-03-23")).rejects.toThrow(
        "Anthropic API error 500: Internal Server Error",
      );
    });

    it("throws Error with status and body when API returns 401", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockErrorResponse(401, "Unauthorized"),
      );

      await expect(getClaudeCodeUsage("2026-03-23")).rejects.toThrow(
        "Anthropic API error 401: Unauthorized",
      );
    });

    it("handles pagination: fetches all pages when has_more is true on first page", async () => {
      const page1 = { data: [{ id: "item-1" }], has_more: true, next_page: "page-2" };
      const page2 = { data: [{ id: "item-2" }, { id: "item-3" }], has_more: false };

      fetchSpy
        .mockResolvedValueOnce(mockJsonResponse(page1))
        .mockResolvedValueOnce(mockJsonResponse(page2));

      const result = await getClaudeCodeUsage("2026-03-23");

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(3);
      expect(result.map((r: { id: string }) => r.id)).toEqual(["item-1", "item-2", "item-3"]);
    });

    it("passes next_page token as 'page' param on subsequent requests", async () => {
      const page1 = { data: [{ id: "a" }], has_more: true, next_page: "cursor-xyz" };
      const page2 = { data: [{ id: "b" }], has_more: false };

      fetchSpy
        .mockResolvedValueOnce(mockJsonResponse(page1))
        .mockResolvedValueOnce(mockJsonResponse(page2));

      await getClaudeCodeUsage("2026-03-23");

      const secondUrl = fetchSpy.mock.calls[1][0] as string;
      expect(secondUrl).toContain("page=cursor-xyz");
    });

    it("returns empty array when response data is empty", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockJsonResponse({ data: [], has_more: false }),
      );

      const result = await getClaudeCodeUsage("2026-03-23");

      expect(result).toEqual([]);
    });
  });

  describe("getMembers()", () => {
    it("calls the correct Anthropic members endpoint", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockJsonResponse({ users: [], has_more: false }),
      );

      await getMembers();

      expect(fetchSpy).toHaveBeenCalledOnce();
      const calledUrl = fetchSpy.mock.calls[0][0] as string;
      expect(calledUrl).toContain("/v1/organizations/users");
    });

    it("returns parsed users array from response", async () => {
      const mockUsers = [
        { id: "u1", email: "alice@test.com", name: "Alice" },
        { id: "u2", email: "bob@test.com", name: "Bob" },
      ];
      fetchSpy.mockResolvedValueOnce(
        mockJsonResponse({ users: mockUsers, has_more: false }),
      );

      const result = await getMembers();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ email: "alice@test.com" });
    });

    it("throws Error with status when API returns 500", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockErrorResponse(500, "Server Error"),
      );

      await expect(getMembers()).rejects.toThrow("Anthropic API error 500: Server Error");
    });

    it("handles pagination: accumulates users across multiple pages", async () => {
      const page1 = { users: [{ id: "u1" }], has_more: true, next_page: "p2" };
      const page2 = { users: [{ id: "u2" }, { id: "u3" }], has_more: false };

      fetchSpy
        .mockResolvedValueOnce(mockJsonResponse(page1))
        .mockResolvedValueOnce(mockJsonResponse(page2));

      const result = await getMembers();

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(3);
    });

    it("sends correct auth headers", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockJsonResponse({ users: [], has_more: false }),
      );

      await getMembers();

      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers["x-api-key"]).toBe("test-key");
      expect(headers["anthropic-version"]).toBe("2023-06-01");
    });

    it("returns empty array when organization has no members", async () => {
      fetchSpy.mockResolvedValueOnce(
        mockJsonResponse({ users: [], has_more: false }),
      );

      const result = await getMembers();

      expect(result).toEqual([]);
    });
  });
});
