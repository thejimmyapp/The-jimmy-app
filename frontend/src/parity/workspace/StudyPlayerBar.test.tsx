import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StudyPlayerBar } from "./StudyPlayerBar";

afterEach(cleanup);

describe("measured study player bar", () => {
  it("uses the Lichess player markup and frozen geometry styles", () => {
    const { container } = render(<StudyPlayerBar position="top" name="A Player" rating={2310} clock="2:59" />);
    const bar = container.querySelector<HTMLElement>(".study__player.study__player-top")!;
    expect(bar.querySelector(".left > .info")?.textContent).toBe("A Player 2310");
    expect(bar.style.height).toBe("22.390625px");
    expect(bar.style.justifyContent).toBe("space-between");
    expect(bar.style.backgroundColor).toBe("transparent");
    expect(bar.style.backgroundImage).toContain("linear-gradient");
    expect(bar.style.color).toBe("rgb(186, 186, 186)");
    expect(bar.style.font).toContain('700 14px "Noto Sans"');
    expect(bar.style.borderRadius).toBe("7px 7px 0 0");
  });

  it("omits an unknown rating and puts the exact clock in the departure slot", () => {
    const { container } = render(<StudyPlayerBar position="bot" name="B Player" rating={null} clock="3:00" />);
    expect(container.querySelector(".info")?.textContent).toBe("B Player");
    const slot = container.querySelector('[data-jimmy-departure="clock"]')!;
    expect(slot.classList.contains("material")).toBe(true);
    expect(slot.textContent).toBe("3:00");
    expect(slot.querySelector("time")?.textContent).toBe("3:00");
  });
});
