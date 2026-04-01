// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SeatCard } from "@/components/seat-card";
import type { Seat } from "@/hooks/use-seats";

const mockSeat: Seat = {
  _id: "seat-1",
  email: "seat1@example.com",
  label: "Seat Alpha",
  team: "dev",
  max_users: 3,
  users: [
    { id: "u-1", name: "Alice", email: "alice@example.com" },
    { id: "u-2", name: "Bob", email: "bob@example.com" },
  ],
};

describe("SeatCard", () => {
  it("renders seat label and email", () => {
    render(
      <SeatCard
        seat={mockSeat}
        isAdmin={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onUnassign={vi.fn()}
      />
    );
    expect(screen.getByText("Seat Alpha")).toBeDefined();
    expect(screen.getByText("seat1@example.com")).toBeDefined();
  });

  it("renders user count and user names", () => {
    render(
      <SeatCard
        seat={mockSeat}
        isAdmin={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onUnassign={vi.fn()}
      />
    );
    expect(screen.getByText("2/3 người dùng")).toBeDefined();
    expect(screen.getByText("Alice")).toBeDefined();
    expect(screen.getByText("Bob")).toBeDefined();
  });

  it("shows edit and delete buttons for admin", () => {
    render(
      <SeatCard
        seat={mockSeat}
        isAdmin={true}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onUnassign={vi.fn()}
      />
    );
    // Pencil and Trash2 icon buttons exist (2 icon buttons in header area)
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it("calls onDelete when delete button clicked", async () => {
    const onDelete = vi.fn();
    render(
      <SeatCard
        seat={mockSeat}
        isAdmin={true}
        onEdit={vi.fn()}
        onDelete={onDelete}
        onUnassign={vi.fn()}
      />
    );
    // Delete button is the second icon button (after Edit)
    const buttons = screen.getAllByRole("button");
    await userEvent.click(buttons[1]);
    expect(onDelete).toHaveBeenCalledWith(mockSeat);
  });

  it("shows empty message when no users assigned", () => {
    render(
      <SeatCard
        seat={{ ...mockSeat, users: [] }}
        isAdmin={false}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onUnassign={vi.fn()}
      />
    );
    expect(screen.getByText("Chưa gán người dùng")).toBeDefined();
  });
});
