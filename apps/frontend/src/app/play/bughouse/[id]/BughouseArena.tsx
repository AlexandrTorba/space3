"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Chessboard } from "react-chessboard";
import { Swords } from "lucide-react";
import { create, toBinary, fromBinary } from "@bufbuild/protobuf";
import { MatchUpdateSchema } from "@antigravity/contracts";
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
  const [mounted, setMounted] = useState(false);
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const role = searchParams?.get("role") || "spectator"; // w0, b0, w1, b1, spectator

  const { t } = useTranslation();
  const { settings, getPieceUrl } = useSettings();
  getPieceUrlRef.current = getPieceUrl;

  const [state, setState] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const logMessage = (msg: string) => {
    setLogs(prev => [...prev.slice(-19), msg]);
  };

  useEffect(() => {
    setMounted(true);
    if (!id) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const rawUrl = process.env.NEXT_PUBLIC_BACKEND_URL || (typeof window !== "undefined" ? window.location.hostname + ":8787" : "localhost:8787");
    let host = rawUrl;
    try {
      if (rawUrl?.includes("://")) {
         host = new URL(rawUrl).host;
      }
    } catch(e) {}
    
    const wsUrl = `${protocol}//${host}/bughouse/${id}?role=${role}`;
    
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => logMessage("Connected to Bughouse Match!");
    ws.onmessage = (event) => {
      if (!(event.data instanceof ArrayBuffer)) return;
      try {
        const update = fromBinary(MatchUpdateSchema, new Uint8Array(event.data));
        if (update.event.case === "bughouse") {
           const bg = update.event.value;
           if (bg.event.case === "status") {
              setState(bg.event.value);
           }
        }
      } catch (e) {}
    };

    return () => ws.close();
  }, [id, role]);

  if (!mounted || !id) return <div className="min-h-screen bg-[#05060B]" />;

  const onDrop = (boardIdx: number, source: string, target: string) => {
     if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false;
     
     const uci = source + target;
     const update = create(MatchUpdateSchema, {
        event: { case: "move", value: { uci, matchId: id, timestamp: BigInt(Date.now()) } }
     });
     wsRef.current.send(toBinary(MatchUpdateSchema, update));
     return true;
  };

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8 bg-[#07090E] text-slate-100 selection:bg-blue-500/30">
      <header className="flex justify-between items-center mb-8 max-w-[1400px] mx-auto w-full">
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-6 py-2 rounded-2xl backdrop-blur-xl">
          <Swords className="w-8 h-8 text-blue-400" />
          <div>
            <h1 className="text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-300">BUGHOUSE</h1>
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{id.substring(0,8)}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
           {state && !state.board0?.isActive && <div className="px-4 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold rounded-full animate-pulse uppercase">Game Over</div>}
        </div>
      </header>

      <div className="max-w-[1800px] mx-auto w-full grid grid-cols-1 xl:grid-cols-2 gap-10">
        
        {/* Board 0 Section */}
        <div className="flex flex-col gap-4">
            <div className="flex justify-between items-end px-2">
                <div className="text-xs uppercase font-black text-slate-500">Board 0</div>
                <div className="text-lg font-mono font-bold text-white/80">{state?.board0?.whiteTimeMs === -1 ? "∞" : "3:00"}</div>
            </div>
            
            <div className="h-10 bg-white/5 rounded-lg flex items-center px-4 gap-2 overflow-x-auto">
               {state?.bank0b?.map((p: string, i: number) => (
                   <span key={i} className="text-sm font-black text-slate-600">{p}</span>
               ))}
            </div>

            <div className="aspect-square border-4 border-slate-900 rounded-xl overflow-hidden shadow-2xl">
                <Chessboard 
                   options={{
                      position: state?.board0?.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                      boardOrientation: "white",
                      darkSquareStyle: { backgroundColor: boardThemes[settings.boardTheme]?.dark || "#4d6d4d" },
                      lightSquareStyle: { backgroundColor: boardThemes[settings.boardTheme]?.light || "#f0f0f0" },
                      pieces: stableCustomPieces as any,
                      onPieceDrop: ((s: any, t: any) => onDrop(0, s, t)) as any,
                      allowDragging: role === "w0" || role === "b0"
                   } as any}
                />
            </div>

            <div className="h-10 bg-white/5 rounded-lg flex items-center px-4 gap-2 overflow-x-auto">
               {state?.bank0w?.map((p: string, i: number) => (
                   <button 
                      key={i} 
                      className="text-sm font-black text-blue-400 hover:scale-110 transition-transform"
                   >{p}</button>
               ))}
               <span className="ml-auto text-[9px] font-black text-blue-500/20 uppercase tracking-widest">Your Bank</span>
            </div>
        </div>

        {/* Board 1 Section */}
        <div className="flex flex-col gap-4">
            <div className="flex justify-between items-end px-2">
                <div className="text-xs uppercase font-black text-slate-500">Board 1</div>
                <div className="text-lg font-mono font-bold text-white/80">{state?.board1?.whiteTimeMs === -1 ? "∞" : "3:00"}</div>
            </div>

            <div className="h-10 bg-white/5 rounded-lg flex items-center px-4 gap-2 overflow-x-auto">
               {state?.bank1b?.map((p: string, i: number) => (
                   <span key={i} className="text-sm font-black text-slate-600">{p}</span>
               ))}
            </div>

            <div className="aspect-square border-4 border-slate-900 rounded-xl overflow-hidden shadow-2xl">
                <Chessboard 
                   options={{
                      position: state?.board1?.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                      boardOrientation: "black",
                      darkSquareStyle: { backgroundColor: boardThemes[settings.boardTheme]?.dark || "#4d6d4d" },
                      lightSquareStyle: { backgroundColor: boardThemes[settings.boardTheme]?.light || "#f0f0f0" },
                      pieces: stableCustomPieces as any,
                      onPieceDrop: ((s: any, t: any) => onDrop(1, s, t)) as any,
                      allowDragging: role === "w1" || role === "b1"
                   } as any}
                />
            </div>

            <div className="h-10 bg-white/5 rounded-lg flex items-center px-4 gap-2 overflow-x-auto">
               {state?.bank1w?.map((p: string, i: number) => (
                   <button 
                      key={i}
                      className="text-sm font-black text-indigo-400 hover:scale-110 transition-transform"
                   >{p}</button>
               ))}
               <span className="ml-auto text-[9px] font-black text-indigo-500/20 uppercase tracking-widest">Your Bank</span>
            </div>
        </div>

      </div>

      {/* Logs */}
      <div className="mt-8 bg-black/40 border border-white/5 p-4 rounded-xl h-32 overflow-y-auto font-mono text-[10px] text-slate-500">
         {logs.map((l, i) => <div key={i}>{l}</div>)}
      </div>

    </div>
  );
}
