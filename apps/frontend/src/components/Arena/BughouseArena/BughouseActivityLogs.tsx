import React from "react";
import { RotateCcw } from "lucide-react";

interface BughouseActivityLogsProps {
  logs: string[];
  chatInput: string;
  setChatInput: (val: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
}

export const BughouseActivityLogs: React.FC<BughouseActivityLogsProps> = ({
  logs, chatInput, setChatInput, handleSubmit
}) => {
  return (
    <div className="flex flex-col bg-black/40 border border-white/5 rounded-3xl overflow-hidden h-[240px] shadow-2xl backdrop-blur-xl w-full">
        <div className="px-6 py-3 border-b border-white/5 bg-white/5 flex items-center justify-between">
           <div className="flex items-center gap-2 uppercase tracking-[0.2em] text-[10px] font-black text-slate-500">
              <RotateCcw className="w-4 h-4 text-blue-500"/> Activity Logs
           </div>
        </div>
        <div className="flex-1 p-6 overflow-y-auto font-mono text-xs text-slate-400 space-y-2 custom-scrollbar">
           {logs.map((l, i) => <div key={i} className="border-l-2 border-white/5 pl-3">{l}</div>)}
        </div>
        <form onSubmit={handleSubmit} className="p-4 bg-white/5 border-t border-white/5 flex gap-3">
           <input 
              type="text" 
              value={chatInput} 
              onChange={(e) => setChatInput(e.target.value)} 
              placeholder="Type to chat..." 
              className="flex-1 bg-black/30 border border-white/10 rounded-xl px-6 py-3 text-sm text-white outline-none focus:border-blue-500/50 transition-all font-mono" 
           />
        </form>
    </div>
  );
};
