"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Chessboard } from "react-chessboard";
import { Swords, Settings } from "lucide-react";
import { useSettingsContext } from "@/providers/SettingsProvider";
import { create, toBinary, fromBinary } from "@bufbuild/protobuf";
import { MatchUpdateSchema } from "@antigravity/contracts";
import { Chess, Square } from "chess.js";
import { useTranslation } from "@/i18n";
import { useSettings, boardThemes } from "@/hooks/useSettings";
import { RotateCcw } from "lucide-react";

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
  const [lobby, setLobby] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedPiece, setSelectedPiece] = useState<{char: string, board: number} | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{boardIdx: number, source: string, target: string} | null>(null);
  const [clocks, setClocks] = useState({
    w0: 180000, b0: 180000,
    w1: 180000, b1: 180000
  });
  const [rematchState, setRematchState] = useState<"default" | "offered" | "waiting">("default");
  const wsRef = useRef<WebSocket | null>(null);
  const router = useRouter(); 

  const logMessage = (msg: string) => {
    setLogs(prev => [...prev.slice(-19), msg]);
  };

  const onDrop = (boardIdx: number, source: string, target: string) => {
     console.log(`[BUGHOUSE] onDrop ${boardIdx}: ${source} -> ${target}`);
     if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false;
     
     // Local validation for promotion
     const fen = boardIdx === 0 ? state?.board0?.fen : state?.board1?.fen;
     if (fen) {
        const game = new Chess(fen);
        const piece = game.get(source as Square);
        if (piece?.type === 'p') {
           const isPromotion = (piece.color === 'w' && target[1] === '8') || (piece.color === 'b' && target[1] === '1');
           if (isPromotion) {
              setPendingPromotion({ boardIdx, source, target });
              return true;
           }
        }
     }

     const uci = source + target;
     const update = create(MatchUpdateSchema, {
        event: { case: "move", value: { uci, matchId: id, timestamp: BigInt(Date.now()) } }
     });
     wsRef.current.send(toBinary(MatchUpdateSchema, update));
     return true;
  };

  const completePromotion = (piece: string) => {
     if (!pendingPromotion || !wsRef.current) return;
     const { boardIdx, source, target } = pendingPromotion;
     const uci = source + target + piece.toLowerCase();
     const update = create(MatchUpdateSchema, {
         event: { case: "move", value: { uci, matchId: id, timestamp: BigInt(Date.now()) } }
     });
     wsRef.current.send(toBinary(MatchUpdateSchema, update));
     setPendingPromotion(null);
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

  const claimSlot = (slotRole: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const name = (typeof window !== "undefined" ? localStorage.getItem("ag_username") : "") || "Player";
    const update = create(MatchUpdateSchema, {
       event: { case: "lobby", value: { type: "claim", role: slotRole, name } }
    });
    wsRef.current.send(toBinary(MatchUpdateSchema, update));
  };

  const toggleReady = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const update = create(MatchUpdateSchema, {
       event: { case: "lobby", value: { type: "ready", role: "", name: "" } }
    });
    wsRef.current.send(toBinary(MatchUpdateSchema, update));
  };

  const addBot = (slotRole: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const update = create(MatchUpdateSchema, {
       event: { case: "lobby", value: { type: "bot_add", role: slotRole, name: "Bot Engine" } }
    });
    wsRef.current.send(toBinary(MatchUpdateSchema, update));
  };

  const fillBots = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !state?.lobby) return;
    const slots = ["w0", "b0", "w1", "b1"];
    slots.forEach(s => {
       if (!(state.lobby as any)[s]?.isClaimed) {
          addBot(s);
       }
    });
  };

  const sendAction = (actionType: "rematch" | "resign") => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const update = create(MatchUpdateSchema, {
              event: { case: "action", value: { matchId: id, actionType: actionType, playerColor: role } }
          });
          wsRef.current.send(toBinary(MatchUpdateSchema, update));
      }
  };

  const handleRematch = () => {
      sendAction("rematch");
      setRematchState("waiting");
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
    console.log(`[BUGHOUSE] Connecting to ${wsUrl} as ${role}`);
    
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
        console.log("[BUGHOUSE] WS Connected");
        logMessage("Connected to Bughouse Match!");
        if (role) {
           claimSlot(role as string);
        }
    };
    ws.onmessage = (event) => {
      if (!(event.data instanceof ArrayBuffer)) return;
      try {
        const update = fromBinary(MatchUpdateSchema, new Uint8Array(event.data));
        if (update.event.case === "bughouse") {
           const bg = update.event.value;
            if (bg.event.case === "status") {
               const val = bg.event.value;
               setState(val);
               setClocks({
                  w0: val.board0?.whiteTimeMs || 180000,
                  b0: val.board0?.blackTimeMs || 180000,
                  w1: val.board1?.whiteTimeMs || 180000,
                  b1: val.board1?.blackTimeMs || 180000
               });
            } else if (bg.event.case === "lobbyInfo") {
               setLobby(bg.event.value);
            }
        } else if (update.event.case === "action") {
           const action = update.event.value;
           if (action.actionType === "rematch") {
               setRematchState("offered");
               logMessage(`Rematch offered by ${action.playerColor}!`);
           } else if (action.actionType === "rematch_accept") {
               const newId = action.matchId;
               const fillBotsParam = searchParams?.get("fillBots") === "1" ? "&fillBots=1" : "";
               router.push(`/play/bughouse/${newId}?role=${role}${fillBotsParam}`);
           }
        }
      } catch (e) {}

    };

    return () => ws.close();
  }, [id, role]);

  // Handle auto-fill bots from query string
  useEffect(() => {
    if (searchParams?.get("fillBots") === "1" && state?.lobby && !state.lobby.isAllReady) {
        // Delay slightly to ensure socket is ready for multiple messages
        const timer = setTimeout(() => {
            fillBots();
            // Also ready up myself
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                const update = create(MatchUpdateSchema, {
                   event: { case: "lobby", value: { type: "ready", role: "", name: "" } }
                });
                wsRef.current.send(toBinary(MatchUpdateSchema, update));
            }
        }, 1500);
        return () => clearTimeout(timer);
    }
  }, [state?.lobby, searchParams]);

  useEffect(() => {
    if (!state || !state.board0?.isActive) return;
    
    const interval = setInterval(() => {
       const turn0 = new Chess(state.board0.fen).turn();
       const turn1 = new Chess(state.board1.fen).turn();
       
       setClocks(prev => ({
          w0: turn0 === 'w' ? Math.max(0, prev.w0 - 100) : prev.w0,
          b0: turn0 === 'b' ? Math.max(0, prev.b0 - 100) : prev.b0,
          w1: turn1 === 'w' ? Math.max(0, prev.w1 - 100) : prev.w1,
          b1: turn1 === 'b' ? Math.max(0, prev.b1 - 100) : prev.b1,
       }));
    }, 100);
    return () => clearInterval(interval);
  }, [state?.board0?.fen, state?.board1?.fen, state?.isActive]);

  const formatTime = (ms: number) => {
     const totalSec = Math.floor(ms / 1000);
     const min = Math.floor(totalSec / 60);
     const sec = totalSec % 60;
     const mil = Math.floor((ms % 1000) / 100);
     if (min === 0 && totalSec < 10) return `${sec}.${mil}`;
     return `${min}:${sec.toString().padStart(2, '0')}`;
  };

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
            <h1 className="text-[10px] md:text-xs font-black tracking-[0.2em] text-blue-500/80 uppercase leading-none mb-1">AntigravityChess</h1>
            <h2 className="text-sm md:text-2xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-300 leading-none uppercase">{t("bughouse")}</h2>
            <span className="text-[8px] md:text-[10px] font-mono text-slate-500 uppercase tracking-widest">{id.substring(0,8)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
           {state && !myBoard?.isActive && (
              <div className="flex gap-2 items-center">
                {rematchState === "default" ? (
                   <button onClick={handleRematch} className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-400 text-[10px] font-bold rounded-full transition-all uppercase flex items-center gap-1.5 shadow-lg shadow-blue-500/10 active:scale-95">
                      <RotateCcw className="w-3 h-3" /> {t("rematch")}
                   </button>
                ) : rematchState === "waiting" ? (
                   <div className="px-3 py-1 bg-white/5 border border-white/10 text-slate-400 text-[10px] font-bold rounded-full animate-pulse uppercase">Waiting...</div>
                ) : (
                   <button onClick={handleRematch} className="px-3 py-1 bg-green-500 shadow-xl shadow-green-500/20 text-white text-[10px] font-black rounded-full animate-bounce uppercase">{t("accept_draw") === "Aceptar Tablas" ? "Revancha" : "Accept Rematch"}</button>
                )}
                <div className="px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold rounded-full animate-pulse uppercase">Game Over</div>
              </div>
           )}
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
                <div className={`text-xs md:text-lg font-mono font-bold transition-colors ${ (new Chess(myBoard?.fen).turn() === 'w' ? (clocks as any)[('w' + myBoardIdx)] : (clocks as any)[('b' + myBoardIdx)]) < 10000 ? 'text-red-500' : 'text-white/80'}`}>
                    {formatTime(myBoardIdx === 0 ? (new Chess(myBoard?.fen).turn() === 'w' ? clocks.w0 : clocks.b0) : (new Chess(myBoard?.fen).turn() === 'w' ? clocks.w1 : clocks.b1))}
                </div>
            </div>
            
            <div className="h-6 md:h-10 bg-white/5 rounded-lg flex items-center px-4 gap-2 overflow-x-auto min-h-0">
               {(role.startsWith('w') ? myBankB : myBankW)?.map((p: string, i: number) => (
                   <span key={i} className="text-[10px] md:text-sm font-black text-slate-600">{p}</span>
               ))}
            </div>

            <div className="aspect-square border-2 md:border-4 border-slate-900 rounded-lg md:rounded-xl overflow-hidden shadow-2xl relative landscape:max-h-[60vh] landscape:w-auto mx-auto">
                <Chessboard 
                   options={{
                      id: `board${myBoardIdx}`,
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
                
                {pendingPromotion && pendingPromotion.boardIdx === myBoardIdx && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
                        <div className="bg-[#151821] border border-white/10 p-4 md:p-6 rounded-[2rem] shadow-2xl flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
                             <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">{t("choose_promotion" as any)}</h3>
                             <div className="flex gap-2">
                                 {['q', 'r', 'b', 'n'].map(p => (
                                     <button 
                                         key={p}
                                         onClick={() => completePromotion(p)}
                                         className="w-10 h-10 md:w-16 md:h-16 bg-white/5 hover:bg-blue-500/20 border border-white/5 hover:border-blue-500/40 rounded-2xl flex items-center justify-center transition-all active:scale-90"
                                     >
                                         <img src={getPieceUrl((role.startsWith('w') ? 'w' : 'b') + p.toUpperCase())} className="w-8 h-8 md:w-12 md:h-12" alt={p}/>
                                     </button>
                                 ))}
                             </div>
                        </div>
                    </div>
                )}
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
                <div className={`text-xs md:text-lg font-mono font-bold transition-colors ${ (new Chess(partnerBoard?.fen).turn() === 'w' ? (clocks as any)[('w' + partnerBoardIdx)] : (clocks as any)[('b' + partnerBoardIdx)]) < 10000 ? 'text-red-500' : 'text-white/80'}`}>
                    {formatTime(partnerBoardIdx === 0 ? (new Chess(partnerBoard?.fen).turn() === 'w' ? clocks.w0 : clocks.b0) : (new Chess(partnerBoard?.fen).turn() === 'w' ? clocks.w1 : clocks.b1))}
                </div>
            </div>

            <div className="h-6 md:h-10 bg-white/5 rounded-lg flex items-center px-4 gap-2 overflow-x-auto min-h-0">
               {(role.startsWith('w') ? partnerBankW : partnerBankB)?.map((p: string, i: number) => (
                   <span key={i} className="text-[10px] md:text-sm font-black text-slate-600">{p}</span>
               ))}
            </div>

            <div className="aspect-square border-2 md:border-4 border-slate-900 rounded-lg md:rounded-xl overflow-hidden shadow-2xl opacity-80 hover:opacity-100 transition-opacity landscape:max-h-[60vh] landscape:w-auto mx-auto relative">
                <Chessboard 
                   options={{
                      id: `board${partnerBoardIdx}`,
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

      {/* Lobby Overlay */}
      {(!state?.lobby || !state.lobby.isAllReady) && (
        <div className="fixed inset-0 z-[100] bg-[#05060B]/90 backdrop-blur-2xl flex items-center justify-center p-4">
           <div className="bg-white/5 border border-white/10 p-8 md:p-12 rounded-[3rem] max-w-2xl w-full shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 animate-pulse" />
              
              <div className="flex flex-col items-center mb-10 text-center">
                  <div className="bg-blue-500/10 p-4 rounded-3xl mb-4">
                      <Swords className="w-10 h-10 text-blue-400" />
                  </div>
                  <h2 className="text-3xl font-black uppercase tracking-tighter mb-2">{t("setup_teams" as any)}</h2>
                  <p className="text-slate-400 text-sm font-bold uppercase tracking-widest opacity-60">{t("bughouse_lobby_hint" as any)}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 md:gap-8 mb-10">
                 {["w0", "b0", "w1", "b1"].map((roleKey) => {
                    const slot = (state?.lobby as any)?.[roleKey];
                    // Since session_id isn't fully implemented yet, we trust the backend to block invalid claims
                    return (
                        <div key={roleKey} className="flex flex-col gap-3">
                            <div className="flex justify-between items-center px-1">
                                <span className="text-[10px] font-black font-mono text-slate-500 uppercase tracking-widest">
                                    {roleKey.startsWith('w') ? '⚪ WHITE' : '⚫ BLACK'} {roleKey.endsWith('0') ? 'Board 1' : 'Board 2'}
                                </span>
                            </div>
                            <button 
                                onClick={() => claimSlot(roleKey)}
                                className={`h-16 rounded-2xl border-2 transition-all flex items-center gap-3 px-4 group relative overflow-hidden ${
                                    slot?.isClaimed 
                                        ? 'bg-blue-500/10 border-blue-500/40 text-blue-400' 
                                        : 'bg-white/5 border-white/5 hover:border-white/20 text-slate-500'
                                }`}
                            >
                                <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-black text-xs ${slot?.isClaimed ? 'bg-blue-500 border-white/20 text-white' : 'bg-white/10 border-white/10'}`}>
                                    {roleKey.toUpperCase()}
                                </div>
                                <div className="flex flex-col items-start min-w-0">
                                    <span className={`text-xs font-black truncate w-full ${slot?.isBot ? 'text-indigo-400' : ''}`}>
                                        {slot?.isClaimed ? slot.playerName : "VACANT"}
                                    </span>
                                    {slot?.isReady && <span className="text-[8px] font-black text-green-500 uppercase tracking-widest animate-pulse">READY</span>}
                                    {slot?.isBot && <span className="text-[7px] font-black text-indigo-500/50 uppercase tracking-[0.2em] leading-none">AI ENGINE</span>}
                                </div>
                                {!slot?.isClaimed && (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); addBot(roleKey); }}
                                        className="ml-auto bg-white/5 hover:bg-blue-500/20 text-[8px] font-black px-2 py-1.5 rounded-lg border border-white/5 hover:border-blue-500/30 transition-all active:scale-90"
                                    >
                                        + BOT
                                    </button>
                                )}
                                {!slot?.isClaimed && <div className="absolute inset-0 bg-blue-500 opacity-0 group-hover:opacity-5 transition-opacity pointer-events-none" />}
                            </button>
                        </div>
                    );
                 })}
              </div>

              <div className="flex flex-col gap-4">
                  <button 
                      id="ready-button"
                      onClick={toggleReady}
                      className="w-full bg-blue-500 hover:bg-blue-600 text-white py-5 rounded-[2rem] font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-3 disabled:opacity-30"
                  >
                      {t("ready_to_play" as any)}
                  </button>
                  <div className="flex items-center justify-center gap-2">
                      {["w0", "b0", "w1", "b1"].map((r, i) => (
                          <div key={i} className={`w-2 h-2 rounded-full transition-all duration-300 ${(state?.lobby as any)?.[r]?.isReady ? 'bg-green-500' : 'bg-white/10 shadow-inner'}`} />
                      ))}
                  </div>
                  <button 
                      onClick={fillBots}
                      className="w-full mt-2 bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-black uppercase tracking-[0.2em] py-3 rounded-2xl text-slate-500 transition-all"
                  >
                      Fill vacant with bots
                  </button>
              </div>
           </div>
        </div>
      )}

      {/* Logs */}
      <div className="mt-8 bg-black/40 border border-white/5 p-4 rounded-xl h-32 overflow-y-auto font-mono text-[10px] text-slate-500">
         {logs.map((l, i) => <div key={i}>{l}</div>)}
      </div>

    </div>
  );
}
