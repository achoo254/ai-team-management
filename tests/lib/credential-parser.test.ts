import { describe, it, expect } from "vitest";
import { parseCredentialJson } from "../../packages/shared/credential-parser";

describe("parseCredentialJson", () => {
  it("parses claudeAiOauth wrapper with camelCase keys", () => {
    const raw = JSON.stringify({
      claudeAiOauth: {
        accessToken: "tok_abc",
        refreshToken: "ref_xyz",
        expiresAt: 1_800_000_000_000,
        scopes: ["user:inference", "user:profile"],
        subscriptionType: "claude_max",
        rateLimitTier: "default_claude_max_5x",
      },
    });
    const p = parseCredentialJson(raw);
    expect(p).toEqual({
      accessToken: "tok_abc",
      refreshToken: "ref_xyz",
      expiresAt: 1_800_000_000_000,
      scopes: ["user:inference", "user:profile"],
      subscriptionType: "claude_max",
      rateLimitTier: "default_claude_max_5x",
    });
  });

  it("parses raw object with snake_case keys", () => {
    const raw = JSON.stringify({
      access_token: "tok_snake",
      refresh_token: "ref_snake",
      expires_at: 1_700_000_000_000,
      scopes: ["a"],
      subscription_type: "pro",
      rate_limit_tier: "tier_1",
    });
    const p = parseCredentialJson(raw);
    expect(p?.accessToken).toBe("tok_snake");
    expect(p?.refreshToken).toBe("ref_snake");
    expect(p?.expiresAt).toBe(1_700_000_000_000);
    expect(p?.subscriptionType).toBe("pro");
    expect(p?.rateLimitTier).toBe("tier_1");
  });

  it("defaults missing optional fields", () => {
    const p = parseCredentialJson(JSON.stringify({ access_token: "x" }));
    expect(p).toEqual({
      accessToken: "x",
      refreshToken: null,
      expiresAt: null,
      scopes: [],
      subscriptionType: null,
      rateLimitTier: null,
    });
  });

  it("returns null for invalid JSON", () => {
    expect(parseCredentialJson("not json")).toBeNull();
    expect(parseCredentialJson("{bad")).toBeNull();
  });

  it("returns null when access_token missing", () => {
    expect(parseCredentialJson(JSON.stringify({ refresh_token: "x" }))).toBeNull();
    expect(parseCredentialJson(JSON.stringify({ claudeAiOauth: {} }))).toBeNull();
  });

  it("rejects non-string access_token", () => {
    expect(parseCredentialJson(JSON.stringify({ access_token: 123 }))).toBeNull();
  });
});
