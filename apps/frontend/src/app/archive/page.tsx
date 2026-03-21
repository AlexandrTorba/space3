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
    <div className="min-h-screen p-4 md:p-8 flex flex-col relative overflow-hidden bg-transparent">
      {/* Dynamic Background elements now handled by AppBackground in layout */}
      
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 md:mb-12 max-w-5xl w-full mx-auto z-10 p-4 border border-[var(--surface-border)] bg-[var(--surface-glass)] backdrop-blur-md rounded-3xl shadow-xl">
         <div className="flex items-center gap-3">
             <Database className="w-8 h-8 text-[var(--brand-primary)]" />
             <div>
                 <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-[var(--text-primary)] to-[var(--brand-primary)] uppercase tracking-tight">{t("match_archive")}</h1>
                 <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-widest font-black opacity-60">{matches.length} {t("matches_found")}</span>
             </div>
         </div>

         <div className="flex items-center gap-3">
            <Link href="/" className="bg-[var(--button-bg)] hover:bg-[var(--surface-border)] text-[var(--text-primary)] px-6 py-2.5 rounded-full font-bold text-sm transition-all shadow-sm border border-[var(--surface-border)]">
               {t("play_match")}
            </Link>
            <button 
                onClick={downloadSelected} 
                disabled={selected.size === 0}
                className="flex items-center gap-2 bg-[var(--brand-primary)] hover:opacity-90 disabled:opacity-30 text-white px-6 py-2.5 rounded-full font-bold text-sm transition-all shadow-lg"
            >
               <Download className="w-4 h-4"/> 
               {t("download_select")} ({selected.size})
            </button>
         </div>
      </header>
      
      <div className="max-w-5xl w-full mx-auto flex flex-col gap-4 z-10">
        
        {matches.length > 0 && (
           <div className="flex items-center gap-2 px-6 py-2">
               <button onClick={toggleAll} className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
                  {selected.size === matches.length ? <CheckSquare className="w-5 h-5 text-[var(--brand-primary)]" /> : <Square className="w-5 h-5" />}
                  {t("select_all")}
               </button>
           </div>
        )}

        {loading ? (
             <div className="text-center text-[var(--text-muted)] py-20 font-bold uppercase tracking-widest animate-pulse">{t("loading_archive")}</div>
        ) : matches.length === 0 ? (
          <div className="text-center text-[var(--text-muted)] py-20 bg-[var(--surface-glass)] rounded-3xl border border-[var(--surface-border)] font-bold uppercase tracking-widest">
            {t("no_games")}
          </div>
        ) : matches.map(match => (
          <Link href={`/archive/${match.id}`} key={match.id} className="group relative bg-[var(--surface-glass)] border border-[var(--surface-border)] rounded-2xl p-4 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-[var(--brand-primary)]/50 transition-all cursor-pointer overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1">
             {/* Selection Checkbox */}
             <div 
                 onClick={(e) => toggleSelect(match.id, e)}
                 className="absolute left-0 top-0 bottom-0 w-16 flex items-center justify-center hover:bg-white/5 transition-colors z-20"
             >
                 {selected.has(match.id) ? (
                    <CheckSquare className="w-6 h-6 text-[var(--brand-primary)]" />
                 ) : (
                    <Square className="w-6 h-6 text-[var(--text-muted)] opacity-30 group-hover:opacity-100 transition-opacity" />
                 )}
             </div>

             <div className="flex flex-col gap-1 pl-12">
                 <span className="text-[10px] text-[var(--text-muted)] font-mono font-bold uppercase tracking-widest opacity-60">ID: {match.id.substring(0,8)} {match.timeControl ? `• ${match.timeControl}` : ''}</span>
                 <div className="flex flex-wrap items-center gap-4 mt-1">
                     <span className={`font-black text-2xl tracking-tighter ${match.result === '1/2-1/2' ? 'text-amber-500' : 'text-[var(--brand-primary)]'}`}>
                         {match.result}
                     </span>
                     <span className="text-[var(--text-primary)] font-bold text-lg tracking-tight">
                         {match.whiteName || t("white")} <span className="text-[var(--text-muted)] font-normal px-1 opacity-50">vs</span> {match.blackName || t("black")}
                     </span>
                     <span className="bg-[var(--button-bg)] border border-[var(--surface-border)] px-3 py-1 rounded-md text-[10px] text-[var(--text-muted)] uppercase tracking-[0.2em] font-black ml-2">
                         {match.reason}
                     </span>
                 </div>
             </div>
             
             <div className="text-left md:text-right pl-12 md:pl-0">
                <div className="text-[var(--text-muted)] font-mono text-xs font-bold">{new Date(match.createdAt).toLocaleDateString()}</div>
                <div className="text-[var(--brand-primary)] opacity-0 group-hover:opacity-100 text-[10px] font-black mt-2 transition-all uppercase tracking-widest">
                   {t("click_review")} →
                </div>
             </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
