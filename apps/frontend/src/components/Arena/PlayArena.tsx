"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Chess, Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import { 
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
  AlertCircle,
  Trophy,
  CheckCircle,
  Settings,
  RotateCcw,
  Video,
  VideoOff
} from "lucide-react";
import VideoChat from "./VideoChat";
import { useSettingsContext } from "@/providers/SettingsProvider";
import { create, toBinary, fromBinary } from "@bufbuild/protobuf";
import { MatchUpdateSchema } from "@antigravity/contracts";
import { useTranslation } from "@/i18n";
import { useSettings, boardThemes } from "@/hooks/useSettings";
import Link from "next/link";

const piecesLabels = ["wP", "wN", "wB", "wR", "wQ", "wK", "bP", "bN", "bB", "bR", "bQ", "bK"];

// Stable piece component factory
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


function PlayArenaContent() {
  const [mounted, setMounted] = useState(false);
  const params = useParams();
  const searchParams = useSearchParams();
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const id = params?.id as string;
  const color = searchParams ? (searchParams.get("color") || "white") : "white";
  const tcMode = searchParams ? (searchParams.get("tc") || "3") : "3";
  const wName = searchParams ? (searchParams.get("w") || "Гравець 1") : "Гравець 1";
  const bName = searchParams ? (searchParams.get("b") || "Гравець 2") : "Гравець 2";
  const router = useRouter();
  const { t } = useTranslation();
  const { settings, getPieceUrl } = useSettings();
  const { setIsPanelOpen } = useSettingsContext();
  getPieceUrlRef.current = getPieceUrl;

  const isSpectator = color === "spectator";

  const [fen, setFen] = useState("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
  const [status, setStatus] = useState("Connecting...");
  const [history, setHistory] = useState<string[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const initialTime = tcMode === "Unlimited" ? -1 : (parseInt(tcMode, 10) || 3) * 60 * 1000;
  const [clocks, setClocks] = useState({ white: initialTime, black: initialTime });
  const [turn, setTurn] = useState<'w' | 'b'>('w');

  const [gameOver, setGameOver] = useState(false);
  const [gameResult, setGameResult] = useState<string | null>(null);
  const [gameReason, setGameReason] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [rematchState, setRematchState] = useState<"idle" | "offered" | "waiting">("idle");
  const [preMove, setPreMove] = useState<{from: string; to: string} | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{from: string; to: string; color: string} | null>(null);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">(color === "black" ? "black" : "white");
  const [showVideo, setShowVideo] = useState(false);
  const [videoAuthorized, setVideoAuthorized] = useState(false);
  const [chatInput, setChatInput] = useState("");

  const gameRef = useRef(new Chess());
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const flipBoard = () => {
      setBoardOrientation(prev => prev === "white" ? "black" : "white");
  };

  const logMessage = (msg: string) => {
      setLogs(prev => [...prev.slice(-49), msg]);
  };

  const updateGameState = (forceIndexUpdate = false) => {
      const isAtEnd = currentMoveIndex === history.length - 1;
      setFen(gameRef.current.fen());
      const newHistory = gameRef.current.history();
      setHistory(newHistory);
      
      if (forceIndexUpdate || isAtEnd || currentMoveIndex === -1) {
          setCurrentMoveIndex(newHistory.length - 1);
      }
      setTurn(gameRef.current.turn());
      
      if (gameRef.current.isGameOver()) {
          setGameOver(true);
          if (gameRef.current.isCheckmate()) setGameResult(turn === 'w' ? "Black Wins" : "White Wins");
          else if (gameRef.current.isDraw()) setGameResult("Draw");
      }
  };

  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (!mounted || !id) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const rawUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" ? window.location.hostname + ":8787" : "localhost:8787");
    let host = rawUrl;
    try {
      if (rawUrl.includes("://")) {
        host = new URL(rawUrl).host;
      }
    } catch (e) {}

    const wsUrl = `${protocol}//${host}/match/${id}?color=${color}&tc=${encodeURIComponent(tcMode)}&w=${encodeURIComponent(wName)}&b=${encodeURIComponent(bName)}`;
    
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("Connected");
    };

    ws.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'video_enabled') {
            setVideoAuthorized(data.enabled);
          }
        } catch(e) {}
        return;
      }
      if (!(event.data instanceof ArrayBuffer)) return;
      const data = new Uint8Array(event.data);
      try {
          const update = fromBinary(MatchUpdateSchema, data);
          if (update.event.case === "status") {
              const state = update.event.value;
              gameRef.current.load(state.fen);
              updateGameState(true);
              setClocks({
                  white: Number(state.whiteTimeMs),
                  black: Number(state.blackTimeMs)
              });
              setSpectatorCount(state.spectators || 0);

              if (!state.isActive) {
                  setGameOver(true);
                  setGameResult(state.result);
                  setGameReason(state.reason);
                  logMessage(`Game Over: ${state.result} (${state.reason})`);
              }
          }
          else if (update.event.case === "move") {
              const move = update.event.value;
              try {
                  gameRef.current.move(move.uci);
                  updateGameState(true);
              } catch(e) {}
          }
          else if (update.event.case === "action") {
             const action = update.event.value;
             if (action.actionType === "rematch") {
                setRematchState("offered");
                logMessage("Opponent offered a rematch!");
             } else if (action.actionType === "rematch_accept") {
                const newId = action.matchId;
                const newColor = isSpectator ? "spectator" : (color === "white" ? "black" : "white");
                router.push(`/play/${newId}?color=${newColor}&tc=${encodeURIComponent(tcMode)}&w=${encodeURIComponent(bName)}&b=${encodeURIComponent(wName)}`);
             }
          }
          else if (update.event.case === "chat") {
             const chat = update.event.value;
             logMessage(`${chat.sender}: ${chat.text}`);
          }
      } catch (err) {
          console.error(err);
      }
    };

    ws.onclose = () => {
      setStatus("Disconnected");
    };

    return () => { 
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(); 
      }
    };
  }, [id, color, mounted, tcMode, wName, bName]);

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
             updateGameState(true);
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
          if (history.length === 0) return; // Clocks don't tick until white makes the first move
          setClocks(prev => ({
              white: turn === 'w' ? Math.max(0, prev.white - 100) : prev.white,
              black: turn === 'b' ? Math.max(0, prev.black - 100) : prev.black,
          }));
      }, 100);
     return () => clearInterval(interval);
  }, [gameOver, fen, clocks.white < 0, preMove]);

  if (!mounted || !id) return <div key="skeleton" className="min-h-screen bg-[#07090E]" />;

  function onDrop({ sourceSquare, targetSquare, piece }: { sourceSquare: string; targetSquare: string; piece: string }) {
    if (!targetSquare || gameOver) return false;
    
    if (currentMoveIndex !== history.length - 1) {
       return false;
    }

    const isMyTurn = gameRef.current.turn() === color[0];

    if (!isMyTurn) {
        if (settings.enablePremove) {
            setPreMove({ from: sourceSquare, to: targetSquare });
        }
        return false;
    }

    try {
        const pieceCode = typeof piece === 'string' ? piece : (piece as any).pieceType;
        const isWhitePawn = pieceCode === 'wP' && sourceSquare[1] === '7' && targetSquare[1] === '8';
        const isBlackPawn = pieceCode === 'bP' && sourceSquare[1] === '2' && targetSquare[1] === '1';
        const isPromotion = isWhitePawn || isBlackPawn;

        const tempGame = new Chess(gameRef.current.fen());
        try {
            const moveData = isPromotion 
                ? { from: sourceSquare as Square, to: targetSquare as Square, promotion: 'q' }
                : { from: sourceSquare as Square, to: targetSquare as Square };
                
            const valid = tempGame.move(moveData);
            if (!valid) return false;
        } catch (e) {
            return false;
        }
                            
        if (isPromotion) {
            if (settings.alwaysPromoteToQueen) {
                try {
                    const move = gameRef.current.move({ from: sourceSquare as Square, to: targetSquare as Square, promotion: 'q' });
                    setTimeout(() => updateGameState(), 0);
                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                        const uci = sourceSquare + targetSquare + 'q';
                        const update = create(MatchUpdateSchema, {
                            event: { case: "move", value: { matchId: id, uci: uci, timestamp: BigInt(Date.now()) } }
                        });
                        wsRef.current.send(toBinary(MatchUpdateSchema, update));
                    }
                    return true;
                } catch(e) { return false; }
            }
            setPendingPromotion({ from: sourceSquare, to: targetSquare, color: pieceCode[0] });
            return true;
        }
    
        const move = gameRef.current.move({ from: sourceSquare as Square, to: targetSquare as Square });
        updateGameState(true);

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
          setTimeout(() => updateGameState(), 0);
          
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
      }
  }
  
  const handleRematch = () => {
      sendAction("rematch");
      setRematchState("waiting");
  }

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

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
       const u = create(MatchUpdateSchema, {
          event: { case: "chat", value: { text: chatInput, sender: "", timestamp: BigInt(0) } }
       });
       wsRef.current.send(toBinary(MatchUpdateSchema, u));
       setChatInput("");
    }
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

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8 relative overscroll-none">

        <header className="flex justify-between items-center mb-6 lg:mb-10 px-4 z-10 max-w-7xl mx-auto w-full">
            <div className="flex items-center gap-3">
              <Link href="/" className="p-2 hover:bg-white/5 rounded-full text-slate-400 hover:text-white transition-colors mr-2">
                <ChevronLeft className="w-6 h-6" />
              </Link>
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded-2xl backdrop-blur-md">
                <Zap className="w-6 h-6 text-blue-400 animate-pulse" />
                <div>
                    <div className="text-[8px] md:text-[10px] font-black tracking-[0.2em] text-blue-500/80 uppercase leading-none mb-1">AntigravityChess</div>
                    <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-300 leading-none">{t("arena_title")}</h1>
                    <span className="text-[9px] md:text-xs font-mono text-gray-500 uppercase tracking-widest mt-0.5 block">ID: {id.substring(0, 8)}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 md:gap-4">
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
               <div className="flex items-center gap-2 md:gap-4">
                 {mounted && (
                    <button 
                      onClick={flipBoard} 
                      className="p-2 bg-white/5 hover:bg-white/10 transition-colors rounded-full border border-white/10 text-slate-400"
                      title="Flip Board"
                    >
                      <RotateCcw className="w-4 h-4 md:w-6 md:h-6" />
                    </button>
                 )}
                 {videoAuthorized && (
                    <button 
                      onClick={() => setShowVideo(!showVideo)} 
                      className={`p-2 transition-all rounded-full border ${showVideo ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-white/5 border-white/10 text-slate-400'}`}
                      title="Toggle Video Chat"
                    >
                      {showVideo ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                    </button>
                 )}
                 <button onClick={() => setIsPanelOpen(true)} className="p-2.5 bg-white/5 hover:bg-white/10 transition-colors rounded-full border border-white/10 text-slate-400">
                    <Settings className="w-5 h-5" />
                 </button>
              </div>
            </div>
        </header>

        <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-10 z-10 relative">
            
            <div className="lg:col-span-2 flex flex-col p-2 relative">
                
                {gameOver && (
                        <div 
                          className="w-full bg-slate-900/80 border border-slate-700/80 rounded-2xl p-4 mb-4 flex justify-between items-center shadow-xl backdrop-blur-xl"
                        >
                            <div className="flex items-center gap-4">
                               <CheckCircle className="w-8 h-8 text-emerald-500" />
                               <div>
                                   <h2 className="text-xl font-black text-white">{gameResult}</h2>
                                   <p className="text-emerald-400/80 font-mono text-xs uppercase tracking-widest">{gameReason}</p>
                               </div>
                            </div>
                        </div>
                )}

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

                <div className="w-full max-w-[min(650px,60vh)] md:max-w-[min(650px,65vh)] mx-auto aspect-square relative border-4 border-slate-800 shadow-2xl rounded-sm overflow-hidden touch-none select-none">
                    <Chessboard 
                        options={{
                            position: fen,
                            onPieceDrop: onDrop as any,
                            boardOrientation: boardOrientation,
                            darkSquareStyle: { backgroundColor: boardThemes[settings.boardTheme]?.dark || "#4d6d4d" },
                            lightSquareStyle: { backgroundColor: boardThemes[settings.boardTheme]?.light || "#f0f0f0" },
                            animationDurationInMs: 200,
                            allowDragging: !isSpectator && !gameOver && currentMoveIndex === history.length - 1,
                            showNotation: settings.showCoordinates,
                            pieces: stableCustomPieces as any,
                            squareStyles: {
                                ...(preMove ? {
                                    [preMove.from]: { backgroundColor: 'rgba(255, 255, 0, 0.4)', borderRadius: '50%' },
                                    [preMove.to]: { backgroundColor: 'rgba(255, 255, 0, 0.4)', borderRadius: '50%' }
                                } : {})
                            },
                            arrows: preMove ? [
                                {
                                    startSquare: preMove.from,
                                    endSquare: preMove.to,
                                    color: 'rgba(255, 255, 0, 0.9)'
                                }
                            ] : []
                        }}
                    />

                    {pendingPromotion && (
                            <div 
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
                            </div>
                    )}

                    {preMove && (
                        <button 
                            onClick={() => setPreMove(null)}
                            className="absolute top-4 right-4 bg-red-600/90 hover:bg-red-600 text-white text-[10px] px-3 py-1.5 rounded-full font-black animate-pulse shadow-xl z-20 border border-red-400/50 backdrop-blur-sm transition-all active:scale-95"
                        >
                            PREMOVE ACTIVE (CLICK TO CANCEL)
                        </button>
                    )}
                </div>
                
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

            <div className="flex flex-col gap-6">
                
                <div className="bg-slate-900/60 border border-white/5 rounded-3xl overflow-hidden flex flex-col h-[400px] shadow-2xl backdrop-blur-xl group">
                    <div className="px-5 py-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2 uppercase tracking-[0.2em] text-[10px] font-black text-slate-500">
                           <Activity className="w-4 h-4 text-blue-500"/> Notation
                        </div>
                    </div>
                    
                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1.5 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-blue-500/30 transition-all">
                        {history.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-600 opacity-20 gap-3">
                                <Zap className="w-8 h-8 rotate-12" />
                                <span className="text-[10px] uppercase font-black tracking-widest">{t("waiting_for_first_move") || "Awaiting moves"}</span>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-1">
                                {Array.from({ length: Math.ceil(history.length / 2) }).map((_, i) => {
                                    const wIndex = i * 2;
                                    const bIndex = wIndex + 1;
                                    const wMove = history[wIndex];
                                    const bMove = history[bIndex];
                                    
                                    return (
                                        <div key={i} className="grid grid-cols-8 text-[11px] font-mono rounded-xl overflow-hidden border border-white/5 bg-white/[0.015] hover:bg-white/[0.04] transition-colors">
                                            <div className="col-span-1 flex items-center justify-center bg-white/5 text-slate-600 py-2.5 font-bold border-r border-white/5 text-[9px]">{i + 1}</div>
                                            <div 
                                               onClick={() => goToMove(wIndex)}
                                               className={`col-span-3 flex items-center px-4 py-2 font-bold transition-colors cursor-pointer border-r border-white/5 ${currentMoveIndex === wIndex ? 'bg-blue-500/20 text-blue-400' : 'text-slate-100 hover:text-blue-400'}`}
                                            >
                                                {wMove}
                                            </div>
                                            <div 
                                               onClick={() => goToMove(bIndex)}
                                               className={`col-span-4 flex items-center px-4 py-2 transition-colors cursor-pointer ${!bMove ? '' : currentMoveIndex === bIndex ? 'bg-blue-500/20 text-blue-400 font-bold' : 'text-slate-400 hover:text-blue-400'}`}
                                            >
                                                {bMove || ""}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-slate-900/60 border border-white/5 rounded-3xl overflow-hidden flex flex-col h-48 shadow-2xl backdrop-blur-xl group">
                    <div className="px-5 py-3 border-b border-white/5 bg-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2 uppercase tracking-[0.2em] text-[10px] font-black text-slate-500">
                           <Activity className="w-4 h-4 text-blue-500"/> Chat & Logs
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-[10px] text-slate-400">
                        {logs.map((l, i) => (
                             <div key={i} className={l.includes(":") ? "text-slate-200" : "text-slate-500 italic"}>
                                 {l}
                             </div>
                        ))}
                    </div>
                    <form onSubmit={handleChatSubmit} className="p-2 bg-white/5 border-t border-white/5 flex gap-2">
                        <input 
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Type to chat..."
                            className="flex-1 bg-black/30 border border-white/10 rounded-xl px-3 py-1.5 text-[10px] text-white outline-none focus:border-blue-500/50 transition-all font-mono"
                        />
                    </form>
                </div>

                <div className="bg-blue-900/5 border border-blue-500/10 rounded-2xl p-4 flex flex-col gap-2">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-500/60">Match Info</h4>
                    <p className="text-xs text-slate-500 leading-relaxed">
                        Match is running on <b>Antigravity Edge</b>. 
                    </p>
                </div>

                {showVideo && (
                    <div className="flex flex-col">
                        <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-t-2xl text-[10px] font-black uppercase tracking-widest text-blue-400 flex items-center justify-between">
                           <span>Video Communication</span>
                           <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                        </div>
                        <div className="p-4 bg-white/5 border border-white/10 border-t-0 rounded-b-2xl shadow-xl">
                           <VideoChat matchId={id} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
}

export default function PlayArena() {
  return (
    <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white bg-black">Loading match...</div>}>
      <PlayArenaContent />
    </React.Suspense>
  );
}
