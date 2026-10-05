// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { QuotaForecastBar, formatForecastDate } from "@/components/quota-forecast-bar";

afterEach(() => cleanup());

describe("QuotaForecastBar — 7d", () => {
  it("renders empty state when data is null", () => {
    render(<QuotaForecastBar type="7d" data={null} />);
    expect(screen.getByText(/Chưa có dữ liệu/)).toBeTruthy();
  });

  it("renders safe status without forecast line", () => {
    render(
      <QuotaForecastBar
        type="7d"
        data={{
          seat_id: "s1", seat_label: "TK Đạt",
          current_pct: 15, slope_per_hour: 0.1,
          hours_to_full: 850, forecast_at: new Date().toISOString(),
          status: "safe",
        }}
      />,
    );
    expect(screen.getByText(/TK Đạt/)).toBeTruthy();
    expect(screen.queryByText(/Dự báo hết/)).toBeNull();
  });

  it("renders critical status with forecast line", () => {
    render(
      <QuotaForecastBar
        type="7d"
        data={{
          seat_id: "s1", seat_label: "TK Đạt",
          current_pct: 70, slope_per_hour: 3,
          hours_to_full: 10, forecast_at: "2026-04-07T14:30:00.000Z",
          status: "critical",
        }}
      />,
    );
    expect(screen.getByText(/Dự báo hết/)).toBeTruthy();
    expect(screen.getByText(/còn ~10h/)).toBeTruthy();
  });

  it("renders collecting with placeholder label", () => {
    render(
      <QuotaForecastBar
        type="7d"
        data={{
          seat_id: "s1", seat_label: "TK Đạt",
          current_pct: 5, slope_per_hour: 0,
          hours_to_full: null, forecast_at: null,
          status: "collecting",
        }}
      />,
    );
    expect(screen.getByText(/Đang thu thập/)).toBeTruthy();
  });
});

describe("QuotaForecastBar — 5h", () => {
  it("renders empty state when null", () => {
    render(<QuotaForecastBar type="5h" data={null} />);
    expect(screen.getByText(/Chưa có dữ liệu/)).toBeTruthy();
  });

  // For the 5h window the goal is to USE the quota, so a high percentage is
  // the good outcome — the labels rank utilization, not danger.
  it.each([
    [10, "Rất thấp"],
    [30, "Thấp"],
    [60, "Khá"],
    [85, "Tận dụng tốt"],
  ])("labels %i%% as %s", (pct, label) => {
    render(<QuotaForecastBar type="5h" data={{ current_pct: pct, status: "safe" }} />);
    expect(screen.getByText(new RegExp(label))).toBeTruthy();
  });

  it("shows the percentage alongside the label", () => {
    render(<QuotaForecastBar type="5h" data={{ current_pct: 85, status: "safe" }} />);
    // The value and the "%" are separate text nodes; match the wrapping element.
    expect(screen.getByText("85%")).toBeTruthy();
  });
});

describe("formatForecastDate", () => {
  it("formats Vietnamese weekday + time", () => {
    const date = new Date(2026, 3, 7, 14, 30); // local: Tue Apr 7 2026, 14:30
    const out = formatForecastDate(date.toISOString());
    expect(out).toMatch(/07\/04/);
    expect(out).toMatch(/~14:30/);
    expect(out).toMatch(/Thứ|CN/);
  });
});
