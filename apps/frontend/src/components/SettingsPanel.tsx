"use client";

import { useTranslation, Language, translations } from "../i18n";
import { useSettings, boardThemes, BoardTheme, PieceSet } from "../hooks/useSettings";
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
        className="fixed top-4 right-4 z-[60] p-3 rounded-full bg-[var(--surface-color)] border border-[var(--surface-border)] text-[var(--brand-primary)] hover:scale-110 active:scale-95 transition-all shadow-xl backdrop-blur-xl"
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
               transition={{ type: "spring", damping: 28, stiffness: 220 }}
               className="fixed right-0 top-0 bottom-0 w-80 sm:w-85 bg-[var(--settings-bg)] border-l border-[var(--surface-border)] z-[80] shadow-2xl overflow-y-auto"
            >
               <div className="p-5 h-full flex flex-col">
                 <header className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                       <div className="p-1.5 rounded-lg bg-[var(--button-bg)]">
                          <Settings className="w-3.5 h-3.5 text-[var(--brand-primary)]" />
                       </div>
                       <h2 className="text-lg font-black text-[var(--text-primary)] uppercase tracking-[0.1em] leading-none">{t("settings_title") || "Settings"}</h2>
                    </div>
                    <button onClick={toggleOpen} className="p-1.5 text-[var(--text-muted)] hover:text-[var(--brand-primary)] hover:bg-[var(--button-bg)] rounded-xl transition-all">
                       <X className="w-4 h-4" />
                    </button>
                 </header>

                 <div className="space-y-5 flex-1 overflow-y-auto pr-1">
                     {/* Language Section */}
                     <div className="space-y-3">
                        <label className="text-[10px] font-bold text-[var(--text-muted)] flex items-center gap-2 tracking-[0.15em] uppercase leading-relaxed">
                           <Globe className="w-2.5 h-2.5" /> {t("language_section") || "Language"}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                           {Object.keys(translations).map((l) => (
                              <button 
                                key={l}
                                onClick={() => changeLanguage(l as Language)}
                                className={`px-3 py-2 text-[12px] font-bold rounded-lg border transition-all ${
                                  lang === l ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white shadow-lg shadow-[var(--brand-primary)]/20' : 'bg-[var(--button-bg)] border-transparent text-[var(--text-secondary)] hover:bg-[var(--button-bg)]'
                                }`}
                              >
                                {l.toUpperCase()}
                              </button>
                           ))}
                        </div>
                     </div>

                     {/* Board Themes Section */}
                     <div className="space-y-3">
                        <label className="text-[10px] font-bold text-[var(--text-muted)] flex items-center gap-2 tracking-[0.15em] uppercase leading-relaxed">
                           <Palette className="w-2.5 h-2.5" /> {t("board_theme_section") || "Board Theme"}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                           {(Object.keys(boardThemes) as BoardTheme[]).map((theme) => (
                              <button 
                                key={theme}
                                onClick={() => updateSettings({ boardTheme: theme })}
                                className={`flex items-center gap-2 px-3 py-2 text-[12px] font-bold rounded-lg border transition-all ${
                                  settings.boardTheme === theme ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white shadow-lg shadow-[var(--brand-primary)]/20' : 'bg-[var(--button-bg)] border-transparent text-[var(--text-secondary)] hover:bg-[var(--button-bg)]'
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
                     <div className="space-y-3">
                        <label className="text-[10px] font-bold text-[var(--text-muted)] flex items-center gap-2 tracking-[0.15em] uppercase leading-relaxed">
                           <Layers className="w-2.5 h-2.5" /> {t("piece_set_section") || "Piece Set"}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                           {(['wikipedia', 'leipzig'] as PieceSet[]).map((set) => (
                              <button 
                                key={set}
                                onClick={() => updateSettings({ pieceSet: set })}
                                className={`px-3 py-2 text-[12px] font-bold rounded-lg border transition-all capitalize ${
                                  settings.pieceSet === set ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] text-white shadow-lg shadow-[var(--brand-primary)]/20' : 'bg-[var(--button-bg)] border-transparent text-[var(--text-secondary)] hover:bg-[var(--button-bg)]'
                                }`}
                              >
                                {set}
                              </button>
                           ))}
                        </div>
                     </div>

                      {/* Appearance Section */}
                     <div className="space-y-3">
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

                     <div className="pt-4 border-t border-[var(--surface-border)] space-y-3">
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

                         <div className="flex flex-col gap-2 pt-1">
                             <label className="text-[10px] font-bold text-[var(--text-secondary)] flex items-center gap-2 tracking-[0.1em] uppercase leading-relaxed">
                                 <Cpu className="w-3 h-3" /> {t("bot_elo") || "Bot Strength (ELO)"}
                             </label>
                             <div className="flex items-center gap-3">
                                 <input 
                                     type="range"
                                     min="800"
                                     max="2500"
                                     step="100"
                                     value={settings.botElo}
                                     onChange={(e) => updateSettings({ botElo: parseInt(e.target.value) })}
                                     className="flex-1 accent-[var(--brand-primary)] h-1 bg-[var(--button-bg)] rounded-lg appearance-none cursor-pointer"
                                 />
                                 <span className="text-[12px] font-mono font-black text-[var(--brand-primary)] w-8 text-right">{settings.botElo}</span>
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
    </>
  );
}
