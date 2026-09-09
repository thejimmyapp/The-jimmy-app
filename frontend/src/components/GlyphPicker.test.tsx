import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MomentGlyph } from "../guestProgress";
import { GlyphPicker } from "./GlyphPicker";

afterEach(cleanup);

function ControlledPicker({ disabled = false }: { disabled?: boolean }) {
  const [glyph, setGlyph] = useState<MomentGlyph | null>(null);
  return <GlyphPicker value={glyph} onChange={setGlyph} disabled={disabled} />;
}

describe("GlyphPicker", () => {
  it.each([
    ["1", "!", "good", 1],
    ["2", "?", "mistake", 2],
    ["3", "!!", "brilliant", 3],
    ["4", "??", "blunder", 4],
    ["5", "!?", "interesting", 5],
    ["6", "?!", "dubious", 6],
  ] as const)("maps key %s to %s", (key, glyph, name, nag) => {
    render(<ControlledPicker />);
    const picker = screen.getByRole("group", { name: "Move glyph" });
    expect(picker.getAttribute("aria-keyshortcuts")).toBe("1 2 3 4 5 6");
    fireEvent.keyDown(picker, { key });
    expect(screen.getByRole("status").textContent).toBe(`Selected ${key}: ${glyph} — ${name}, NAG $${nag}`);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(glyph);
  });

  it("offers a native dropdown as the pointer fallback", () => {
    render(<ControlledPicker />);
    fireEvent.change(screen.getByRole("combobox", { name: "Move glyph pointer fallback" }), { target: { value: "??" } });
    expect(screen.getByRole("status").textContent).toBe("Selected 4: ?? — blunder, NAG $4");
  });

  it("does not select while disabled", () => {
    const onChange = vi.fn();
    render(<GlyphPicker value={null} onChange={onChange} disabled />);
    const picker = screen.getByRole("group", { name: "Move glyph" });
    fireEvent.keyDown(picker, { key: "1" });
    expect(onChange).not.toHaveBeenCalled();
    expect((screen.getByRole("combobox") as HTMLSelectElement).disabled).toBe(true);
    expect(picker.getAttribute("tabindex")).toBe("-1");
  });

  it.each([
    ["1", "!", "good"],
    ["2", "?", "mistake"],
    ["3", "!!", "brilliant"],
    ["4", "??", "blunder"],
    ["5", "!?", "interesting"],
    ["6", "?!", "dubious"],
  ] as const)("selects tile %s by click and exposes its pressed state", (key, glyph, name) => {
    const onChange = vi.fn();
    const { rerender } = render(<GlyphPicker value={null} onChange={onChange} />);
    const tile = screen.getByRole("button", { name: `${key} · ${glyph} · ${name}` });
    expect(tile.getAttribute("type")).toBe("button");
    expect(tile.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(tile);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(glyph);

    rerender(<GlyphPicker value={glyph} onChange={onChange} />);
    expect(screen.getByRole("button", { pressed: true })).toBe(tile);
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(glyph);
  });

  it("does not select any disabled tile by click", () => {
    const onChange = vi.fn();
    render(<GlyphPicker value={null} onChange={onChange} disabled />);
    const tiles = screen.getAllByRole("button");
    expect(tiles).toHaveLength(6);
    for (const tile of tiles) {
      expect((tile as HTMLButtonElement).disabled).toBe(true);
      fireEvent.click(tile);
    }
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps number-key selection when a tile has focus", () => {
    render(<ControlledPicker />);
    const tile = screen.getByRole("button", { name: "1 · ! · good" });
    tile.focus();
    fireEvent.keyDown(tile, { key: "2" });
    expect(screen.getByRole("button", { name: "2 · ? · mistake" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("group", { name: "Move glyph" }).getAttribute("tabindex")).toBe("0");
  });

  it("explains both tile clicking and number-key selection", () => {
    render(<ControlledPicker />);
    expect(screen.getByText("Click a glyph, or press its number key")).toBeTruthy();
  });
});
