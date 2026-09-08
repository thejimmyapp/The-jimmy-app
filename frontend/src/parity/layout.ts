export type ParityLayoutId = "reference" | "owner";

export interface ParityLayout {
  id: ParityLayoutId;
  headerHeight: number;
  mainY: number;
  board: {
    x: number;
    y: number;
    size: number;
    squareSize: number;
    ranksWidth: number;
    filesHeight: number;
  };
  tools: {
    x: number;
    width: number;
    pocketTopY: number;
    pocketBottomY: number;
    pocketHeight: number;
    pocketSlotSize: number;
    movesTop: number;
    movesBottom: number;
    controlsY: number;
    controlsHeight: number;
  };
  badge: {
    width: number;
    height: number;
    radius: number;
    fontSize: number;
    lineHeight: number;
  };
}

export const PARITY_LAYOUTS: Record<ParityLayoutId, ParityLayout> = {
  reference: {
    id: "reference",
    headerHeight: 60,
    mainY: 82.6875,
    board: { x: 379.1875, y: 82.6875, size: 680, squareSize: 85, ranksWidth: 9.59375, filesHeight: 16.796875 },
    tools: {
      x: 1071.1875,
      width: 354.421875,
      pocketTopY: 82.6875,
      pocketBottomY: 705.484375,
      pocketHeight: 60,
      pocketSlotSize: 60,
      movesTop: 142.6875,
      movesBottom: 705.484375,
      controlsY: 765.484375,
      controlsHeight: 42,
    },
    badge: { width: 18.03125, height: 19.859375, radius: 7, fontSize: 15.4, lineHeight: 13.86 },
  },
  owner: {
    id: "owner",
    headerHeight: 60,
    mainY: 82.69,
    board: { x: 323.14, y: 82.69, size: 800, squareSize: 100, ranksWidth: 9.6, filesHeight: 16.8 },
    tools: {
      x: 1135.1,
      width: 283.5,
      pocketTopY: 82.69,
      pocketBottomY: 828,
      pocketHeight: 56.7,
      pocketSlotSize: 56.7,
      movesTop: 142.7,
      movesBottom: 826,
      controlsY: 886,
      controlsHeight: 42,
    },
    badge: { width: 18.03125, height: 19.859375, radius: 7, fontSize: 15.4, lineHeight: 13.86 },
  },
};

export function parityLayout(id: string | null): ParityLayout {
  return id === "owner" ? PARITY_LAYOUTS.owner : PARITY_LAYOUTS.reference;
}
