// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AlertCard } from "@/components/alerts/alert-card";
import type { Alert } from "@/hooks/use-alerts";

const mockAlert: Alert = {
  _id: "alert-1",
  seat_id: { _id: "seat-1", email: "seat1@example.com", label: "Seat 1" },
  type: "high_usage",
  message: "Usage exceeded 80%",
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
  it("renders alert message and seat email", () => {
    render(
      <AlertCard alert={mockAlert} isAdmin={false} onResolve={vi.fn()} />
    );
    expect(screen.getByText("Usage exceeded 80%")).toBeDefined();
    expect(screen.getByText("Seat 1")).toBeDefined();
  });

  it("renders alert type badge", () => {
    render(
      <AlertCard alert={mockAlert} isAdmin={false} onResolve={vi.fn()} />
    );
    // type "high_usage" rendered as "high usage" (underscore replaced)
    expect(screen.getByText("high usage")).toBeDefined();
  });

  it("shows resolve button for admin on unresolved alert", () => {
    render(
      <AlertCard alert={mockAlert} isAdmin={true} onResolve={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: "Xử lý" })).toBeDefined();
  });

  it("calls onResolve with alert id when resolve button clicked", async () => {
    const onResolve = vi.fn();
    render(
      <AlertCard alert={mockAlert} isAdmin={true} onResolve={onResolve} />
    );
    await userEvent.click(screen.getByRole("button", { name: "Xử lý" }));
    expect(onResolve).toHaveBeenCalledWith("alert-1");
  });

  it("shows resolved_by text for resolved alert", () => {
    render(
      <AlertCard alert={resolvedAlert} isAdmin={true} onResolve={vi.fn()} />
    );
    expect(screen.getByText("Xử lý bởi: admin@example.com")).toBeDefined();
  });

  it("hides resolve button for resolved alert", () => {
    render(
      <AlertCard alert={resolvedAlert} isAdmin={true} onResolve={vi.fn()} />
    );
    expect(screen.queryByRole("button", { name: "Xử lý" })).toBeNull();
  });
});
