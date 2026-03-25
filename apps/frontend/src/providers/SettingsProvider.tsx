"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { translations, Language } from "../i18n";

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
  alwaysPromoteToQueen: boolean;
}

export const boardThemes: Record<BoardTheme, { dark: string; light: string }> = {
  wood: { dark: "#8b4513", light: "#d2b48c" },
  classic: { dark: "#4d6d4d", light: "#f0f0f0" },
};

const PIECE_URLS: Record<PieceSet, string> = {
  wikipedia: "https://chessboardjs.com/img/chesspieces/wikipedia/",
  leipzig: "https://raw.githubusercontent.com/lichess-org/lila/master/public/piece/leipzig/",
};

interface SettingsContextType {
  settings: ChessSettings;
  updateSettings: (partial: Partial<ChessSettings>) => void;
  lang: Language;
  changeLanguage: (newLang: Language) => void;
  t: (key: keyof typeof translations['en']) => string;
  getPieceUrl: (piece: string) => string;
  isPanelOpen: boolean;
  setIsPanelOpen: (open: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

const DEFAULT_SETTINGS: ChessSettings = {
  boardTheme: "classic",
  pieceSet: "wikipedia",
  uiMode: "dark",
  showCoordinates: true,
  highlightMoves: true,
  enablePremove: false,
  botElo: 1100,
  alwaysPromoteToQueen: true,
};

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [settings, setSettings] = useState<ChessSettings>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ag_settings");
      if (saved) {
        try {
          return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
        } catch (e) {}
      }
    }
    return DEFAULT_SETTINGS;
  });

  const [lang, setLang] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ag_lang") as Language;
      if (saved && translations[saved]) {
        return saved;
      }
    }
    return "uk";
  });

  // Update localStorage when state changes
  useEffect(() => {
    localStorage.setItem("ag_settings", JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem("ag_lang", lang);
  }, [lang]);

  const updateSettings = (partial: Partial<ChessSettings>) => {
    setSettings(prev => ({ ...prev, ...partial }));
  };

  const changeLanguage = (newLang: Language) => {
    if (translations[newLang]) {
      setLang(newLang);
    }
  };

  const t = (key: keyof typeof translations['en']): string => {
    return translations[lang]?.[key] || translations['en'][key] || (key as string);
  };

  const getPieceUrl = (piece: string) => {
    const color = piece[0];
    const type = piece[1].toUpperCase();
    const setBase = PIECE_URLS[settings.pieceSet];
    const ext = settings.pieceSet === "wikipedia" ? ".png" : ".svg";
    return `${setBase}${color}${type}${ext}`;
  };

  return (
    <SettingsContext.Provider value={{ 
      settings, updateSettings, lang, changeLanguage, t, getPieceUrl,
      isPanelOpen, setIsPanelOpen
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettingsContext() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettingsContext must be used within a SettingsProvider");
  }
  return context;
}
