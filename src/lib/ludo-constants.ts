export const LUDO_COLORS = ["green", "yellow", "blue", "red"] as const;

export type LudoColor = (typeof LUDO_COLORS)[number];

export const LUDO_COLOR_LABELS: Record<LudoColor, string> = {
  green: "Zielony",
  yellow: "Żółty",
  blue: "Niebieski",
  red: "Czerwony",
};

export const LUDO_COLOR_STYLES: Record<
  LudoColor,
  {
    token: string;
    glow: string;
    surface: string;
    accent: string;
  }
> = {
  green: {
    token: "#37d67a",
    glow: "rgba(55,214,122,0.38)",
    surface: "#123324",
    accent: "#7df0ab",
  },
  yellow: {
    token: "#ffd84a",
    glow: "rgba(255,216,74,0.38)",
    surface: "#3a3211",
    accent: "#ffe98b",
  },
  blue: {
    token: "#4d7dff",
    glow: "rgba(77,125,255,0.38)",
    surface: "#14264a",
    accent: "#88a8ff",
  },
  red: {
    token: "#ff5d6c",
    glow: "rgba(255,93,108,0.38)",
    surface: "#421520",
    accent: "#ff97a0",
  },
};

