"use client";

import React from "react";
import { Timer, Shield, X, Swords, Zap, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface MatchSetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: "standard" | "bughouse";
    timeControl: string;
    onTimeControlChange: (v: string) => void;
    colorPref: string;
    onColorPrefChange: (v: any) => void;
    onCreate: () => void;
    t: any;
}

export default function MatchSetupModal({
    isOpen, onClose, mode,
    timeControl, onTimeControlChange,
    colorPref, onColorPrefChange,
    onCreate, t
}: MatchSetupModalProps) {
    if (!isOpen) return null;

    const isBughouse = mode === "bughouse";

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-[#05060B]/80 backdrop-blur-xl"
                />

                {/* Modal */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    className="relative bg-[#0A0C14] border border-white/10 rounded-[3rem] w-full max-w-xl shadow-2xl overflow-hidden"
                >
                    <div className="px-8 py-10 md:px-12 md:py-12">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-10">
                            <div className="flex items-center gap-4">
                                <div className={`p-4 rounded-3xl ${isBughouse ? 'bg-indigo-500/10 text-indigo-400' : 'bg-blue-500/10 text-blue-400'}`}>
                                    {isBughouse ? <Zap className="w-8 h-8" /> : <Swords className="w-8 h-8" />}
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black uppercase tracking-tight">
                                        {isBughouse ? t("bughouse") : "Standard Match"}
                                    </h3>
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t("setup_teams") || "Match Configuration"}</p>
                                </div>
                            </div>
                            <button 
                                onClick={onClose}
                                className="p-3 hover:bg-white/5 rounded-2xl text-slate-500 hover:text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        {/* Settings Grid */}
                        <div className="flex flex-col gap-8 mb-12">
                            {/* Time Control */}
                            <div className="flex flex-col gap-4">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">
                                    Time Control
                                </label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {['1', '3', '10', 'Unlimited'].map(opt => (
                                        <button 
                                            key={opt}
                                            onClick={() => onTimeControlChange(opt)}
                                            className={`h-14 rounded-2xl border-2 font-black text-xs transition-all flex items-center justify-center gap-2 ${
                                                timeControl === opt 
                                                    ? 'bg-blue-500/20 border-blue-500 text-white' 
                                                    : 'bg-white/5 border-white/5 text-slate-500 hover:border-white/10'
                                            }`}
                                        >
                                            <Timer className="w-3.5 h-3.5" />
                                            {opt === 'Unlimited' ? '∞' : opt + 'm'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Color Selection (Only for Standard) */}
                            {!isBughouse && (
                                <div className="flex flex-col gap-4">
                                    <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">
                                        Color Preference
                                    </label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            { id: 'random', label: 'Random', icon: <Shield className="w-4 h-4 text-blue-400" /> },
                                            { id: 'white', label: 'White', icon: <Shield className="w-4 h-4 text-white" /> },
                                            { id: 'black', label: 'Black', icon: <Shield className="w-4 h-4 text-slate-600" /> }
                                        ].map(opt => (
                                            <button 
                                                key={opt.id}
                                                onClick={() => onColorPrefChange(opt.id)}
                                                className={`h-14 rounded-2xl border-2 font-black text-xs transition-all flex items-center justify-center gap-3 ${
                                                    colorPref === opt.id 
                                                        ? 'bg-blue-500/20 border-blue-500 text-white' 
                                                        : 'bg-white/5 border-white/5 text-slate-500 hover:border-white/10'
                                                }`}
                                            >
                                                {opt.icon}
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Action */}
                        <div className="flex flex-col gap-4">
                            <button 
                                onClick={onCreate}
                                className={`w-full h-16 rounded-[2rem] font-black uppercase tracking-[0.2em] text-xs transition-all shadow-xl active:scale-[0.98] flex items-center justify-center gap-3 ${
                                    isBughouse 
                                        ? 'bg-indigo-600 hover:bg-emerald-600 text-white shadow-indigo-600/20' 
                                        : 'bg-blue-600 hover:bg-emerald-600 text-white shadow-blue-600/20'
                                }`}
                            >
                                <Check className="w-5 h-5" />
                                {t("ready_to_play") || "Create Match"}
                            </button>
                            <p className="text-center text-[10px] font-bold text-slate-600 uppercase tracking-widest opacity-60">
                                Match will be created and listed in the lobby
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
