import React from "react";
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
  const whiteClock = clocks[whiteKey];
  const blackClock = clocks[blackKey];

  const bottomClock = orientation === "white" ? whiteClock : blackClock;
  const topClock = orientation === "white" ? blackClock : whiteClock;
  const bottomRole = orientation === "white" ? `w${boardIdx}` : `b${boardIdx}`;
  const topRole = orientation === "white" ? `b${boardIdx}` : `w${boardIdx}`;

  if (!Chessboard || typeof Chessboard !== 'function') {
    return <div className="p-4 text-white bg-red-500/20 rounded-xl border border-red-500/50 text-sm">Board Error</div>;
  }

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

        {/* Board */}
        <div className="aspect-square border-2 border-slate-800 overflow-hidden shadow-xl relative">
            <Chessboard 
               options={{
                 position: (!fen || fen === "start") ? START_FEN : fen,
                 boardOrientation: orientation,
                 pieces: customPieces,
                 darkSquareStyle: { backgroundColor: theme.dark },
                 lightSquareStyle: { backgroundColor: theme.light },
                 onPieceDrop: ({ piece, sourceSquare, targetSquare }: any) =>
                    onDrop(boardIdx, sourceSquare || piece?.position, targetSquare, piece?.pieceType || piece),
                 onSquareClick: ({ square }: any) => onSquareClick(boardIdx, square),
                 animationDurationInMs: 200,
               }}
            />
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
