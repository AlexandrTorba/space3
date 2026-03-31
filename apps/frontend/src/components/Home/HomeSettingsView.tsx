"use client";

import { useTranslation, Language, translations } from "@/i18n";
import { useSettings, boardThemes, BoardTheme, PieceSet } from "@/hooks/useSettings";
import { Settings, Palette, Globe, Eye, Sliders, User, Layers, Cpu } from "lucide-react";
import { motion } from "framer-motion";
import MagicSegmentedControl from "./MagicSegmentedControl";

/**
 * HomeSettingsView — full-page settings used on the home page "Settings" tab.
 * Must stay 100% in sync with SettingsPanel (the slide-in panel used during games).
 * Both read/write the same `useSettings()` hook → single source of truth.
 */
export default function HomeSettingsView() {
  const { lang, changeLanguage, t } = useTranslation();
  const { settings, updateSettings } = useSettings();

  const Toggle = ({ value, onToggle }: { value: boolean; onToggle: () => void }) => (
    <button
      onClick={onToggle}
      className={`w-10 h-5 rounded-full transition-all relative flex-shrink-0 ${value ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]" : "bg-slate-700"}`}
    >
      <motion.div animate={{ x: value ? 22 : 4 }} className="w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] shadow-sm" />
    </button>
  );

  return (
    <div className="w-full bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-6 md:p-10 animate-in fade-in zoom-in-95 duration-500 max-w-4xl mx-auto shadow-2xl overflow-hidden">
        <header className="flex items-center gap-4 mb-8">
            <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-400">
                <Settings className="w-8 h-8" />
            </div>
            <div>
                <h2 className="text-3xl font-black text-white uppercase tracking-tighter">{t("settings_title") || "Settings"}</h2>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t("customize_experience") || "Customize your Antigravity experience"}</p>
            </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
            {/* ── Left Column ─────────────────────────────────────────── */}
            <div className="space-y-8">

                {/* Player Name */}
                <section className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 flex items-center gap-2 uppercase tracking-[0.2em] opacity-60">
                        <User className="w-3 h-3" /> {t("profile_section") || "Profile"}
                    </label>
                    <div className="p-1 bg-white/[0.03] rounded-2xl border border-white/5 focus-within:border-blue-500/50 transition-all shadow-inner">
                        <input
                            type="text"
                            value={settings.playerName}
                            onChange={(e) => updateSettings({ playerName: e.target.value })}
                            placeholder="Your Name"
                            className="w-full bg-transparent px-5 py-2.5 text-base font-black text-white focus:outline-none placeholder:text-white/10"
                            maxLength={20}
                        />
                    </div>
                </section>

                {/* Language */}
                <section className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 flex items-center gap-2 uppercase tracking-[0.2em] opacity-60">
                        <Globe className="w-3 h-3" /> {t("language_section") || "Language"}
                    </label>
                    <MagicSegmentedControl
                        value={lang}
                        onChange={(id) => changeLanguage(id as Language)}
                        options={Object.keys(translations).map(l => ({ id: l, label: l.toUpperCase() }))}
                    />
                </section>

                {/* Appearance / Theme */}
                <section className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 flex items-center gap-2 uppercase tracking-[0.2em] opacity-60">
                        <Palette className="w-3 h-3" /> {t("appearance_section") || "Appearance"}
                    </label>
                    <MagicSegmentedControl
                        value={settings.uiMode}
                        onChange={(id) => updateSettings({ uiMode: id as any })}
                        options={[
                            { id: "dark",        label: t("theme_dark")  || "Dark",        icon: <Eye   className="w-3 h-3" /> },
                            { id: "light",       label: t("theme_light") || "Light",       icon: <Layers className="w-3 h-3" /> },
                            { id: "antigravity", label: t("theme_antigravity") || "Antigravity", icon: <span className="text-xs">🪐</span> },
                        ]}
                    />
                </section>

                {/* Board Theme */}
                <section className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 flex items-center gap-2 uppercase tracking-[0.2em] opacity-60">
                        <Palette className="w-3 h-3" /> {t("board_theme_section") || "Board Theme"}
                    </label>
                    <MagicSegmentedControl
                        value={settings.boardTheme}
                        onChange={(id) => updateSettings({ boardTheme: id as BoardTheme })}
                        options={(Object.keys(boardThemes) as BoardTheme[]).map(theme => ({
                            id: theme,
                            label: theme.toUpperCase(),
                            icon: (
                                <div className="flex flex-col w-3 h-3 rounded overflow-hidden rotate-45 border border-white/10">
                                    <div className="w-full h-full" style={{ backgroundColor: boardThemes[theme].light }} />
                                    <div className="w-full h-full" style={{ backgroundColor: boardThemes[theme].dark }} />
                                </div>
                            ),
                        }))}
                    />
                </section>

                {/* Piece Set */}
                <section className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 flex items-center gap-2 uppercase tracking-[0.2em] opacity-60">
                        <Layers className="w-3 h-3" /> {t("piece_set_section") || "Piece Set"}
                    </label>
                    <MagicSegmentedControl
                        value={settings.pieceSet}
                        onChange={(id) => updateSettings({ pieceSet: id as PieceSet })}
                        options={[
                            { id: "wikipedia", label: "Wikipedia" },
                            { id: "leipzig",   label: "Leipzig" },
                        ]}
                    />
                </section>
            </div>

            {/* ── Right Column ─────────────────────────────────────────── */}
            <div className="space-y-8">

                {/* Gameplay toggles */}
                <section className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 flex items-center gap-2 uppercase tracking-[0.2em] opacity-60">
                        <Sliders className="w-3 h-3" /> {t("gameplay_section") || "Gameplay"}
                    </label>
                    <div className="space-y-3 bg-white/[0.03] p-5 rounded-2xl border border-white/5 shadow-inner">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black text-slate-300 uppercase tracking-tight">{t("always_promote_to_queen") || "Auto Queen"}</span>
                            <Toggle value={settings.alwaysPromoteToQueen} onToggle={() => updateSettings({ alwaysPromoteToQueen: !settings.alwaysPromoteToQueen })} />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black text-slate-300 uppercase tracking-tight">{t("coordinates") || "Coordinates"}</span>
                            <Toggle value={settings.showCoordinates} onToggle={() => updateSettings({ showCoordinates: !settings.showCoordinates })} />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black text-slate-300 uppercase tracking-tight">{t("enable_premove") || "Pre-move"}</span>
                            <Toggle value={settings.enablePremove} onToggle={() => updateSettings({ enablePremove: !settings.enablePremove })} />
                        </div>
                    </div>
                </section>

                {/* Bot Difficulty — 4 levels matching BotEngine.ts */}
                <section className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 flex items-center gap-2 uppercase tracking-[0.2em] opacity-60">
                        <Cpu className="w-3 h-3" /> {t("bot_elo") || "Bot Difficulty"}
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                        {([
                            { elo: 400,  label: "Random",  sub: "~400 Elo",  emoji: "🎲" },
                            { elo: 750,  label: "Beginner", sub: "~600 Elo", emoji: "🐣" },
                            { elo: 1050, label: "Casual",  sub: "~900 Elo",  emoji: "🧩" },
                            { elo: 1500, label: "Strong",  sub: "~1200 Elo", emoji: "⚡" },
                        ] as const).map(({ elo, label, sub, emoji }) => (
                            <button
                                key={elo}
                                onClick={() => updateSettings({ botElo: elo })}
                                className={`flex flex-col items-center justify-center gap-1 py-4 px-2 rounded-2xl border transition-all ${
                                    settings.botElo === elo
                                        ? "bg-blue-500/15 border-blue-500 text-blue-400 shadow-lg shadow-blue-500/10"
                                        : "bg-white/[0.03] border-white/5 text-slate-400 hover:border-white/20 hover:text-slate-200"
                                }`}
                            >
                                <span className="text-2xl leading-none">{emoji}</span>
                                <span className="text-[11px] font-black uppercase tracking-wide leading-none mt-1">{label}</span>
                                <span className="text-[9px] font-bold opacity-50 leading-none">{sub}</span>
                            </button>
                        ))}
                    </div>
                </section>
            </div>
        </div>

        <footer className="mt-12 pt-6 border-t border-white/5 flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-500 opacity-50">
            <span>AntigravityChess Beta 1.3.1</span>
            <span>Local Processing (No Data Sent to Server)</span>
        </footer>
    </div>
  );
}
