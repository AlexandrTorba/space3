import React from "react";

interface BughouseBankProps {
  bank: string[];
  boardIdx: number;
  playerColor: "w" | "b";
  selectedPiece: {char: string, board: number} | null;
  setSelectedPiece: (piece: {char: string, board: number} | null) => void;
  getPieceUrl: (piece: string) => string;
  placementHint?: string;
  emptyLabel?: string;
}

export const BughouseBank: React.FC<BughouseBankProps> = ({
  bank, boardIdx, playerColor, selectedPiece, setSelectedPiece, getPieceUrl, placementHint, emptyLabel
}) => {
  const isSelected = (p: string) => 
    selectedPiece?.board === boardIdx && selectedPiece?.char === p;

  const hasSelection = selectedPiece?.board === boardIdx;

  return (
    <div className="relative">
      {hasSelection && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-emerald-400 uppercase tracking-widest whitespace-nowrap animate-pulse z-10">
          {placementHint || "Click a square to place"}
        </div>
      )}
      <div className="h-10 bg-white/5 rounded-xl flex items-center px-2 gap-1 border border-white/5 overflow-x-auto custom-scrollbar">
        {bank?.map((p: string, i: number) => {
            const pieceCode = p.length === 1 ? `${playerColor}${p.toUpperCase()}` : p;
            const selected = isSelected(p);
            return (
                <button 
                    key={i} 
                    onClick={() => {
                      if (selected) {
                        setSelectedPiece(null);
                      } else {
                        setSelectedPiece({char: p, board: boardIdx});
                      }
                    }}
                    className={`w-8 h-8 flex-shrink-0 transition-all duration-150 rounded-md ${
                      selected 
                        ? 'scale-110 ring-2 ring-emerald-400 bg-emerald-400/20 shadow-md shadow-emerald-400/20' 
                        : 'hover:scale-105 active:scale-95 hover:bg-white/10'
                    }`}
                >
                    <img src={getPieceUrl(pieceCode)} alt={p} className="w-full h-full object-contain drop-shadow-md" />
                </button>
            );
        })}
        {(!bank || bank.length === 0) && (
            <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest px-2">{emptyLabel || "Empty"}</div>
        )}
      </div>
    </div>
  );
};
