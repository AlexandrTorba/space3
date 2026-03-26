"use client";

import { useTranslation, Language, translations } from "@/i18n";
import { useSettings, boardThemes, BoardTheme } from "@/hooks/useSettings";
import { Settings, Palette, Globe, Eye, Sliders, User, Layers, Cpu } from "lucide-react";
import { motion } from "framer-motion";
import MagicSegmentedControl from "./MagicSegmentedControl";

export default function HomeSettingsView() {
  const { lang, changeLanguage, t } = useTranslation();
  const { settings, updateSettings } = useSettings();

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
            {/* Left Column */}
            <div className="space-y-8">
                {/* Profile Section */}
                <section className="space-y-4">
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

                {/* Language Section */}
                <section className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 flex items-center gap-2 uppercase tracking-[0.2em] opacity-60">
                        <Globe className="w-3 h-3" /> {t("language_section") || "Language"}
                    </label>
                    <MagicSegmentedControl 
                        value={lang} 
                        onChange={(id) => changeLanguage(id as any)} 
                        options={Object.keys(translations).map(l => ({ id: l, label: l.toUpperCase() }))}
                    />
                </section>

                {/* Appearance */}
                <section className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 flex items-center gap-2 uppercase tracking-[0.2em] opacity-60">
                        <Palette className="w-3 h-3" /> {t("appearance_section") || "Appearance"}
                    </label>
                    <MagicSegmentedControl
                        value={settings.uiMode}
                        onChange={(id) => updateSettings({ uiMode: id as any })}
                        options={[
                            { id: "dark", label: "Dark", icon: <Eye className="w-3 h-3" /> },
                            { id: "light", label: "Light", icon: <Layers className="w-3 h-3" /> }
                        ]}
                    />
                </section>
            </div>

            {/* Right Column */}
            <div className="space-y-8">
                {/* Board Themes */}
                <section className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 flex items-center gap-2 uppercase tracking-[0.2em] opacity-60">
                        <Palette className="w-3 h-3" /> {t("board_theme_section") || "Board Theme"}
                    </label>
                    <MagicSegmentedControl 
                        value={settings.boardTheme}
                        onChange={(id) => updateSettings({ boardTheme: id as any })}
                        options={(Object.keys(boardThemes) as BoardTheme[]).map(theme => ({
                            id: theme,
                            label: theme.toUpperCase(),
                            icon: (
                                <div className="flex flex-col w-3 h-3 rounded overflow-hidden rotate-45 border border-white/10">
                                    <div className="w-full h-full" style={{ backgroundColor: boardThemes[theme].light }} />
                                    <div className="w-full h-full" style={{ backgroundColor: boardThemes[theme].dark }} />
                                </div>
                            )
                        }))}
                    />
                </section>

                {/* Gameplay Settings */}
                <section className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 flex items-center gap-2 uppercase tracking-[0.2em] opacity-60">
                        <Sliders className="w-3 h-3" /> {t("gameplay_section") || "Gameplay"}
                    </label>
                    <div className="space-y-3 bg-white/[0.03] p-5 rounded-2xl border border-white/5 shadow-inner">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black text-slate-300 uppercase tracking-tight">{t("always_promote_to_queen") || "Auto Queen"}</span>
                            <button 
                                onClick={() => updateSettings({ alwaysPromoteToQueen: !settings.alwaysPromoteToQueen })}
                                className={`w-10 h-5 rotate-0 rounded-full transition-all relative ${settings.alwaysPromoteToQueen ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-slate-700'}`}
                            >
                                <motion.div animate={{ x: settings.alwaysPromoteToQueen ? 22 : 4 }} className="w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] shadow-sm" />
                            </button>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black text-slate-300 uppercase tracking-tight">{t("coordinates") || "Coordinates"}</span>
                            <button 
                                onClick={() => updateSettings({ showCoordinates: !settings.showCoordinates })}
                                className={`w-10 h-5 rotate-0 rounded-full transition-all relative ${settings.showCoordinates ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-slate-700'}`}
                            >
                                <motion.div animate={{ x: settings.showCoordinates ? 22 : 4 }} className="w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] shadow-sm" />
                            </button>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black text-slate-300 uppercase tracking-tight">{t("enable_premove") || "Pre-move"}</span>
                            <button 
                                onClick={() => updateSettings({ enablePremove: !settings.enablePremove })}
                                className={`w-10 h-5 rotate-0 rounded-full transition-all relative ${settings.enablePremove ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-slate-700'}`}
                            >
                                <motion.div animate={{ x: settings.enablePremove ? 22 : 4 }} className="w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] shadow-sm" />
                            </button>
                        </div>
                    </div>
                </section>

                {/* Engine Settings */}
                <section className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 flex items-center gap-2 uppercase tracking-[0.2em] opacity-60">
                        <Cpu className="w-3 h-3" /> {t("bot_elo") || "Bot Strength (ELO)"}
                    </label>
                    <div className="space-y-4">
                        <MagicSegmentedControl 
                            value={String(settings.botElo)}
                            onChange={(id) => updateSettings({ botElo: parseInt(id) })}
                            options={[
                                { id: "1200", label: "1200" },
                                { id: "1500", label: "1500" },
                                { id: "2000", label: "2000" },
                                { id: "2500", label: "2500" },
                                { id: "3200", label: "MAX" }
                            ]}
                        />
                        <div className="grid grid-cols-2 gap-4">
                           <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/5 shadow-inner">
                               <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">{t("engine_threads") || "Threads"}</div>
                               <input 
                                   type="number"
                                   min="1" max="128"
                                   value={settings.engineThreads}
                                   onChange={(e) => updateSettings({ engineThreads: parseInt(e.target.value) || 1 })}
                                   className="w-full bg-transparent text-lg font-black text-blue-400 focus:outline-none"
                               />
                           </div>
                           <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/5 shadow-inner">
                               <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">{t("engine_hash") || "Hash (MB)"}</div>
                               <input 
                                   type="number"
                                   min="16" max="4096" step="16"
                                   value={settings.engineHash}
                                   onChange={(e) => updateSettings({ engineHash: parseInt(e.target.value) || 16 })}
                                   className="w-full bg-transparent text-lg font-black text-blue-400 focus:outline-none"
                               />
                           </div>
                        </div>
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
