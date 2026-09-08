export type ParityBoardThemeId = "brown" | "wood";

export interface ParityBoardTheme {
  id: ParityBoardThemeId;
  light: string;
  dark: string;
  coordOnLight: string;
  coordOnDark: string;
  image: string;
}

export const PARITY_BOARD_THEMES: Record<ParityBoardThemeId, ParityBoardTheme> = {
  brown: {
    id: "brown",
    light: "#f0d9b5",
    dark: "#b58863",
    coordOnLight: "#946f51",
    coordOnDark: "#f0d9b5",
    image: "none",
  },
  wood: {
    id: "wood",
    light: "#d0ceca",
    dark: "#755839",
    coordOnLight: "#755839",
    coordOnDark: "#d0ceca",
    image: 'url("/boards/parity-wood.svg")',
  },
};

export function parityBoardTheme(id: string | null): ParityBoardTheme {
  return id === "wood" ? PARITY_BOARD_THEMES.wood : PARITY_BOARD_THEMES.brown;
}
