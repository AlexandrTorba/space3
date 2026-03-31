"use client";

import { useState, useEffect } from "react";

export type BoardTheme = "wood" | "classic";
export type PieceSet = "wikipedia" | "leipzig";
export type UiMode = "dark" | "light" | "antigravity";

export interface ChessSettings {
  playerName: string;
  boardTheme: BoardTheme;
  pieceSet: PieceSet;
  uiMode: UiMode;
  showCoordinates: boolean;
  highlightMoves: boolean;
  enablePremove: boolean;
  botElo: number;
  alwaysPromoteToQueen: boolean;
  engineThreads: number;
  engineHash: number;
  engineMultiPV: number;
  volume: number;
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
    playerName: "Player",
    boardTheme: "classic",
    pieceSet: "wikipedia",
    uiMode: "dark",
    showCoordinates: true,
    highlightMoves: true,
    enablePremove: false,
    botElo: 1500,
    alwaysPromoteToQueen: true,
    engineThreads: 1,
    engineHash: 16,
    engineMultiPV: 1,
    volume: 0.7,
  });

  useEffect(() => {
    // Initial load from localStorage
    const savedName = localStorage.getItem("ag_name");
    const savedSettings = localStorage.getItem("ag_settings");
    
    let initialName = savedName || `Player${Math.floor(Math.random() * 9000) + 1000}`;
    if (!savedName) localStorage.setItem("ag_name", initialName);

    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        if (parsed.playerName) initialName = parsed.playerName;
        
        // Validate theme/pieces to prevent crashes if localStorage has stale values
        if (parsed.boardTheme && !boardThemes[parsed.boardTheme as BoardTheme]) {
            delete parsed.boardTheme;
        }
        if (parsed.pieceSet && !["wikipedia", "leipzig"].includes(parsed.pieceSet)) {
            delete parsed.pieceSet;
        }
        // Single-shot localStorage hydration on mount — safe, not cascading
        // eslint-disable-next-line react-compiler/react-compiler
        setSettings(prev => ({ ...prev, ...parsed, playerName: initialName }));
      } catch (e) {
        setSettings(prev => ({ ...prev, playerName: initialName }));
      }
    } else {
        setSettings(prev => ({ ...prev, playerName: initialName }));
    }
  }, []);

  const updateSettings = (partial: Partial<ChessSettings>) => {
    setSettings(prev => {
      const newSettings = { ...prev, ...partial };
      
      // Defer side effects to next tick to avoid React render cycle issues
      setTimeout(() => {
        localStorage.setItem("ag_settings", JSON.stringify(newSettings));
        if (newSettings.playerName) {
            localStorage.setItem("ag_name", newSettings.playerName);
        }
        window.dispatchEvent(new CustomEvent("ag_settings_update", { detail: newSettings }));
      }, 0);
      
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
    if (!piece || piece.length < 2) {
      // Fallback for invalid piece codes
      const setBase = PIECE_URLS[settings.pieceSet];
      const ext = settings.pieceSet === "wikipedia" ? ".png" : ".svg";
      return `${setBase}wP${ext}`;
    }
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
