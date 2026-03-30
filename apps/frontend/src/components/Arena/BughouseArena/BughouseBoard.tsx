import React, { useRef, useState, useEffect } from "react";
import { Chessboard } from "react-chessboard";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

interface BughouseBoardProps {
  boardIdx: number;
  orientation: "white" | "black";
  fen: string;
  clocks: any;
  playerName: string;
  isMain?: boolean;
  scale?: number;
  theme: { dark: string; light: string };
  customPieces: any;
  onDrop: (boardIdx: number, source: string, target: string, piece?: string) => boolean;
  onSquareClick: (boardIdx: number, square: string) => void;
  formatTime: (ms: number) => string;
  getPlayerLabel: (role: string) => string;
}

export const BughouseBoard: React.FC<BughouseBoardProps> = ({
  boardIdx, orientation, fen, clocks, playerName, isMain, scale = 100, theme, customPieces,
  onDrop, onSquareClick, formatTime, getPlayerLabel
}) => {
  const whiteKey = `w${boardIdx}` as "w0" | "w1";
  const blackKey = `b${boardIdx}` as "b0" | "b1";
  const whiteClock = clocks?.[whiteKey] ?? 0;
  const blackClock = clocks?.[blackKey] ?? 0;

  const bottomClock = orientation === "white" ? whiteClock : blackClock;
  const topClock    = orientation === "white" ? blackClock : whiteClock;
  const bottomRole  = orientation === "white" ? `w${boardIdx}` : `b${boardIdx}`;
  const topRole     = orientation === "white" ? `b${boardIdx}` : `w${boardIdx}`;

  // Measure real pixel width client-side so react-chessboard never sees 0
  const containerRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState<number>(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.offsetWidth;
      if (w > 0) setBoardWidth(w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const safeTheme = theme ?? { dark: "#4d6d4d", light: "#f0f0f0" };
  const safeFen   = (!fen || fen === "start") ? START_FEN : fen;

  return (
    <div className="flex flex-col w-full">
      {/* Top player bar */}
      <div className="flex justify-between items-center px-2 bg-white/5 rounded-t-xl py-1 border border-white/5 border-b-0">
        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest truncate max-w-[60%]">
          {getPlayerLabel(topRole)}
        </div>
        <div className={`text-sm font-mono font-black tabular-nums ${topClock < 30000 ? 'text-red-400' : 'text-white'}`}>
          {formatTime(topClock)}
        </div>
      </div>

      {/* Board — ref lets us measure before Chessboard mounts */}
      <div ref={containerRef} className="aspect-square border-2 border-slate-800 overflow-hidden shadow-xl relative w-full">
        {boardWidth > 0 && (
          <Chessboard
            options={{
              boardWidth,
              position: safeFen,
              boardOrientation: orientation,
              pieces: customPieces,
              darkSquareStyle:  { backgroundColor: safeTheme.dark },
              lightSquareStyle: { backgroundColor: safeTheme.light },
              onPieceDrop: ({ piece, sourceSquare, targetSquare }: any) =>
                onDrop(boardIdx, sourceSquare || piece?.position, targetSquare, piece?.pieceType || piece),
              onSquareClick: ({ square }: any) => onSquareClick(boardIdx, square),
              animationDurationInMs: 200,
            } as any}
          />
        )}
      </div>

      {/* Bottom player bar */}
      <div className="flex justify-between items-center px-2 bg-white/5 rounded-b-xl py-1 border border-white/5 border-t-0">
        <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest truncate max-w-[60%]">
          {getPlayerLabel(bottomRole)}
        </div>
        <div className={`text-sm font-mono font-black tabular-nums ${bottomClock < 30000 ? 'text-red-400' : 'text-white'}`}>
          {formatTime(bottomClock)}
        </div>
      </div>
    </div>
  );
};

