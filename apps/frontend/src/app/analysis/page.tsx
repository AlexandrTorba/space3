"use client";

import { useEffect, useState, useRef } from "react";
import { ChevronLeft, ChevronRight, Activity, SkipBack, SkipForward, ArrowLeft, Upload } from "lucide-react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import Link from "next/link";
import { useTranslation } from "@/i18n";

export default function AnalysisView() {
  const { t } = useTranslation();
  
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [history, setHistory] = useState<string[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [evaluation, setEvaluation] = useState<string>("0.0");
  const [pastePgn, setPastePgn] = useState("");
  
  const sfWorker = useRef<Worker | null>(null);

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
             // Let's attempt to strip messy headers if standard load fails, as chess.js can be extremely strict
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
    
    // Disallow moves if user is previewing history
    if (currentMoveIndex !== history.length - 1) {
       // Truncate history! Like normal analysis boards.
       const engine = new Chess();
       for(let i = 0; i <= currentMoveIndex; i++) {
          engine.move(history[i]);
       }
       gameRef.current = engine;
    }
    
    try {
        const isPromotion = (piece === 'wP' && sourceSquare[1] === '7' && targetSquare[1] === '8') || 
                            (piece === 'bP' && sourceSquare[1] === '2' && targetSquare[1] === '1');
                            
        const moveData: {from: string; to: string; promotion?: string} = { from: sourceSquare, to: targetSquare };
        if (isPromotion) moveData.promotion = "q";
    
        gameRef.current.move(moveData);
        updateGameState();
        return true;
    } catch (e) {
        return false;
    }
  }

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

  return (
    <div className="min-h-screen bg-[#07090E] text-white flex flex-col p-4 md:p-8 relative overflow-hidden">
        <div className="absolute top-1/2 left-0 w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none -translate-y-1/2 -translate-x-1/2" />
        
        <header className="flex justify-between items-center mb-6 z-10 max-w-6xl w-full mx-auto">
            <div className="flex items-center gap-3">
              <Activity className="w-8 h-8 text-blue-400" />
              <div>
                  <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-300">{t("analysis_board")}</h1>
                  <span className="text-xs text-gray-500 font-mono tracking-widest block uppercase">Stockfish 16.1 HCE</span>
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

                <div className="w-full max-w-[min(650px,60vh)] md:max-w-[min(650px,65vh)] bg-black/50 border-4 border-slate-800 p-2 rounded-[1rem] shadow-[0_0_50px_rgba(59,130,246,0.15)] backdrop-blur-xl">
                    <Chessboard 
                        options={{
                            position: fen, 
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            onPieceDrop: onDrop as any,
                            boardOrientation: "white",
                            darkSquareStyle: { backgroundColor: "#1e293b" },
                            lightSquareStyle: { backgroundColor: "#334155" },
                            animationDurationInMs: 150,
                            allowDragging: true
                        }}
                    />
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
