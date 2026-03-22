"use client";

import { useSettingsContext } from "../providers/SettingsProvider";
export { boardThemes } from "../providers/SettingsProvider";
export type { BoardTheme, PieceSet, UiMode, ChessSettings } from "../providers/SettingsProvider";

export function useSettings() {
  const { settings, updateSettings, getPieceUrl } = useSettingsContext();
  return { settings, updateSettings, getPieceUrl };
}

