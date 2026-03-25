"use client";

import { Timer, Shield, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface ChallengeConfigProps {
    timeControl: string;
    onTimeControlChange: (v: string) => void;
    colorPref: string;
    onColorPrefChange: (v: any) => void;
    myChallengeId: string | null;
    onCancelChallenge: () => void;
}

export default function ChallengeConfig({ 
    timeControl, onTimeControlChange, 
    colorPref, onColorPrefChange, 
    myChallengeId, onCancelChallenge 
}: ChallengeConfigProps) {
  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 md:p-8 rounded-[2.5rem] shadow-xl">
        <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1 flex flex-col gap-2 w-full">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Time Control</label>
                <div className="bg-black/40 border border-white/5 rounded-2xl px-5 h-14 flex items-center gap-3">
                   <Timer className="w-5 h-5 text-blue-400" />
                   <select 
                     value={timeControl}
                     onChange={e => onTimeControlChange(e.target.value)}
                     className="bg-transparent border-none text-sm font-black w-full focus:outline-none appearance-none cursor-pointer"
                   >
                      <option value="1">1 Minute (Bullet)</option>
                      <option value="3">3 Minutes (Blitz)</option>
                      <option value="10">10 Minutes (Rapid)</option>
                      <option value="Unlimited">Unlimited</option>
                   </select>
                </div>
            </div>

            <div className="flex-1 flex flex-col gap-2 w-full">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Color Pref</label>
                <div className="bg-black/40 border border-white/5 rounded-2xl px-5 h-14 flex items-center gap-3">
                   <Shield className={`w-5 h-5 ${colorPref === 'white' ? 'text-white' : colorPref === 'black' ? 'text-slate-600' : 'text-blue-400'}`} />
                   <select 
                     value={colorPref}
                     onChange={e => onColorPrefChange(e.target.value as any)}
                     className="bg-transparent border-none text-sm font-black w-full focus:outline-none appearance-none cursor-pointer"
                   >
                      <option value="random">Randomized</option>
                      <option value="white">White</option>
                      <option value="black">Black</option>
                   </select>
                </div>
            </div>
        </div>

        {myChallengeId && (
           <motion.div 
             initial={{ opacity: 0, scale: 0.95 }}
             animate={{ opacity: 1, scale: 1 }}
             className="mt-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between"
           >
              <div className="flex items-center gap-3">
                 <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                 <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Searching Match...</span>
              </div>
              <button onClick={onCancelChallenge} className="text-xs font-black text-slate-400 hover:text-white uppercase">Cancel</button>
           </motion.div>
        )}
    </div>
  );
}
