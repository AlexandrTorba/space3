"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import React from "react";
import { ChevronLeft, ChevronRight, Activity, SkipBack, SkipForward, ArrowLeft, Upload, Cpu, Globe, Plus, Trash2, Edit, Layers } from "lucide-react";
import { Chess, Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import JSZip from "jszip";
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

interface AnalysisVersion {
  id: string;
  name: string;
  fen: string;
  history: string[];
}

export default function HomeAnalysisView() {
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
  
  const [versions, setVersions] = useState<AnalysisVersion[]>([
    { id: 'v1', name: 'Analysis 1', fen: new Chess().fen(), history: [] }
  ]);
  const [activeVersionId, setActiveVersionId] = useState('v1');
  const [evaluation, setEvaluation] = useState<string>("0.0");
  const [pastePgn, setPastePgn] = useState("");
  
  const [pendingPromotion, setPendingPromotion] = useState<{from: string; to: string; color: string} | null>(null);
  
  const [isBotActive, setIsBotActive] = useState(false);
  const [botColor, setBotColor] = useState<"white" | "black">("black");
  const [resolvedBotColor, setResolvedBotColor] = useState<"white" | "black" | null>(null);
  const [botThinking, setBotThinking] = useState(false);
  const [preMove, setPreMove] = useState<{from: string; to: string} | null>(null);
  
  const sfWorker = useRef<Worker | null>(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState<"pgn" | "openings" | "versions">("versions");
  const [activeOpeningIndex, setActiveOpeningIndex] = useState<number | null>(null);
  const [lastMoveSquares, setLastMoveSquares] = useState<{[sq: string]: boolean}>({});
  const [openingPage, setOpeningPage] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [hasHydrated, setHasHydrated] = useState(false);

  // Persistence: Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("ag_analysis_versions");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setVersions(parsed);
          setActiveVersionId(parsed[0].id);
          const initialV = parsed[0];
          const engine = new Chess();
          for(const m of initialV.history) engine.move(m);
          gameRef.current = engine;
          setFen(engine.fen());
          setHistory(engine.history());
        }
      } catch (e) {}
    }
    setHasHydrated(true);
  }, []);

  // Persistence: Save to localStorage
  useEffect(() => {
    if (hasHydrated) {
      localStorage.setItem("ag_analysis_versions", JSON.stringify(versions));
    }
  }, [versions, hasHydrated]);

  // Refs for Stockfish worker to avoid restarts while keeping fresh state access
  const isBotActiveRef = useRef(isBotActive);
  const resolvedBotColorRef = useRef(resolvedBotColor);
  const botThinkingRef = useRef(botThinking);
  useEffect(() => { isBotActiveRef.current = isBotActive; }, [isBotActive]);
  useEffect(() => { resolvedBotColorRef.current = resolvedBotColor; }, [resolvedBotColor]);
  useEffect(() => { botThinkingRef.current = botThinking; }, [botThinking]);

  const TOP_OPENINGS = [
    { 
      nameKey: "op_sicilian", 
      pgn: "1. e4 c5",
      variations: [
        { nameKey: "op_sicilian_najdorf", pgn: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6" },
        { nameKey: "op_sicilian_paulsen", pgn: "1. e4 c5 2. Nf3 e6 3. d4 cxd4 4. Nxd4 a6" },
        { nameKey: "op_sicilian_classical", pgn: "1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 Nc6" },
        { nameKey: "op_sicilian_alapin", pgn: "1. e4 c5 2. c3" },
        { nameKey: "op_sicilian_closed", pgn: "1. e4 c5 2. Nc3" }
      ]
    },
    { 
      nameKey: "op_ruy_lopez", 
      pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5",
      variations: [
        { nameKey: "op_ruy_lopez_closed", pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6" },
        { nameKey: "op_ruy_lopez_berlin", pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6" },
        { nameKey: "op_ruy_lopez_exchange", pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Bxc6" },
        { nameKey: "op_ruy_lopez_open", pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Nxe4" },
        { nameKey: "op_ruy_lopez_anti_marshall", pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. a4" }
      ]
    },
    { 
      nameKey: "op_italian", 
      pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4",
      variations: [
        { nameKey: "op_italian_piano", pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5" },
        { nameKey: "op_italian_two_knights", pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6" },
        { nameKey: "op_italian_evans", pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. b4" },
        { nameKey: "op_italian_pianissimo", pgn: "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. d3" }
      ]
    },
    { 
      nameKey: "op_queens_gambit", 
      pgn: "1. d4 d5 2. c4",
      variations: [
        { nameKey: "op_qg_declined", pgn: "1. d4 d5 2. c4 e6" },
        { nameKey: "op_qg_accepted", pgn: "1. d4 d5 2. c4 dxc4" },
        { nameKey: "op_qg_slav", pgn: "1. d4 d5 2. c4 c6" },
        { nameKey: "op_qg_exchange", pgn: "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. cxd5 exd5" },
        { nameKey: "op_qg_tarrasch", pgn: "1. d4 d5 2. c4 e6 3. Nc3 c5" },
        { nameKey: "op_qg_cambridge", pgn: "1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Nbd7 5. e3 c6 6. Nf3 Qa5" },
        { nameKey: "op_qg_albin", pgn: "1. d4 d5 2. c4 e5" }
      ]
    },
    { 
      nameKey: "op_english", 
      pgn: "1. c4",
      variations: [
        { nameKey: "op_english_sym", pgn: "1. c4 c5" },
        { nameKey: "op_english_rev", pgn: "1. c4 e5" },
        { nameKey: "op_english_ind", pgn: "1. c4 Nf6" },
        { nameKey: "op_english_mf", pgn: "1. c4 Nf6 2. Nc3 e6 3. e4" },
        { nameKey: "op_english_df", pgn: "1. c4 c5 2. Nc3 Nc6 3. g3 g6 4. Bg2 Bg7 5. Nf3 Nf6 6. O-O O-O" },
        { nameKey: "op_english_ad", pgn: "1. c4 f5" }
      ]
    },
    { 
      nameKey: "op_carokann", 
      pgn: "1. e4 c6",
      variations: [
        { nameKey: "op_ck_classical", pgn: "1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5" },
        { nameKey: "op_ck_advance", pgn: "1. e4 c6 2. d4 d5 3. e5" },
        { nameKey: "op_ck_panov", pgn: "1. e4 c6 2. d4 d5 3. exd5 cxd5 4. c4" },
        { nameKey: "op_ck_steiner", pgn: "1. e4 c6 2. c4" },
        { nameKey: "op_ck_exchange", pgn: "1. e4 c6 2. d4 d5 3. exd5 cxd5 4. Bd3" }
      ]
    },
    { 
      nameKey: "op_grunfeld", 
      pgn: "1. d4 Nf6 2. c4 g6 3. Nc3 d5",
      variations: [
        { nameKey: "op_gr_modern", pgn: "1. d4 Nf6 2. c4 g6 3. Nc3 d5 4. Nf3 Bg7 5. Bf4" },
        { nameKey: "op_gr_exchange", pgn: "1. d4 Nf6 2. c4 g6 3. Nc3 d5 4. cxd5 Nxd5 5. e4" }
      ]
    },
    { 
      nameKey: "op_french", 
      pgn: "1. e4 e6",
      variations: [
        { nameKey: "op_fr_paulsen", pgn: "1. e4 e6 2. d4 d5 3. Nc3 Nf6" },
        { nameKey: "op_fr_winawer", pgn: "1. e4 e6 2. d4 d5 3. Nc3 Bb4" },
        { nameKey: "op_fr_tarrasch", pgn: "1. e4 e6 2. d4 d5 3. Nd2" }
      ]
    },
    { 
      nameKey: "op_kings_indian", 
      pgn: "1. d4 Nf6 2. c4 g6",
      variations: [
        { nameKey: "op_ki_classical", pgn: "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5" },
        { nameKey: "op_ki_saemisch", pgn: "1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. f3" },
        { nameKey: "op_ki_fianchetto", pgn: "1. d4 Nf6 2. c4 g6 3. Nf3 Bg7 4. g3 O-O 5. Bg2 d6" }
      ]
    },
    { 
      nameKey: "op_catalan", 
      pgn: "1. d4 Nf6 2. c4 e6 3. g3 d5",
      variations: [
        { nameKey: "op_ca_open", pgn: "1. d4 Nf6 2. c4 e6 3. g3 d5 4. Bg2 dxc4" },
        { nameKey: "op_ca_closed", pgn: "1. d4 Nf6 2. c4 e6 3. g3 d5 4. Bg2 c6" }
      ]
    },
    { 
      nameKey: "op_slav", 
      pgn: "1. d4 d5 2. c4 c6",
      variations: [
        { nameKey: "op_sl_meran", pgn: "1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 e6 5. e3 Nbd7 6. Bd3 dxc4 7. Bxc4 b5" }
      ]
    },
    { 
      nameKey: "op_pirc", 
      pgn: "1. e4 d6",
      variations: [
        { nameKey: "op_pi_austrian", pgn: "1. e4 d6 2. d4 Nf6 3. Nc3 g6 4. f4" }
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
          
          if (line.startsWith("bestmove ") && isBotActiveRef.current) {
             const moveUci = line.split(" ")[1];
             if (moveUci !== "(none)" && isBotMoving.current) {
                const from = moveUci.substring(0, 2);
                const to = moveUci.substring(2, 4);
                const promotion = moveUci.length > 4 ? moveUci[4] : undefined;
                
                try {
                  // Only apply if it's actually the bot's turn to avoid race conditions
                  if (resolvedBotColorRef.current && gameRef.current.turn() === resolvedBotColorRef.current[0]) {
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
    }
    return () => sfWorker.current?.terminate();
  }, []);

  // Update Stockfish options without restarting the worker
  useEffect(() => {
    if (sfWorker.current) {
       sfWorker.current.postMessage(`setoption name Threads value ${settings.engineThreads}`);
       sfWorker.current.postMessage(`setoption name Hash value ${settings.engineHash}`);
       sfWorker.current.postMessage(`setoption name MultiPV value ${settings.engineMultiPV}`);
       sfWorker.current.postMessage("setoption name UCI_LimitStrength value true");
       sfWorker.current.postMessage(`setoption name UCI_Elo value ${settings.botElo}`);
    }
  }, [settings.botElo, settings.engineThreads, settings.engineHash, settings.engineMultiPV]);

   useEffect(() => {
    if (isBotActive && resolvedBotColor && !botThinking && gameRef.current.turn() === resolvedBotColor[0]) {
       setBotThinking(true);
       isBotMoving.current = true;
       sfWorker.current?.postMessage("stop"); 
       sfWorker.current?.postMessage(`position fen ${gameRef.current.fen()}`);
       
       // Dynamic think time: 1500 ELO -> 1000ms, 2500 ELO -> 3000ms
       const movetime = 1000 + Math.max(0, (settings.botElo - 1500) * 2);
       sfWorker.current?.postMessage(`go movetime ${movetime}`);
    }
  }, [isBotActive, fen, resolvedBotColor, botThinking, settings.botElo]);

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
      setPastePgn(gameRef.current.pgn());
      setCurrentMoveIndex(newHistory.length - 1);

      // Sync specific version
      setVersions(prev => prev.map(v => 
        v.id === activeVersionId ? { ...v, fen: currentFen, history: newHistory } : v
      ));

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

  const switchVersion = (id: string) => {
    const v = versions.find(v => v.id === id);
    if (!v) return;
    setActiveVersionId(id);
    const engine = new Chess(v.fen);
    // history in version might be shorter than moves needed to reach fen if it's a branch
    // but we use actual history from version
    try {
        const fullEngine = new Chess();
        for(const m of v.history) fullEngine.move(m);
        gameRef.current = fullEngine;
    } catch(e) {
        gameRef.current = engine;
    }
    
    setFen(gameRef.current.fen());
    setHistory(gameRef.current.history());
    setPastePgn(gameRef.current.pgn());
    setCurrentMoveIndex(gameRef.current.history().length - 1);
    setLastMoveSquares({});
    setPreMove(null);
    setActiveOpeningIndex(null);
    triggerAnalysis();
  };

  const createNewVersion = () => {
    const newId = `v-${Date.now()}`;
    const newVersion: AnalysisVersion = {
      id: newId,
      name: `Analysis ${versions.length + 1}`,
      fen: gameRef.current.fen(),
      history: [...gameRef.current.history()]
    };
    setVersions(prev => [...prev, newVersion]);
    setActiveVersionId(newId);
  };

  const deleteVersion = (id: string) => {
    if (versions.length <= 1) return;
    setVersions(prev => {
        const remaining = prev.filter(v => v.id !== id);
        if (id === activeVersionId) {
            setTimeout(() => switchVersion(remaining[0].id), 0);
        }
        return remaining;
    });
  };

  const renameVersion = (id: string) => {
    const v = versions.find(v => v.id === id);
    const newName = prompt("Enter version name", v?.name);
    if (newName) {
        setVersions(prev => prev.map(v => v.id === id ? { ...v, name: newName } : v));
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
             engine.load(cleanPgn);
             success = true;
          } catch(e) {}

          if (!success) {
              try {
                  engine.loadPgn(cleanPgn); 
                  success = true;
              } catch(err) {}
          }

          if (!success) {
             const strippedMoves = cleanPgn.split('\n\n').pop()?.trim() || cleanPgn;
             try {
                engine.loadPgn(strippedMoves);
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
          setLastMoveSquares({}); // Clear highlight on fresh load
      } catch (e) {
          alert("Error parsing string");
      }
  };



  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Security: Limit overall file size to 10MB to avoid browser hang/crash
      if (file.size > 10 * 1024 * 1024) {
          alert(t("file_too_large") as any || "File too large (Max 10MB)");
          return;
      }
      
      setLoading(true);
      try {
          if (file.name.toLowerCase().endsWith(".zip")) {
              const zip = new JSZip();
              const content = await zip.loadAsync(file);
              
              // Filter out directories and metadata files (like MacOSX trash)
              const pgnFile = Object.values(content.files).find(f => 
                  !f.dir && 
                  !f.name.includes("__MACOSX") && 
                  (f.name.toLowerCase().endsWith(".pgn") || f.name.toLowerCase().endsWith(".fen"))
              );

              if (pgnFile) {
                  const data = await pgnFile.async("string");
                  // Security: Limit extracted text content size (5MB limit)
                  if (data.length > 5 * 1024 * 1024) {
                     alert(t("content_too_large") as any || "Extracted content is too large");
                     return;
                  }
                  loadPgnInternal(data);
              } else {
                  alert(t("no_chess_file_found") as any || "No PGN or FEN found in archive");
              }
          } else {
              const text = await file.text();
              // Security: Limit direct text file size
              if (text.length > 5 * 1024 * 1024) {
                 alert("Content size exceeded");
                 return;
              }
              loadPgnInternal(text);
          }
      } catch (e) {
          alert("Error loading file");
      } finally {
          setLoading(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
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
       const engine = new Chess();
       for(let i = 0; i <= currentMoveIndex; i++) {
           try { engine.move(history[i]); } catch(e) {}
       }
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
    <div className="w-full animate-in fade-in duration-500">
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
                <div className="flex items-center gap-3 mt-4 bg-[var(--surface-glass)] border border-[var(--surface-border)] px-4 py-2 rounded-full w-full max-w-[min(650px,60vh)] md:max-w-[min(650px,65vh)] justify-center shadow-xl backdrop-blur-md relative">
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
                
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[var(--surface-border)]">
                    <button 
                        onClick={() => setIsBotActive(!isBotActive)}
                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all shadow-lg active:scale-95 ${
                            isBotActive 
                                ? 'bg-amber-600/20 border border-amber-500/40 text-amber-500' 
                                : 'bg-[var(--brand-primary)] border border-white/10 text-white shadow-[var(--brand-primary)]/20'
                        }`}
                    >
                        <Cpu className={`w-4 h-4 ${botThinking ? 'animate-spin' : ''}`} />
                         {botThinking ? t("bot_thinking") : `${t("play_with_bot")} (${settings.botElo})`}
                    </button>
                    
                    <div className="flex bg-[var(--button-bg)] p-1.5 rounded-xl border border-[var(--surface-border)] focus-within:border-[var(--brand-primary)] transition-colors h-[42px] items-center min-w-[50px]">
                         <select 
                            value={botColor} 
                            onChange={e => setBotColor(e.target.value as any)} 
                            disabled={isBotActive && botThinking}
                            className="bg-transparent border-none text-[var(--text-primary)] w-full font-black focus:outline-none appearance-none cursor-pointer text-[10px] text-center"
                         >
                            <option value="black" className="bg-[var(--settings-bg)]">⚫</option>
                            <option value="white" className="bg-[var(--settings-bg)]">⚪</option>
                         </select>
                    </div>
                </div>
                
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
                            onClick={() => setActiveSidebarTab("versions")}
                            className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeSidebarTab === "versions" ? 'bg-[var(--brand-primary)] text-white shadow-md' : 'text-[var(--text-muted)] hover:text-white'}`}
                        >
                           <Layers className="w-3 h-3 inline-block mr-1 mb-0.5" /> {t("versions") || "VERSIONS"}
                        </button>
                        <button 
                            onClick={() => setActiveSidebarTab("openings")}
                            className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeSidebarTab === "openings" ? 'bg-[var(--brand-primary)] text-white shadow-md' : 'text-[var(--text-muted)] hover:text-white'}`}
                        >
                           <Globe className="w-3 h-3 inline-block mr-1 mb-0.5" /> {t("openings_tab") || "DEBUTS"}
                        </button>
                        <button 
                            onClick={() => setActiveSidebarTab("pgn")}
                            className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeSidebarTab === "pgn" ? 'bg-[var(--brand-primary)] text-white shadow-md' : 'text-[var(--text-muted)] hover:text-white'}`}
                        >
                           <Upload className="w-3 h-3 inline-block mr-1 mb-0.5" /> PGN
                        </button>
                    </div>

                    <div className="h-[200px] flex flex-col overflow-hidden">
                        {activeSidebarTab === "versions" ? (
                             <div className="flex flex-col gap-2 h-full animate-in fade-in slide-in-from-left-2 duration-300">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{versions.length} {t("saved_versions") || "Branches"}</span>
                                    <button 
                                        onClick={createNewVersion}
                                        className="p-1.5 bg-[var(--brand-primary)]/10 hover:bg-[var(--brand-primary)] text-[var(--brand-primary)] hover:text-white rounded-lg transition-all border border-[var(--brand-primary)]/20 shadow-sm"
                                        title={t("new_version") || "New Branch"}
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 scrollbar-thin scrollbar-thumb-white/10">
                                    {versions.map((v) => (
                                        <div 
                                            key={v.id} 
                                            className={`group flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                                                activeVersionId === v.id 
                                                ? 'bg-[var(--brand-primary)]/10 border-[var(--brand-primary)]/50' 
                                                : 'bg-white/5 border-transparent hover:border-white/10'
                                            }`}
                                        >
                                              <button 
                                                  onClick={() => switchVersion(v.id)}
                                                  className="flex-1 text-left min-w-0 mr-2"
                                              >
                                                  <div className={`text-[11px] font-bold truncate ${activeVersionId === v.id ? 'text-[var(--brand-primary)]' : 'text-slate-300'}`}>{v.name}</div>
                                                  <div className="flex items-center gap-2 mt-0.5">
                                                      <div className="text-[9px] text-slate-500 font-mono">{v.history.length || 0} moves</div>
                                                      {v.history.length > 0 && (
                                                          <div className="text-[8px] px-1.5 py-0.5 bg-white/10 rounded-md text-white/50 font-bold uppercase tracking-wider">
                                                              {v.history[v.history.length - 1]}
                                                          </div>
                                                      )}
                                                  </div>
                                              </button>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => renameVersion(v.id)} className="p-1.5 hover:bg-white/10 rounded-md text-slate-400 hover:text-white"><Edit className="w-3 h-3" /></button>
                                                <button onClick={() => deleteVersion(v.id)} disabled={versions.length <= 1} className="p-1.5 hover:bg-red-500/20 rounded-md text-slate-400 hover:text-red-400 disabled:opacity-0"><Trash2 className="w-3 h-3" /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                             </div>
                        ) : activeSidebarTab === "pgn" ? (
                            <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300 h-full">
                                <textarea 
                                   value={pastePgn} 
                                   onChange={e => setPastePgn(e.target.value)}
                                   placeholder="PGN / FEN" 
                                   className="w-full bg-[var(--button-bg)] border border-[var(--surface-border)] rounded-xl p-3 text-[10px] font-mono text-[var(--text-primary)] h-[90px] focus:outline-none focus:border-[var(--brand-primary)] resize-none"
                                />
                                <div className="flex gap-2">
                                     <button onClick={loadPgn} disabled={!pastePgn.trim()} className="flex-1 flex items-center justify-center gap-2 bg-[var(--brand-primary)] hover:opacity-90 disabled:opacity-30 text-white py-2.5 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all shadow-lg active:scale-95">
                                        <Activity className="w-3.5 h-3.5"/> OK
                                    </button>
                                    <button 
                                        onClick={() => fileInputRef.current?.click()} 
                                        className="flex-1 flex items-center justify-center gap-2 bg-[var(--button-bg)] border border-[var(--surface-border)] hover:bg-[var(--surface-border)] text-white py-2.5 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all active:scale-95"
                                    >
                                        <Upload className={loading ? 'animate-spin w-3.5 h-3.5' : 'w-3.5 h-3.5'}/> {loading ? t("loading_zip") : t("load_file")}
                                    </button>
                                </div>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    accept=".pgn,.fen,.zip" 
                                    onChange={handleFileUpload}
                                />
                                <div className="text-[9px] text-center text-[var(--text-muted)] opacity-50 font-black tracking-widest uppercase">
                                    {t("upload_hint")}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2 h-full">
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
                                                    : 'bg-[var(--button-bg)] border-transparent hover:bg-[var(--brand-primary)]/20 hover:border-[var(--brand-primary)]/40 hover:shadow-md'
                                                }`}>
                                                    <button 
                                                        onClick={() => loadOpening(i)}
                                                        className="flex items-center gap-2 flex-1 text-left min-w-0"
                                                    >
                                                        <span className={`text-[10px] font-mono font-black w-4 flex-shrink-0 transition-colors ${activeOpeningIndex === i ? 'text-white/80' : 'text-[var(--brand-primary)] group-hover:text-[var(--brand-primary)]'}`}>{i+1}.</span>
                                                        <span className={`text-[11px] font-bold truncate pr-1 transition-colors ${activeOpeningIndex === i ? 'text-white' : 'text-[var(--text-primary)] group-hover:text-white'}`}>{t(op.nameKey as any)}</span>
                                                    </button>
                                                    
                                                    <select 
                                                       onChange={(e) => {
                                                           if (e.target.value) {
                                                               setActiveOpeningIndex(i);
                                                               loadPgnInternal(e.target.value);
                                                           }
                                                       }}
                                                       className={`text-[9px] font-bold border border-[var(--surface-border)] rounded-md px-1.5 py-0.5 focus:outline-none max-w-[85px] cursor-pointer flex-shrink-0 ${
                                                           activeOpeningIndex === i 
                                                           ? 'bg-white/20 text-white border-white/30' 
                                                           : 'bg-[var(--settings-bg)] text-[var(--text-muted)]'
                                                       }`}
                                                    >
                                                        <option value={op.pgn} className="bg-[var(--settings-bg)]">Main Line</option>
                                                        {op.variations.map((v, vIdx) => (
                                                            <option key={vIdx} value={v.pgn} className="bg-[var(--settings-bg)]">{t(v.nameKey as any)}</option>
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
    </div>
  );
}
