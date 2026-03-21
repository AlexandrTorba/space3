"use client";

import { useEffect, useState, useRef } from "react";
import { ChevronLeft, ChevronRight, Activity, SkipBack, SkipForward, ArrowLeft, Upload, Cpu, Timer } from "lucide-react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import Link from "next/link";
import { useTranslation } from "@/i18n";
import { useSettings, boardThemes } from "@/hooks/useSettings";

export default function AnalysisView() {
  const { t } = useTranslation();
  const { settings, getPieceUrl } = useSettings();
  
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [history, setHistory] = useState<string[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [evaluation, setEvaluation] = useState<string>("0.0");
  const [pastePgn, setPastePgn] = useState("");
  
  const [pendingPromotion, setPendingPromotion] = useState<{from: string; to: string; color: string} | null>(null);
  
  const [isBotActive, setIsBotActive] = useState(false);
  const [botColor, setBotColor] = useState<"white" | "black" | "random">("black");
  const [resolvedBotColor, setResolvedBotColor] = useState<"white" | "black" | null>(null);
  const [botThinking, setBotThinking] = useState(false);
  
  const sfWorker = useRef<Worker | null>(null);

  useEffect(() => {
     if (isBotActive && botColor === "random") {
        if (!resolvedBotColor) {
           setResolvedBotColor(Math.random() > 0.5 ? "white" : "black");
        }
     } else if (botColor !== "random") {
        setResolvedBotColor(botColor);
     } else if (!isBotActive) {
        setResolvedBotColor(null);
     }
  }, [isBotActive, botColor]);

   const isBotMoving = useRef(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
       sfWorker.current = new Worker("/stockfish.js");
       sfWorker.current.onmessage = (e) => {
          const line = e.data;
          
          if (line.startsWith("bestmove ") && isBotActive) {
             const moveUci = line.split(" ")[1];
             if (moveUci !== "(none)" && isBotMoving.current) {
                const from = moveUci.substring(0, 2);
                const to = moveUci.substring(2, 4);
                const promotion = moveUci.length > 4 ? moveUci[4] : undefined;
                
                try {
                  // Only apply if it's actually the bot's turn to avoid race conditions
                  if (resolvedBotColor && gameRef.current.turn() === resolvedBotColor[0]) {
                     gameRef.current.move({ from, to, promotion });
                     updateGameState();
                  }
                } catch(e) {}
             }
             isBotMoving.current = false;
             setBotThinking(false);
          }

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
       sfWorker.current.postMessage("setoption name UCI_LimitStrength value true");
       sfWorker.current.postMessage(`setoption name UCI_Elo value ${settings.botElo}`);
    }
    return () => sfWorker.current?.terminate();
  }, [isBotActive, settings.botElo, resolvedBotColor]);

   useEffect(() => {
    if (isBotActive && resolvedBotColor && !botThinking && gameRef.current.turn() === resolvedBotColor[0]) {
       setBotThinking(true);
       isBotMoving.current = true;
       sfWorker.current?.postMessage("stop"); // Ensure any ongoing analysis stops
       sfWorker.current?.postMessage(`position fen ${gameRef.current.fen()}`);
       sfWorker.current?.postMessage("go movetime 1000");
    }
  }, [isBotActive, fen, resolvedBotColor, botThinking]);

  const triggerAnalysis = () => {
      if (sfWorker.current) {
         sfWorker.current.postMessage("stop");
         sfWorker.current.postMessage(`position fen ${fen}`);
         sfWorker.current.postMessage("go depth 16");
      }
  };

  useEffect(() => {
      triggerAnalysis();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fen]);
  
  const updateGameState = () => {
      setFen(gameRef.current.fen());
      const newHistory = gameRef.current.history();
      setHistory(newHistory);
      setCurrentMoveIndex(newHistory.length - 1);
  };

  const loadPgn = () => {
      try {
          const engine = new Chess();
          const cleanPgn = pastePgn.trim().replace(/\r\n/g, '\n');
          
          let success = false;
          try {
              engine.loadPgn(cleanPgn); 
              success = true;
          } catch(err) {
              console.error(err);
          }

          if (!success) {
             const strippedMoves = cleanPgn.split('\n\n').pop()?.trim() || cleanPgn;
             try {
                engine.loadPgn(strippedMoves);
                success = true;
             } catch(e) {}
          }

          if (!success) {
             alert("Failed to load PGN. Please check formatting.");
             return;
          }
          
          gameRef.current = engine;
          updateGameState();
      } catch (e) {
          alert("Error parsing PGN string");
      }
  };

  function onDrop({ sourceSquare, targetSquare, piece }: { sourceSquare: string, targetSquare: string | null, piece: string }) {
    if (!targetSquare) return false;
    
    // Disallow user moves if bot is thinking OR it's bot's turn
    if (isBotActive && resolvedBotColor && (botThinking || gameRef.current.turn() === resolvedBotColor[0])) {
       return false;
    }

    if (currentMoveIndex !== history.length - 1) {
       const engine = new Chess();
       for(let i = 0; i <= currentMoveIndex; i++) {
          engine.move(history[i]);
       }
       gameRef.current = engine;
    }
    
    try {
        const isPromotion = (piece === 'wP' && sourceSquare[1] === '7' && targetSquare[1] === '8') || 
                            (piece === 'bP' && sourceSquare[1] === '2' && targetSquare[1] === '1');
                            
        if (isPromotion) {
            setPendingPromotion({ from: sourceSquare, to: targetSquare, color: piece[0] });
            return true;
        }
    
        gameRef.current.move({ from: sourceSquare, to: targetSquare });
        updateGameState();
        return true;
    } catch (e) {
        return false;
    }
  }

  const completePromotion = (promotionPiece: string) => {
      if (!pendingPromotion) return;
      const { from, to } = pendingPromotion;
      try {
          gameRef.current.move({ from, to, promotion: promotionPiece });
          updateGameState();
      } catch(e) {}
      setPendingPromotion(null);
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

  const resetBoard = () => {
      gameRef.current = new Chess();
      setPastePgn("");
      updateGameState();
  };


  const piecesArr = ["wP", "wN", "wB", "wR", "wQ", "wK", "bP", "bN", "bB", "bR", "bQ", "bK"];
  const pieces = Object.fromEntries(
    piecesArr.map(p => [p, ({ squareWidth }: any) => (
      <img src={getPieceUrl(p)} style={{ width: squareWidth, height: squareWidth }} alt={p} />
    )])
  );

  return (
    <div className="min-h-screen text-white flex flex-col p-4 md:p-8 relative transition-colors duration-700">
        
        <header className="flex justify-between items-center mb-6 z-10 max-w-6xl w-full mx-auto">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-blue-400" />
              <div>
                   <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-300">{t("analysis_board")}</h1>
                  <span className="text-xs text-gray-500 font-mono tracking-widest block uppercase">Stockfish 16.1 (NNUE)</span>
              </div>
            </div>
            
            <Link href="/" className="flex items-center gap-2 text-sm font-bold bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-full transition-all text-slate-300 hover:text-white">
                <ArrowLeft className="w-4 h-4"/> {t("back")}
            </Link>
        </header>

        <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-8 z-10">
            <div className="lg:col-span-2 flex flex-col items-center">
                
                <div className="w-full max-w-[min(650px,60vh)] md:max-w-[min(650px,65vh)] flex justify-between items-end mb-2 px-2">
                    <div className="flex items-center gap-2 bg-slate-800/80 px-4 py-1.5 rounded-xl text-sm font-mono border border-slate-700/50 shadow-inner">
                        <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                        <span className={`font-bold tracking-wider ${evaluation.startsWith('+') || evaluation.startsWith('M') && !evaluation.startsWith('M-') ? 'text-white' : 'text-slate-400'}`}>
                            EVAL: {evaluation}
                        </span>
                    </div>
                    <button onClick={resetBoard} className="text-xs bg-red-900/30 text-red-400 hover:bg-red-900/60 px-3 py-1 rounded-full border border-red-500/20 font-bold transition-all">{t("clear_board")}</button>
                </div>

                <div className="w-full max-w-[min(650px,60vh)] md:max-w-[min(650px,65vh)] bg-black/50 border-4 border-slate-800 p-2 rounded-[1rem] shadow-[0_0_50px_rgba(59,130,246,0.15)] backdrop-blur-xl relative">
                    <Chessboard 
                        options={{
                            position: fen, 
                            onPieceDrop: onDrop as any,
                            boardOrientation: "white",
                            darkSquareStyle: { backgroundColor: boardThemes[settings.boardTheme].dark },
                            lightSquareStyle: { backgroundColor: boardThemes[settings.boardTheme].light },
                            animationDurationInMs: 150,
                            allowDragging: true,
                            showNotation: settings.showCoordinates,
                            pieces: pieces as any
                        }}
                    />

                    {pendingPromotion && (
                        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-8">
                            <div className="bg-slate-900 border border-white/10 p-6 rounded-3xl shadow-2xl flex flex-col items-center gap-6">
                                <h3 className="text-xl font-bold text-white tracking-widest uppercase">{t("promotion_title")}</h3>
                                <div className="flex gap-4">
                                    {['q', 'r', 'b', 'n'].map((p) => (
                                        <button 
                                            key={p}
                                            onClick={() => completePromotion(p)}
                                            className="w-16 h-16 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 group"
                                        >
                                            <img 
                                                src={`https://chessboardjs.com/img/chesspieces/wikipedia/${pendingPromotion.color}${p.toUpperCase()}.png`} 
                                                alt={p} 
                                                className="w-12 h-12 object-contain group-hover:drop-shadow-[0_0_8px_white]"
                                            />
                                        </button>
                                    ))}
                                </div>
                                <button 
                                    onClick={() => setPendingPromotion(null)}
                                    className="text-slate-500 hover:text-white text-sm font-bold mt-2"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Playback Controls */}
                <div className="flex items-center gap-3 mt-4 bg-slate-900/80 border border-slate-700/80 px-4 py-2 rounded-full w-full max-w-[min(650px,60vh)] md:max-w-[min(650px,65vh)] justify-center shadow-xl">
                    <button onClick={() => goToMove(-1)} disabled={currentMoveIndex === -1} className="p-2 hover:bg-slate-800 rounded-full disabled:opacity-30"><SkipBack className="w-5 h-5"/></button>
                    <button onClick={() => goToMove(currentMoveIndex - 1)} disabled={currentMoveIndex === -1} className="p-2 hover:bg-slate-800 rounded-full disabled:opacity-30"><ChevronLeft className="w-6 h-6"/></button>
                    <span className="font-mono text-xs font-bold w-16 text-center text-blue-400">{currentMoveIndex + 1} / {history.length}</span>
                    <button onClick={() => goToMove(currentMoveIndex + 1)} disabled={currentMoveIndex === history.length - 1} className="p-2 hover:bg-slate-800 rounded-full disabled:opacity-30"><ChevronRight className="w-6 h-6"/></button>
                    <button onClick={() => goToMove(history.length - 1)} disabled={currentMoveIndex === history.length - 1} className="p-2 hover:bg-slate-800 rounded-full disabled:opacity-30"><SkipForward className="w-5 h-5"/></button>
                </div>
            </div>

            <div className="bg-[#111827]/60 border border-white/10 rounded-3xl p-6 flex flex-col h-[650px] backdrop-blur-xl shadow-2xl">
                
                <div className="flex flex-col gap-3 mb-4 pb-4 border-b border-white/10">
                    <button 
                        onClick={() => setIsBotActive(!isBotActive)}
                        className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold transition-all shadow-xl shadow-black/30 ${
                            isBotActive 
                                ? 'bg-amber-600/20 border border-amber-500/40 text-amber-400' 
                                : 'bg-blue-600/20 border border-blue-500/40 text-blue-400 hover:bg-blue-600/30'
                        }`}
                    >
                        <Cpu className={`w-5 h-5 ${botThinking ? 'animate-spin' : ''}`} />
                         {botThinking ? t("bot_thinking") : `${t("play_with_bot")} (${settings.botElo})`}
                    </button>
                    
                    <div className="flex flex-col gap-1 w-full">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 pl-1">{t("bot_play_as")} ({settings.botElo})</span>
                        <div className="flex items-center gap-3 bg-slate-950/80 p-3 rounded-2xl border border-slate-800 focus-within:border-blue-500/50 transition-colors shadow-inner cursor-pointer hover:bg-slate-900/40">
                             <div className={`w-3 h-3 rounded-full ${botColor === 'white' ? 'bg-slate-200 shadow-[0_0_10px_rgba(255,255,255,0.3)]' : botColor === 'black' ? 'bg-slate-800 border border-slate-600' : 'bg-gradient-to-tr from-slate-900 to-slate-200 border border-slate-600'}`}></div>
                             <select 
                                value={botColor} 
                                onChange={e => setBotColor(e.target.value as any)} 
                                disabled={isBotActive && botThinking}
                                className="bg-transparent border-none text-white w-full font-bold focus:outline-none appearance-none cursor-pointer text-xs"
                             >
                                <option value="black" className="bg-slate-900">⚫ {t("color_black")}</option>
                                <option value="white" className="bg-slate-900">⚪ {t("color_white")}</option>
                                <option value="random" className="bg-slate-900">🎲 {t("color_random")}</option>
                             </select>
                        </div>
                    </div>
                </div>

                <h3 className="font-bold border-b border-white/10 text-white/80 pb-3 mb-4">{t("move_annotation")}</h3>
                
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
                
                <div className="mt-auto border-t border-white/10 pt-4 flex flex-col gap-2">
                    <p className="text-xs text-slate-400 font-bold ml-1 uppercase tracking-widest flex justify-between">
                       <span>PGN Import</span>
                    </p>
                    <textarea 
                       value={pastePgn} 
                       onChange={e => setPastePgn(e.target.value)}
                       placeholder={t("paste_pgn") as string} 
                       className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm font-mono text-slate-300 h-24 focus:outline-none focus:border-blue-500 resize-none flex-shrink-0"
                    />
                    <button onClick={loadPgn} disabled={!pastePgn.trim()} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white py-3 rounded-xl font-bold transition-all disabled:opacity-50">
                        <Upload className="w-4 h-4"/> {t("load_pgn")}
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
}
