// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SeatCard } from "@/components/seat-card";
import { createTestQueryWrapper } from "../helpers/query-wrapper";
import type { Seat } from "@/hooks/use-seats";

const mockSeat: Seat = {
  _id: "seat-1",
  email: "seat1@example.com",
  label: "Seat Alpha",
  owner_id: "owner-1",
  users: [
    { id: "u-1", name: "Alice", email: "alice@example.com" },
    { id: "u-2", name: "Bob", email: "bob@example.com" },
  ],
};

const allUsers = [
  { id: "u-1", name: "Alice", email: "alice@example.com", active: true },
  { id: "u-3", name: "Carol", email: "carol@example.com", active: true },
  { id: "u-4", name: "Dave", email: "dave@example.com", active: false },
];

/** SeatCard embeds WatchSeatButton, which reads user settings through React
 *  Query — rendering it bare throws before any assertion runs. */
function renderCard(overrides: Partial<React.ComponentProps<typeof SeatCard>> = {}) {
  const props: React.ComponentProps<typeof SeatCard> = {
    seat: mockSeat,
    isAdmin: false,
    currentUserId: "someone-else",
    canManage: false,
    allUsers,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onAssign: vi.fn(),
    onUnassign: vi.fn(),
    onExportCredential: vi.fn(),
    ...overrides,
  };
  const Wrapper = createTestQueryWrapper();
  return { props, ...render(<SeatCard {...props} />, { wrapper: Wrapper }) };
}

describe("SeatCard", () => {
  it("renders seat label and email", () => {
    renderCard();
    expect(screen.getByText("Seat Alpha")).toBeDefined();
    expect(screen.getByText("seat1@example.com")).toBeDefined();
  });

  it("renders user count and user names", () => {
    renderCard();
    expect(screen.getByText(/2 members/)).toBeDefined();
    expect(screen.getByText("Alice")).toBeDefined();
    expect(screen.getByText("Bob")).toBeDefined();
  });

  it("hides edit and delete from someone who cannot manage the seat", () => {
    renderCard({ canManage: false });
    expect(screen.queryByTitle("Sửa seat")).toBeNull();
    expect(screen.queryByTitle("Xoá seat")).toBeNull();
  });

  it("shows edit and delete when the viewer can manage the seat", () => {
    renderCard({ canManage: true });
    expect(screen.getByTitle("Sửa seat")).toBeDefined();
    expect(screen.getByTitle("Xoá seat")).toBeDefined();
  });

  it("calls onDelete with the seat when delete is clicked", async () => {
    const onDelete = vi.fn();
    renderCard({ canManage: true, onDelete });
    await userEvent.click(screen.getByTitle("Xoá seat"));
    expect(onDelete).toHaveBeenCalledWith(mockSeat);
  });

  it("calls onEdit with the seat when edit is clicked", async () => {
    const onEdit = vi.fn();
    renderCard({ canManage: true, onEdit });
    await userEvent.click(screen.getByTitle("Sửa seat"));
    expect(onEdit).toHaveBeenCalledWith(mockSeat);
  });

  it("shows empty message when no users assigned", () => {
    renderCard({ seat: { ...mockSeat, users: [] } });
    expect(screen.getByText("Chưa gán người dùng")).toBeDefined();
  });

  it("marks the seat as the viewer's own", () => {
    renderCard({ currentUserId: "owner-1" });
    expect(screen.getByText("Seat của tôi")).toBeDefined();
  });

  it("offers export only to the owner of a seat holding a token", () => {
    renderCard({ currentUserId: "owner-1", seat: { ...mockSeat, has_token: true } });
    expect(screen.getByTitle("Export credential")).toBeDefined();
  });

  it("withholds export from a non-owner even when a token exists", () => {
    renderCard({ currentUserId: "someone-else", seat: { ...mockSeat, has_token: true } });
    expect(screen.queryByTitle("Export credential")).toBeNull();
  });
});
