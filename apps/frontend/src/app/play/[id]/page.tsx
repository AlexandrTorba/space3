"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldAlert, Zap, Activity, CheckCircle2, Flag, Handshake, SkipBack, ChevronLeft, ChevronRight, SkipForward, Server, Archive, Swords, Database, Copy } from "lucide-react";
import { MatchUpdateSchema } from "@antigravity/contracts";
import { fromBinary, toBinary, create } from "@bufbuild/protobuf";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/i18n";
import { useSettings, boardThemes, backgroundGradients } from "@/hooks/useSettings";

export default function Play() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const searchParams = useSearchParams();
  const color = searchParams.get("color") || "white";
  const tcMode = searchParams.get("tc") || "3";
  const wName = decodeURIComponent(searchParams.get("w") || "White");
  const bName = decodeURIComponent(searchParams.get("b") || "Black");
  const { t } = useTranslation();
  const { settings, getPieceUrl } = useSettings();
  
  const wsRef = useRef<WebSocket | null>(null);
  const isSpectator = color === "spectator";
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [status, setStatus] = useState("Connecting...");
  const [logs, setLogs] = useState<{ id: number; text: string; time: string }[]>([]);
  const logId = useRef(0);
  
  const [rematchState, setRematchState] = useState<"none" | "offered" | "waiting">("none");

  const [drawOfferedBy, setDrawOfferedBy] = useState<"w" | "b" | null>(null);
  
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [clocks, setClocks] = useState({ white: -1, black: -1 });

  const [preMove, setPreMove] = useState<{from: string; to: string; promotion?: string} | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{from: string; to: string; color: string} | null>(null);

  const formatTime = (ms: number) => {
      if (ms < 0) return "∞";
      const totalSeconds = Math.ceil(ms / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  const [history, setHistory] = useState<string[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);

  const [gameOver, setGameOver] = useState(false);
  const [gameResult, setGameResult] = useState<string | null>(null);
  const [gameReason, setGameReason] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"moves" | "logs">("moves");

  const [evaluation, setEvaluation] = useState<string>("0.0");
  const sfWorker = useRef<Worker | null>(null);

  const logMessage = (text: string) => {
    logId.current++;
    setLogs((prev) => [{ id: logId.current, text, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 50));
  };

  const updateGameState = () => {
     setFen(gameRef.current.fen());
     const newHistory = gameRef.current.history();
     setHistory(newHistory);
     setCurrentMoveIndex(newHistory.length - 1);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
       sfWorker.current = new Worker("/stockfish.js");
       sfWorker.current.onmessage = (e) => {
          const line = e.data;
          if (line.includes("score cp ")) {
             const match = line.match(/score cp (-?\d+)/);
             if (match) {
                let score = parseInt(match[1], 10) / 100;
                if (gameRef.current.turn() === 'b') score = -score;
                setEvaluation(score > 0 ? `+${score.toFixed(1)}` : score.toFixed(1));
             }
          }
          if (line.includes("score mate ")) {
             const match = line.match(/score mate (-?\d+)/);
             if (match) {
                let mate = parseInt(match[1], 10);
                if (gameRef.current.turn() === 'b') mate = -mate;
                setEvaluation(`M${mate}`);
             }
          }
       };
       sfWorker.current.postMessage("uci");
    }
    return () => sfWorker.current?.terminate();
  }, []);

  useEffect(() => {
     if (sfWorker.current) {
        sfWorker.current.postMessage("stop");
        sfWorker.current.postMessage(`position fen ${fen}`);
        sfWorker.current.postMessage("go depth 14");
     }
  }, [fen]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const rawUrl = process.env.NEXT_PUBLIC_BACKEND_URL || (typeof window !== "undefined" ? window.location.hostname + ":8787" : "localhost:8787");
    let host = rawUrl;
    try {
      if (rawUrl.includes("://")) {
        host = new URL(rawUrl).host;
      }
    } catch (e) {}
    const wParam = encodeURIComponent(wName);
    const bParam = encodeURIComponent(bName);
    const ws = new WebSocket(`${protocol}//${host}/match/${id}?tc=${encodeURIComponent(tcMode)}&w=${wParam}&b=${bParam}`);
    
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus(`Connected (${color})`);
      logMessage(`Joined match ${id} as ${color}`);
    };

    ws.onmessage = async (event) => {
      try {
        const buffer = event.data instanceof Blob 
           ? new Uint8Array(await event.data.arrayBuffer()) 
           : new Uint8Array(event.data);
           
        const matchUpdate = fromBinary(MatchUpdateSchema, buffer);
        
        if (matchUpdate.event.case === "move") {
           const uci = matchUpdate.event.value.uci;
           logMessage(`Incoming Move: ${uci}`);
           
           try {
              const from = uci.substring(0, 2);
              const to = uci.substring(2, 4);
              const promotion = uci.length > 4 ? uci[4] : undefined;
              
              // Only apply if we are synced to the latest move
              if (currentMoveIndex === history.length - 1) {
                  gameRef.current.move({ from, to, promotion });
                  updateGameState();
              } else {
                  // We are reviewing history, we must skip to end before applying logic implicitly
                  // But safely applying it directly to engine
                  gameRef.current.move({ from, to, promotion });
                  setHistory(gameRef.current.history());
              }

              // Clear pre-move if it was played or becomes invalid
              setPreMove(prev => {
                  if (!prev) return null;
                  // Wait a bit to check if it's still our turn and if pre-move is valid
                  return prev;
              });
           } catch(e) {}
        }
        else if (matchUpdate.event.case === "status") {
           const info = matchUpdate.event.value;
           
           if (!info.isActive) {
               setGameOver(true);
               setGameResult(info.result);
               setGameReason(info.reason);
               logMessage(`Game Over! ${info.result} (${info.reason})`);
           }
           
           if (info.whiteTimeMs !== undefined && info.blackTimeMs !== undefined) {
               setClocks({ white: info.whiteTimeMs, black: info.blackTimeMs });
           }
           
           if (info.spectators !== undefined) {
               setSpectatorCount(info.spectators);
           }

           // Sync FEN last as it controls ticking updates!
           if (info.fen && info.fen !== gameRef.current.fen()) {
               gameRef.current.load(info.fen);
               updateGameState();
           }
        }
        else if (matchUpdate.event.case === "action") {
           const action = matchUpdate.event.value;
           
           if (action.actionType === "rematch") {
               setRematchState("offered");
           }
           else if (action.actionType === "rematch_accept") {
               const newMatchId = action.matchId;
               const swpColor = color === 'white' ? 'black' : 'white';
               logMessage(`Rematch accepted! Diverting to ${newMatchId.substring(0,6)}...`);
               setTimeout(() => {
                   router.push(`/play/${newMatchId}?color=${swpColor}&tc=${encodeURIComponent(tcMode)}&w=${encodeURIComponent(wName)}&b=${encodeURIComponent(bName)}`);
               }, 300);
           }
           else if (action.actionType === "draw_offer") {
              setDrawOfferedBy(action.playerColor as "w" | "b");
              logMessage(`${action.playerColor === 'w' ? 'White' : 'Black'} offered a draw.`);
           }
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
         const piece = board[parseInt(from[1]) === 1 ? 7 - (parseInt(from[1])-1) : 8 - parseInt(from[1])]?.[from.charCodeAt(0) - 97];
         // Simple check: is it a pawn moving to last rank?
         const isPawn = gameRef.current.get(from as any)?.type === 'p';
         const isPromotion = isPawn && (to[1] === '8' || to[1] === '1');
         
         if (isPromotion) moveData.promotion = "q"; // Default for pre-move for now, or we can improve later

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


  const pieces = ["wP", "wN", "wB", "wR", "wQ", "wK", "bP", "bN", "bB", "bR", "bQ", "bK"];
  const customPieces = Object.fromEntries(
    pieces.map(p => [p, ({ squareWidth }: any) => (
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
                   <Activity className="w-4 h-4" />
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

                            {/* Engine Request Area */}
                            <div className="hidden sm:block">
                                <span className="bg-emerald-900/20 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-bold">
                                    {t("match_synced")}
                                </span>
                            </div>
                        </motion.div>
                   )}
                </AnimatePresence>

                {/* Top Player (Opponent) Info Banner */}
                <div className="w-full max-w-[min(650px,60vh)] md:max-w-[min(650px,65vh)] mx-auto flex items-center justify-between bg-slate-900/50 border border-slate-800 px-4 py-2 mt-2 lg:mt-0 rounded-t-2xl">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-400">
                           {color === 'white' ? bName[0]?.toUpperCase() : wName[0]?.toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-300">
                           {color === 'white' ? bName : wName}
                        </span>
                        {/* Status Eval indicator */}
                        <span className={`text-xs ml-4 font-mono font-bold tracking-wider ${evaluation.startsWith('+') || evaluation.startsWith('M') && !evaluation.startsWith('M-') ? 'text-white' : 'text-slate-500'}`}>
                            EVAL: {evaluation}
                        </span>
                    </div>
                    <div className={`font-mono font-black text-2xl tracking-tighter ${
                        (color === 'white' ? clocks.black : clocks.white) < 10000 && (color === 'white' ? clocks.black : clocks.white) >= 0
                            ? 'text-red-500 animate-pulse' 
                            : 'text-slate-300'
                    }`}>
                        {formatTime(color === 'white' ? clocks.black : clocks.white)}
                    </div>
                </div>

                <div className="w-full max-w-[min(650px,60vh)] md:max-w-[min(650px,65vh)] mx-auto aspect-square overflow-hidden shadow-[0_0_50px_rgba(59,130,246,0.15)] border-4 border-slate-800 bg-black/50 p-1 lg:p-2 backdrop-blur-xl relative">
                    <Chessboard 
                        options={{
                            position: fen, 
                            onPieceDrop: onDrop as any,
                            boardOrientation: color as "white" | "black",
                            darkSquareStyle: { backgroundColor: boardThemes[settings.boardTheme].dark },
                            lightSquareStyle: { backgroundColor: boardThemes[settings.boardTheme].light },
                            dropSquareStyle: { boxShadow: "inset 0 0 1px 6px rgba(96, 165, 250, 0.5)" },
                            animationDurationInMs: 150,
                            allowDragging: !gameOver && currentMoveIndex === history.length - 1,
                            onSquareClick: () => setPreMove(null),
                            arrows: preMove ? [{ startSquare: preMove.from, endSquare: preMove.to, color: 'red' }] : [],
                            pieces: customPieces as any,
                            showNotation: settings.showCoordinates
                        }}
                    />
                    
                    {/* Promotion Selection Dialog */}
                    <AnimatePresence>
                        {pendingPromotion && (
                            <motion.div 
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                className="absolute inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-8"
                            >
                                <div className="bg-slate-900 border border-white/10 p-6 rounded-3xl shadow-2xl flex flex-col items-center gap-6">
                                    <h3 className="text-xl font-bold text-white tracking-widest">{t("promotion_title") || "PROMOTE PIECE"}</h3>
                                    <div className="flex gap-4">
                                        {['q', 'r', 'b', 'n'].map((p) => (
                                            <button 
                                                key={p}
                                                onClick={() => completePromotion(p)}
                                                className="w-16 h-16 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 group"
                                            >
                                                <img 
                                                    src={`/pieces/${pendingPromotion.color}${p.toUpperCase()}.png`} 
                                                    alt={p} 
                                                    className="w-12 h-12 object-contain group-hover:drop-shadow-[0_0_8px_white]"
                                                    onError={(e) => {
                                                        // Fallback if images don't exist
                                                        (e.target as any).src = `https://chessboardjs.com/img/chesspieces/wikipedia/${pendingPromotion.color}${p.toUpperCase()}.png`;
                                                    }}
                                                />
                                            </button>
                                        ) as any)}
                                    </div>
                                    <button 
                                        onClick={() => setPendingPromotion(null)}
                                        className="text-slate-500 hover:text-white text-sm font-bold mt-2"
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
                    {/* Only show playback controls actively easily if game over OR user wants to scroll */}
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
                            
                            <Link href="/" className="flex items-center gap-2 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 px-5 py-2.5 rounded-full border border-emerald-500/30 text-sm font-bold transition-all shadow-lg shadow-emerald-500/10 whitespace-nowrap">
                                <Zap className="w-4 h-4" /> {t("new_match")}
                            </Link>
                        </div>
                    )}

                    {!gameOver && !isSpectator && (
                        <div className="flex items-center justify-end gap-2 w-full flex-wrap">
                            <button onClick={() => sendAction("resign")} className="flex items-center justify-center gap-2 bg-red-900/50 hover:bg-red-800/80 text-red-300 px-4 py-2 flex-1 sm:flex-none rounded-full border border-red-500/20 text-sm font-semibold transition-all">
                                <Flag className="w-4 h-4" /> {t("resign")}
                            </button>
                            <button onClick={() => sendAction("draw_offer")} disabled={drawOfferedBy === color[0]} className="flex items-center justify-center gap-2 bg-slate-800/50 hover:bg-slate-700/80 disabled:opacity-50 text-slate-300 px-4 py-2 flex-1 sm:flex-none rounded-full border border-slate-600/50 text-sm font-semibold transition-all">
                                <Handshake className="w-4 h-4" /> {t("offer_draw")}
                            </button>
                            {drawOfferedBy && drawOfferedBy !== color[0] && (
                                <button onClick={() => sendAction("draw_accept")} className="bg-blue-900/50 hover:bg-blue-800/80 text-blue-300 px-4 py-2 flex-1 sm:flex-none rounded-full border border-blue-500/20 text-sm font-semibold transition-all animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                                    {t("accept_draw")}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Sidebar (Moves & Logs Tabs) */}
            <div className="bg-[#111827]/60 border border-white/10 rounded-3xl p-6 flex flex-col h-[600px] backdrop-blur-xl shadow-2xl">
                
                <div className="flex gap-4 border-b border-white/10 mb-4 pb-2">
                    <button onClick={() => setActiveTab('moves')} className={`pb-2 text-sm font-bold uppercase tracking-widest ${activeTab === 'moves' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-500 hover:text-slate-400'}`}>{t("moves")}</button>
                    <button onClick={() => setActiveTab('logs')} className={`pb-2 text-sm font-bold uppercase tracking-widest ${activeTab === 'logs' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-500 hover:text-slate-400'}`}>{t("net_ops")}</button>
                </div>

                {activeTab === 'moves' && (
                    <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 pr-2">
                        <div className="flex flex-col gap-1">
                            {Array.from({ length: Math.ceil(history.length / 2) }).map((_, i) => {
                                const wIndex = i * 2;
                                const bIndex = wIndex + 1;
                                const wMove = history[wIndex];
                                const bMove = history[bIndex];
                                
                                return (
                                    <div key={i} className="grid grid-cols-7 text-sm font-mono rounded overflow-hidden">
                                        <div className="col-span-1 flex items-center justify-center bg-slate-800/50 text-slate-500 py-1">{i + 1}.</div>
                                        <div onClick={() => goToMove(wIndex)} className={`col-span-3 px-3 py-1 cursor-pointer transition-colors ${currentMoveIndex === wIndex ? 'bg-blue-600 font-bold text-white' : 'hover:bg-slate-800 text-slate-300'}`}>
                                            {wMove}
                                        </div>
                                        <div onClick={() => goToMove(bIndex)} className={`col-span-3 px-3 py-1 cursor-pointer transition-colors ${!bMove ? '' : currentMoveIndex === bIndex ? 'bg-blue-600 font-bold text-white' : 'hover:bg-slate-800 text-slate-300'}`}>
                                            {bMove || ""}
                                        </div>
                                    </div>
                                );
                            })}
                            {history.length === 0 && <div className="text-slate-500 text-center mt-10">{t("no_moves")}</div>}
                        </div>
                    </div>
                )}

                {activeTab === 'logs' && (
                    <div className="flex-1 overflow-y-auto pr-2 space-y-3 scrollbar-thin scrollbar-thumb-white/10">
                        {logs.map(log => (
                            <div key={log.id} className="text-xs font-mono bg-white/5 p-3 rounded-xl border border-white/5">
                                <span className="text-blue-400/80 mb-1 block">[{log.time}]</span>
                                <span className="text-gray-300 leading-relaxed font-semibold">{log.text}</span>
                            </div>
                        ))}
                    </div>
                )}
                
            </div>
        </div>
    </div>
  );
}
