"use client";

import { useState, useEffect } from "react";

export type BoardTheme = "wood" | "classic";
export type PieceSet = "wikipedia" | "leipzig";
export type UiMode = "dark" | "light";

export interface ChessSettings {
  boardTheme: BoardTheme;
  pieceSet: PieceSet;
  uiMode: UiMode;
  showCoordinates: boolean;
  highlightMoves: boolean;
  enablePremove: boolean;
  botElo: number;
}

export const boardThemes: Record<BoardTheme, { dark: string; light: string }> = {
  wood: { dark: "#8b4513", light: "#d2b48c" },
  classic: { dark: "#4d6d4d", light: "#f0f0f0" },
};

const PIECE_URLS: Record<PieceSet, string> = {
  wikipedia: "https://chessboardjs.com/img/chesspieces/wikipedia/",
  leipzig: "https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/leipzig/",
};

export function useSettings() {
  const [settings, setSettings] = useState<ChessSettings>({
    boardTheme: "classic",
    pieceSet: "wikipedia",
    uiMode: "dark",
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
    setSettings(prev => {
      const newSettings = { ...prev, ...partial };
      
      // Update storage
      localStorage.setItem("ag_settings", JSON.stringify(newSettings));
      
      // Notify other instances
      window.dispatchEvent(new CustomEvent("ag_settings_update", { detail: newSettings }));
      
      return newSettings;
    });
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
