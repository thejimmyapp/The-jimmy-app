import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useCoachStore } from "../store";
import { CollaboratePanel } from "./CollaboratePanel";

describe("study collaborate lock", () => {
  beforeEach(() => useCoachStore.setState({ roomId: null, participants: [], messages: [], globalPly: 4 }));
  afterEach(cleanup);

  it("keeps the locked panel visible and makes all controls inert", () => {
    const { container, getByRole, getByText } = render(<CollaboratePanel active locked />);
    expect(getByText("Locked")).not.toBeNull();
    expect(getByRole("tab", { name: "Chat" }).getAttribute("aria-selected")).toBe("true");
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>("button")).every((button) => button.disabled)).toBe(true);
    expect(container.querySelector<HTMLTextAreaElement>("textarea")?.disabled).toBe(true);
  });

  it("retains the existing unlocked draft behavior", () => {
    const { getByPlaceholderText, getByRole } = render(<CollaboratePanel active />);
    const draft = getByPlaceholderText("Message your partner") as HTMLTextAreaElement;
    fireEvent.change(draft, { target: { value: "shared line" } });
    expect(draft.value).toBe("shared line");
    expect((getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
