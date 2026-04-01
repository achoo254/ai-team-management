// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TeamCard } from "@/components/team-card";
import type { Team } from "@/hooks/use-teams";

const mockTeam: Team = {
  _id: "team-1",
  name: "dev",
  label: "Development",
  color: "#3b82f6",
  user_count: 5,
  seat_count: 2,
};

describe("TeamCard", () => {
  it("renders team label and name", () => {
    render(
      <TeamCard team={mockTeam} isAdmin={false} onEdit={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getByText("Development")).toBeDefined();
    expect(screen.getByText("dev")).toBeDefined();
  });

  it("renders user count and seat count", () => {
    render(
      <TeamCard team={mockTeam} isAdmin={false} onEdit={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getByText("5 người")).toBeDefined();
    expect(screen.getByText("2 seat")).toBeDefined();
  });

  it("hides edit/delete buttons for non-admin", () => {
    render(
      <TeamCard team={mockTeam} isAdmin={false} onEdit={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("calls onEdit when edit button clicked", async () => {
    const onEdit = vi.fn();
    render(
      <TeamCard team={mockTeam} isAdmin={true} onEdit={onEdit} onDelete={vi.fn()} />
    );
    const buttons = screen.getAllByRole("button");
    await userEvent.click(buttons[0]);
    expect(onEdit).toHaveBeenCalledWith(mockTeam);
  });

  it("calls onDelete when delete button clicked", async () => {
    const onDelete = vi.fn();
    render(
      <TeamCard team={mockTeam} isAdmin={true} onEdit={vi.fn()} onDelete={onDelete} />
    );
    const buttons = screen.getAllByRole("button");
    await userEvent.click(buttons[1]);
    expect(onDelete).toHaveBeenCalledWith(mockTeam);
  });
});
