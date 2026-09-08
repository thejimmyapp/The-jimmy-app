import type { ParsedPgn, PgnNode, PgnRoot } from "../pgn/parsePgn";

export function pgnNodeById(tree: ParsedPgn, id: string): PgnRoot | PgnNode | undefined {
  return id === "root" ? tree.root : tree.nodes.find((node) => node.id === id);
}

export function pgnMainline(tree: ParsedPgn) {
  const nodes: PgnNode[] = [];
  let current = tree.root.children[0];
  while (current) {
    nodes.push(current);
    current = current.children[0];
  }
  return nodes;
}

export function treeKeyboardTarget(tree: ParsedPgn, activeId: string, key: "ArrowLeft" | "ArrowRight") {
  const active = pgnNodeById(tree, activeId);
  if (!active) return activeId;
  if (key === "ArrowRight") return active.children[0]?.id ?? activeId;
  return "parentId" in active ? active.parentId : activeId;
}

export type ParityNavigationAction = "first" | "prev" | "next" | "last";
export type ParityNavigationKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "Home" | "End";
export type ParityKeyboardAction = { type: "navigate"; key: ParityNavigationKey } | { type: "flip" } | null;

export function parityKeyboardAction(key: string): ParityKeyboardAction {
  if (key === "f") return { type: "flip" };
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(key)) return { type: "navigate", key: key as ParityNavigationKey };
  return null;
}

function walk(tree: ParsedPgn, activeId: string, direction: "prev" | "next", count: number) {
  let result = activeId;
  for (let index = 0; index < count; index += 1) {
    const next = treeKeyboardTarget(tree, result, direction === "prev" ? "ArrowLeft" : "ArrowRight");
    if (next === result) break;
    result = next;
  }
  return result;
}

export function treeControlTarget(tree: ParsedPgn, activeId: string, action: ParityNavigationAction) {
  if (action === "first") return "root";
  if (action === "prev") return walk(tree, activeId, "prev", 1);
  if (action === "next") return walk(tree, activeId, "next", 1);
  return walk(tree, activeId, "next", Number.POSITIVE_INFINITY);
}

export function treeNavigationTarget(tree: ParsedPgn, activeId: string, key: ParityNavigationKey, shiftKey = false) {
  if (key === "ArrowUp" || key === "Home") return "root";
  if (key === "ArrowDown" || key === "End") return treeControlTarget(tree, activeId, "last");
  return walk(tree, activeId, key === "ArrowLeft" ? "prev" : "next", shiftKey ? 10 : 1);
}
