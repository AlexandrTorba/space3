"use client";

import React, { useState } from "react";
import { Chessboard } from "react-chessboard";
import { Activity, Swords, Users, Zap, Timer } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useSettings, boardThemes } from "@/hooks/useSettings";

const piecesLabels = ["wP", "wN", "wB", "wR", "wQ", "wK", "bP", "bN", "bB", "bR", "bQ", "bK"];

function makePieceComponent(pieceCode: string, urlRef: React.MutableRefObject<(p: string) => string>) {
  function PieceImg(props: { svgStyle?: React.CSSProperties; square?: string } = {}) {
    return <img src={urlRef.current(pieceCode)} style={props.svgStyle} className="w-full h-full object-contain pointer-events-none" alt={pieceCode} />;
  }
  return PieceImg;
}

const getPieceUrlRef: { current: (p: string) => string } = { current: () => "" };

const stableCustomPieces = Object.fromEntries(
  piecesLabels.map(p => [p, makePieceComponent(p, getPieceUrlRef)])
);

export default function BughouseArena() {
  const { t } = useTranslation();
  const { settings, getPieceUrl } = useSettings();
  getPieceUrlRef.current = getPieceUrl;
  const [fen0] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [fen1] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  
  // Mock Piece Banks
  const [bank0w] = useState(["P", "P", "N"]);
  const [bank0b] = useState(["B", "R"]);
  const [bank1w] = useState(["Q"]);
  const [bank1b] = useState(["P", "N", "N"]);

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8 bg-[#07090E] text-slate-100 selection:bg-blue-500/30">
      
      {/* Header */}
      <header className="flex justify-between items-center mb-10 max-w-[1400px] mx-auto w-full">
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-6 py-3 rounded-2xl backdrop-blur-xl">
          <Swords className="w-8 h-8 text-blue-400" />
          <div>
            <h1 className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-300">
               BUGHOUSE ARENA
            </h1>
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">4-Player Team Mode</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-xs">
              <Activity className="w-4 h-4" /> 4 PLAYERS CONNECTED
           </div>
        </div>
      </header>

      {/* Main Dual-Board Layout */}
      <div className="max-w-[1800px] mx-auto w-full grid grid-cols-1 xl:grid-cols-2 gap-12 lg:gap-20">
        
        {/* BOARD 0 */}
        <div className="flex flex-col gap-4 group">
          <div className="flex items-center justify-between px-4">
            <div className="flex items-center gap-3">
               <Users className="w-5 h-5 text-slate-400" />
               <span className="font-bold text-slate-300">TEAM A (White) vs TEAM B (Black)</span>
            </div>
            <div className="text-2xl font-black font-mono text-white/90">3:00</div>
          </div>

          {/* Piece Bank (Top Player) */}
          <div className="h-12 bg-white/5 border border-white/5 rounded-xl flex items-center px-4 gap-2">
             {bank0b.map((p, i) => (
               <div key={i} className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center border border-white/10 shadow-lg cursor-grab active:cursor-grabbing hover:scale-110 transition-transform">
                  <span className="font-black text-xs text-slate-400">{p}</span>
               </div>
             ))}
             <span className="text-[9px] uppercase font-black text-slate-600 ml-auto tracking-widest">Enemy Drops</span>
          </div>

          <div className="aspect-square relative rounded-2xl overflow-hidden border-8 border-slate-900 shadow-2xl transition-all group-hover:shadow-blue-500/10 group-hover:border-slate-800">
            <Chessboard 
               options={{
                 position: fen0,
                 boardOrientation: "white",
                 darkSquareStyle: { backgroundColor: boardThemes[settings.boardTheme]?.dark || "#4d6d4d" },
                 lightSquareStyle: { backgroundColor: boardThemes[settings.boardTheme]?.light || "#f0f0f0" },
                 pieces: stableCustomPieces as any,
               }}
            />
          </div>

          {/* Piece Bank (Bottom Player) */}
          <div className="h-12 bg-white/5 border border-white/5 rounded-xl flex items-center px-4 gap-2">
             {bank0w.map((p, i) => (
               <div key={i} className="w-8 h-8 bg-blue-900/20 rounded-lg flex items-center justify-center border border-blue-500/20 shadow-lg cursor-grab active:cursor-grabbing hover:scale-110 transition-transform">
                  <span className="font-black text-xs text-blue-400">{p}</span>
               </div>
             ))}
             <span className="text-[9px] uppercase font-black text-blue-500/40 ml-auto tracking-widest">Your Drops</span>
          </div>
        </div>

        {/* BOARD 1 */}
        <div className="flex flex-col gap-4 group">
          <div className="flex items-center justify-between px-4">
            <div className="flex items-center gap-3">
               <Users className="w-5 h-5 text-slate-400" />
               <span className="font-bold text-slate-300">TEAM B (White) vs TEAM A (Black)</span>
            </div>
            <div className="text-2xl font-black font-mono text-white/90">2:45</div>
          </div>

          {/* Piece Bank (Top Player) */}
          <div className="h-12 bg-white/5 border border-white/5 rounded-xl flex items-center px-4 gap-2">
             {bank1b.map((p, i) => (
               <div key={i} className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center border border-white/10 shadow-lg cursor-grab active:cursor-grabbing hover:scale-110 transition-transform">
                  <span className="font-black text-xs text-slate-400">{p}</span>
               </div>
             ))}
             <span className="text-[9px] uppercase font-black text-slate-600 ml-auto tracking-widest">Enemy Drops</span>
          </div>

          <div className="aspect-square relative rounded-2xl overflow-hidden border-8 border-slate-900 shadow-2xl transition-all group-hover:shadow-indigo-500/10 group-hover:border-slate-800">
            <Chessboard 
               options={{
                 position: fen1,
                 boardOrientation: "black",
                 darkSquareStyle: { backgroundColor: boardThemes[settings.boardTheme]?.dark || "#4d6d4d" },
                 lightSquareStyle: { backgroundColor: boardThemes[settings.boardTheme]?.light || "#f0f0f0" },
                 pieces: stableCustomPieces as any,
               }}
            />
          </div>

          {/* Piece Bank (Bottom Player) */}
          <div className="h-12 bg-white/5 border border-white/5 rounded-xl flex items-center px-4 gap-2">
             {bank1w.map((p, i) => (
               <div key={i} className="w-8 h-8 bg-indigo-900/20 rounded-lg flex items-center justify-center border border-indigo-500/20 shadow-lg cursor-grab active:cursor-grabbing hover:scale-110 transition-transform">
                  <span className="font-black text-xs text-indigo-400">{p}</span>
               </div>
             ))}
             <span className="text-[9px] uppercase font-black text-indigo-500/40 ml-auto tracking-widest">Your Drops</span>
          </div>
        </div>

      </div>

      {/* Team Coordination Panel */}
      <div className="mt-12 max-w-[1400px] mx-auto w-full bg-slate-900/40 border border-white/5 p-8 rounded-[2.5rem] backdrop-blur-3xl shadow-3xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
             <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-3xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                   <Zap className="w-8 h-8 text-blue-400" />
                </div>
                <div>
                   <h3 className="text-xl font-black uppercase tracking-widest">Real-time Piece Sharing</h3>
                   <p className="text-sm text-slate-500 max-w-lg mt-1 font-medium leading-relaxed">
                      Every piece you capture is instantly delivered to your partner's drop bank on the adjacent board. 
                      Move pieces from your bank onto any empty square to turn the tide.
                   </p>
                </div>
             </div>
             
             <button className="px-10 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-500/20 hover:scale-105 active:scale-95 transition-all">
                Wait for Players (0/4)
             </button>
          </div>
      </div>
      
    </div>
  );
}
