import { describe, it, expect } from "vitest";
import { linearRegression, classifyStatus } from "@/services/quota-forecast-service";

describe("linearRegression", () => {
  it("returns positive slope for increasing series", () => {
    const { slope } = linearRegression([
      { x: 0, y: 10 }, { x: 1, y: 12 }, { x: 2, y: 14 },
    ]);
    expect(slope).toBeCloseTo(2, 5);
  });

  it("returns negative slope for decreasing series", () => {
    const { slope } = linearRegression([
      { x: 0, y: 50 }, { x: 1, y: 45 }, { x: 2, y: 40 },
    ]);
    expect(slope).toBeCloseTo(-5, 5);
  });

  it("returns 0 for constant values", () => {
    const { slope } = linearRegression([
      { x: 0, y: 20 }, { x: 1, y: 20 }, { x: 2, y: 20 },
    ]);
    expect(slope).toBe(0);
  });

  it("handles noisy data with approximate slope", () => {
    const { slope } = linearRegression([
      { x: 0, y: 10 }, { x: 1, y: 13 }, { x: 2, y: 14 }, { x: 3, y: 17 },
    ]);
    expect(slope).toBeGreaterThan(1.5);
    expect(slope).toBeLessThan(3);
  });

  it("returns slope 0 when single point", () => {
    const { slope, intercept } = linearRegression([{ x: 0, y: 5 }]);
    expect(slope).toBe(0);
    expect(intercept).toBe(5);
  });
});

describe("classifyStatus", () => {
  it("safe for >168h", () => {
    expect(classifyStatus(200)).toBe("safe");
    expect(classifyStatus(169)).toBe("safe");
  });

  it("watch for 48-168h", () => {
    expect(classifyStatus(100)).toBe("watch");
    expect(classifyStatus(48)).toBe("watch");
    expect(classifyStatus(168)).toBe("watch");
  });

  it("warning for 24-48h", () => {
    expect(classifyStatus(30)).toBe("warning");
    expect(classifyStatus(24)).toBe("warning");
  });

  it("critical for 6-24h", () => {
    expect(classifyStatus(12)).toBe("critical");
    expect(classifyStatus(6)).toBe("critical");
  });

  it("imminent for <6h", () => {
    expect(classifyStatus(3)).toBe("imminent");
    expect(classifyStatus(0.5)).toBe("imminent");
  });
});
