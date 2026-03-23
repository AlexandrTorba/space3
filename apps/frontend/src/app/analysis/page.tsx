"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import React from "react";
import { ChevronLeft, ChevronRight, Activity, SkipBack, SkipForward, ArrowLeft, Upload, Cpu, Timer, Globe } from "lucide-react";
import { Chess, Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import Link from "next/link";
import { useTranslation } from "@/i18n";
import { useSettings, boardThemes } from "@/hooks/useSettings";

function makePieceComponent(pieceCode: string, getPieceUrl: (p: string) => string) {
  function PieceImg(props: { svgStyle?: React.CSSProperties; square?: string } = {}) {
    return <img src={getPieceUrl(pieceCode)} style={props.svgStyle} className="w-full h-full object-contain" alt={pieceCode} />;
  }
  PieceImg.displayName = `Piece_${pieceCode}`;
  return PieceImg;
}
const PIECE_LABELS = ["wP", "wN", "wB", "wR", "wQ", "wK", "bP", "bN", "bB", "bR", "bQ", "bK"];

export default function AnalysisView() {
  const { t } = useTranslation();
  const { settings, getPieceUrl } = useSettings();
  
  const pieces = useMemo(() => {
    return Object.fromEntries(PIECE_LABELS.map(p => [p, makePieceComponent(p, getPieceUrl)]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.pieceSet]);

  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [history, setHistory] = useState<string[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [evaluation, setEvaluation] = useState<string>("0.0");
  const [pastePgn, setPastePgn] = useState("");
  
  const [pendingPromotion, setPendingPromotion] = useState<{from: string; to: string; color: string} | null>(null);
  
  const [isBotActive, setIsBotActive] = useState(false);
  const [botColor, setBotColor] = useState<"white" | "black">("black");
  const [resolvedBotColor, setResolvedBotColor] = useState<"white" | "black" | null>(null);
  const [botThinking, setBotThinking] = useState(false);
  const [preMove, setPreMove] = useState<{from: string; to: string} | null>(null);
  
  const sfWorker = useRef<Worker | null>(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState<"pgn" | "openings">("pgn");
  const [activeOpeningIndex, setActiveOpeningIndex] = useState<number | null>(null);
  const [lastMoveSquares, setLastMoveSquares] = useState<{[sq: string]: boolean}>({});
  const [openingPage, setOpeningPage] = useState(0);

  const TOP_OPENINGS = [
    { 
      name: "Ruy Lopez", 
      pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5",
      variations: [
        { name: "Berlin Defense", pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6" },
        { name: "Exchange Var.", pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Bxc6" },
        { name: "Marshall Attack", pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. c3 d5" }
      ]
    },
    { 
      name: "Sicilian Def.", 
      pgn: "1. e4 c5",
      variations: [
        { name: "Najdorf", pgn: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6" },
        { name: "Dragon", pgn: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6" },
        { name: "Rossolimo", pgn: "1. e4 c5 2. Nf3 Nc6 3. Bb5" }
      ]
    },
    { 
      name: "Queen's Gambit", 
      pgn: "1. d4 d5 2. c4",
      variations: [
        { name: "Declined", pgn: "1. d4 d5 2. c4 e6" },
        { name: "Accepted", pgn: "1. d4 d5 2. c4 dxc4" },
        { name: "Slav Defense", pgn: "1. d4 d5 2. c4 c6" }
      ]
    },
    { 
      name: "French Def.", 
      pgn: "1. e4 e6",
      variations: [
        { name: "Winawer", pgn: "1. e4 e6 2. d4 d5 3. Nc3 Bb4" },
        { name: "Classical", pgn: "1. e4 e6 2. d4 d5 3. Nc3 Nf6" },
        { name: "Advance", pgn: "1. e4 e6 2. d4 d5 3. e5" }
      ]
    },
    { 
      name: "Caro-Kann Def.", 
      pgn: "1. e4 c6",
      variations: [
        { name: "Advance", pgn: "1. e4 c6 2. d4 d5 3. e5" },
        { name: "Classical", pgn: "1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5" },
        { name: "Two Knights", pgn: "1. e4 c6 2. Nf3 d5 3. Nc3" }
      ]
    },
    { 
      name: "Italian Game", 
      pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4",
      variations: [
        { name: "Giuoco Piano", pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5" },
        { name: "Two Knights", pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6" },
        { name: "Evans Gambit", pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4" }
      ]
    },
    { 
      name: "King's Indian", 
      pgn: "1. d4 Nf6 2. c4 g6",
      variations: [
        { name: "Classical", pgn: "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5" },
        { name: "Saemisch", pgn: "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. f3" }
      ]
    },
    { 
      name: "Slav Defense", 
      pgn: "1. d4 d5 2. c4 c6",
      variations: [
        { name: "Exchange", pgn: "1. d4 d5 2. c4 c6 3. cxd5 cxd5" },
        { name: "Semi-Slav", pgn: "1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 e6" }
      ]
    },
    { 
      name: "English Open", 
      pgn: "1. c4",
      variations: [
        { name: "Symmetrical", pgn: "1. c4 c5" },
        { name: "King's English", pgn: "1. c4 e5" }
      ]
    },
    { 
      name: "Scandinavian", 
      pgn: "1. e4 d5",
      variations: [
        { name: "Modern", pgn: "1. e4 d5 2. exd5 Nf6" },
        { name: "Mieses-Kotroc", pgn: "1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5" }
      ]
    },
    { 
      name: "Pirc Defense", 
      pgn: "1. e4 d6",
      variations: [
        { name: "Austrian Attack", pgn: "1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. f4" },
        { name: "Classical", pgn: "1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. Nf3" }
      ]
    },
    { 
      name: "Nimzo-Indian", 
      pgn: "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4",
      variations: [
        { name: "Rubinstein", pgn: "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. e3" },
        { name: "Classical", pgn: "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4 4. Qc2" }
      ]
    },
  ];

  useEffect(() => {
     if (isBotActive) {
        setResolvedBotColor(botColor);
     } else {
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
      const currentFen = gameRef.current.fen();
      setFen(currentFen);
      const newHistory = gameRef.current.history();
      setHistory(newHistory);
      setCurrentMoveIndex(newHistory.length - 1);

      // Handle last move squares for highlighting
      const verboseHistory = gameRef.current.history({ verbose: true });
      const lastM = verboseHistory[verboseHistory.length - 1];
      if (lastM) {
          setLastMoveSquares({ [lastM.from]: true, [lastM.to]: true });
      } else {
          setLastMoveSquares({});
      }
      
      // Auto-trigger pre-moves
      if (settings.enablePremove && preMove) {
          const turn = gameRef.current.turn();
          const piece = gameRef.current.get(preMove.from as Square);
          
          if (piece && piece.color === turn) {
              try {
                  const move = gameRef.current.move({ 
                      from: preMove.from as Square, 
                      to: preMove.to as Square, 
                      promotion: 'q' 
                  });
                  if (move) {
                      setPreMove(null);
                      // Update again for the new state
                      requestAnimationFrame(() => updateGameState());
                  } else {
                      setPreMove(null);
                  }
              } catch(e) {
                  setPreMove(null); 
              }
          } else if (piece && piece.color !== turn) {
              // Still not our turn, keep it
          } else {
              // Piece gone or invalid
              setPreMove(null);
          }
      }
  };

  const loadPgn = () => {
      setActiveOpeningIndex(null);
      loadPgnInternal(pastePgn);
  };

  const loadOpening = (index: number) => {
      setActiveOpeningIndex(index);
      loadPgnInternal(TOP_OPENINGS[index].pgn);
  };

  const loadPgnInternal = (pgnString: string) => {
      try {
          const engine = new Chess();
          const cleanPgn = pgnString.trim().replace(/\r\n/g, '\n');
          
          let success = false;
          try {
              engine.loadPgn(cleanPgn); 
              success = true;
          } catch(err) {}

          if (!success) {
             const strippedMoves = cleanPgn.split('\n\n').pop()?.trim() || cleanPgn;
             try {
                engine.loadPgn(strippedMoves);
                success = true;
             } catch(e) {}
          }

          if (!success) {
               try {
                   engine.load(cleanPgn);
                   success = true;
               } catch(e) {}
          }

          if (!success) {
             alert("Failed to load PGN/FEN. Please check formatting.");
             return;
          }
          
          setPreMove(null); 
          gameRef.current = engine;
          updateGameState();
      } catch (e) {
          alert("Error parsing PGN string");
      }
  };
  function onDrop({ sourceSquare, targetSquare, piece }: { sourceSquare: string; targetSquare: string; piece: string }) {
    if (!targetSquare) return false;
    
    const pieceCode = typeof piece === 'string' ? piece : (piece as any).pieceType;
    const turn = gameRef.current.turn();
    const pieceColor = pieceCode[0];

    // Handle premove if it's not our turn
    if (pieceColor !== turn) {
        if (settings.enablePremove) {
            setPreMove({ from: sourceSquare, to: targetSquare });
        }
        return false;
    }

    // Disallow user moves if bot is thinking 
    if (isBotActive && botThinking) {
       return false;
    }

    if (currentMoveIndex !== history.length - 1) {
       // We are in the past, so we trim the history to the current point
       // and continue from there.
       const newHistory = history.slice(0, currentMoveIndex + 1);
       // Instead of re-parsing, we just use the current board FEN
       // which is already at the currentMoveIndex.
       const engine = new Chess(fen);
       gameRef.current = engine;
    }
    
    try {
        const isWhitePawn = pieceCode === 'wP' && sourceSquare[1] === '7' && targetSquare[1] === '8';
        const isBlackPawn = pieceCode === 'bP' && sourceSquare[1] === '2' && targetSquare[1] === '1';
        const isPromotion = isWhitePawn || isBlackPawn;

        // Validation clone
        const tempGame = new Chess(gameRef.current.fen());
        try {
            const moveData = isPromotion 
                ? { from: sourceSquare as Square, to: targetSquare as Square, promotion: 'q' }
                : { from: sourceSquare as Square, to: targetSquare as Square };
            const valid = tempGame.move(moveData);
            if (!valid) return false;
        } catch (e) { return false; }

        if (isPromotion) {
            if (settings.alwaysPromoteToQueen) {
                try {
                    gameRef.current.move({ from: sourceSquare as Square, to: targetSquare as Square, promotion: 'q' });
                    setTimeout(() => updateGameState(), 0);
                    return true;
                } catch(e) { return false; }
            }
            setPendingPromotion({ from: sourceSquare, to: targetSquare, color: pieceCode[0] });
            return true;
        }
    
        gameRef.current.move({ from: sourceSquare as Square, to: targetSquare as Square });
        setActiveOpeningIndex(null);
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
          setTimeout(() => updateGameState(), 0);
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
      setPreMove(null);

      // Update highlight for past moves
      const verboseHistory = engine.history({ verbose: true });
      const lastM = verboseHistory[verboseHistory.length - 1];
      if (lastM) {
          setLastMoveSquares({ [lastM.from]: true, [lastM.to]: true });
      } else {
          setLastMoveSquares({});
      }
  };

   const resetBoard = () => {
      gameRef.current = new Chess();
      setPastePgn("");
      setPreMove(null);
      setActiveOpeningIndex(null);
      updateGameState();
  };




  return (
    <div className="min-h-screen text-white flex flex-col p-4 md:p-8 relative transition-colors duration-700">
        
        <header className="flex justify-between items-center mb-6 z-10 max-w-6xl w-full mx-auto p-4 border border-[var(--surface-border)] bg-[var(--surface-glass)] backdrop-blur-md rounded-3xl shadow-xl">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[var(--brand-primary)]/10">
                <Activity className="w-8 h-8 text-[var(--brand-primary)]" />
              </div>
              <div>
                   <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-[var(--text-primary)] to-[var(--brand-primary)] uppercase tracking-tight">{t("analysis_board")}</h1>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono tracking-[0.2em] block uppercase font-black opacity-60">Stockfish 16.1 (NNUE)</span>
              </div>
            </div>
            
            <Link href="/" className="flex items-center gap-2 text-sm font-bold bg-[var(--button-bg)] hover:bg-[var(--surface-border)] border border-[var(--surface-border)] px-5 py-2.5 rounded-full transition-all text-[var(--text-primary)] shadow-sm">
                <ArrowLeft className="w-4 h-4"/> {t("back")}
            </Link>
        </header>

        <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-8 z-10">
            <div className="lg:col-span-2 flex flex-col items-center">
                
                <div className="w-full max-w-[min(650px,60vh)] md:max-w-[min(650px,65vh)] flex justify-between items-end mb-2 px-2">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 bg-slate-800/80 px-4 py-1.5 rounded-xl text-sm font-mono border border-slate-700/50 shadow-inner">
                            <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                            <span className={`font-bold tracking-wider ${evaluation.startsWith('+') || evaluation.startsWith('M') && !evaluation.startsWith('M-') ? 'text-white' : 'text-slate-400'}`}>
                                EVAL: {evaluation}
                            </span>
                        </div>
                        <div className="px-2 text-[10px] uppercase font-black tracking-[0.2em] text-[var(--brand-primary)] animate-pulse">
                            {new Chess(fen).turn() === 'w' ? t("white") : t("black")} {t("to_move") || "to move"}
                        </div>
                    </div>
                    <button onClick={resetBoard} className="text-xs bg-red-900/30 text-red-400 hover:bg-red-900/60 px-3 py-1 rounded-full border border-red-500/20 font-bold transition-all">{t("clear_board")}</button>
                </div>

                <div className="w-full max-w-[min(650px,60vh)] md:max-w-[min(650px,65vh)] bg-black/50 border-4 border-slate-800 p-2 rounded-[1rem] shadow-[0_0_50px_rgba(59,130,246,0.15)] backdrop-blur-xl relative">
                    <Chessboard 
                        options={{
                            id: "AnalysisBoard",
                            position: fen,
                            onPieceDrop: onDrop as any,
                            boardOrientation: isBotActive && resolvedBotColor ? (resolvedBotColor === "white" ? "black" : "white") : "white",
                            darkSquareStyle: { backgroundColor: boardThemes[settings.boardTheme]?.dark || "#1e293b" },
                            lightSquareStyle: { backgroundColor: boardThemes[settings.boardTheme]?.light || "#334155" },
                            animationDurationInMs: 150,
                            allowDragging: true,
                            showNotation: settings.showCoordinates,
                            pieces: pieces as any,
                             squareStyles: {
                                 // Last Move highlight
                                 ...Object.keys(lastMoveSquares).reduce((acc, sq) => ({
                                     ...acc,
                                     [sq]: { backgroundColor: 'rgba(255, 255, 0, 0.25)' }
                                 }), {}),
                                 // Premove indicator
                                 ...(preMove ? {
                                     [preMove.from]: { backgroundColor: 'rgba(219, 165, 33, 0.4)', borderRadius: '50%' },
                                     [preMove.to]: { backgroundColor: 'rgba(219, 165, 33, 0.4)', borderRadius: '50%' }
                                 } : {})
                             },
                             arrows: preMove ? [
                                 {
                                     startSquare: (preMove.from as Square),
                                     endSquare: (preMove.to as Square),
                                     color: 'rgba(219, 165, 33, 0.9)'
                                 }
                             ] : []
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
                                            className="w-16 h-16 bg-[var(--button-bg)] hover:bg-[var(--brand-primary)]/10 border border-[var(--surface-border)] rounded-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 group shadow-lg"
                                        >
                                            <img 
                                                src={getPieceUrl(`${pendingPromotion.color}${p.toUpperCase()}`)} 
                                                alt={p} 
                                                className="w-12 h-12 object-contain group-hover:drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]"
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

                    {preMove && (
                        <button 
                            onClick={() => setPreMove(null)}
                            className="absolute top-4 right-4 bg-amber-600/90 hover:bg-amber-600 text-white text-[10px] px-3 py-1.5 rounded-full font-black animate-pulse shadow-xl z-20 border border-amber-400/50 backdrop-blur-sm transition-all active:scale-95"
                        >
                            PREMOVE ACTIVE (CLICK TO CANCEL)
                        </button>
                    )}
                </div>
                
                {/* Playback Controls */}
                <div className="flex items-center gap-3 mt-4 bg-[var(--surface-glass)] border border-[var(--surface-border)] px-4 py-2 rounded-full w-full max-w-[min(650px,60vh)] md:max-w-[min(650px,65vh)] justify-center shadow-xl backdrop-blur-md">
                    <button onClick={() => goToMove(-1)} disabled={currentMoveIndex === -1} className="p-2 hover:bg-[var(--surface-color)] rounded-full disabled:opacity-30"><SkipBack className="w-5 h-5 text-[var(--text-primary)]"/></button>
                    <button onClick={() => goToMove(currentMoveIndex - 1)} disabled={currentMoveIndex === -1} className="p-2 hover:bg-[var(--surface-color)] rounded-full disabled:opacity-30"><ChevronLeft className="w-6 h-6 text-[var(--text-primary)]"/></button>
                    <span className="font-mono text-[11px] font-black w-28 text-center text-[var(--brand-primary)] truncate px-1">
                        {currentMoveIndex === -1 ? "START" : `${Math.floor(currentMoveIndex / 2) + 1}${currentMoveIndex % 2 === 0 ? '. ' : '... '}${history[currentMoveIndex]}`}
                    </span>
                    <button onClick={() => goToMove(currentMoveIndex + 1)} disabled={currentMoveIndex === history.length - 1} className="p-2 hover:bg-[var(--surface-color)] rounded-full disabled:opacity-30"><ChevronRight className="w-6 h-6 text-[var(--text-primary)]"/></button>
                    <button onClick={() => goToMove(history.length - 1)} disabled={currentMoveIndex === history.length - 1} className="p-2 hover:bg-[var(--surface-color)] rounded-full disabled:opacity-30"><SkipForward className="w-5 h-5 text-[var(--text-primary)]"/></button>
                </div>
            </div>

            <div className="bg-[var(--surface-glass)] border border-[var(--surface-border)] rounded-[2rem] p-6 flex flex-col h-[650px] backdrop-blur-xl shadow-2xl">
                
                <div className="flex flex-col gap-4 mb-6 pb-6 border-b border-[var(--surface-border)]">
                    <button 
                        onClick={() => setIsBotActive(!isBotActive)}
                        className={`w-full flex items-center justify-center gap-3 py-4 rounded-[1.25rem] font-black uppercase tracking-widest text-xs transition-all shadow-lg active:scale-95 ${
                            isBotActive 
                                ? 'bg-amber-600/20 border border-amber-500/40 text-amber-500' 
                                : 'bg-[var(--brand-primary)] border border-white/10 text-white shadow-[var(--brand-primary)]/20'
                        }`}
                    >
                        <Cpu className={`w-5 h-5 ${botThinking ? 'animate-spin' : ''}`} />
                         {botThinking ? t("bot_thinking") : `${t("play_with_bot")} (${settings.botElo})`}
                    </button>
                    
                    <div className="flex flex-col gap-2 w-full">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)] pl-1 opacity-60 font-black">{t("bot_play_as")}</span>
                        <div className="flex items-center gap-3 bg-[var(--button-bg)] p-3 rounded-xl border border-[var(--surface-border)] focus-within:border-[var(--brand-primary)] transition-colors shadow-inner cursor-pointer">
                             <div className={`w-3 h-3 rounded-full ${botColor === 'white' ? 'bg-slate-100 shadow-sm border border-slate-300' : botColor === 'black' ? 'bg-slate-800 border border-slate-700' : 'bg-gradient-to-tr from-slate-950 to-slate-200 border border-slate-600'}`}></div>
                             <select 
                                value={botColor} 
                                onChange={e => setBotColor(e.target.value as any)} 
                                disabled={isBotActive && botThinking}
                                className="bg-transparent border-none text-[var(--text-primary)] w-full font-bold focus:outline-none appearance-none cursor-pointer text-xs"
                             >
                                <option value="black" className="bg-[var(--settings-bg)]">⚫ {t("black") || "Black"}</option>
                                <option value="white" className="bg-[var(--settings-bg)]">⚪ {t("white") || "White"}</option>
                             </select>
                        </div>
                    </div>
                </div>

                <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] border-b border-[var(--surface-border)] pb-3 mb-4 flex items-center gap-2">
                   <Timer className="w-3 h-3" /> {t("move_annotation")}
                </h3>
                
                <div className="flex-1 overflow-y-auto mb-6 scrollbar-thin scrollbar-thumb-[var(--surface-border)] pr-2">
                    <div className="flex flex-col gap-1.5">
                        {Array.from({ length: Math.ceil(history.length / 2) }).map((_, i) => {
                            const wIndex = i * 2;
                            const bIndex = wIndex + 1;
                            const wMove = history[wIndex];
                            const bMove = history[bIndex];
                            
                            return (
                                <div key={i} className="grid grid-cols-7 text-xs font-mono rounded overflow-hidden border border-[var(--surface-border)]/50">
                                    <div className="col-span-1 flex items-center justify-center bg-[var(--button-bg)] text-[var(--text-muted)] py-1.5 font-bold opacity-60">{i + 1}.</div>
                                    <div 
                                      onClick={() => goToMove(wIndex)} 
                                      className={`col-span-3 px-3 py-1.5 cursor-pointer transition-colors ${currentMoveIndex === wIndex ? 'bg-[var(--brand-primary)] font-black text-white' : 'hover:bg-[var(--button-bg)] text-[var(--text-secondary)]'}`}
                                    >
                                        {wMove}
                                    </div>
                                    <div 
                                      onClick={() => goToMove(bIndex)} 
                                      className={`col-span-3 px-3 py-1.5 cursor-pointer transition-colors ${!bMove ? '' : currentMoveIndex === bIndex ? 'bg-[var(--brand-primary)] font-black text-white' : 'hover:bg-[var(--button-bg)] text-[var(--text-secondary)]'}`}
                                    >
                                        {bMove || ""}
                                    </div>
                                </div>
                            );
                        })}
                        {history.length === 0 && <div className="text-[var(--text-muted)] text-center mt-10 font-bold uppercase tracking-widest text-[10px] opacity-40">{t("no_moves")}</div>}
                    </div>
                </div>
                
                <div className="mt-auto border-t border-[var(--surface-border)] pt-4 flex flex-col gap-3">
                    <div className="flex bg-[var(--button-bg)] p-1 rounded-xl mb-1 border border-[var(--surface-border)]">
                        <button 
                            onClick={() => setActiveSidebarTab("pgn")}
                            className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeSidebarTab === "pgn" ? 'bg-[var(--brand-primary)] text-white shadow-md' : 'text-[var(--text-muted)] hover:text-white'}`}
                        >
                           <Upload className="w-3 h-3 inline-block mr-1 mb-0.5" /> PGN
                        </button>
                        <button 
                            onClick={() => setActiveSidebarTab("openings")}
                            className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeSidebarTab === "openings" ? 'bg-[var(--brand-primary)] text-white shadow-md' : 'text-[var(--text-muted)] hover:text-white'}`}
                        >
                           <Globe className="w-3 h-3 inline-block mr-1 mb-0.5" /> {t("openings_tab") || "DEBUTS"}
                        </button>
                    </div>

                    {activeSidebarTab === "pgn" ? (
                        <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <textarea 
                               value={pastePgn} 
                               onChange={e => setPastePgn(e.target.value)}
                               placeholder={t("paste_pgn") as string} 
                               className="w-full bg-[var(--button-bg)] border border-[var(--surface-border)] rounded-xl p-4 text-xs font-mono text-[var(--text-primary)] h-28 focus:outline-none focus:border-[var(--brand-primary)] resize-none flex-shrink-0"
                            />
                            <button onClick={loadPgn} disabled={!pastePgn.trim()} className="w-full flex items-center justify-center gap-2 bg-[var(--brand-primary)] hover:opacity-90 disabled:opacity-30 text-white py-3 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg active:scale-95">
                                <Upload className="w-4 h-4"/> {t("load_pgn")}
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2">
                             <div className="flex items-center justify-between mb-1 px-1">
                                <button 
                                    onClick={() => setOpeningPage(p => Math.max(0, p - 1))} 
                                    disabled={openingPage === 0}
                                    className="p-1.5 bg-[var(--button-bg)] border border-[var(--surface-border)] rounded-lg hover:bg-[var(--surface-border)] disabled:opacity-20 transition-all active:scale-90"
                                >
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                                <span className="text-[9px] font-black font-mono tracking-widest text-[var(--brand-primary)] opacity-60 uppercase">Page {openingPage + 1}/3</span>
                                <button 
                                    onClick={() => setOpeningPage(p => Math.min(2, p + 1))} 
                                    disabled={openingPage === 2}
                                    className="p-1.5 bg-[var(--button-bg)] border border-[var(--surface-border)] rounded-lg hover:bg-[var(--surface-border)] disabled:opacity-20 transition-all active:scale-90"
                                >
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                             </div>

                             <div className="grid grid-cols-1 gap-1.5 animate-in fade-in slide-in-from-right-2 duration-300">
                                {TOP_OPENINGS.slice(openingPage * 4, (openingPage + 1) * 4).map((op, localIdx) => {
                                    const i = openingPage * 4 + localIdx;
                                    return (
                                        <div key={i} className="flex flex-col gap-1">
                                            <div className={`flex items-center justify-between border p-2 rounded-xl transition-all group ${
                                                activeOpeningIndex === i 
                                                ? 'bg-[var(--brand-primary)] border-[var(--brand-primary)] shadow-lg shadow-[var(--brand-primary)]/20' 
                                                : 'bg-[var(--button-bg)] border-transparent hover:bg-[var(--brand-primary)]/10 hover:border-[var(--brand-primary)]/30'
                                            }`}>
                                                <button 
                                                    onClick={() => loadOpening(i)}
                                                    className="flex items-center gap-2 flex-1 text-left"
                                                >
                                                    <span className={`text-[10px] font-mono font-black w-4 opacity-40 ${activeOpeningIndex === i ? 'text-white/80' : 'text-[var(--brand-primary)]'}`}>{i+1}.</span>
                                                    <span className={`text-[11px] font-bold truncate ${activeOpeningIndex === i ? 'text-white' : 'text-[var(--text-primary)] group-hover:text-[var(--brand-primary)]'}`}>{op.name}</span>
                                                </button>
                                                
                                                <select 
                                                   onChange={(e) => {
                                                       if (e.target.value) {
                                                           setActiveOpeningIndex(i);
                                                           loadPgnInternal(e.target.value);
                                                       }
                                                   }}
                                                   className={`ml-1 text-[9px] font-bold border border-[var(--surface-border)] rounded-md px-1.5 py-0.5 focus:outline-none max-w-[80px] cursor-pointer ${
                                                       activeOpeningIndex === i 
                                                       ? 'bg-white/20 text-white border-white/30' 
                                                       : 'bg-[var(--settings-bg)] text-[var(--text-muted)]'
                                                   }`}
                                                >
                                                    <option value={op.pgn} className="bg-[var(--settings-bg)]">Main Line</option>
                                                    {op.variations.map((v, vIdx) => (
                                                        <option key={vIdx} value={v.pgn} className="bg-[var(--settings-bg)]">{v.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    );
                                })}
                             </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
}
