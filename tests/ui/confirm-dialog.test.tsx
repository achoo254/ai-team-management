// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

describe("ConfirmDialog", () => {
  it("renders nothing when closed", () => {
    render(
      <ConfirmDialog
        open={false}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Delete item"
        description="Are you sure?"
      />
    );
    expect(screen.queryByText("Delete item")).toBeNull();
  });

  it("renders title and description when open", () => {
    render(
      <ConfirmDialog
        open={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Delete item"
        description="Are you sure?"
      />
    );
    expect(screen.getByText("Delete item")).toBeDefined();
    expect(screen.getByText("Are you sure?")).toBeDefined();
  });

  it("calls onConfirm when confirm button clicked", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        onClose={vi.fn()}
        onConfirm={onConfirm}
        title="Delete item"
        description="Are you sure?"
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onClose when cancel button clicked", async () => {
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        open={true}
        onClose={onClose}
        onConfirm={vi.fn()}
        title="Delete item"
        description="Are you sure?"
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Huỷ" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("disables both buttons and shows loading text when loading", () => {
    render(
      <ConfirmDialog
        open={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        title="Delete item"
        description="Are you sure?"
        loading={true}
      />
    );
    expect(screen.getByText("Đang xử lý...")).toBeDefined();
    // Check both named buttons are disabled
    const cancelBtn = screen.getByRole("button", { name: "Huỷ" });
    const confirmBtn = screen.getByRole("button", { name: "Đang xử lý..." });
    expect((cancelBtn as HTMLButtonElement).disabled).toBe(true);
    expect((confirmBtn as HTMLButtonElement).disabled).toBe(true);
  });
});
