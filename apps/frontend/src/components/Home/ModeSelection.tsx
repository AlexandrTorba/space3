"use client";

import { Swords, Zap, Users, Trophy, Activity } from "lucide-react";
import { motion } from "framer-motion";

interface ModeSelectionProps {
    isBughouse: boolean;
    myChallengeId: string | null;
    onCreateChallenge: (bughouse: boolean, vsBots?: boolean) => void;
    t: any;
}

export default function ModeSelection({ isBughouse, myChallengeId, onCreateChallenge, t }: ModeSelectionProps) {
  return (
    <div className="flex flex-col gap-4">
        <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Play Mode</h2>
        <div className="grid grid-cols-1 gap-4">
            <motion.button 
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onCreateChallenge(false)}
              className={`group relative h-40 rounded-3xl overflow-hidden border transition-all ${!isBughouse && myChallengeId ? 'border-blue-500 bg-blue-500/10' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}
            >
               <div className="absolute top-6 left-6 text-left">
                  <Zap className="w-8 h-8 text-blue-400 mb-2" />
                  <div className="text-lg font-black">{t("color_random")}</div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Standard Match</div>
               </div>
               <div className="absolute bottom-[-20px] right-[-20px] opacity-10 group-hover:opacity-20 transition-opacity">
                  <Swords className="w-40 h-40" />
               </div>
            </motion.button>

            <motion.button 
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onCreateChallenge(true)}
              className={`group relative h-40 rounded-3xl overflow-hidden border transition-all ${isBughouse && myChallengeId ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}
            >
               <div className="absolute top-6 left-6 text-left">
                  <Users className="w-8 h-8 text-indigo-400 mb-2" />
                  <div className="text-lg font-black">Bughouse</div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">2v2 Cooperative</div>
               </div>
               <div className="absolute bottom-[-20px] right-[-20px] opacity-10 group-hover:opacity-20 transition-opacity">
                  <Users className="w-40 h-40" />
               </div>
            </motion.button>

            <motion.button 
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onCreateChallenge(true, true)}
              className="group relative h-40 rounded-3xl overflow-hidden border border-white/5 bg-white/5 hover:bg-white/10"
            >
               <div className="absolute top-6 left-6 text-left">
                  <Activity className="w-8 h-8 text-emerald-400 mb-2" />
                  <div className="text-lg font-black">Practice VS AI</div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase">Solo Training</div>
               </div>
               <div className="absolute bottom-[-20px] right-[-20px] opacity-10 group-hover:opacity-20 transition-opacity">
                  <Activity className="w-40 h-40" />
               </div>
            </motion.button>
        </div>
    </div>
  );
}
