"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Chess, Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { 
  ArrowLeft, 
  Activity, 
  ChevronLeft, 
  ChevronRight, 
  SkipBack, 
  SkipForward, 
  Archive, 
  Copy, 
  Timer, 
  User, 
  Swords, 
  Flag, 
  Zap, 
  MessageSquare, 
  Send,
  AlertCircle,
  Trophy,
  Activity as ActivityIcon,
  CheckCircle2
} from "lucide-react";
import { create, toBinary, fromBinary } from "@bufbuild/protobuf";
import { MatchUpdateSchema } from "@/proto/match_pb";
import { useTranslation } from "@/i18n";
import { useSettings, boardThemes } from "@/hooks/useSettings";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

export default function PlayArena() {
  const { id } = useParams() as { id: string };
  const searchParams = useSearchParams();
  const color = searchParams.get("color") || "white";
  const tcMode = searchParams.get("tc") || "3";
  const wName = searchParams.get("w") || "White";
  const bName = searchParams.get("b") || "Black";
  const router = useRouter();
  const { t } = useTranslation();
  const { settings, getPieceUrl } = useSettings();

  const isSpectator = color === "spectator";

  const [fen, setFen] = useState("start");
  const [status, setStatus] = useState("Connecting...");
  const [history, setHistory] = useState<string[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [clocks, setClocks] = useState({ white: 0, black: 0 });
  const [turn, setTurn] = useState<'w' | 'b'>('w');
  const [gameOver, setGameOver] = useState(false);
  const [gameResult, setGameResult] = useState<string | null>(null);
  const [gameReason, setGameReason] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [chat, setChat] = useState<{sender: string, text: string, time: string}[]>([]);
  const [message, setMessage] = useState("");
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [rematchState, setRematchState] = useState<"idle" | "offered" | "waiting">("idle");
  const [preMove, setPreMove] = useState<{from: string; to: string} | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{from: string; to: string; color: string} | null>(null);

  const gameRef = useRef(new Chess());
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, chat]);

  const logMessage = (msg: string) => {
      setLogs(prev => [...prev.slice(-49), msg]);
  };

  const updateGameState = () => {
      setFen(gameRef.current.fen());
      const newHistory = gameRef.current.history();
      setHistory(newHistory);
      setCurrentMoveIndex(newHistory.length - 1);
      setTurn(gameRef.current.turn());
      
      if (gameRef.current.isGameOver()) {
          setGameOver(true);
          if (gameRef.current.isCheckmate()) setGameResult(turn === 'w' ? "Black Wins" : "White Wins");
          else if (gameRef.current.isDraw()) setGameResult("Draw");
      }
  };

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const rawUrl = process.env.NEXT_PUBLIC_BACKEND_URL || (typeof window !== "undefined" ? window.location.hostname + ":8787" : "localhost:8787");
    let host = rawUrl;
    try {
      if (rawUrl.includes("://")) {
        host = new URL(rawUrl).host;
      }
    } catch (e) {}

    const ws = new WebSocket(`${protocol}//${host}/match/${id}?color=${color}`);
    wsRef.current = ws;
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      setStatus("Connected");
      logMessage("Successfully connected to game server.");
    };

    ws.onmessage = async (event) => {
      const data = new Uint8Array(event.data);
      try {
          const update = fromBinary(MatchUpdateSchema, data);
          if (update.event.case === "gameState") {
              const state = update.event.value;
              gameRef.current.load(state.fen);
              updateGameState();
              setClocks({
                  white: Number(state.whiteTime),
                  black: Number(state.blackTime)
              });
              setSpectatorCount(state.spectators || 0);
          }
          else if (update.event.case === "move") {
              const move = update.event.value;
              try {
                  gameRef.current.move(move.uci);
                  updateGameState();
              } catch(e) {}
          }
          else if (update.event.case === "gameOver") {
              const res = update.event.value;
              setGameOver(true);
              setGameResult(res.result);
              setGameReason(res.reason);
              logMessage(`Game Over: ${res.result} (${res.reason})`);
          }
          else if (update.event.case === "chat") {
             const c = update.event.value;
             setChat(prev => [...prev, { sender: c.sender, text: c.message, time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) }]);
          }
          else if (update.event.case === "rematchOffered") {
             setRematchState("offered");
             logMessage("Opponent offered a rematch!");
          }
      } catch (err) {
          console.error(err);
      }
    };

    ws.onclose = () => {
      setStatus("Disconnected");
      logMessage("WebSocket closed.");
    };

    return () => { ws.close(); };
  }, [id, color]);

  useEffect(() => {
     if (gameOver || clocks.white < 0) return;
     const turn = gameRef.current.turn();
     
     // Handle Pre-move
     if (turn === color[0] && preMove) {
         const { from, to } = preMove;
         const moveData: {from: string; to: string; promotion?: string} = { from, to };
         
         // Check if promotion is needed for pre-move
         const board = gameRef.current.board();
         const targetRank = parseInt(to[1]);
         const sourceRank = parseInt(from[1]);
         const fileIdx = from.charCodeAt(0) - 97;
         const piece = board[8 - sourceRank]?.[fileIdx];
         
         if (piece?.type === 'p' && (targetRank === 8 || targetRank === 1)) {
             moveData.promotion = 'q'; // Auto-queen for pre-moves
         }

         try {
             const move = gameRef.current.move(moveData);
             setPreMove(null);
             updateGameState();
             logMessage(`Pre-move Played: ${move.san}`);
             
             if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                const uci = from + to + (move.promotion || "");
                const update = create(MatchUpdateSchema, {
                    event: { case: "move", value: { matchId: id, uci: uci, timestamp: BigInt(Date.now()) } }
                });
                wsRef.current.send(toBinary(MatchUpdateSchema, update));
             }
         } catch(e) {
             // Pre-move invalid now
             setPreMove(null);
         }
     }

     const interval = setInterval(() => {
         setClocks(prev => ({
             white: turn === 'w' ? Math.max(0, prev.white - 100) : prev.white,
             black: turn === 'b' ? Math.max(0, prev.black - 100) : prev.black,
         }));
     }, 100);
     return () => clearInterval(interval);
  }, [gameOver, fen, clocks.white < 0, preMove]);

  function onDrop({ sourceSquare, targetSquare, piece }: { sourceSquare: string, targetSquare: string | null, piece: string }) {
    if (!targetSquare || gameOver) return false;
    
    // Disallow moves if user is previewing history
    if (currentMoveIndex !== history.length - 1) {
       logMessage("Skip to the current move to play!");
       return false;
    }

    const isMyTurn = gameRef.current.turn() === color[0];

    if (!isMyTurn) {
        // Record Pre-move only if enabled
        if (settings.enablePremove) {
            setPreMove({ from: sourceSquare, to: targetSquare });
        }
        return false;
    }

    try {
        const isPromotion = (piece === 'wP' && sourceSquare[1] === '7' && targetSquare[1] === '8') || 
                            (piece === 'bP' && sourceSquare[1] === '2' && targetSquare[1] === '1');
                            
        if (isPromotion) {
            setPendingPromotion({ from: sourceSquare, to: targetSquare, color: piece[0] });
            return true;
        }
    
        const move = gameRef.current.move({ from: sourceSquare, to: targetSquare });
        updateGameState();
        logMessage(`Played: ${move.san}`);

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            const uci = sourceSquare + targetSquare;
            const update = create(MatchUpdateSchema, {
                event: { case: "move", value: { matchId: id, uci: uci, timestamp: BigInt(Date.now()) } }
            });
            wsRef.current.send(toBinary(MatchUpdateSchema, update));
        }
        return true;
    } catch (e) {
        return false;
    }
  }

  const completePromotion = (promotionPiece: string) => {
      if (!pendingPromotion) return;
      const { from, to } = pendingPromotion;
      try {
          const move = gameRef.current.move({ from, to, promotion: promotionPiece });
          updateGameState();
          logMessage(`Played (Prom): ${move.san}`);
          
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              const uci = from + to + promotionPiece;
              const update = create(MatchUpdateSchema, {
                  event: { case: "move", value: { matchId: id, uci: uci, timestamp: BigInt(Date.now()) } }
              });
              wsRef.current.send(toBinary(MatchUpdateSchema, update));
          }
      } catch(e) {}
      setPendingPromotion(null);
  };

  const sendAction = (actionType: "resign" | "draw_offer" | "draw_accept" | "rematch") => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const update = create(MatchUpdateSchema, {
              event: { case: "action", value: { matchId: id, actionType: actionType, playerColor: color[0] } }
          });
          wsRef.current.send(toBinary(MatchUpdateSchema, update));
          logMessage(`Sent ${actionType}`);
      }
  }
  
  const handleRematch = () => {
      sendAction("rematch");
      setRematchState("waiting");
  }

  const handleSendMessage = () => {
      if (!message.trim()) return;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const update = create(MatchUpdateSchema, {
              event: { case: "chat", value: { matchId: id, sender: color === "white" ? wName : bName, message: message } }
          });
          wsRef.current.send(toBinary(MatchUpdateSchema, update));
          setMessage("");
      }
  };

  const formatTime = (ms: number) => {
      const s = Math.ceil(ms / 1000);
      const m = Math.floor(s / 60);
      return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  };

  const handleDownloadPGN = () => {
      gameRef.current.header(
          "White", color === 'white' ? wName : bName, 
          "Black", color === 'black' ? wName : bName, 
          "Result", gameResult || "*", 
          "TimeControl", tcMode === "Unlimited" ? "-" : tcMode + "m",
          "Date", new Date().toLocaleDateString()
      );
      const pgn = gameRef.current.pgn();
      const blob = new Blob([pgn], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `antigravity_${wName}_vs_${bName}_${id.substring(0,8)}.pgn`;
      a.click();
      URL.revokeObjectURL(url);
  };
  
  const handleCopyPGN = () => {
      gameRef.current.header(
          "White", color === 'white' ? wName : bName, 
          "Black", color === 'black' ? wName : bName, 
          "Result", gameResult || "*", 
          "TimeControl", tcMode === "Unlimited" ? "-" : tcMode + "m",
          "Date", new Date().toLocaleDateString()
      );
      const pgn = gameRef.current.pgn();
      navigator.clipboard.writeText(pgn).then(() => {
          logMessage("✅ PGN copied to clipboard!");
      });
  };

  const goToMove = (index: number) => {
      if (index < -1 || index >= history.length) return;
      const engine = new Chess();
      for(let i = 0; i <= index; i++) {
         engine.move(history[i]);
      }
      setCurrentMoveIndex(index);
      setFen(engine.fen());
  };


  const piecesLabels = ["wP", "wN", "wB", "wR", "wQ", "wK", "bP", "bN", "bB", "bR", "bQ", "bK"];
  const customPieces = Object.fromEntries(
    piecesLabels.map(p => [p, ({ squareWidth }: any) => (
      <img src={getPieceUrl(p)} style={{ width: squareWidth, height: squareWidth }} alt={p} />
    )])
  );

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8 relative">

        <header className="flex justify-between items-center mb-6 lg:mb-10 px-4 z-10 max-w-7xl mx-auto w-full">
            <div className="flex items-center gap-3">
              <Link href="/" className="p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors mr-2">
                <ChevronLeft className="w-6 h-6" />
              </Link>
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-2xl backdrop-blur-md">
                <Zap className="w-6 h-6 text-blue-400 animate-pulse" />
                <div>
                    <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-300">{t("arena_title")}</h1>
                    <span className="text-xs font-mono text-gray-500">ID: {id.substring(0, 8)}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
               {spectatorCount > 0 && (
                   <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-900/20 border border-emerald-500/20 text-emerald-400 font-mono text-xs shadow-inner">
                       <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                       {spectatorCount} {spectatorCount === 1 ? 'spectator' : 'spectators'}
                   </div>
               )}
               <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono text-xs md:text-sm border backdrop-blur-md
                   ${status.includes('Connected') || status.includes(t("status_connected")) ? 'bg-emerald-900/10 text-emerald-400 border-emerald-500/20' : 'bg-red-900/10 text-red-400 border-red-500/20'}`}>
                   <ActivityIcon className="w-4 h-4" />
                   <span>{status === 'Connected' ? t("status_connected") : status === 'Disconnected' ? t("status_disconnected") : status}</span>
               </div>
            </div>
        </header>

        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10 z-10 relative">
            
            <div className="lg:col-span-2 flex flex-col p-2 relative">
                
                {/* Result Announcement Strip */}
                <AnimatePresence>
                   {gameOver && (
                        <motion.div 
                          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
                          className="w-full bg-slate-900/80 border border-slate-700/80 rounded-2xl p-4 mb-4 flex justify-between items-center shadow-xl backdrop-blur-xl"
                        >
                            <div className="flex items-center gap-4">
                               <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                               <div>
                                   <h2 className="text-xl font-black text-white">{gameResult}</h2>
                                   <p className="text-emerald-400/80 font-mono text-xs uppercase tracking-widest">{gameReason}</p>
                               </div>
                            </div>
                        </motion.div>
                   )}
                </AnimatePresence>

                {/* Opponent Info Banner */}
                <div className="w-full max-w-[min(650px,60vh)] md:max-w-[min(650px,65vh)] mx-auto flex items-center justify-between bg-slate-900/50 border border-slate-800 border-b-0 px-4 py-2 rounded-t-2xl">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-400">
                           {color === 'white' ? bName[0]?.toUpperCase() : wName[0]?.toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-300">
                           {color === 'white' ? bName : wName}
                        </span>
                    </div>
                    <div className={`font-mono font-black text-3xl tracking-tighter ${
                        (color === 'white' ? clocks.black : clocks.white) < 10000 && (color === 'white' ? clocks.black : clocks.white) >= 0
                            ? 'text-red-500 animate-pulse' 
                            : 'text-white'
                    }`}>
                        {formatTime(color === 'white' ? clocks.black : clocks.white)}
                    </div>
                </div>

                <div className="w-full max-w-[min(650px,60vh)] md:max-w-[min(650px,65vh)] mx-auto aspect-square relative border-4 border-slate-800 shadow-2xl rounded-sm overflow-hidden">
                    <Chessboard 
                        options={{
                            position: fen, 
                            onPieceDrop: onDrop as any,
                            boardOrientation: isSpectator ? "white" : color as any,
                            darkSquareStyle: { backgroundColor: boardThemes[settings.boardTheme].dark },
                            lightSquareStyle: { backgroundColor: boardThemes[settings.boardTheme].light },
                            animationDurationInMs: 200,
                            allowDragging: !isSpectator,
                            showNotation: settings.showCoordinates,
                            pieces: customPieces as any
                        }}
                    />

                    {/* Promotion Selection Dialog */}
                    <AnimatePresence>
                        {pendingPromotion && (
                            <motion.div 
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-8"
                            >
                                <div className="bg-[var(--settings-bg)] border border-[var(--surface-border)] p-8 rounded-[2rem] shadow-2xl flex flex-col items-center gap-8">
                                    <h3 className="text-xl font-black text-[var(--text-primary)] tracking-widest uppercase">{t("promotion_title") || "PROMOTE PIECE"}</h3>
                                    <div className="flex gap-4">
                                        {['q', 'r', 'b', 'n'].map((p) => (
                                            <button 
                                                key={p}
                                                onClick={() => completePromotion(p)}
                                                className="w-20 h-20 bg-[var(--button-bg)] hover:bg-[var(--brand-primary)]/10 border border-[var(--surface-border)] rounded-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 group shadow-lg"
                                            >
                                                <img 
                                                    src={getPieceUrl(`${pendingPromotion.color}${p.toUpperCase()}`)} 
                                                    alt={p} 
                                                    className="w-14 h-14 object-contain group-hover:drop-shadow-[0_0_12px_rgba(59,130,246,0.5)]"
                                                />
                                            </button>
                                        ) as any)}
                                    </div>
                                    <button 
                                        onClick={() => setPendingPromotion(null)}
                                        className="text-[var(--text-muted)] hover:text-[var(--brand-primary)] text-sm font-bold mt-2 uppercase tracking-widest transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Pre-move Indicator */}
                    {preMove && (
                        <div className="absolute top-4 right-4 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse shadow-lg z-10 border border-red-400">
                            PREMOVE SET (CLICK TO CANCEL)
                        </div>
                    )}
                </div>
                
                {/* Bottom Player (You) Info Banner */}
                <div className="w-full max-w-[min(650px,60vh)] md:max-w-[min(650px,65vh)] mx-auto flex items-center justify-between bg-slate-900/50 border border-slate-800 border-t-0 px-4 py-2 rounded-b-2xl">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-900/50 border border-blue-500/30 flex items-center justify-center font-bold text-blue-400">
                           {color === 'white' ? wName[0]?.toUpperCase() : bName[0]?.toUpperCase()}
                        </div>
                        <span className="font-bold text-white">
                           {color === 'white' ? wName : bName} (You)
                        </span>
                    </div>
                    <div className={`font-mono font-black text-3xl tracking-tighter ${
                        (color === 'white' ? clocks.white : clocks.black) < 10000 && (color === 'white' ? clocks.white : clocks.black) >= 0
                            ? 'text-red-500 animate-pulse' 
                            : 'text-white'
                    }`}>
                        {formatTime(color === 'white' ? clocks.white : clocks.black)}
                    </div>
                </div>
                
                {/* Board Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 max-w-[min(650px,60vh)] md:max-w-[min(650px,65vh)] mx-auto w-full">
                    <div className="flex items-center gap-1 bg-slate-900/80 border border-slate-700/80 px-2 py-1 rounded-full flex-shrink-0">
                        <button onClick={() => goToMove(-1)} disabled={currentMoveIndex === -1} className="p-2 hover:bg-slate-800 rounded-full disabled:opacity-30"><SkipBack className="w-4 h-4"/></button>
                        <button onClick={() => goToMove(currentMoveIndex - 1)} disabled={currentMoveIndex === -1} className="p-2 hover:bg-slate-800 rounded-full disabled:opacity-30"><ChevronLeft className="w-5 h-5"/></button>
                        <span className="font-mono text-xs font-bold w-12 text-center text-blue-400">{currentMoveIndex + 1}/{history.length}</span>
                        <button onClick={() => goToMove(currentMoveIndex + 1)} disabled={currentMoveIndex === history.length - 1} className="p-2 hover:bg-slate-800 rounded-full disabled:opacity-30"><ChevronRight className="w-5 h-5"/></button>
                        <button onClick={() => goToMove(history.length - 1)} disabled={currentMoveIndex === history.length - 1} className="p-2 hover:bg-slate-800 rounded-full disabled:opacity-30"><SkipForward className="w-4 h-4"/></button>
                    </div>

                    {gameOver && (
                        <div className="flex flex-wrap items-center justify-end gap-2 w-full">
                            {!isSpectator && (
                                rematchState === "waiting" ? (
                                    <span className="bg-slate-800 border border-slate-700 text-slate-400 px-5 py-2.5 rounded-full text-sm font-bold animate-pulse">
                                        {t("rematch_wait")}
                                    </span>
                                ) : (
                                    <button onClick={handleRematch} className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold transition-all shadow-lg text-sm
                                        ${rematchState === "offered" ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-500/30' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/30'}`}>
                                        <Swords className="w-4 h-4" /> 
                                        {rematchState === "offered" ? t("rematch_offered") : t("rematch")}
                                    </button>
                                )
                            )}
                            
                            <button onClick={handleDownloadPGN} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-full border border-slate-700 text-sm font-bold transition-all shadow-lg shadow-black/30 whitespace-nowrap">
                                <Archive className="w-4 h-4" /> {t("download_pgn")}
                            </button>
                            
                            <button onClick={handleCopyPGN} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-full border border-slate-700 text-sm font-bold transition-all shadow-lg shadow-black/30 whitespace-nowrap">
                                <Copy className="w-4 h-4" /> {t("copy_pgn")}
                            </button>
                        </div>
                    )}
                    
                    {!gameOver && !isSpectator && (
                        <div className="flex items-center gap-2">
                            <button onClick={() => sendAction("draw_offer")} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2.5 rounded-full border border-slate-700 text-xs font-bold transition-all shadow-lg uppercase tracking-wider">
                                ½ Draw
                            </button>
                            <button onClick={() => sendAction("resign")} className="flex items-center gap-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 px-4 py-2.5 rounded-full border border-red-500/20 text-xs font-bold transition-all shadow-lg uppercase tracking-wider">
                                <Flag className="w-4 h-4" /> Resign
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Sidebar with Stats & Chat */}
            <div className="flex flex-col gap-6">
                
                {/* Move Logs Panel */}
                <div className="bg-slate-900/60 border border-white/5 rounded-3xl overflow-hidden flex flex-col h-[300px] shadow-2xl backdrop-blur-xl">
                    <div className="px-5 py-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2 uppercase tracking-[0.2em] text-[10px] font-black text-slate-500">
                           <ActivityIcon className="w-3 h-3"/> Move Log
                        </div>
                    </div>
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1.5 scrollbar-thin scrollbar-thumb-white/10">
                        {logs.map((log, i) => (
                            <div key={i} className={`flex gap-2 ${log.startsWith('Played') ? 'text-blue-400' : 'text-slate-500'}`}>
                                <span className="opacity-30">[{i+1}]</span>
                                {log}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Chat Panel */}
                <div className="bg-slate-900/60 border border-white/5 rounded-3xl overflow-hidden flex flex-col h-[350px] shadow-2xl backdrop-blur-xl">
                    <div className="px-5 py-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
                         <div className="flex items-center gap-2 uppercase tracking-[0.2em] text-[10px] font-black text-slate-500">
                           <MessageSquare className="w-3 h-3"/> {t("chat")}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10">
                        {chat.map((msg, i) => (
                            <div key={i} className={`flex flex-col ${msg.sender === (color === 'white' ? wName : bName) ? 'items-end' : 'items-start'}`}>
                                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${msg.sender === (color === 'white' ? wName : bName) ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
                                    {msg.text}
                                </div>
                                <span className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-widest">{msg.sender} • {msg.time}</span>
                            </div>
                        ))}
                        {chat.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center opacity-20 gap-2">
                                <MessageSquare className="w-10 h-10" />
                                <p className="text-xs font-bold uppercase tracking-widest">{t("no_messages")}</p>
                            </div>
                        )}
                    </div>
                    <div className="p-3 bg-white/5 border-t border-white/5 flex gap-2">
                        <input 
                            type="text" 
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                            placeholder="Send message..."
                            className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                        />
                        <button onClick={handleSendMessage} className="bg-blue-600 hover:bg-blue-500 p-2 rounded-xl transition-all shadow-lg active:scale-95">
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="bg-blue-900/5 border border-blue-500/10 rounded-2xl p-4 flex flex-col gap-2">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-500/60">Match Info</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                        Match is running on <b>Antigravity Edge</b>. 
                        In case of connection failure, the game will attempt to reconnect automatically.
                    </p>
                </div>
            </div>
        </div>
    </div>
  );
}
