"use client";

import { useState, useEffect } from "react";

export type BoardTheme = "dusk" | "wood" | "ice" | "classic";
export type PieceSet = "wikipedia" | "leipzig";
export type BackgroundTheme = "cosmos" | "abyss" | "minimal" | "forest";

export const backgroundGradients: Record<BackgroundTheme, { primary: string; secondary: string; base: string }> = {
  cosmos: { base: "bg-[#07090E]", primary: "bg-blue-600/10", secondary: "bg-indigo-900/10" },
  abyss: { base: "bg-[#020617]", primary: "bg-purple-900/10", secondary: "bg-black" },
  minimal: { base: "bg-[#0a0a0a]", primary: "bg-gray-800/5", secondary: "bg-gray-900/5" },
  forest: { base: "bg-[#050805]", primary: "bg-emerald-900/10", secondary: "bg-green-900/5" },
};

export interface ChessSettings {
  boardTheme: BoardTheme;
  pieceSet: PieceSet;
  backgroundTheme: BackgroundTheme;
  showCoordinates: boolean;
  highlightMoves: boolean;
  enablePremove: boolean;
  botElo: number;
}

export const boardThemes: Record<BoardTheme, { dark: string; light: string }> = {
  dusk: { dark: "#1e293b", light: "#334155" },
  wood: { dark: "#8b4513", light: "#d2b48c" },
  ice: { dark: "#2c3e50", light: "#ecf0f1" },
  classic: { dark: "#4d6d4d", light: "#f0f0f0" },
};

const PIECE_URLS: Record<PieceSet, string> = {
  wikipedia: "https://chessboardjs.com/img/chesspieces/wikipedia/",
  leipzig: "https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/leipzig/",
};

export function useSettings() {
  const [settings, setSettings] = useState<ChessSettings>({
    boardTheme: "dusk",
    pieceSet: "wikipedia",
    backgroundTheme: "cosmos",
    showCoordinates: true,
    highlightMoves: true,
    enablePremove: false,
    botElo: 1100,
  });

  useEffect(() => {
    const saved = localStorage.getItem("ag_settings");
    if (saved) {
      try {
        setSettings({ ...settings, ...JSON.parse(saved) });
      } catch (e) {}
    }
  }, []);

  const updateSettings = (partial: Partial<ChessSettings>) => {
    const newSettings = { ...settings, ...partial };
    setSettings(newSettings);
    localStorage.setItem("ag_settings", JSON.stringify(newSettings));
    
    // Dispatch event for other components to sync
    window.dispatchEvent(new CustomEvent("ag_settings_update", { detail: newSettings }));
  };

  useEffect(() => {
    const handleSync = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) setSettings(detail);
    };
    window.addEventListener("ag_settings_update", handleSync);
    return () => window.removeEventListener("ag_settings_update", handleSync);
  }, []);

  const getPieceUrl = (piece: string) => {
    // piece is like 'wP', 'bK'
    const color = piece[0];
    const type = piece[1].toUpperCase();
    const setBase = PIECE_URLS[settings.pieceSet];
    
    // Lichess URL format: wP.svg or wP.png
    // Chessboardjs URL format: wP.png
    const ext = settings.pieceSet === "wikipedia" ? ".png" : ".svg";
    return `${setBase}${color}${type}${ext}`;
  };

  return { settings, updateSettings, getPieceUrl, boardThemes };
}
