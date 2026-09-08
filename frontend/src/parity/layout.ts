export type ParityLayoutId = "reference" | "reference1200" | "reference1024" | "owner";

export interface ParityLayout {
  id: ParityLayoutId;
  viewport: { width: number; height: number };
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
    viewport: { width: 1440, height: 900 },
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
    viewport: { width: 1440, height: 950 },
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
  reference1200: {
    id: "reference1200",
    viewport: { width: 1200, height: 800 },
    headerHeight: 60,
    mainY: 82.1875,
    board: { x: 105.109375, y: 82.1875, size: 592, squareSize: 74, ranksWidth: 9.59375, filesHeight: 16.796875 },
    tools: {
      x: 701.109375, width: 400, pocketTopY: 82.1875, pocketBottomY: 620.40625,
      pocketHeight: 60, pocketSlotSize: 60, movesTop: 142.1875, movesBottom: 620.40625,
      controlsY: 680.40625, controlsHeight: 42,
    },
    badge: { width: 18.03125, height: 19.859375, radius: 7, fontSize: 15.4, lineHeight: 13.86 },
  },
  reference1024: {
    id: "reference1024",
    viewport: { width: 1024, height: 768 },
    headerHeight: 60,
    mainY: 81.53125,
    board: { x: 27.953125, y: 81.53125, size: 568, squareSize: 71, ranksWidth: 9.59375, filesHeight: 16.796875 },
    tools: {
      x: 599.953125, width: 400, pocketTopY: 81.53125, pocketBottomY: 593.453125,
      pocketHeight: 60, pocketSlotSize: 60, movesTop: 141.53125, movesBottom: 593.453125,
      controlsY: 653.453125, controlsHeight: 40.8125,
    },
    badge: { width: 18.03125, height: 19.859375, radius: 7, fontSize: 15.4, lineHeight: 13.86 },
  },
};

export function parityLayout(id: string | null): ParityLayout {
  return id === "owner" || id === "reference1200" || id === "reference1024" ? PARITY_LAYOUTS[id] : PARITY_LAYOUTS.reference;
}
