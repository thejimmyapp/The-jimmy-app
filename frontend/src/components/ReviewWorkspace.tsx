import type { ReactNode } from "react";

interface Props {
  mainBoard: ReactNode;
  secondaryBoard: ReactNode;
  replayControls: ReactNode;
  swapControl?: ReactNode;
  stageActions?: ReactNode;
}

export function ReviewWorkspace({ mainBoard, secondaryBoard, replayControls, swapControl, stageActions }: Props) {
  return (
    <section className="review-workspace">
      <div className="review-main">
        {stageActions}
        <div className="review-main-board">{mainBoard}</div>
        <div className="review-replay">{replayControls}</div>
      </div>
      <div className="review-divider">{swapControl}</div>
      <aside className="review-secondary" aria-label="Secondary board">{secondaryBoard}</aside>
    </section>
  );
}
