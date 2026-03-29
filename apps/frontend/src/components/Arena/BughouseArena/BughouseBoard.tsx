import React from "react";
import * as ReactChessboard from "react-chessboard";

// Flexible import to handle different module versions
const Chessboard = (ReactChessboard as any).Chessboard || (ReactChessboard as any).default || ReactChessboard;

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
  // Clock assignment: always white=w{boardIdx}, black=b{boardIdx}, independent of visual orientation
  const whiteKey = `w${boardIdx}` as "w0" | "w1";
  const blackKey = `b${boardIdx}` as "b0" | "b1";
  const whiteClock = clocks[whiteKey];
  const blackClock = clocks[blackKey];

  // In "white" orientation: white is at BOTTOM, black at TOP
  // In "black" orientation: black is at BOTTOM, white at TOP
  const bottomClock = orientation === "white" ? whiteClock : blackClock;
  const topClock = orientation === "white" ? blackClock : whiteClock;
  // Labels: always show the player who is actually at that position
  // white player = w{boardIdx}, black player = b{boardIdx}
  const bottomRole = orientation === "white" ? `w${boardIdx}` : `b${boardIdx}`;
  const topRole = orientation === "white" ? `b${boardIdx}` : `w${boardIdx}`;

  if (!Chessboard || typeof Chessboard !== 'function') {
    return <div className="p-8 text-white bg-red-500/20 rounded-2xl border border-red-500/50">Chessboard Error</div>;
  }

  const baseWidth = isMain ? 700 : 500;
  const scaledWidth = (baseWidth * scale) / 100;

  return (
    <div 
      className="flex flex-col gap-4 transition-all duration-300 ease-out origin-top"
      style={{ 
        width: '100%', 
        maxWidth: `${scaledWidth}px` 
      }}
    >
        <div className="flex justify-between items-center px-4 bg-white/5 rounded-t-2xl py-2 border border-white/5">
            <div className="text-sm font-black text-slate-400 uppercase tracking-widest">
              {getPlayerLabel(topRole)}
            </div>
            <div className="text-2xl font-mono font-bold text-white">
              {formatTime(topClock)}
            </div>
        </div>

        <div className="aspect-square border-4 border-slate-900 rounded-2xl overflow-hidden shadow-2xl relative">
            <Chessboard 
               position={fen}
               boardOrientation={orientation}
               pieces={customPieces}
               darkSquareStyle={{ backgroundColor: theme.dark }}
               lightSquareStyle={{ backgroundColor: theme.light }}
               onPieceDrop={({ piece, sourceSquare, targetSquare }: any) => 
                  onDrop(boardIdx, sourceSquare, targetSquare, piece)
               }
               onSquareClick={({ square }: any) => onSquareClick(boardIdx, square)}
               animationDurationInMs={300}
            />
        </div>

        <div className="flex justify-between items-center px-4 bg-white/5 rounded-b-2xl py-2 border border-white/5">
            <div className="text-sm font-black text-slate-400 uppercase tracking-widest">
              {getPlayerLabel(bottomRole)}
            </div>
            <div className="text-2xl font-mono font-bold text-white">
              {formatTime(bottomClock)}
            </div>
        </div>
    </div>
  );
};
