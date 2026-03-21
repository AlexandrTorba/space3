"use client";

import { useTranslation, Language, translations } from "../i18n";
import { useSettings, boardThemes, BoardTheme, PieceSet, UiMode } from "../hooks/useSettings";
import { Settings, X, Palette, Globe, Layers, Eye, Cpu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";

export default function SettingsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const { lang, changeLanguage, t } = useTranslation();
  const { settings, updateSettings } = useSettings();

  const toggleOpen = () => setIsOpen(!isOpen);

  return (
    <>
      <button 
        onClick={toggleOpen}
        className="fixed top-4 right-4 z-[60] p-2.5 rounded-full bg-[var(--surface-color)] border border-[var(--surface-border)] text-blue-400 hover:scale-110 active:scale-95 transition-all shadow-lg backdrop-blur-xl"
        title="Settings"
      >
        <Settings className="w-5 h-5" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               onClick={toggleOpen}
               className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70]"
            />
            <motion.div 
               initial={{ x: "100%" }} 
               animate={{ x: 0 }} 
               exit={{ x: "100%" }}
               transition={{ type: "spring", damping: 25, stiffness: 200 }}
               className="fixed right-0 top-0 bottom-0 w-80 sm:w-80 bg-[var(--settings-bg)] border-l border-[var(--surface-border)] z-[80] shadow-2xl overflow-y-auto"
            >
               <div className="p-5 h-full flex flex-col">
                 <header className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                       <Settings className="w-4 h-4 text-blue-400" />
                       <h2 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-wider">{t("settings_title") || "Settings"}</h2>
                    </div>
                    <button onClick={toggleOpen} className="p-1.5 text-[var(--text-muted)] hover:text-blue-400 rounded-full transition-colors">
                       <X className="w-5 h-5" />
                    </button>
                 </header>

                 <div className="space-y-6 flex-1 overflow-y-auto">
                     {/* Language Section */}
                     <div className="space-y-3">
                        <label className="text-[10px] font-black text-[var(--text-muted)] flex items-center gap-2 tracking-widest uppercase">
                           <Globe className="w-3 h-3" /> {t("language_section") || "Language"}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                           {Object.keys(translations).map((l) => (
                              <button 
                                key={l}
                                onClick={() => changeLanguage(l as Language)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                                  lang === l ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-[var(--button-bg)] border-transparent text-[var(--text-secondary)] hover:bg-[var(--button-bg)] hover:scale-[1.02]'
                                }`}
                              >
                                {l.toUpperCase()}
                              </button>
                           ))}
                        </div>
                     </div>

                     {/* Board Themes Section */}
                     <div className="space-y-3">
                        <label className="text-[10px] font-black text-[var(--text-muted)] flex items-center gap-2 tracking-widest uppercase">
                           <Palette className="w-3 h-3" /> {t("board_theme_section") || "Board Theme"}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                           {(Object.keys(boardThemes) as BoardTheme[]).map((theme) => (
                              <button 
                                key={theme}
                                onClick={() => updateSettings({ boardTheme: theme })}
                                className={`flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                                  settings.boardTheme === theme ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-[var(--button-bg)] border-transparent text-[var(--text-secondary)] hover:bg-[var(--button-bg)]'
                                }`}
                              >
                                <div className="flex flex-col w-4 h-4 rounded overflow-hidden rotate-45 flex-shrink-0">
                                   <div className="w-full h-full" style={{ backgroundColor: boardThemes[theme].light }} />
                                   <div className="w-full h-full" style={{ backgroundColor: boardThemes[theme].dark }} />
                                </div>
                                <span className="capitalize">{theme}</span>
                              </button>
                           ))}
                        </div>
                     </div>

                     {/* Piece Sets Section */}
                     <div className="space-y-3">
                        <label className="text-[10px] font-black text-[var(--text-muted)] flex items-center gap-2 tracking-widest uppercase">
                           <Layers className="w-3 h-3" /> {t("piece_set_section") || "Piece Set"}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                           {(['wikipedia', 'leipzig'] as PieceSet[]).map((set) => (
                              <button 
                                key={set}
                                onClick={() => updateSettings({ pieceSet: set })}
                                className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all capitalize ${
                                  settings.pieceSet === set ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-[var(--button-bg)] border-transparent text-[var(--text-secondary)] hover:bg-[var(--button-bg)]'
                                }`}
                              >
                                {set}
                              </button>
                           ))}
                        </div>
                     </div>

                      {/* Appearance Section */}
                     <div className="space-y-3">
                        <label className="text-[10px] font-black text-[var(--text-muted)] flex items-center gap-2 tracking-widest uppercase">
                           <Palette className="w-3 h-3" /> {t("background_section") || "Appearance"}
                        </label>
                        <div className="flex bg-[var(--button-bg)] p-1 rounded-xl border border-[var(--surface-border)] shadow-inner">
                           <button 
                             onClick={() => updateSettings({ uiMode: "dark" })}
                             className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                               settings.uiMode === "dark" 
                                 ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                                 : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                             }`}
                           >
                             ⚫ {t("theme_dark")}
                           </button>
                           <button 
                             onClick={() => updateSettings({ uiMode: "light" })}
                             className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                               settings.uiMode === "light" 
                                 ? 'bg-white text-slate-900 shadow-md' 
                                 : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                             }`}
                           >
                             ⚪ {t("theme_light")}
                           </button>
                        </div>
                     </div>

                     <div className="pt-4 border-t border-[var(--surface-border)] space-y-3">
                         <div className="flex items-center justify-between">
                             <span className="text-xs font-bold text-[var(--text-secondary)] flex items-center gap-2 tracking-wide uppercase">
                                 <Eye className="w-3 h-3 text-[var(--text-muted)]" /> {t("coordinates") || "Coordinates"}
                             </span>
                             <button 
                               onClick={() => updateSettings({ showCoordinates: !settings.showCoordinates })}
                               className={`w-10 h-5 rounded-full transition-colors relative ${settings.showCoordinates ? 'bg-emerald-600' : 'bg-slate-700'}`}
                             >
                                 <motion.div animate={{ x: settings.showCoordinates ? 22 : 3 }} className="w-3.5 h-3.5 bg-white rounded-full absolute top-0.5" />
                             </button>
                         </div>
                         
                         <div className="flex items-center justify-between">
                             <span className="text-xs font-bold text-[var(--text-secondary)] flex items-center gap-2 tracking-wide uppercase">
                                 <Layers className="w-3 h-3 text-[var(--text-muted)]" /> {t("enable_premove") || "Pre-move"}
                             </span>
                             <button 
                               onClick={() => updateSettings({ enablePremove: !settings.enablePremove })}
                               className={`w-10 h-5 rounded-full transition-colors relative ${settings.enablePremove ? 'bg-emerald-600' : 'bg-slate-700'}`}
                             >
                                 <motion.div animate={{ x: settings.enablePremove ? 22 : 3 }} className="w-3.5 h-3.5 bg-white rounded-full absolute top-0.5" />
                             </button>
                         </div>

                         <div className="flex flex-col gap-2 pt-2">
                             <label className="text-xs font-bold text-[var(--text-secondary)] flex items-center gap-2 tracking-wide uppercase">
                                 <Cpu className="w-3 h-3 text-[var(--text-muted)]" /> {t("bot_elo") || "Bot Strength (ELO)"}
                             </label>
                             <div className="flex items-center gap-3">
                                 <input 
                                     type="range"
                                     min="800"
                                     max="2500"
                                     step="100"
                                     value={settings.botElo}
                                     onChange={(e) => updateSettings({ botElo: parseInt(e.target.value) })}
                                     className="flex-1 accent-blue-500 h-1.5 bg-[var(--button-bg)] rounded-lg appearance-none cursor-pointer"
                                 />
                                 <span className="text-xs font-mono font-black text-blue-400 w-10 text-right">{settings.botElo}</span>
                             </div>
                         </div>
                     </div>
                 </div>

                 <div className="mt-8 pt-4 border-t border-[var(--surface-border)] text-center flex flex-col gap-1">
                     <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest">AntigravityChess Beta 1.3.1</p>
                     <p className="text-[8px] text-[var(--text-muted)] font-bold uppercase tracking-[0.2em] opacity-80">Powered by Stockfish (GPLv3) & Chess.js (MIT)</p>
                 </div>
               </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
