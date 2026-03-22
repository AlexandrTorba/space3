"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

import { ChevronLeft, ChevronRight, Download, History, SkipBack, SkipForward } from "lucide-react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import Link from "next/link";

import { useTranslation } from "@/i18n";

export default function ArchiveView() {
  const [mounted, setMounted] = useState(false);
  const params = useParams();
  const id = params?.id as string;
  
  useEffect(() => {
    setMounted(true);
  }, []);
  const { t } = useTranslation();
  const [match, setMatch] = useState<{result: string, reason: string, pgn: string} | null>(null);
  
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [history, setHistory] = useState<string[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);

  useEffect(() => {
    const fetchMatch = async () => {
      try {
        const rawUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" ? window.location.hostname + ":8787" : "localhost:8787");
        const host = rawUrl.replace(/^http(s)?:\/\//, '');
        const protocol = window.location.protocol === "https:" ? "https:" : "http:";
        const res = await fetch(`${protocol}//${host}/api/archive/${id}`);
        if (res.ok) {
           const data = await res.json();
           setMatch(data);
           
           if (data.pgn) {
               const engine = new Chess();
               engine.loadPgn(data.pgn);
               const historyMoves = engine.history();
               setHistory(historyMoves);
               setCurrentMoveIndex(historyMoves.length - 1);
               setFen(engine.fen());
               gameRef.current = engine;
           }
        }
      } catch (e) {
        console.error("Failed to load match", e);
      }
    };
    fetchMatch();
  }, [id]);

  const goToMove = (index: number) => {
      if (index < -1 || index >= history.length) return;
      
      const engine = new Chess();
      for(let i = 0; i <= index; i++) {
         engine.move(history[i]);
      }
      setCurrentMoveIndex(index);
      setFen(engine.fen());
  };

  const downloadPgn = () => {
     if (!match?.pgn) return;
     const blob = new Blob([match.pgn], { type: "text/plain" });
     const url = URL.createObjectURL(blob);
     const a = document.createElement("a");
     a.href = url;
     a.download = `antigravity_match_${id}.pgn`;
     a.click();
     URL.revokeObjectURL(url);
  };

  if (!mounted || !id || !match) {
     return <div className="min-h-screen bg-[var(--bg-color)] flex items-center justify-center text-[var(--text-primary)]">{t("loading_pgn")}</div>;
  }

  return (
    <div className="min-h-screen bg-[#07090E] text-white flex flex-col p-4 md:p-8">
        <header className="flex justify-between items-center mb-6 z-10">
            <div className="flex items-center gap-3">
              <History className="w-6 h-6 text-blue-400" />
              <div>
                  <h1 className="text-xl font-bold">{t("match_review")}</h1>
                  <span className="text-xs text-gray-500">{match.result} • {match.reason}</span>
              </div>
            </div>
            
            <Link href="/archive" className="text-sm text-blue-400 hover:text-blue-300">{t("back_archive")}</Link>
        </header>

        <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 flex flex-col items-center">
                <div className="w-full max-w-[min(600px,60vh)] md:max-w-[min(600px,65vh)] bg-black/50 border border-slate-800 p-2 rounded-2xl shadow-[0_0_40px_rgba(59,130,246,0.1)]">
                    <Chessboard 
                        options={{
                            position: fen, 
                            // onPieceDrop: onDrop as any, // Not applicable in archive view
                            boardOrientation: "white", // Fixed for archive view
                            darkSquareStyle: { backgroundColor: "#1e293b" }, // Using existing styles
                            lightSquareStyle: { backgroundColor: "#334155" }, // Using existing styles
                            animationDurationInMs: 200, // Updated from 150
                            allowDragging: false, // Fixed for archive view
                            showNotation: true, // Using existing value
                            // pieces: customPieces as any // Not applicable in archive view
                        }}
                    />
                </div>
                
                {/* Playback Controls */}
                <div className="flex items-center gap-4 mt-4 bg-slate-900 border border-slate-700 px-6 py-3 rounded-full shadow-2xl">
                    <button onClick={() => goToMove(-1)} disabled={currentMoveIndex === -1} className="p-2 hover:bg-slate-800 rounded disabled:opacity-30"><SkipBack className="w-5 h-5"/></button>
                    <button onClick={() => goToMove(currentMoveIndex - 1)} disabled={currentMoveIndex === -1} className="p-2 hover:bg-slate-800 rounded disabled:opacity-30"><ChevronLeft className="w-6 h-6"/></button>
                    <span className="font-mono text-sm w-12 text-center text-blue-400">{currentMoveIndex + 1} / {history.length}</span>
                    <button onClick={() => goToMove(currentMoveIndex + 1)} disabled={currentMoveIndex === history.length - 1} className="p-2 hover:bg-slate-800 rounded disabled:opacity-30"><ChevronRight className="w-6 h-6"/></button>
                    <button onClick={() => goToMove(history.length - 1)} disabled={currentMoveIndex === history.length - 1} className="p-2 hover:bg-slate-800 rounded disabled:opacity-30"><SkipForward className="w-5 h-5"/></button>
                </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 flex flex-col h-[min(650px,80vh)]">
                <h3 className="font-bold border-b border-slate-800 pb-3 mb-4">{t("move_annotation")}</h3>
                
                <div className="flex-1 overflow-y-auto mb-4 scrollbar-thin scrollbar-thumb-white/10 pr-2">
                    <div className="flex flex-col gap-1">
                        {Array.from({ length: Math.ceil(history.length / 2) }).map((_, i) => {
                            const wIndex = i * 2;
                            const bIndex = wIndex + 1;
                            const wMove = history[wIndex];
                            const bMove = history[bIndex];
                            
                            return (
                                <div key={i} className="grid grid-cols-7 text-sm font-mono rounded overflow-hidden">
                                    <div className="col-span-1 flex items-center justify-center bg-slate-800/50 text-slate-500 py-1">{i + 1}.</div>
                                    <div 
                                      onClick={() => goToMove(wIndex)} 
                                      className={`col-span-3 px-3 py-1 cursor-pointer transition-colors ${currentMoveIndex === wIndex ? 'bg-blue-600 font-bold text-white' : 'hover:bg-slate-800 text-slate-300'}`}
                                    >
                                        {wMove}
                                    </div>
                                    <div 
                                      onClick={() => goToMove(bIndex)} 
                                      className={`col-span-3 px-3 py-1 cursor-pointer transition-colors ${!bMove ? '' : currentMoveIndex === bIndex ? 'bg-blue-600 font-bold text-white' : 'hover:bg-slate-800 text-slate-300'}`}
                                    >
                                        {bMove || ""}
                                    </div>
                                </div>
                            );
                        })}
                        {history.length === 0 && <div className="text-slate-500 text-center mt-10">{t("no_moves")}</div>}
                    </div>
                </div>
                
                <button onClick={downloadPgn} className="w-full flex items-center justify-center gap-2 bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-500/30 py-3 rounded-xl font-bold transition-all mt-auto">
                    <Download className="w-4 h-4"/> {t("download_pgn")}
                </button>
            </div>
        </div>
    </div>
  );
}
