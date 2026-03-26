"use client";

import { Crown, Activity, MessageSquare, Info } from "lucide-react";

export default function HomeSidebar({ latency = "12" }: { latency?: string }) {
  return (
    <div className="flex flex-col gap-6">
        <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6">
            <div className="flex items-center justify-between mb-4">
               <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Top Players</h3>
               <Crown className="w-4 h-4 text-amber-500" />
            </div>
            <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3 opacity-50">
                     <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-xs font-black">{i}</div>
                     <div className="flex-1 h-2 bg-white/5 rounded-full" />
                  </div>
                ))}
            </div>
            <div className="mt-6 pt-6 border-t border-white/5 text-center">
                <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest italic">Global Ranking Locked</span>
            </div>
        </div>

        <div className="bg-gradient-to-br from-indigo-900/10 to-blue-900/10 border border-white/5 rounded-[2.5rem] p-6 relative overflow-hidden group">
            <div className="relative z-10">
               <div className="text-sm font-black flex items-center gap-2 mb-1">
                  <Activity className="w-4 h-4 text-blue-400" />
                  Edge Latency
               </div>
               <div className="text-2xl font-black text-blue-400">{latency}<span className="text-sm ml-1 opacity-50">ms</span></div>
               <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">System core is healthy and responding from the closest edge node.</p>
            </div>
            <div className="absolute top-[-20px] right-[-20px] w-24 h-24 bg-blue-500/10 blur-2xl group-hover:bg-blue-500/20 transition-all" />
        </div>

        <div className="mt-auto flex items-center justify-center gap-4 text-slate-700">
            <MessageSquare className="w-5 h-5 hover:text-slate-400 transition-colors cursor-pointer" />
            <Info className="w-5 h-5 hover:text-slate-400 transition-colors cursor-pointer" />
            <div className="h-4 w-px bg-white/5" />
            <span className="text-[9px] font-black uppercase tracking-[0.3em]">v2.4.0</span>
        </div>
    </div>
  );
}
