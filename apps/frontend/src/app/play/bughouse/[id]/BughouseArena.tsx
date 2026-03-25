"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Chessboard } from "react-chessboard";
import { Swords, Settings } from "lucide-react";
import { useSettingsContext } from "@/providers/SettingsProvider";
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
  const { setIsPanelOpen } = useSettingsContext();
  getPieceUrlRef.current = getPieceUrl;

  const [state, setState] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedPiece, setSelectedPiece] = useState<{char: string, board: number} | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const logMessage = (msg: string) => {
    setLogs(prev => [...prev.slice(-19), msg]);
  };

  const onDrop = (boardIdx: number, source: string, target: string) => {
     console.log(`[BUGHOUSE] onDrop ${boardIdx}: ${source} -> ${target}`);
     if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false;
     
     const uci = source + target;
     const update = create(MatchUpdateSchema, {
        event: { case: "move", value: { uci, matchId: id, timestamp: BigInt(Date.now()) } }
     });
     wsRef.current.send(toBinary(MatchUpdateSchema, update));
     return true;
  };

  const onSquareClick = (boardIdx: number, square: any) => {
     if (selectedPiece && selectedPiece.board === boardIdx) {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        const targetSquare = typeof square === 'string' ? square : (square?.square || square);
        const uci = `${selectedPiece.char.toUpperCase()}@${targetSquare}`;
        console.log(`[BUGHOUSE] Sending Drop: ${uci}`);
        const update = create(MatchUpdateSchema, {
            event: { case: "move", value: { uci, matchId: id, timestamp: BigInt(Date.now()) } }
        });
        wsRef.current.send(toBinary(MatchUpdateSchema, update));
        setSelectedPiece(null);
     }
  }

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

    ws.onopen = () => {
        console.log("[BUGHOUSE] WS Connected");
        logMessage("Connected to Bughouse Match!");
    };
    ws.onmessage = (event) => {
      if (!(event.data instanceof ArrayBuffer)) return;
      try {
        const update = fromBinary(MatchUpdateSchema, new Uint8Array(event.data));
        console.log("[BUGHOUSE] WS Update:", update.event.case);
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

  const isTeam2 = role.endsWith('1');
  const myBoardIdx = isTeam2 ? 1 : 0;
  const partnerBoardIdx = 1 - myBoardIdx;

  const myBoard = myBoardIdx === 0 ? state?.board0 : state?.board1;
  const partnerBoard = partnerBoardIdx === 0 ? state?.board0 : state?.board1;

  const myBankW = myBoardIdx === 0 ? state?.bank0w : state?.bank1w;
  const myBankB = myBoardIdx === 0 ? state?.bank0b : state?.bank1b;
  const partnerBankW = partnerBoardIdx === 0 ? state?.bank0w : state?.bank1w;
  const partnerBankB = partnerBoardIdx === 0 ? state?.bank0b : state?.bank1b;

  if (!mounted || !id) return <div className="min-h-screen bg-[#05060B]" />;

  return (
    <div className="min-h-screen flex flex-col p-2 md:p-8 bg-[#07090E] text-slate-100 selection:bg-blue-500/30 overflow-x-hidden">
      <header className="flex justify-between items-center mb-4 md:mb-8 max-w-[1400px] mx-auto w-full px-2 landscape:hidden md:landscape:flex min-h-0">
        <div className="flex items-center gap-2 md:gap-3 bg-white/5 border border-white/10 px-3 md:px-6 py-1.5 md:py-2 rounded-2xl backdrop-blur-xl">
          <Swords className="w-5 h-5 md:w-8 md:h-8 text-blue-400" />
          <div>
            <h1 className="text-sm md:text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-300 leading-none uppercase">{t("bughouse")}</h1>
            <span className="text-[8px] md:text-[10px] font-mono text-slate-500 uppercase tracking-widest">{id.substring(0,8)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
           {state && !myBoard?.isActive && <div className="px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold rounded-full animate-pulse uppercase">Game Over</div>}
           <button onClick={() => setIsPanelOpen(true)} className="p-2 bg-white/5 hover:bg-white/10 transition-colors rounded-full border border-white/10 text-slate-400">
               <Settings className="w-4 h-4 md:w-6 md:h-6" />
           </button>
        </div>
      </header>

      <div className="max-w-[1800px] mx-auto w-full grid grid-cols-1 md:grid-cols-2 landscape:grid-cols-2 md:landscape:grid-cols-2 gap-2 md:gap-10 items-start">
        
        {/* Your Board */}
        <div className="flex flex-col gap-1 md:gap-4 w-full">
            <div className="flex justify-between items-end px-2">
                <div className="text-[9px] md:text-xs uppercase font-black text-slate-500">Board {myBoardIdx} (You)</div>
                <div className="text-xs md:text-lg font-mono font-bold text-white/80">3:00</div>
            </div>
            
            <div className="h-6 md:h-10 bg-white/5 rounded-lg flex items-center px-4 gap-2 overflow-x-auto min-h-0">
               {(role.startsWith('w') ? myBankB : myBankW)?.map((p: string, i: number) => (
                   <span key={i} className="text-[10px] md:text-sm font-black text-slate-600">{p}</span>
               ))}
            </div>

            <div className="aspect-square border-2 md:border-4 border-slate-900 rounded-lg md:rounded-xl overflow-hidden shadow-2xl relative landscape:max-h-[60vh] landscape:w-auto mx-auto">
                <Chessboard 
                   options={{
                      id: "board0",
                      position: myBoard?.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                      boardOrientation: role.startsWith('b') ? "black" : "white",
                      darkSquareStyle: { backgroundColor: boardThemes[settings.boardTheme]?.dark || "#4d6d4d" },
                      lightSquareStyle: { backgroundColor: boardThemes[settings.boardTheme]?.light || "#f0f0f0" },
                      pieces: stableCustomPieces as any,
                      onPieceDrop: (({ sourceSquare, targetSquare }: any) => onDrop(myBoardIdx, sourceSquare, targetSquare)) as any,
                      onSquareClick: ((s: any) => onSquareClick(myBoardIdx, s)) as any,
                      allowDragging: (role !== "spectator") && !selectedPiece
                   } as any}
                />
            </div>

            <div className="h-6 md:h-10 bg-white/5 rounded-lg flex items-center px-4 gap-2 overflow-x-auto min-h-0">
                {(role.startsWith('w') ? myBankW : myBankB)?.map((p: string, i: number) => (
                    <button 
                       key={i} 
                       onClick={() => setSelectedPiece(selectedPiece?.char === p && selectedPiece?.board === myBoardIdx ? null : { char: p, board: myBoardIdx })}
                       className={`text-[10px] md:text-sm font-black transition-all ${selectedPiece?.char === p && selectedPiece?.board === myBoardIdx ? 'text-white scale-110 bg-blue-500/20 px-2 rounded-md border border-blue-500/50' : 'text-blue-400 hover:scale-105'}`}
                    >{p}</button>
                ))}
                <span className="ml-auto text-[7px] md:text-[9px] font-black text-blue-500/20 uppercase tracking-widest">Bank</span>
            </div>
        </div>

        {/* Partner's Board */}
        <div className="flex flex-col gap-1 md:gap-4 w-full">
            <div className="flex justify-between items-end px-2">
                <div className="text-[9px] md:text-xs uppercase font-black text-slate-500">Board {partnerBoardIdx} (Partner)</div>
                <div className="text-xs md:text-lg font-mono font-bold text-white/80">3:00</div>
            </div>

            <div className="h-6 md:h-10 bg-white/5 rounded-lg flex items-center px-4 gap-2 overflow-x-auto min-h-0">
               {(role.startsWith('w') ? partnerBankW : partnerBankB)?.map((p: string, i: number) => (
                   <span key={i} className="text-[10px] md:text-sm font-black text-slate-600">{p}</span>
               ))}
            </div>

            <div className="aspect-square border-2 md:border-4 border-slate-900 rounded-lg md:rounded-xl overflow-hidden shadow-2xl opacity-80 hover:opacity-100 transition-opacity landscape:max-h-[60vh] landscape:w-auto mx-auto relative">
                <Chessboard 
                   options={{
                      id: "board1",
                      position: partnerBoard?.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                      boardOrientation: role.startsWith('b') ? "white" : "black",
                      darkSquareStyle: { backgroundColor: boardThemes[settings.boardTheme]?.dark || "#4d6d4d" },
                      lightSquareStyle: { backgroundColor: boardThemes[settings.boardTheme]?.light || "#f0f0f0" },
                      pieces: stableCustomPieces as any,
                      onPieceDrop: (({ sourceSquare, targetSquare }: any) => onDrop(partnerBoardIdx, sourceSquare, targetSquare)) as any,
                      onSquareClick: ((s: any) => onSquareClick(partnerBoardIdx, s)) as any,
                      allowDragging: false // Cannot drag on partner board
                   } as any}
                />
            </div>

            <div className="h-6 md:h-10 bg-white/5 rounded-lg flex items-center px-4 gap-2 overflow-x-auto min-h-0">
                {(role.startsWith('w') ? partnerBankB : partnerBankW)?.map((p: string, i: number) => (
                    <button 
                       key={i} 
                       onClick={() => setSelectedPiece(selectedPiece?.char === p && selectedPiece?.board === partnerBoardIdx ? null : { char: p, board: partnerBoardIdx })}
                       className={`text-[10px] md:text-sm font-black transition-all ${selectedPiece?.char === p && selectedPiece?.board === partnerBoardIdx ? 'text-white scale-110 bg-indigo-500/20 px-2 rounded-md border border-indigo-500/50' : 'text-indigo-400 hover:scale-105'}`}
                    >{p}</button>
                ))}
                <span className="ml-auto text-[7px] md:text-[9px] font-black text-indigo-500/20 uppercase tracking-widest">Bank</span>
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
