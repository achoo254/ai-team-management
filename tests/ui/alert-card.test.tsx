// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlertCard } from "@/components/alert-card";
import type { Alert } from "@/hooks/use-alerts";

const mockAlert: Alert = {
  _id: "alert-1",
  seat_id: { _id: "seat-1", email: "seat1@example.com", label: "Seat 1" },
  type: "rate_limit",
  message: "Rate limit exceeded 85%",
  metadata: { window: "5h", pct: 85 },
  resolved: false,
  created_at: "2026-03-24T08:00:00.000Z",
};

const resolvedAlert: Alert = {
  ...mockAlert,
  _id: "alert-2",
  resolved: true,
  resolved_by: "admin@example.com",
  resolved_at: "2026-03-24T10:00:00.000Z",
};

describe("AlertCard", () => {
  it("renders alert message and seat label", () => {
    render(
      <AlertCard alert={mockAlert} isAdmin={false} onResolve={vi.fn()} />
    );
    expect(screen.getByText("Rate limit exceeded 85%")).toBeDefined();
    expect(screen.getByText("Seat 1")).toBeDefined();
  });

  it("renders alert type badge", () => {
    render(
      <AlertCard alert={mockAlert} isAdmin={false} onResolve={vi.fn()} />
    );
    expect(screen.getByText("Rate Limit")).toBeDefined();
  });

  it("shows resolve button for admin on unresolved alert", () => {
    render(
      <AlertCard alert={mockAlert} isAdmin={true} onResolve={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: /Xử lý/i })).toBeDefined();
  });

  it("calls onResolve with alert id when resolve button clicked", async () => {
    const onResolve = vi.fn();
    render(
      <AlertCard alert={mockAlert} isAdmin={true} onResolve={onResolve} />
    );
    await userEvent.click(screen.getByRole("button", { name: /Xử lý/i }));
    expect(onResolve).toHaveBeenCalledWith("alert-1");
  });

  it("shows resolved_by text for resolved alert", () => {
    render(
      <AlertCard alert={resolvedAlert} isAdmin={true} onResolve={vi.fn()} />
    );
    expect(screen.getByText(/admin@example.com/)).toBeDefined();
  });

  it("hides resolve button for resolved alert", () => {
    render(
      <AlertCard alert={resolvedAlert} isAdmin={true} onResolve={vi.fn()} />
    );
    expect(screen.queryByRole("button", { name: /Xử lý/i })).toBeNull();
  });

  it("renders metadata badges for rate_limit type", () => {
    render(
      <AlertCard alert={mockAlert} isAdmin={false} onResolve={vi.fn()} />
    );
    expect(screen.getByText("5h")).toBeDefined();
    expect(screen.getByText("85%")).toBeDefined();
  });

  it("renders extra_credit metadata", () => {
    const extraAlert: Alert = {
      ...mockAlert,
      type: "extra_credit",
      message: "Extra credits 90% used",
      metadata: { pct: 90, credits_used: 45, credits_limit: 50 },
    };
    render(
      <AlertCard alert={extraAlert} isAdmin={false} onResolve={vi.fn()} />
    );
    expect(screen.getByText("Extra Credit")).toBeDefined();
  });

  it("renders token_failure metadata", () => {
    const tokenAlert: Alert = {
      ...mockAlert,
      type: "token_failure",
      message: "Token error",
      metadata: { error: "invalid_grant" },
    };
    render(
      <AlertCard alert={tokenAlert} isAdmin={false} onResolve={vi.fn()} />
    );
    expect(screen.getByText("Token Error")).toBeDefined();
    expect(screen.getByText("invalid_grant")).toBeDefined();
  });
});
