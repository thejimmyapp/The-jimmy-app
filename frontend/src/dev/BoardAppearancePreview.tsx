import { createRoot } from "react-dom/client";
import { BOARD_THEMES, PIECE_SETS, boardThemeVariables, type BoardThemeId, type PieceSetId } from "../boardAppearance";
import { BoardPanel, PocketRail } from "../components/BoardPanel";
import type { ReplayPosition } from "../types";
import "../styles.css";
import "../boardAppearance.css";
import "./boardAppearancePreview.css";

const position: ReplayPosition = {
  ply: 18,
  label: "10. Re1",
  board: [
    ["r", "", "b", "q", "", "r", "k", ""],
    ["p", "p", "", "n", "b", "p", "p", "p"],
    ["", "", "n", "p", "", "", "", ""],
    ["", "", "p", "", "p", "", "", ""],
    ["", "", "B", "", "P", "", "", ""],
    ["", "", "N", "P", "", "N", "", ""],
    ["P", "P", "P", "", "", "P", "P", "P"],
    ["R", "", "B", "Q", "R", "", "K", ""],
  ],
  side_to_move: "Black",
  variant_fen: "appearance-preview",
  white_pocket: "PPNBR",
  black_pocket: "ppnq",
  white_clock: "2:14",
  black_clock: "1:58",
  partner_index: 18,
  from_square: "f1",
  to_square: "e1",
};

const scales = [
  { id: "small", label: "Small", width: "300px" },
  { id: "medium", label: "Medium", width: "420px" },
  { id: "large", label: "Large", width: "560px" },
] as const;

export function AppearanceExample({ themeId, pieceSetId, scale }: { themeId: BoardThemeId; pieceSetId: PieceSetId; scale: (typeof scales)[number] }) {
  const variables = { ...boardThemeVariables(themeId), "--appearance-width": scale.width } as React.CSSProperties;
  const noop = () => undefined;
  return (
    <article className="appearance-example" data-board-theme={themeId} data-piece-set={pieceSetId} data-piece-style={pieceSetId} data-piece-size="normal" style={variables}>
      <header><strong>{scale.label}</strong><span>{scale.width}</span></header>
      <div className="appearance-board-row">
        <BoardPanel boardId="A" position={position} pairedPosition={position} orientation="white" pieceStyle={pieceSetId} layout="primary" title="First Board" playerTop="Opponent" playerBottom="You" />
        <BoardPanel boardId="B" position={position} pairedPosition={position} orientation="black" pieceStyle={pieceSetId} layout="compact" title="Second Board" playerTop="Partner" playerBottom="Diagonal opponent" />
      </div>
      <div className="appearance-pocket-row">
        <PocketRail color="White" value={position.white_pocket} draggable={false} pieceStyle={pieceSetId} selectedPiece={null} onSelectPiece={noop} onDragPiece={noop} />
        <PocketRail color="Black" value={position.black_pocket} draggable={false} pieceStyle={pieceSetId} selectedPiece={null} onSelectPiece={noop} onDragPiece={noop} />
      </div>
    </article>
  );
}

export function BoardAppearancePreview() {
  return (
    <main className="appearance-catalog">
      <header className="appearance-catalog-header"><span>PRIVATE DEV PREVIEW</span><h1>Board appearance registry</h1><p>Every board theme × piece set at three scales, rendered through the production BoardPanel and PocketRail.</p></header>
      {BOARD_THEMES.map((theme) => PIECE_SETS.map((pieceSet) => (
        <section className="appearance-combination" key={`${theme.id}-${pieceSet.id}`}>
          <h2>{theme.name} × {pieceSet.name}</h2>
          <div className="appearance-scales">{scales.map((scale) => <AppearanceExample key={scale.id} themeId={theme.id} pieceSetId={pieceSet.id} scale={scale} />)}</div>
        </section>
      )))}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<BoardAppearancePreview />);
