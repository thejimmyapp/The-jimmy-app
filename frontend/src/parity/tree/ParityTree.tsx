import { Fragment, useEffect, useMemo, useRef, type ReactNode } from "react";
import type { ParsedPgn, PgnGlyph, PgnNode, PgnRoot } from "../pgn/parsePgn";
import { pgnMainline, pgnNodeById } from "./treeNavigation";
import "./parityTree.css";

export interface ParityTreeProps {
  tree: ParsedPgn;
  activeId: string;
  onSelect: (id: string) => void;
}

const glyphClass = (glyph: PgnGlyph) => glyph.kind === "other" ? "other" : glyph.kind;
const figurines = {
  White: { K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙" },
  Black: { K: "♚", Q: "♛", R: "♜", B: "♝", N: "♞", P: "♟" },
} as const;

function shownSan(san: string, side: PgnNode["sideToMove"]) {
  const pieces = figurines[side];
  return san.replace(/^([KQRBNP])(?=@|[a-hx])/, (role) => pieces[role as keyof typeof pieces]).replace(/=([QRBN])/, (_match, role: keyof typeof pieces) => `=${pieces[role]}`);
}

function nodeGlyphText(node: PgnNode) {
  return node.glyphs.map((glyph) => glyph.symbol).join("");
}

function MoveCell({ node, activeId, onSelect, inline = false }: { node: PgnNode; activeId: string; onSelect: (id: string) => void; inline?: boolean }) {
  const firstGlyph = node.glyphs[0];
  const className = [inline ? "inline-move" : "column-move", node.id === activeId ? "active" : "", firstGlyph ? `glyph-${glyphClass(firstGlyph)}` : ""].filter(Boolean).join(" ");
  return <move className={className} data-node-id={node.id} data-glyph={firstGlyph?.kind} onClick={() => onSelect(node.id)} tabIndex={0} role="button">
    {inline && <index>{node.moveNumber}{node.sideToMove === "Black" ? "..." : "."}</index>}
    {node.boardTag && <span className="parity-board-tag" aria-label={`Board ${node.boardTag}`}>{node.boardTag}</span>}
    <san>{shownSan(node.san, node.sideToMove)}</san>
    {node.glyphs.map((glyph, index) => <glyph key={`${glyph.symbol}-${index}`} className={glyphClass(glyph)}>{glyph.symbol}</glyph>)}
  </move>;
}

function Comments({ node }: { node: PgnNode }) {
  return <>{node.comments.map((text, index) => <comment key={`${node.id}-comment-${index}`}>{text}</comment>)}</>;
}

function VariationLine({ start, activeId, onSelect, depth }: { start: PgnNode; activeId: string; onSelect: (id: string) => void; depth: number }) {
  const content: ReactNode[] = [];
  let current: PgnNode | undefined = start;
  while (current) {
    content.push(<Fragment key={current.id}>
      <MoveCell node={current} activeId={activeId} onSelect={onSelect} inline />
      <Comments node={current} />
      {current.children.slice(1).map((variation) => <interrupt key={`${current!.id}-${variation.id}`} data-depth={depth + 1}><lines><line><VariationLine start={variation} activeId={activeId} onSelect={onSelect} depth={depth + 1} /></line></lines></interrupt>)}
    </Fragment>);
    current = current.children[0];
  }
  return <>{content}</>;
}

function mainlineRows(nodes: PgnNode[]) {
  const rows = new Map<number, { white?: PgnNode; black?: PgnNode }>();
  for (const node of nodes) {
    const row = rows.get(node.moveNumber) ?? {};
    row[node.sideToMove === "White" ? "white" : "black"] = node;
    rows.set(node.moveNumber, row);
  }
  return [...rows.entries()].map(([moveNumber, row]) => ({ moveNumber, ...row }));
}

export function ParityTree({ tree, activeId, onSelect }: ParityTreeProps) {
  const movesRef = useRef<HTMLDivElement>(null);
  const mainline = useMemo(() => pgnMainline(tree), [tree]);
  const rows = useMemo(() => mainlineRows(mainline), [mainline]);

  useEffect(() => {
    const box = movesRef.current;
    const active = box?.querySelector<HTMLElement>(`move[data-node-id="${activeId}"]`);
    if (!box || !active) return;
    const activeTop = active.offsetTop;
    const activeBottom = activeTop + active.offsetHeight;
    if (activeTop < box.scrollTop || activeBottom > box.scrollTop + box.clientHeight) box.scrollTop = Math.max(0, activeTop - box.clientHeight / 3);
  }, [activeId]);

  return <div className="parity-tree" ref={movesRef} data-active-id={activeId}>
    {tree.root.comments.map((text) => <comment className="root-comment" key={text}><a href={text} target="_blank" rel="noreferrer">{text.replace(/^https?:\/\//, "")}</a></comment>)}
    <div className="parity-mainline">
      {rows.map(({ moveNumber, white, black }) => {
        const variations = [white, black].flatMap((node) => {
          if (!node) return [];
          const parent = pgnNodeById(tree, node.parentId);
          return parent?.children[0]?.id === node.id ? parent.children.slice(1) : [];
        });
        return <Fragment key={moveNumber}>
          <div className="parity-column-row" data-mainline-row={moveNumber}>
            <index>{moveNumber}</index>
            {white ? <MoveCell node={white} activeId={activeId} onSelect={onSelect} /> : <move className="column-move ellipsis">...</move>}
            {black ? <MoveCell node={black} activeId={activeId} onSelect={onSelect} /> : <move className="column-move empty" />}
          </div>
          {variations.map((variation) => <interrupt key={variation.id} data-depth="1"><lines><line><VariationLine start={variation} activeId={activeId} onSelect={onSelect} depth={1} /></line></lines></interrupt>)}
          {white && <Comments node={white} />}
          {black && <Comments node={black} />}
        </Fragment>;
      })}
    </div>
  </div>;
}

export function ParityFork({ node, onSelect }: { node: PgnRoot | PgnNode | undefined; onSelect: (id: string) => void }) {
  if (!node || node.children.length < 2) return null;
  return <div className="parity-fork-options" data-testid="parity-fork">
    {node.children.map((child, index) => <button key={child.id} className={index === 0 ? "selected" : ""} type="button" onClick={() => onSelect(child.id)}>{child.moveNumber}{child.sideToMove === "Black" ? "..." : "."}{shownSan(child.san, child.sideToMove)}{nodeGlyphText(child)}</button>)}
  </div>;
}
