export type ParityLayoutId = "reference" | "reference1200" | "reference1024" | "owner" | "jimmy1440" | "jimmy1200" | "jimmy1024";

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
  frame?: { width: number; height: number };
  extents?: { right: number; bottom: number };
  secondBoard?: { placement: "side" | "under"; x: number; width: number };
  underboard?: { y: number; buttonsHeight: number; fontSize: number; buttonFontSize: number; headingHeight: number; headingFontSize: number; headingPadding: number; rowHeight: number };
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
  jimmy1440: {
    id: "jimmy1440",
    viewport: { width: 1372, height: 902 }, frame: { width: 1372, height: 842 }, headerHeight: 0, mainY: 22.703125,
    board: { x: 353.234375, y: 22.703125, size: 680, squareSize: 85, ranksWidth: 9.59375, filesHeight: 16.796875 },
    tools: {
      x: 1045.234375, width: 313.046875, pocketTopY: 22.703125, pocketBottomY: 647.1875,
      pocketHeight: 60, pocketSlotSize: 60, movesTop: 82.703125, movesBottom: 647.1875,
      controlsY: 707.1875, controlsHeight: 42,
    },
    badge: { width: 18.03125, height: 19.859375, radius: 7, fontSize: 15.4, lineHeight: 13.86 },
    extents: { right: 1358.28125, bottom: 749.1875 }, secondBoard: { placement: "side", x: 13.71875, width: 323.03125 },
    underboard: { y: 720.375, buttonsHeight: 39.34375, fontSize: 14, buttonFontSize: 16.1, headingHeight: 42.78125, headingFontSize: 18.2, headingPadding: 14, rowHeight: 40.578125 },
  },
  jimmy1200: {
    id: "jimmy1200",
    viewport: { width: 1132, height: 802 }, frame: { width: 1132, height: 742 }, headerHeight: 0, mainY: 22,
    board: { x: 64.09375, y: 22, size: 600, squareSize: 75, ranksWidth: 9.34375, filesHeight: 16.375 },
    tools: {
      x: 668.09375, width: 400, pocketTopY: 22, pocketBottomY: 562.203125,
      pocketHeight: 60, pocketSlotSize: 60, movesTop: 82, movesBottom: 562.203125,
      controlsY: 622.203125, controlsHeight: 41.53125,
    },
    badge: { width: 18.03125, height: 19.859375, radius: 7, fontSize: 15.4, lineHeight: 13.86 },
    extents: { right: 1068.09375, bottom: 663.734375 }, secondBoard: { placement: "under", x: 64.09375, width: 293.5 },
    underboard: { y: 656.046875, buttonsHeight: 39.203125, fontSize: 13.8489, buttonFontSize: 15.9262, headingHeight: 42.515625, headingFontSize: 18.0036, headingPadding: 13.8489, rowHeight: 40.125 },
  },
  jimmy1024: {
    id: "jimmy1024",
    viewport: { width: 956, height: 770 }, frame: { width: 956, height: 710 }, headerHeight: 0, mainY: 21.34375,
    board: { x: 12.140625, y: 21.34375, size: 560, squareSize: 70, ranksWidth: 8.71875, filesHeight: 15.28125 },
    tools: {
      x: 576.140625, width: 370.3125, pocketTopY: 21.34375, pocketBottomY: 523.9375,
      pocketHeight: 60, pocketSlotSize: 60, movesTop: 81.34375, movesBottom: 523.9375,
      controlsY: 583.9375, controlsHeight: 40.359375,
    },
    badge: { width: 18.03125, height: 19.859375, radius: 7, fontSize: 15.4, lineHeight: 13.86 },
    extents: { right: 946.453125, bottom: 624.296875 }, secondBoard: { placement: "under", x: 12.140625, width: 293.5 },
    underboard: { y: 616.875, buttonsHeight: 38.46875, fontSize: 13.4578, buttonFontSize: 15.4764, headingHeight: 40.796875, headingFontSize: 17.4951, headingPadding: 13.4578, rowHeight: 38.984375 },
  },
};

export function parityLayout(id: string | null): ParityLayout {
  return id === "owner" || id === "reference1200" || id === "reference1024" || id === "jimmy1440" || id === "jimmy1200" || id === "jimmy1024" ? PARITY_LAYOUTS[id] : PARITY_LAYOUTS.reference;
}

const jimmyLayouts = [PARITY_LAYOUTS.jimmy1440, PARITY_LAYOUTS.jimmy1200, PARITY_LAYOUTS.jimmy1024];

export function studyLayoutForBox(width: number, height: number): ParityLayout {
  return jimmyLayouts.find((layout) => layout.extents!.right <= width && layout.extents!.bottom <= height) ?? PARITY_LAYOUTS.jimmy1024;
}
