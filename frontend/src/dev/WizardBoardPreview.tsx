import { useState } from "react";
import { createRoot } from "react-dom/client";
import { api } from "../api";
import { AnnotationWizardShell } from "../components/AnnotationWizardShell";
import { AppShell } from "../components/AppShell";
import { BoardPanel } from "../components/BoardPanel";
import type { ReplayPosition } from "../types";
import start from "../../dev/usability/starting-position.json";
import "../styles.css";
import "../boardAppearance.css";

const position = start as ReplayPosition;

// Dev-only composition of the production shell, wizard, and board. The browser
// harness serves fixed exploration responses; no application API is contacted.
export function WizardBoardPreview() {
  const [saved, setSaved] = useState(false);
  const suppressDock = new URLSearchParams(location.search).get("dock") === "0";
  return <AppShell
    rail={<span>J</span>}
    topbar={<span>OFFLINE WIZARD FIXTURE</span>}
    boardTheme="wood-classic" pieceStyle="cburnett" pieceSize="normal"
    suppressDock={suppressDock}
    dock={<span>Second Board</span>}
    stage={<div className="moment-editor-backdrop">
      {saved ? <p role="status">Fixture moment saved</p> : <AnnotationWizardShell
        move_options={[{ token: "1A", move: "e4" }]}
        onSave={async () => setSaved(true)}
        onCancel={() => setSaved(false)}
        render_alternative_board={(onMovePlayed) => <BoardPanel
          boardId="A" position={position} pairedPosition={position}
          orientation="white" pieceStyle="cburnett" layout="standard"
          title="Board A alternative" playerTop="Black" playerBottom="White"
          analysisLocked
          onMoveIntent={async (intent) => {
            const result = await api.explorationMove({
              board_a_fen: position.variant_fen, board_b_fen: position.variant_fen,
              board: intent.board, from_square: intent.from, to_square: intent.to,
              drop_piece: intent.dropPiece,
            });
            if (result.legal && result.notation) onMovePlayed(result.notation);
            return result;
          }}
        />}
      />}
    </div>}
  />;
}

createRoot(document.getElementById("root")!).render(<WizardBoardPreview />);
