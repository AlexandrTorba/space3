import React from "react";

interface BughouseBankProps {
  bank: string[];
  boardIdx: number;
  playerColor: "w" | "b";
  selectedPiece: {char: string, board: number} | null;
  setSelectedPiece: (piece: {char: string, board: number} | null) => void;
  getPieceUrl: (piece: string) => string;
}

export const BughouseBank: React.FC<BughouseBankProps> = ({
  bank, boardIdx, playerColor, selectedPiece, setSelectedPiece, getPieceUrl
}) => {
  const isSelected = (p: string) => 
    selectedPiece?.board === boardIdx && selectedPiece?.char === p;

  return (
    <div className="relative">
      <div className="h-16 bg-white/5 rounded-2xl flex items-center px-4 gap-3 border border-white/5 overflow-x-auto custom-scrollbar">
        {bank?.map((p: string, i: number) => {
            const pieceCode = p.length === 1 ? `${playerColor}${p.toUpperCase()}` : p;
            const selected = isSelected(p);
            return (
                <button 
                    key={i} 
                    onClick={() => {
                      if (selected) {
                        setSelectedPiece(null); // Deselect on re-click
                      } else {
                        setSelectedPiece({char: p, board: boardIdx});
                      }
                    }}
                    className={`w-10 h-10 flex-shrink-0 transition-all duration-200 rounded-lg ${
                      selected 
                        ? 'scale-125 ring-2 ring-emerald-400 bg-emerald-400/20 shadow-lg shadow-emerald-400/30' 
                        : 'hover:scale-110 active:scale-95'
                    }`}
                >
                    <img src={getPieceUrl(pieceCode)} alt={p} className="w-full h-full object-contain drop-shadow-lg" />
                </button>
            );
        })}
        {(!bank || bank.length === 0) && (
            <div className="text-[10px] font-black text-slate-600 uppercase tracking-widest px-2">Empty Bank</div>
        )}
      </div>
      {selectedPiece?.board === boardIdx && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-emerald-400 uppercase tracking-widest whitespace-nowrap animate-pulse">
          Click a square to place
        </div>
      )}
    </div>
  );
};
