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
import { RotateCcw, Video, VideoOff, CheckCircle } from "lucide-react";
import VideoChat from "./VideoChat";

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
  const [playerName, setPlayerName] = useState("Player");
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">(role.startsWith("b") ? "black" : "white");
  const [partnerOrientation, setPartnerOrientation] = useState<"white" | "black">(role.startsWith("b") ? "white" : "black");
  const [showVideo, setShowVideo] = useState(false);
  const [videoAuthorized, setVideoAuthorized] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const router = useRouter(); 

  const logMessage = (msg: string) => {
    setLogs(prev => [...prev.slice(-19), msg]);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    let name = sessionStorage.getItem("ag_name");
    if (!name) {
       name = localStorage.getItem("ag_name") || "Player";
       sessionStorage.setItem("ag_name", name);
    }
    setPlayerName(name);
  }, []);

  const flipBoards = () => {
    setBoardOrientation(prev => prev === "white" ? "black" : "white");
    setPartnerOrientation(prev => prev === "white" ? "black" : "white");
  };

  const onDrop = (boardIdx: number, source: string, target: string, pieceCode?: string) => {
     console.log(`[BUGHOUSE] onDrop ${boardIdx}: ${source} -> ${target} (${pieceCode})`);
     if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false;
     
     // Local validation for promotion
     const fen = boardIdx === 0 ? state?.board0?.fen : state?.board1?.fen;
     if (fen) {
        const game = new Chess(fen);
        const p = game.get(source as Square);
        if (p?.type === 'p') {
           const isPromotion = (p.color === 'w' && target[1] === '8') || (p.color === 'b' && target[1] === '1');
           if (isPromotion) {
              setPendingPromotion({ boardIdx, source, target });
              return true;
           }
        }
     }

     const uci = source + target;
     const update = create(MatchUpdateSchema, {
        event: { case: "move", value: { matchId: id, uci, timestamp: BigInt(Date.now()) } }
     });
     wsRef.current.send(toBinary(MatchUpdateSchema, update));
     return true;
  };

  const onSquareClick = (boardIdx: number, squareArg: any) => {
    const square = typeof squareArg === 'string' ? squareArg : (squareArg?.square || squareArg?.id);
    if (!square || !selectedPiece || selectedPiece.board !== boardIdx) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    const uci = `${selectedPiece.char}@${square}`;
    console.log(`[BUGHOUSE] Drop Request: ${uci}`);
    const update = create(MatchUpdateSchema, {
      event: { case: "move", value: { matchId: id, uci, timestamp: BigInt(Date.now()) } }
    });
    wsRef.current.send(toBinary(MatchUpdateSchema, update));
    setSelectedPiece(null);
  };

  const completePromotion = (promotionPiece: string) => {
      if (!pendingPromotion || !wsRef.current) return;
      const { source, target, boardIdx } = pendingPromotion;
      const uci = source + target + promotionPiece;
      const update = create(MatchUpdateSchema, {
          event: { case: "move", value: { matchId: id, uci, timestamp: BigInt(Date.now()) } }
      });
      wsRef.current.send(toBinary(MatchUpdateSchema, update));
      setPendingPromotion(null);
  };

  const toggleReady = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const update = create(MatchUpdateSchema, {
       event: { case: "lobby", value: { type: "ready", role, name: playerName } }
    });
    wsRef.current.send(toBinary(MatchUpdateSchema, update));
  };

  const claimSlot = (slotRole: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const update = create(MatchUpdateSchema, {
       event: { case: "lobby", value: { type: "claim", role: slotRole, name: playerName } }
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

  const removeBot = (slotRole: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const update = create(MatchUpdateSchema, {
       event: { case: "lobby", value: { type: "bot_remove", role: slotRole, name: "" } }
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

  const setTimeControl = (ms: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
        const update = create(MatchUpdateSchema, {
            event: { case: "lobby", value: { type: "set_time", role: "", name: "", timeControlMs: ms } }
        });
        wsRef.current.send(toBinary(MatchUpdateSchema, update));
    }
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
    const isProd = typeof window !== "undefined" && window.location.protocol === "https:";
    const rawUrl = process.env.NEXT_PUBLIC_BACKEND_URL || (typeof window !== "undefined" ? (isProd ? window.location.hostname : window.location.hostname + ":8787") : "localhost:8787");
    let host = rawUrl;
    try {
      if (rawUrl?.includes("://")) {
         host = new URL(rawUrl).host;
      }
    } catch(e) {}
    
    const wsUrl = `${protocol}//${host}/bughouse/${id}?role=${role}&name=${encodeURIComponent(playerName)}`;
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
      if (typeof event.data === "string") {
          try {
              const data = JSON.parse(event.data);
              if (data.type === "video_enabled") {
                  setVideoAuthorized(data.enabled);
              }
          } catch(e) {}
          return;
      }
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
        } else if (update.event.case === "chat") {
            const chat = update.event.value;
            logMessage(`${chat.sender}: ${chat.text}`);
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

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
       const u = create(MatchUpdateSchema, {
          event: { case: "chat", value: { text: chatInput, sender: "", timestamp: BigInt(Date.now()) } }
       });
       wsRef.current.send(toBinary(MatchUpdateSchema, u));
       setChatInput("");
    }
  };

  const getPlayerLabel = (r: string) => {
     const slot = (state?.lobby as any)?.[r];
     if (slot?.isClaimed) return slot.playerName;
     if (slot?.isBot) return "Bot Engine";
     return r.toUpperCase();
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
                    <span className="text-[10px] p-2 text-slate-500 animate-pulse">{t("waiting" as any)}...</span>
                ) : (
                    <button onClick={handleRematch} className="px-3 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 text-[10px] font-bold rounded-full transition-all uppercase flex items-center gap-1.5 shadow-lg shadow-emerald-500/10 animate-bounce">
                        {t("accept_rematch" as any)}
                    </button>
                )}
                 <button onClick={() => sendAction("resign")} className="p-2 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-full transition-all active:scale-95">
                    <RotateCcw className="w-4 h-4 md:w-6 md:h-6 rotate-45" />
                 </button>
              </div>
           )}
           {mounted && (
                <button 
                  onClick={flipBoards} 
                  className="p-2 bg-white/5 hover:bg-white/10 transition-colors rounded-full border border-white/10 text-slate-400"
                  title="Flip Boards"
                >
                  <RotateCcw className="w-4 h-4 md:w-6 md:h-6" />
                </button>
           )}
           {videoAuthorized && (
                <button onClick={() => setShowVideo(!showVideo)} className={`p-2 rounded-full transition-all border ${showVideo ? 'bg-blue-500/20 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}>
                   {showVideo ? <Video className="w-4 h-4 md:w-6 md:h-6" /> : <VideoOff className="w-4 h-4 md:w-6 md:h-6" />}
                </button>
           )}
            <button onClick={() => setIsPanelOpen(true)} className="p-2 bg-white/5 hover:bg-white/10 transition-colors rounded-full border border-white/10 text-slate-400">
               <Settings className="w-4 h-4 md:w-6 md:h-6" />
           </button>
        </div>
      </header>

      {/* Desktop Split View: [Video Left] [Boards Center] [Video Right] */}
      <div className="max-w-[1800px] mx-auto w-full flex flex-col lg:flex-row gap-4 lg:gap-8 items-stretch flex-1">
        
        {/* Left Column (Video Board 0) - Desktop Only */}
        {showVideo && (
           <div className="hidden lg:flex w-[280px] flex-col gap-4 bg-black/20 border border-white/5 rounded-3xl p-4 shadow-2xl backdrop-blur-xl animate-in slide-in-from-left duration-500">
              <div className="flex items-center gap-2 uppercase tracking-[0.2em] text-[10px] font-black text-slate-500 mb-2 pl-1">
                 <Video className="w-3.5 h-3.5 text-blue-500"/> {t("board" as any)} 1
              </div>
              <VideoChat matchId={id} role={role} filterBoardIdx={0} />
           </div>
        )}

        {/* Center: Boards Container */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 items-start justify-center">
            {/* Board 0 */}
            <div className="flex flex-col gap-1 md:gap-4 w-full">
                <div className="flex justify-between items-center px-2 bg-white/5 rounded-t-xl py-1 border-x border-t border-white/5">
                    <div className="text-[9px] md:text-xs uppercase font-black text-slate-400">
                        {boardOrientation === 'white' ? getPlayerLabel('b' + myBoardIdx) : getPlayerLabel('w' + myBoardIdx)}
                    </div>
                    <div className={`text-xs md:text-lg font-mono font-bold transition-colors ${ (new Chess(myBoard?.fen).turn() === (boardOrientation === 'white' ? 'b' : 'w') ? (clocks as any)[(boardOrientation === 'white' ? 'b' : 'w') + myBoardIdx] : 0) < 10000 && (new Chess(myBoard?.fen).turn() === (boardOrientation === 'white' ? 'b' : 'w')) ? 'text-red-500' : (new Chess(myBoard?.fen).turn() === (boardOrientation === 'white' ? 'b' : 'w') ? 'text-white' : 'text-slate-500')}`}>
                        {formatTime(boardOrientation === 'white' ? (myBoardIdx === 0 ? clocks.b0 : clocks.b1) : (myBoardIdx === 0 ? clocks.w0 : clocks.w1))}
                    </div>
                </div>
                
                <div className="h-6 md:h-10 bg-white/5 rounded-lg flex items-center px-4 gap-2 overflow-x-auto min-h-0">
                   {(role.startsWith('w') ? myBankB : myBankW)?.map((p: string, i: number) => (
                       <span key={i} className="text-[10px] md:text-sm font-black text-slate-600">{p}</span>
                   ))}
                </div>

                <div className="aspect-square border-2 md:border-4 border-slate-900 rounded-lg md:rounded-xl overflow-hidden shadow-2xl relative mx-auto w-full max-w-[600px]">
                    <Chessboard 
                        options={{
                            id: `board-${myBoardIdx}-${boardOrientation}`,
                            position: myBoard?.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                            boardOrientation: boardOrientation,
                            darkSquareStyle: { backgroundColor: boardThemes[settings.boardTheme]?.dark || "#4d6d4d" },
                            lightSquareStyle: { backgroundColor: boardThemes[settings.boardTheme]?.light || "#f0f0f0" },
                            pieces: stableCustomPieces as any,
                            onPieceDrop: ((source: string, target: string, piece: string) => onDrop(myBoardIdx, source, target, piece)) as any,
                            onSquareClick: ((s: any) => onSquareClick(myBoardIdx, s)) as any,
                            allowDragging: (role !== "spectator") && !myBoard?.result && !selectedPiece
                        }}
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

                <div className="flex justify-between items-center px-2 bg-white/5 rounded-b-xl py-1 border-x border-b border-white/5">
                    <div className="text-[9px] md:text-xs uppercase font-black text-slate-400">
                        {boardOrientation === 'white' ? getPlayerLabel('w' + myBoardIdx) : getPlayerLabel('b' + myBoardIdx)}
                    </div>
                    <div className={`text-xs md:text-lg font-mono font-bold transition-colors ${ (new Chess(myBoard?.fen).turn() === (boardOrientation === 'white' ? 'w' : 'b') ? (clocks as any)[(boardOrientation === 'white' ? 'w' : 'b') + myBoardIdx] : 0) < 10000 && (new Chess(myBoard?.fen).turn() === (boardOrientation === 'white' ? 'w' : 'b')) ? 'text-red-500' : (new Chess(myBoard?.fen).turn() === (boardOrientation === 'white' ? 'w' : 'b') ? 'text-white' : 'text-slate-500')}`}>
                        {formatTime(boardOrientation === 'white' ? (myBoardIdx === 0 ? clocks.w0 : clocks.w1) : (myBoardIdx === 0 ? clocks.b0 : clocks.b1))}
                    </div>
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

            {/* Board 1 */}
            <div className="flex flex-col gap-1 md:gap-4 w-full">
                <div className="flex justify-between items-center px-2 bg-white/5 rounded-t-xl py-1 border-x border-t border-white/5">
                    <div className="text-[9px] md:text-xs uppercase font-black text-slate-400">
                        {partnerOrientation === 'white' ? getPlayerLabel('b' + partnerBoardIdx) : getPlayerLabel('w' + partnerBoardIdx)}
                    </div>
                    <div className={`text-xs md:text-lg font-mono font-bold transition-colors ${ (new Chess(partnerBoard?.fen).turn() === (partnerOrientation === 'white' ? 'b' : 'w') ? (clocks as any)[(partnerOrientation === 'white' ? 'b' : 'w') + partnerBoardIdx] : 0) < 10000 && (new Chess(partnerBoard?.fen).turn() === (partnerOrientation === 'white' ? 'b' : 'w')) ? 'text-red-500' : (new Chess(partnerBoard?.fen).turn() === (partnerOrientation === 'white' ? 'b' : 'w') ? 'text-white' : 'text-slate-500')}`}>
                        {formatTime(partnerOrientation === 'white' ? (partnerBoardIdx === 0 ? clocks.b0 : clocks.b1) : (partnerBoardIdx === 0 ? clocks.w0 : clocks.w1))}
                    </div>
                </div>

                <div className="h-6 md:h-10 bg-white/5 rounded-lg flex items-center px-4 gap-2 overflow-x-auto min-h-0">
                   {(role.startsWith('w') ? partnerBankW : partnerBankB)?.map((p: string, i: number) => (
                       <span key={i} className="text-[10px] md:text-sm font-black text-slate-600">{p}</span>
                   ))}
                </div>

                <div className="aspect-square border-2 md:border-4 border-slate-900 rounded-lg md:rounded-xl overflow-hidden shadow-2xl relative mx-auto w-full max-w-[600px] opacity-80 hover:opacity-100 transition-opacity">
                    <Chessboard 
                        options={{
                            id: `board-${partnerBoardIdx}-${partnerOrientation}`,
                            position: partnerBoard?.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                            boardOrientation: partnerOrientation,
                            darkSquareStyle: { backgroundColor: boardThemes[settings.boardTheme]?.dark || "#4d6d4d" },
                            lightSquareStyle: { backgroundColor: boardThemes[settings.boardTheme]?.light || "#f0f0f0" },
                            pieces: stableCustomPieces as any,
                            onPieceDrop: ((source: string, target: string, piece: string) => onDrop(partnerBoardIdx, source, target, piece)) as any,
                            onSquareClick: ((s: any) => onSquareClick(partnerBoardIdx, s)) as any,
                            allowDragging: (role !== "spectator") && !partnerBoard?.result && !selectedPiece
                        }}
                    />
                </div>

                <div className="flex justify-between items-center px-2 bg-white/5 rounded-b-xl py-1 border-x border-b border-white/5">
                    <div className="text-[9px] md:text-xs uppercase font-black text-slate-400">
                        {partnerOrientation === 'white' ? getPlayerLabel('w' + partnerBoardIdx) : getPlayerLabel('b' + partnerBoardIdx)}
                    </div>
                    <div className={`text-xs md:text-lg font-mono font-bold transition-colors ${ (new Chess(partnerBoard?.fen).turn() === (partnerOrientation === 'white' ? 'w' : 'b') ? (clocks as any)[(partnerOrientation === 'white' ? 'w' : 'b') + partnerBoardIdx] : 0) < 10000 && (new Chess(partnerBoard?.fen).turn() === (partnerOrientation === 'white' ? 'w' : 'b')) ? 'text-red-500' : (new Chess(partnerBoard?.fen).turn() === (partnerOrientation === 'white' ? 'w' : 'b') ? 'text-white' : 'text-slate-500')}`}>
                        {formatTime(partnerOrientation === 'white' ? (partnerBoardIdx === 0 ? clocks.w0 : clocks.w1) : (partnerBoardIdx === 0 ? clocks.b0 : clocks.b1))}
                    </div>
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

        {/* Right Column (Video Board 1) - Desktop Only */}
        {showVideo && (
           <div className="hidden lg:flex w-[280px] flex-col gap-4 bg-black/20 border border-white/5 rounded-3xl p-4 shadow-2xl backdrop-blur-xl animate-in slide-in-from-right duration-500">
              <div className="flex items-center justify-end gap-2 uppercase tracking-[0.2em] text-[10px] font-black text-slate-500 mb-2 pr-1">
                 {t("board" as any)} 2 <Video className="w-3.5 h-3.5 text-blue-500"/>
              </div>
              <VideoChat matchId={id} role={role} filterBoardIdx={1} />
           </div>
        )}
      </div>

      {/* MOBILE VIDEO - Adaptive Floating or Bottom area */}
      {showVideo && (
        <div className="lg:hidden mt-4 w-full h-[280px] bg-black/20 border border-white/5 rounded-3xl p-3 shadow-2xl backdrop-blur-xl group overflow-hidden relative">
           <VideoChat matchId={id} role={role} />
        </div>
      )}

      {/* Logs and Activity Bottom Section */}
      <div className="mt-8 max-w-[1400px] mx-auto w-full">
          <div className="flex flex-col bg-black/40 border border-white/5 rounded-3xl overflow-hidden h-[240px] shadow-2xl backdrop-blur-xl">
             <div className="px-5 py-3 border-b border-white/5 bg-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2 uppercase tracking-[0.2em] text-[10px] font-black text-slate-500">
                   <RotateCcw className="w-3.5 h-3.5 text-blue-500"/> Activity Logs
                </div>
             </div>
             <div className="flex-1 p-5 overflow-y-auto font-mono text-[11px] text-slate-400 space-y-1.5 scrollbar-thin scrollbar-thumb-white/10">
                {logs.map((l, i) => (
                    <div key={i} className={l.includes(":") ? "text-slate-200" : "text-slate-500 italic opacity-60"}>
                        {l}
                    </div>
                ))}
             </div>
             <form onSubmit={handleChatSubmit} className="p-3 bg-white/5 border-t border-white/5 flex gap-2">
                <input 
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type to chat..."
                    className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-blue-500/50 transition-all font-mono"
                />
             </form>
          </div>
      </div>
    </div>
  );
}
