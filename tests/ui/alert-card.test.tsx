// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlertCard } from "@/components/alert-card";
import type { Alert } from "@repo/shared/types";

const mockAlert: Alert = {
  _id: "alert-1",
  seat_id: { _id: "seat-1", email: "seat1@example.com", label: "Seat 1" },
  type: "rate_limit",
  message: "Rate limit exceeded 85%",
  metadata: { session: "5h", pct: 85 },
  read_by: [],
  created_at: "2026-03-24T08:00:00.000Z",
};

describe("AlertCard", () => {
  it("renders alert message and seat label", () => {
    render(<AlertCard alert={mockAlert} />);
    expect(screen.getByText("Rate limit exceeded 85%")).toBeDefined();
    expect(screen.getByText("Seat 1")).toBeDefined();
  });

  it("renders alert type badge", () => {
    render(<AlertCard alert={mockAlert} />);
    expect(screen.getByText("Rate Limit")).toBeDefined();
  });

  it("expands on click to show metadata", async () => {
    render(<AlertCard alert={mockAlert} />);
    // Before expand: no expanded metadata
    expect(screen.queryByText("5h")).toBeNull();

    // Click to expand
    await userEvent.click(screen.getByText("Rate limit exceeded 85%"));
    expect(screen.getByText("5h")).toBeDefined();
  });

  it("renders 7d rate_limit with threshold metadata", () => {
    const alert7d: Alert = {
      ...mockAlert,
      type: "rate_limit",
      window: "7d",
      message: "Seat X: 7d usage 95%",
      metadata: { max_pct: 95, threshold: 85, session: "7d" },
    };
    render(<AlertCard alert={alert7d} />);
    expect(screen.getByText("Rate Limit")).toBeDefined();
  });

  it("renders token_failure with error in expanded view", async () => {
    const tokenAlert: Alert = {
      ...mockAlert,
      type: "token_failure",
      message: "Token error",
      metadata: { error: "invalid_grant" },
    };
    render(<AlertCard alert={tokenAlert} />);
    expect(screen.getByText("Token Error")).toBeDefined();
    await userEvent.click(screen.getByText("Token error"));
    expect(screen.getByText("invalid_grant")).toBeDefined();
  });

  it("renders usage_exceeded type", () => {
    const budgetAlert: Alert = {
      ...mockAlert,
      type: "usage_exceeded",
      message: "Vượt budget 15%",
      metadata: { delta: 15, budget: 10, user_name: "Test User" },
    };
    render(<AlertCard alert={budgetAlert} />);
    expect(screen.getByText("Vượt Budget")).toBeDefined();
  });

  it("renders session_waste type", () => {
    const wasteAlert: Alert = {
      ...mockAlert,
      type: "session_waste",
      message: "Session lãng phí",
      metadata: { delta: 2, duration: 3 },
    };
    render(<AlertCard alert={wasteAlert} />);
    expect(screen.getByText("Lãng phí")).toBeDefined();
  });

  it("renders 7d_risk type", () => {
    const riskAlert: Alert = {
      ...mockAlert,
      type: "7d_risk",
      message: "7d risk 92%",
      metadata: { current_7d: 75, projected: 92, remaining_sessions: 3 },
    };
    render(<AlertCard alert={riskAlert} />);
    expect(screen.getByText("7d Risk")).toBeDefined();
  });
});
