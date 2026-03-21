"use client";

import { useTranslation, Language, translations } from "../i18n";
import { useSettings, boardThemes, BoardTheme, PieceSet, BackgroundTheme } from "../hooks/useSettings";
import { Settings, X, Palette, Globe, Layers, Eye } from "lucide-react";
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
        className="fixed top-8 right-8 z-[60] p-3 rounded-full bg-slate-900/80 border border-white/10 text-blue-400 hover:text-white hover:scale-110 active:scale-95 transition-all shadow-2xl backdrop-blur-xl"
        title="Settings"
      >
        <Settings className="w-6 h-6" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               onClick={toggleOpen}
               className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]"
            />
            <motion.div 
               initial={{ x: "100%" }} 
               animate={{ x: 0 }} 
               exit={{ x: "100%" }}
               transition={{ type: "spring", damping: 25, stiffness: 200 }}
               className="fixed right-0 top-0 bottom-0 w-80 sm:w-96 bg-[#0f172a] border-l border-white/10 z-[80] shadow-2xl overflow-y-auto"
            >
              <div className="p-6 h-full flex flex-col">
                <header className="flex items-center justify-between mb-8">
                   <div className="flex items-center gap-2">
                      <Settings className="w-5 h-5 text-blue-400" />
                      <h2 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 text-white uppercase tracking-wider uppercase">{t("settings_title") || "Settings"}</h2>
                   </div>
                   <button onClick={toggleOpen} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-colors">
                      <X className="w-6 h-6" />
                   </button>
                </header>

                <div className="space-y-8 flex-1 overflow-y-auto">
                    {/* Language Section */}
                    <div className="space-y-4">
                       <label className="text-xs font-black text-slate-500 flex items-center gap-2 tracking-widest uppercase">
                          <Globe className="w-3.5 h-3.5" /> {t("language_section") || "Language"}
                       </label>
                       <div className="grid grid-cols-2 gap-2">
                          {Object.keys(translations).map((l) => (
                             <button 
                               key={l}
                               onClick={() => changeLanguage(l as Language)}
                               className={`px-4 py-2 text-sm font-bold rounded-xl border transition-all ${
                                 lang === l ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                               }`}
                             >
                               {l.toUpperCase()}
                             </button>
                          ))}
                       </div>
                    </div>

                    {/* Board Themes Section */}
                    <div className="space-y-4">
                       <label className="text-xs font-black text-slate-500 flex items-center gap-2 tracking-widest uppercase">
                          <Palette className="w-3.5 h-3.5" /> {t("board_theme_section") || "Board Theme"}
                       </label>
                       <div className="grid grid-cols-2 gap-2">
                          {(Object.keys(boardThemes) as BoardTheme[]).map((theme) => (
                             <button 
                               key={theme}
                               onClick={() => updateSettings({ boardTheme: theme })}
                               className={`flex items-center gap-3 px-3 py-2 text-sm font-bold rounded-xl border transition-all ${
                                 settings.boardTheme === theme ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                               }`}
                             >
                               <div className="flex flex-col w-5 h-5 rounded overflow-hidden rotate-45 flex-shrink-0">
                                  <div className="w-full h-full" style={{ backgroundColor: boardThemes[theme].light }} />
                                  <div className="w-full h-full" style={{ backgroundColor: boardThemes[theme].dark }} />
                               </div>
                               <span className="capitalize">{theme}</span>
                             </button>
                          ))}
                       </div>
                    </div>

                    {/* Piece Sets Section */}
                    <div className="space-y-4">
                       <label className="text-xs font-black text-slate-500 flex items-center gap-2 tracking-widest uppercase">
                          <Layers className="w-3.5 h-3.5" /> {t("piece_set_section") || "Piece Set"}
                       </label>
                       <div className="grid grid-cols-2 gap-2">
                          {(['wikipedia', 'alpha', 'neo', 'dublin', 'leipzig'] as PieceSet[]).map((set) => (
                             <button 
                               key={set}
                               onClick={() => updateSettings({ pieceSet: set })}
                               className={`px-4 py-2 text-sm font-bold rounded-xl border transition-all capitalize ${
                                 settings.pieceSet === set ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                               }`}
                             >
                               {set}
                             </button>
                          ))}
                       </div>
                    </div>

                    {/* Background Selection Section */}
                    <div className="space-y-4">
                       <label className="text-xs font-black text-slate-500 flex items-center gap-2 tracking-widest uppercase">
                          <Palette className="w-3.5 h-3.5" /> {t("background_section") || "Background"}
                       </label>
                       <div className="grid grid-cols-2 gap-2">
                          {(['cosmos', 'abyss', 'minimal', 'forest'] as BackgroundTheme[]).map((bg) => (
                             <button 
                               key={bg}
                               onClick={() => updateSettings({ backgroundTheme: bg })}
                               className={`px-4 py-2 text-sm font-bold rounded-xl border transition-all capitalize ${
                                 settings.backgroundTheme === bg ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                               }`}
                             >
                               {bg}
                             </button>
                          ))}
                       </div>
                    </div>

                    <div className="pt-4 border-t border-white/10 space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-300">Show Coordinates</span>
                            <button 
                              onClick={() => updateSettings({ showCoordinates: !settings.showCoordinates })}
                              className={`w-12 h-6 rounded-full transition-colors relative ${settings.showCoordinates ? 'bg-emerald-600' : 'bg-slate-700'}`}
                            >
                                <motion.div animate={{ x: settings.showCoordinates ? 26 : 4 }} className="w-4 h-4 bg-white rounded-full absolute top-1" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-white/10 text-center">
                    <p className="text-[10px] uppercase font-black tracking-widest text-slate-600">AntigravityChess Beta 1.2</p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
