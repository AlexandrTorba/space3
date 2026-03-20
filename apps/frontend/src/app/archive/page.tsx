"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Zap, Download, Database, CheckSquare, Square } from "lucide-react";

import { useTranslation } from "@/i18n";

export default function Archive() {
  const { t } = useTranslation();
  const [matches, setMatches] = useState<{id: string, result: string, whiteName: string, blackName: string, pgn: string, reason: string, timeControl: string, createdAt: string}[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "https:" : "http:";
    const rawUrl = process.env.NEXT_PUBLIC_BACKEND_URL || (typeof window !== "undefined" ? window.location.hostname + ":8787" : "localhost:8787");
    let host = rawUrl;
    try {
      if (rawUrl.includes("://")) {
        host = new URL(rawUrl).host;
      }
    } catch (e) {}
    fetch(`${protocol}//${host}/api/archive`)
      .then(res => res.json())
      .then(data => {
         setMatches(Array.isArray(data) ? data : []);
         setLoading(false);
      })
      .catch((e) => {
         console.error(e);
         setLoading(false);
      });
  }, []);

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newSet = new Set(selected);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelected(newSet);
  };

  const toggleAll = () => {
    if (selected.size === matches.length) setSelected(new Set());
    else setSelected(new Set(matches.map(m => m.id)));
  };

  const downloadSelected = () => {
     if (selected.size === 0) return;
     const selectedMatches = matches.filter(m => selected.has(m.id));
     const combinedPgn = selectedMatches.map(m => m.pgn || "").join("\n\n");
     
     const blob = new Blob([combinedPgn], { type: "text/plain" });
     const url = URL.createObjectURL(blob);
     const a = document.createElement("a");
     a.href = url;
     a.download = `antigravity_archive_${selected.size}_matches.pgn`;
     a.click();
     URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#07090E] p-4 md:p-8 text-white flex flex-col relative overflow-hidden">
      <div className="absolute top-1/2 left-0 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none -translate-y-1/2 -translate-x-1/2" />
      
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 md:mb-12 max-w-5xl w-full mx-auto z-10 p-4 border border-white/5 bg-slate-900/50 backdrop-blur-md rounded-3xl">
         <div className="flex items-center gap-3">
             <Database className="w-8 h-8 text-indigo-400" />
             <div>
                 <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-300">{t("match_archive")}</h1>
                 <span className="text-xs font-mono text-gray-500 uppercase tracking-widest">{matches.length} {t("matches_found")}</span>
             </div>
         </div>

         <div className="flex items-center gap-3">
            <Link href="/" className="bg-slate-800 hover:bg-slate-700 px-5 py-2.5 rounded-full font-bold text-sm transition-colors">
               {t("play_match")}
            </Link>
            <button 
                onClick={downloadSelected} 
                disabled={selected.size === 0}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900/30 disabled:text-blue-500/30 px-5 py-2.5 rounded-full font-bold text-sm transition-all"
            >
               <Download className="w-4 h-4"/> 
               {t("download_select")} ({selected.size})
            </button>
         </div>
      </header>
      
      <div className="max-w-5xl w-full mx-auto flex flex-col gap-4 z-10">
        
        {matches.length > 0 && (
           <div className="flex items-center gap-2 px-6 py-2">
               <button onClick={toggleAll} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
                  {selected.size === matches.length ? <CheckSquare className="w-5 h-5 text-blue-400" /> : <Square className="w-5 h-5" />}
                  {t("select_all")}
               </button>
           </div>
        )}

        {loading ? (
             <div className="text-center text-slate-500 py-20 animate-pulse">{t("loading_archive")}</div>
        ) : matches.length === 0 ? (
          <div className="text-center text-slate-500 py-20 bg-slate-900/30 rounded-3xl border border-slate-800">
            {t("no_games")}
          </div>
        ) : matches.map(match => (
          <Link href={`/archive/${match.id}`} key={match.id} className="group relative bg-slate-900 border border-slate-700/50 rounded-2xl p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-blue-500/50 hover:bg-slate-800/80 transition-all cursor-pointer overflow-hidden">
             {/* Selection Checkbox */}
             <div 
                 onClick={(e) => toggleSelect(match.id, e)}
                 className="absolute left-0 top-0 bottom-0 w-16 flex items-center justify-center hover:bg-white/5 transition-colors z-20"
             >
                 {selected.has(match.id) ? (
                    <CheckSquare className="w-6 h-6 text-blue-500" />
                 ) : (
                    <Square className="w-6 h-6 text-slate-600 group-hover:text-slate-400" />
                 )}
             </div>

             <div className="flex flex-col gap-1 pl-12">
                 <span className="text-xs text-slate-500 font-mono">ID: {match.id} {match.timeControl ? `• ${match.timeControl}` : ''}</span>
                 <div className="flex flex-wrap items-center gap-3 mt-1">
                     <span className={`font-black text-xl ${match.result === '1/2-1/2' ? 'text-yellow-500' : 'text-emerald-400'}`}>
                         {match.result}
                     </span>
                     <span className="text-slate-300 font-bold text-sm tracking-wide">
                         {match.whiteName || t("color_white")} <span className="text-slate-600 font-normal px-1">vs</span> {match.blackName || t("color_black")}
                     </span>
                     <span className="bg-slate-800 border border-slate-700 px-3 py-1 rounded text-xs text-slate-400 uppercase tracking-widest font-bold ml-2">
                         {match.reason}
                     </span>
                 </div>
             </div>
             
             <div className="text-left md:text-right pl-12 md:pl-0">
                <div className="text-slate-400 font-mono text-sm">{new Date(match.createdAt).toLocaleString()}</div>
                <div className="text-blue-500/0 group-hover:text-blue-500 text-xs font-bold mt-1 transition-all">
                   {t("click_review")} →
                </div>
             </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
