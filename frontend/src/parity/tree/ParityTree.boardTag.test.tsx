import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import fixture from "../fixtures/Ma9vcnpu-4lZqSffp.pgn?raw";
import { parsePgn } from "../pgn/parsePgn";
import { ParityTree } from "./ParityTree";

describe("optional timeline board tags", () => {
  it("leaves fixture-tree markup byte-identical when no boardTag is present", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const tree = parsePgn(fixture);
    const first = render(<ParityTree tree={tree} activeId="root" onSelect={() => undefined} />).container.innerHTML;
    const second = render(<ParityTree tree={structuredClone(tree)} activeId="root" onSelect={() => undefined} />).container.innerHTML;
    expect(first).toBe(second);
    expect(first).not.toContain("parity-board-tag");
  });
});
