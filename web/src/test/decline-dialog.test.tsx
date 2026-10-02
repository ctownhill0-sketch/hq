import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeclineReasonDialog } from "@/components/app/DeclineReasonDialog";

afterEach(cleanup);

describe("Decline reason dialog", () => {
  it("will not submit without a reason", async () => {
    const onSubmit = vi.fn();
    render(<DeclineReasonDialog open onSubmit={onSubmit} onCancel={() => {}} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /mark declined/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("A decline reason is required.")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/decline reason/i), "Uses another tool");
    await user.click(screen.getByRole("button", { name: /mark declined/i }));
    expect(onSubmit).toHaveBeenCalledWith("Uses another tool");
  });
});
