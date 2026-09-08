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
