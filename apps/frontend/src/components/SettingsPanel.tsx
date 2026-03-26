"use client";

import { useTranslation, Language, translations } from "../i18n";
import { useSettings, boardThemes, BoardTheme, PieceSet, UiMode } from "../hooks/useSettings";
import { useSettingsContext } from "../providers/SettingsProvider";
import { Settings, X, Palette, Globe, Layers, Eye, Cpu, Sliders, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export default function SettingsPanel() {
  const [isAdvancedStockfishOpen, setIsAdvancedStockfishOpen] = useState(false);
  const { lang, changeLanguage, t } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const { isPanelOpen, setIsPanelOpen } = useSettingsContext();

  const toggleOpen = () => setIsPanelOpen(!isPanelOpen);

  return (
    <>
      <AnimatePresence>
        {isPanelOpen && (
          <>
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               onClick={() => setIsPanelOpen(false)}
               className="fixed inset-0 bg-black/60 backdrop-blur-md z-[70]"
            />
            <motion.div 
               initial={{ x: "100%" }} 
               animate={{ x: 0 }} 
               exit={{ x: "100%" }}
               transition={{ type: "spring", damping: 30, stiffness: 200 }}
               className="fixed right-0 top-0 bottom-0 w-85 bg-[#0A0D14]/95 border-l border-white/5 z-[80] shadow-2xl overflow-y-auto backdrop-blur-2xl"
            >
               <div className="p-8 h-full flex flex-col">
                 <header className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                       <div className="p-2 rounded-xl bg-blue-600/10 text-blue-400">
                          <Settings className="w-5 h-5" />
                       </div>
                       <h2 className="text-xl font-black text-white uppercase tracking-widest leading-none">{t("settings_title") || "Settings"}</h2>
                    </div>
                    <button onClick={() => setIsPanelOpen(false)} className="p-2 text-slate-500 hover:text-white hover:bg-white/5 rounded-full transition-all">
                       <X className="w-6 h-6" />
                    </button>
                 </header>

                 <div className="space-y-6 flex-1 pr-1">
                     {/* Profile Section */}
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold text-[var(--text-muted)] flex items-center gap-2 tracking-[0.15em] uppercase leading-relaxed">
                           <User className="w-2.5 h-2.5" /> {t("profile_section" as any) || "Profile"}
                        </label>
                        <div className="flex gap-1.5 p-1 bg-[var(--button-bg)] rounded-xl border border-[var(--surface-border)]">
                           <input 
                             type="text"
                             value={settings.playerName}
                             onChange={(e) => updateSettings({ playerName: e.target.value })}
                             placeholder="Your Name"
                             className="w-full bg-transparent px-3 py-2 text-sm font-bold text-white focus:outline-none placeholder:text-white/20"
                             maxLength={20}
                           />
                        </div>
                     </div>

                     {/* Language Section */}
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold text-[var(--text-muted)] flex items-center gap-2 tracking-[0.15em] uppercase leading-relaxed">
                           <Globe className="w-2.5 h-2.5" /> {t("language_section") || "Language"}
                        </label>
                        <div className="flex gap-1.5 p-1 bg-[var(--button-bg)] rounded-xl border border-[var(--surface-border)]">
                           {Object.keys(translations).map((l) => (
                              <button 
                                key={l}
                                onClick={() => changeLanguage(l as Language)}
                                className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${
                                  lang === l 
                                    ? 'bg-[var(--brand-primary)] text-white shadow-md' 
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                }`}
                              >
                                {l.toUpperCase()}
                              </button>
                           ))}
                        </div>
                     </div>

                     {/* Board Themes Section */}
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold text-[var(--text-muted)] flex items-center gap-2 tracking-[0.15em] uppercase leading-relaxed">
                           <Palette className="w-2.5 h-2.5" /> {t("board_theme_section") || "Board Theme"}
                        </label>
                        <div className="flex gap-1.5 p-1 bg-[var(--button-bg)] rounded-xl border border-[var(--surface-border)]">
                           {(Object.keys(boardThemes) as BoardTheme[]).map((theme) => (
                              <button 
                                key={theme}
                                onClick={() => updateSettings({ boardTheme: theme })}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 text-[11px] font-bold rounded-lg transition-all ${
                                  settings.boardTheme === theme 
                                    ? 'bg-[var(--brand-primary)] text-white shadow-md' 
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                }`}
                              >
                                <div className="flex flex-col w-3 h-3 rounded-sm overflow-hidden rotate-45 flex-shrink-0">
                                   <div className="w-full h-full" style={{ backgroundColor: boardThemes[theme].light }} />
                                   <div className="w-full h-full" style={{ backgroundColor: boardThemes[theme].dark }} />
                                 </div>
                                <span className="capitalize">{theme}</span>
                              </button>
                           ))}
                        </div>
                     </div>

                     {/* Piece Sets Section */}
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold text-[var(--text-muted)] flex items-center gap-2 tracking-[0.15em] uppercase leading-relaxed">
                           <Layers className="w-2.5 h-2.5" /> {t("piece_set_section") || "Piece Set"}
                        </label>
                        <div className="flex gap-1.5 p-1 bg-[var(--button-bg)] rounded-xl border border-[var(--surface-border)]">
                           {(['wikipedia', 'leipzig'] as PieceSet[]).map((set) => (
                              <button 
                                key={set}
                                onClick={() => updateSettings({ pieceSet: set })}
                                className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all capitalize ${
                                  settings.pieceSet === set 
                                    ? 'bg-[var(--brand-primary)] text-white shadow-md' 
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                                }`}
                              >
                                {set}
                              </button>
                           ))}
                        </div>
                     </div>

                      {/* Appearance Section */}
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold text-[var(--text-muted)] flex items-center gap-2 tracking-[0.15em] uppercase leading-relaxed">
                           <Palette className="w-2.5 h-2.5" /> {t("background_section") || "Appearance"}
                        </label>
                        <div className="flex bg-[var(--button-bg)] p-1 rounded-xl border border-[var(--surface-border)]">
                           <button 
                             onClick={() => updateSettings({ uiMode: "dark" })}
                             className={`flex-1 flex items-center justify-center gap-2 py-2 text-[12px] font-bold rounded-lg transition-all ${
                               settings.uiMode === "dark" 
                                 ? 'bg-[var(--brand-primary)] text-white shadow-md' 
                                 : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                             }`}
                           >
                             ⚫ {t("theme_dark")}
                           </button>
                           <button 
                             onClick={() => updateSettings({ uiMode: "light" })}
                             className={`flex-1 flex items-center justify-center gap-2 py-2 text-[12px] font-bold rounded-lg transition-all ${
                               settings.uiMode === "light" 
                                 ? 'bg-[var(--bg-color)] text-[var(--text-primary)] shadow-sm' 
                                 : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                             }`}
                           >
                             ⚪ {t("theme_light")}
                           </button>
                        </div>
                     </div>

                     <div className="pt-3 border-t border-[var(--surface-border)] space-y-2">
                         <div className="flex items-center justify-between">
                             <span className="text-[10px] font-bold text-[var(--text-secondary)] flex items-center gap-2 tracking-[0.1em] uppercase leading-relaxed">
                                 <Layers className="w-3 h-3" /> {t("always_promote_to_queen") || "Auto Queen"}
                             </span>
                             <button 
                               onClick={() => updateSettings({ alwaysPromoteToQueen: !settings.alwaysPromoteToQueen })}
                               className={`w-9 h-5 rounded-full transition-colors relative ${settings.alwaysPromoteToQueen ? 'bg-emerald-500' : 'bg-[var(--button-bg)]'}`}
                             >
                                 <motion.div animate={{ x: settings.alwaysPromoteToQueen ? 18 : 3 }} className="w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] shadow-sm" />
                             </button>
                         </div>

                         <div className="flex items-center justify-between">
                             <span className="text-[10px] font-bold text-[var(--text-secondary)] flex items-center gap-2 tracking-[0.1em] uppercase leading-relaxed">
                                 <Eye className="w-3 h-3" /> {t("coordinates") || "Coordinates"}
                             </span>
                             <button 
                               onClick={() => updateSettings({ showCoordinates: !settings.showCoordinates })}
                               className={`w-9 h-5 rounded-full transition-colors relative ${settings.showCoordinates ? 'bg-emerald-500' : 'bg-[var(--button-bg)]'}`}
                             >
                                 <motion.div animate={{ x: settings.showCoordinates ? 18 : 3 }} className="w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] shadow-sm" />
                             </button>
                         </div>
                         
                         <div className="flex items-center justify-between">
                             <span className="text-[10px] font-bold text-[var(--text-secondary)] flex items-center gap-2 tracking-[0.1em] uppercase leading-relaxed">
                                 <Layers className="w-3 h-3" /> {t("enable_premove") || "Pre-move"}
                             </span>
                             <button 
                               onClick={() => updateSettings({ enablePremove: !settings.enablePremove })}
                               className={`w-9 h-5 rounded-full transition-colors relative ${settings.enablePremove ? 'bg-emerald-500' : 'bg-[var(--button-bg)]'}`}
                             >
                                 <motion.div animate={{ x: settings.enablePremove ? 18 : 3 }} className="w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] shadow-sm" />
                             </button>
                         </div>

                         <div className="flex items-center justify-between pt-1">
                             <div className="flex items-center gap-3">
                                 <select 
                                     value={settings.botElo}
                                     onChange={(e) => updateSettings({ botElo: parseInt(e.target.value) })}
                                     className="bg-[var(--button-bg)] border border-[var(--surface-border)] rounded-lg py-1 px-2 text-[12px] font-black text-[var(--brand-primary)] focus:outline-none focus:border-[var(--brand-primary)] cursor-pointer"
                                 >
                                     {Array.from({ length: 11 }, (_, i) => 1500 + i * 100).map(elo => (
                                         <option key={elo} value={elo} className="bg-[var(--settings-bg)]">{elo}</option>
                                     ))}
                                 </select>
                                 <div className="flex items-center gap-2 group/advanced">
                                     <button 
                                        onClick={() => setIsAdvancedStockfishOpen(true)}
                                        className="p-1.5 rounded-md bg-[var(--button-bg)] border border-[var(--surface-border)] text-[var(--text-muted)] hover:text-[var(--brand-primary)] hover:border-[var(--brand-primary)]/50 transition-all active:scale-95"
                                        title={t("advanced_settings" as any)}
                                     >
                                         <Sliders className="w-3 h-3" />
                                     </button>
                                     <label className="text-[10px] font-bold text-[var(--text-secondary)] flex items-center gap-2 tracking-[0.1em] uppercase leading-relaxed">
                                         <Cpu className="w-3 h-3" /> {t("bot_elo" as any) || "Bot Strength (ELO)"}
                                     </label>
                                 </div>
                             </div>
                         </div>
                     </div>
                 </div>

                 <div className="mt-auto pt-6 border-t border-[var(--surface-border)] text-center flex flex-col gap-2 opacity-60">
                     <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">AntigravityChess Beta 1.3.1</p>
                     <p className="text-[8px] text-[var(--text-muted)] font-bold uppercase tracking-[0.2em] leading-relaxed">Powered by Stockfish & Chess.js</p>
                 </div>
               </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {isAdvancedStockfishOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsAdvancedStockfishOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[90]"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="fixed inset-0 m-auto w-[90%] sm:w-[350px] h-fit bg-[var(--settings-bg)] border border-[var(--surface-border)] rounded-3xl p-6 z-[100] shadow-2xl"
            >
              <header className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-[var(--text-primary)]">
                    {t("engine_settings_title" as any)}
                  </h3>
                </div>
                <button 
                  onClick={() => setIsAdvancedStockfishOpen(false)}
                  className="p-1.5 text-[var(--text-muted)] hover:text-[var(--brand-primary)] hover:bg-[var(--button-bg)] rounded-xl transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </header>

              <div className="space-y-6">
                {/* Threads */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                      {t("engine_threads" as any)}
                    </label>
                    <span className="text-xs font-mono font-black text-[var(--brand-primary)] bg-[var(--brand-primary)]/10 px-2 py-0.5 rounded-md">
                      {settings.engineThreads}
                    </span>
                  </div>
                  <input 
                    type="range"
                    min="1"
                    max="16"
                    step="1"
                    value={settings.engineThreads}
                    onChange={(e) => updateSettings({ engineThreads: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-[var(--button-bg)] rounded-full appearance-none cursor-pointer accent-[var(--brand-primary)]"
                  />
                </div>

                {/* Hash */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                      {t("engine_hash" as any)}
                    </label>
                    <span className="text-xs font-mono font-black text-[var(--brand-primary)] bg-[var(--brand-primary)]/10 px-2 py-0.5 rounded-md">
                      {settings.engineHash} MB
                    </span>
                  </div>
                  <input 
                    type="range"
                    min="16"
                    max="1024"
                    step="16"
                    value={settings.engineHash}
                    onChange={(e) => updateSettings({ engineHash: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-[var(--button-bg)] rounded-full appearance-none cursor-pointer accent-[var(--brand-primary)]"
                  />
                </div>

                {/* MultiPV */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                      {t("engine_multipv" as any)}
                    </label>
                    <span className="text-xs font-mono font-black text-[var(--brand-primary)] bg-[var(--brand-primary)]/10 px-2 py-0.5 rounded-md">
                      {settings.engineMultiPV}
                    </span>
                  </div>
                  <input 
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={settings.engineMultiPV}
                    onChange={(e) => updateSettings({ engineMultiPV: parseInt(e.target.value) })}
                    className="w-full h-1.5 bg-[var(--button-bg)] rounded-full appearance-none cursor-pointer accent-[var(--brand-primary)]"
                  />
                </div>

                <button 
                  onClick={() => setIsAdvancedStockfishOpen(false)}
                  className="w-full py-3 bg-[var(--brand-primary)] text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-[var(--brand-primary)]/20 hover:scale-[1.02] active:scale-[0.98] transition-all mt-4"
                >
                  {t("save_settings" as any)}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
