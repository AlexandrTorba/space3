"use client";

import React, { useEffect, useState, useRef, useMemo, Component, ErrorInfo } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Swords, Settings, RotateCcw, Video, VideoOff, CheckCircle, Volume2, VolumeX, Mic, MicOff, MessageSquare } from "lucide-react";
import { useSettingsContext } from "@/providers/SettingsProvider";
import { create, toBinary, fromBinary } from "@bufbuild/protobuf";
import { MatchUpdateSchema } from "@antigravity/contracts";
import { useTranslation } from "@/i18n";
import { useSettings, boardThemes } from "@/hooks/useSettings";
import DailyIframe from "@daily-co/daily-js";
import VideoChat from "./VideoChat";
import { BughouseBoard } from "./BughouseArena/BughouseBoard";
import { BughouseLobby } from "./BughouseArena/BughouseLobby";
import { BughouseBank } from "./BughouseArena/BughouseBank";
import { BughouseActivityLogs } from "./BughouseArena/BughouseActivityLogs";

const piecesLabels = ["wP", "wN", "wB", "wR", "wQ", "wK", "bP", "bN", "bB", "bR", "bQ", "bK"];

// Error Boundary — prevents "This page couldn't load" on render errors
class BughouseErrorBoundary extends Component<{children: React.ReactNode}, {hasError: boolean; error: Error | null}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[BughouseArena] Render error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#07090E] flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-xl font-black text-white">Помилка завантаження</h1>
          <p className="text-slate-400 text-sm max-w-xs">
            {this.state.error?.message || 'Сталася помилка в арені Bughouse.'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-all active:scale-95"
          >
            🔄 Перезавантажити
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function BughouseArena() {
  const [mounted, setMounted] = useState(false);
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const role = searchParams?.get("role") || "spectator"; 

  const { t } = useTranslation();
  const { settings, updateSettings, getPieceUrl } = useSettings();
  const { setIsPanelOpen } = useSettingsContext();

  const urlRef = useRef(getPieceUrl);
  urlRef.current = getPieceUrl;

  const stableCustomPieces = useMemo(() => {
    const p: any = {};
    piecesLabels.forEach(label => {
      p[label] = (props: any) => (
        <img 
          src={urlRef.current(label)} 
          style={props.svgStyle} 
          className="w-full h-full object-contain pointer-events-none" 
          alt={label} 
        />
      );
    });
    return p;
  }, []);

  const [state, setState] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedPiece, setSelectedPiece] = useState<{char: string, board: number} | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{boardIdx: number, source: string, target: string} | null>(null);
  const [clocks, setClocks] = useState({ w0: 180000, b0: 180000, w1: 180000, b1: 180000 });
  const [rematchState, setRematchState] = useState<"default" | "offered" | "waiting">("default");
  const [playerName, setPlayerName] = useState("Player");
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const [partnerOrientation, setPartnerOrientation] = useState<"white" | "black">("black");
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCamOn, setIsCamOn] = useState(false);
  const [videoAuthorized, setVideoAuthorized] = useState(false);
  const [videoHeight, setVideoHeight] = useState(180);
  const [boardScale, setBoardScale] = useState(100);
  const [mobileTab, setMobileTab] = useState<'chat' | 'video'>('chat');
  const [chatInput, setChatInput] = useState("");
  // Detect screen orientation for adaptive layout
  const [isLandscape, setIsLandscape] = useState(false);
  const [mySessionId, setMySessionId] = useState<string | null>(null);
  
  const [team0Name, setTeam0Name] = useState("Team White");
  const [team1Name, setTeam1Name] = useState("Team Black");
  const [spectators, setSpectators] = useState<{id: string, name: string}[]>([]);
  const [adminSessionId, setAdminSessionId] = useState("");

  const wsRef = useRef<WebSocket | null>(null);
  const router = useRouter(); 

  const updateTeamName = (team: "team0" | "team1", name: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const u = create(MatchUpdateSchema, { 
        event: { 
            case: "lobby", 
            value: { 
                type: "team_name", 
                role: team, 
                name 
            } as any 
        } 
    });
    wsRef.current.send(toBinary(MatchUpdateSchema, u));
  };


  const assignRole = (targetSessionId: string, targetRole: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const u = create(MatchUpdateSchema, { 
        event: { 
            case: "lobby", 
            value: { 
                type: "force_assign", 
                role: targetRole, 
                name: targetSessionId // Using name field as carried sessionId for simplicity in custom action
            } as any 
        } 
    });
    wsRef.current.send(toBinary(MatchUpdateSchema, u));
  };

  const toggleGlobalMic = () => {
    const call = DailyIframe.getCallInstance();
    if (call) {
      call.setLocalAudio(!isMicOn);
    }
    setIsMicOn(!isMicOn);
  };

  const toggleGlobalCam = () => {
    const call = DailyIframe.getCallInstance();
    if (call) {
      call.setLocalVideo(!isCamOn);
      setIsCamOn(!isCamOn);
    } else {
      setIsCamOn(!isCamOn);
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
       const u = create(MatchUpdateSchema, {
          event: { case: "chat", value: { text: chatInput, sender: "", timestamp: BigInt(Date.now()) } }
       });
       wsRef.current.send(toBinary(MatchUpdateSchema, u));
       setChatInput("");
    }
  };

  const flipBoards = () => {
    setBoardOrientation(prev => prev === "white" ? "black" : "white");
    setPartnerOrientation(prev => prev === "white" ? "black" : "white");
  };

  // Separate effect for orientation tracking with proper cleanup
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(orientation: landscape)');
    setIsLandscape(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsLandscape(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    setMounted(true);
    if (typeof window === "undefined") return;
    const name = localStorage.getItem("ag_name") || "Player";
    setPlayerName(name);

    // Set orientations based on role (must be client-side to avoid SSR mismatch)
    if (role.startsWith("b")) {
      setBoardOrientation("black");
      setPartnerOrientation("white");
    } else {
      setBoardOrientation("white");
      setPartnerOrientation("black");
    }

    const isProd = typeof window !== "undefined" && (window.location.protocol === "https:" || window.location.hostname !== 'localhost');
    
    // Check multiple possible env vars for backend URL
    const envBackendUrl = process.env.NEXT_PUBLIC_EDGE_URL || 
                          process.env.NEXT_PUBLIC_BACKEND_URL || 
                          process.env.NEXT_PUBLIC_API_URL;

    let host = "";
    if (envBackendUrl) {
      try {
        host = new URL(envBackendUrl).host;
      } catch (e) {
        host = envBackendUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
      }
    } else {
      host = isProd ? window.location.hostname : window.location.hostname + ":8787";
    }

    const protocol = (host.includes('localhost') || host.includes('127.0.0.1')) ? "ws:" : "wss:";
    const wsUrl = `${protocol}//${host}/bughouse/${id}?name=${encodeURIComponent(name)}&role=${role}`;
    
    console.log("[BUGHOUSE] Connecting to:", wsUrl);
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onmessage = async (ev) => {
       if (typeof ev.data === 'string') {
          try {
             const data = JSON.parse(ev.data);
             if (data.type === 'video_enabled') {
                setVideoAuthorized(data.enabled);
             } else if (data.type === 'session_id') {
                setMySessionId(data.id);
             } else if (data.type === 'lobby_sync') {
                setSpectators(data.spectators || []);
                setAdminSessionId(data.adminSessionId || "");
             } else if (data.type === 'debug') {
                console.warn('[BUGHOUSE SERVER DEBUG]', data.msg);
             }
          } catch(e) {}
          return;
       }
       if (!(ev.data instanceof ArrayBuffer)) return;
       const update = fromBinary(MatchUpdateSchema, new Uint8Array(ev.data));
       if (update.event.case === "bughouse") {
          const val = update.event.value as any;
          if (val.event.case === "status") {
             const status = val.event.value;
             setState(status);
             setClocks({
                w0: Number(status.board0?.whiteTimeMs || 0),
                b0: Number(status.board0?.blackTimeMs || 0),
                w1: Number(status.board1?.whiteTimeMs || 0),
                b1: Number(status.board1?.blackTimeMs || 0)
             });
             if (status.lobby) {
                setTeam0Name(status.lobby.team0Name || "Team White");
                setTeam1Name(status.lobby.team1Name || "Team Black");
                setAdminSessionId(status.lobby.adminSessionId || "");
             }
          } else if (val.event.case === "lobbyInfo") {
             const lobby = val.event.value;
             setState((prev: any) => ({ ...prev, lobby }));
             setTeam0Name(lobby.team0Name || "Team White");
             setTeam1Name(lobby.team1Name || "Team Black");
             setAdminSessionId(lobby.adminSessionId || "");
          }
       } else if (update.event.case === "chat") {
          const val = update.event.value as any;
          setLogs(prev => [...prev, `${val.sender}: ${val.text}`]);
       }
    };

    const checkVideo = async () => {
       try {
          const envBackendUrl = process.env.NEXT_PUBLIC_EDGE_URL || 
                                process.env.NEXT_PUBLIC_BACKEND_URL || 
                                process.env.NEXT_PUBLIC_API_URL;
          
          let baseUrl = "";
          if (envBackendUrl) {
             baseUrl = envBackendUrl.endsWith('/') ? envBackendUrl.slice(0, -1) : envBackendUrl;
             if (!baseUrl.startsWith('http')) baseUrl = 'https://' + baseUrl;
          } else {
             const isProd = window.location.protocol === "https:";
             baseUrl = isProd ? `https://${window.location.host}` : `http://${window.location.hostname}:8787`;
          }

          const res = await fetch(`${baseUrl}/api/video/token?matchId=${id}&role=${role}`);
          if (res.ok) setVideoAuthorized(true);
       } catch(e){}
    };
    checkVideo();

    return () => { 
      ws.close(); 
      // Clean up Daily video call on unmount
      try {
        const call = DailyIframe.getCallInstance();
        if (call) {
          try { call.setLocalAudio(false); } catch(e) {}
          try { call.setLocalVideo(false); } catch(e) {}
          call.leave().then(() => call.destroy().catch(() => {})).catch(() => call.destroy().catch(() => {}));
        }
      } catch(e) {}
    };
  }, [id, role]);

  const onDrop = (boardIdx: number, sourceSquare: string, targetSquare: string, piece?: string) => {
     if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false;
     // Only allow moves on the player's own board
     if (boardIdx !== myBoardIdx) return false;
     
     // Detect pawn promotion
     const pieceCode = typeof piece === 'string' ? piece : '';
     const isPawn = pieceCode.includes('P') || pieceCode.includes('p');
     const targetRank = targetSquare?.[1];
     if (isPawn && (targetRank === '8' || targetRank === '1')) {
        setPendingPromotion({ boardIdx, source: sourceSquare, target: targetSquare });
        return true;
     }
     
     const uci = sourceSquare + targetSquare;
     const update = create(MatchUpdateSchema, {
        event: { 
          case: "move", 
          value: { 
            uci, 
            promotion: "" 
          } as any 
        }
     });
     wsRef.current.send(toBinary(MatchUpdateSchema, update));
     return true;
  };

  const onSquareClick = (boardIdx: number, square: string) => {
     if (!selectedPiece || selectedPiece.board !== boardIdx) return;
     if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
     // Send as UCI drop notation: "P@e4" means drop a pawn on e4
     // The backend handleMove already supports this format
     const uci = `${selectedPiece.char}@${square}`;
     const update = create(MatchUpdateSchema, {
        event: { 
          case: "move", 
          value: { 
            uci, 
            promotion: "" 
          } as any
        }
     });
     wsRef.current.send(toBinary(MatchUpdateSchema, update));
     setSelectedPiece(null);
  };

  const completePromotion = (piece: string) => {
     if (!pendingPromotion || !wsRef.current) return;
     const update = create(MatchUpdateSchema, {
        event: { 
          case: "move", 
          value: { 
            uci: pendingPromotion.source + pendingPromotion.target, 
            promotion: piece 
          } as any 
        }
     });
     wsRef.current.send(toBinary(MatchUpdateSchema, update));
     setPendingPromotion(null);
  };

  const handleRematch = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const u = create(MatchUpdateSchema, { event: { case: "lobby", value: { type: "rematch", role, name: playerName } as any } });
    wsRef.current.send(toBinary(MatchUpdateSchema, u));
    setRematchState("waiting");
  };

  const getPlayerLabel = (r: string) => {
     const slot = (state?.lobby as any)?.[r];
     if (slot?.isClaimed) return slot.playerName;
     return r.toUpperCase();
  };
  
  const claimRole = (r: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const u = create(MatchUpdateSchema, { 
        event: { 
            case: "lobby", 
            value: { type: "claim", role: r, name: playerName } as any 
        } 
    });
    wsRef.current.send(toBinary(MatchUpdateSchema, u));
  };

  const toggleReady = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const u = create(MatchUpdateSchema, { 
        event: { 
            case: "lobby", 
            value: { type: "ready" } as any 
        } 
    });
    wsRef.current.send(toBinary(MatchUpdateSchema, u));
  };

  const addBot = (r: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const u = create(MatchUpdateSchema, { 
        event: { 
            case: "lobby", 
            value: { type: "force_assign", role: r, name: "bot" } as any 
        } 
    });
    wsRef.current.send(toBinary(MatchUpdateSchema, u));
  };

  const removeBot = (r: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const u = create(MatchUpdateSchema, { 
        event: { 
            case: "lobby", 
            value: { type: "bot_remove", role: r } as any 
        } 
    });
    wsRef.current.send(toBinary(MatchUpdateSchema, u));
  };

  const fillBots = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const u = create(MatchUpdateSchema, { 
        event: { 
            case: "lobby", 
            value: { type: "fill_bots" } as any 
        } 
    });
    wsRef.current.send(toBinary(MatchUpdateSchema, u));
  };

  const startMatch = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const u = create(MatchUpdateSchema, { 
        event: { 
            case: "lobby", 
            value: { type: "start" } as any 
        } 
    });
    wsRef.current.send(toBinary(MatchUpdateSchema, u));
  };

  const formatTime = (ms: number) => {
     const totalSec = Math.floor(ms / 1000);
     const min = Math.floor(totalSec / 60);
     const sec = totalSec % 60;
     return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  // Find my current role dynamically from lobby slots
  const effectiveRole = useMemo(() => {
     if (!state?.lobby || !mySessionId) return role;
     for (const r of ["w0", "b0", "w1", "b1"]) {
        if (state.lobby?.[r]?.sessionId === mySessionId) return r;
     }
     return role; // Fallback to URL role
  }, [state?.lobby, mySessionId, role]);

  if (!mounted || !id) return <div className="min-h-screen bg-[#07090E]" />;

  const useRole = effectiveRole || "spectator";
  const myBoardIdx = useRole.endsWith('1') ? 1 : 0;
  const partnerBoardIdx = 1 - myBoardIdx;
  const myBoard = myBoardIdx === 0 ? state?.board0 : state?.board1;
  const partnerBoard = partnerBoardIdx === 0 ? state?.board0 : state?.board1;
  
  // Determine my color and partner's color
  const myColor = useRole.startsWith('w') ? 'w' : 'b';
  const partnerColor = myColor === 'w' ? 'b' : 'w'; // Partner is opposite color on the other board
  
  // My bank: bank for my color on my board
  const myBank = myBoardIdx === 0 
    ? (myColor === 'w' ? state?.bank0w : state?.bank0b)
    : (myColor === 'w' ? state?.bank1w : state?.bank1b);
  
  // Partner's bank: bank for partner's color on partner's board
  const partnerBank = partnerBoardIdx === 0
    ? (partnerColor === 'w' ? state?.bank0w : state?.bank0b)
    : (partnerColor === 'w' ? state?.bank1w : state?.bank1b);

  const isAdmin = mySessionId === adminSessionId;


  // Derive game-over state — check gameOver flag first, fallback to status
  const isGameOver = !!(state?.board0?.gameOver || state?.board1?.gameOver ||
    (state?.board0?.result && state.board0.result !== '') ||
    (state?.board1?.result && state.board1.result !== ''));
  const gameResult = state?.board0?.result || state?.board1?.result || null;
  const winnerTeam = gameResult === '1-0' ? team0Name : gameResult === '0-1' ? team1Name : null;

  return (
    <div className="min-h-screen flex flex-col px-2 pt-2 pb-[env(safe-area-inset-bottom,8px)] md:p-8 bg-[#07090E] text-slate-100 selection:bg-blue-500/30 overflow-x-hidden">
      <header className="flex justify-between items-center mb-2 md:mb-4 max-w-[1800px] mx-auto w-full h-10 md:h-auto shrink-0">
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-2.5 py-1 md:px-4 md:py-1.5 rounded-xl backdrop-blur-xl">
          <Swords className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
          <div>
            <h1 className="hidden sm:block text-[8px] font-black tracking-[0.2em] text-blue-500/80 uppercase leading-none">{t("arena_title").split(' ')[0]}</h1>
            <h2 className="text-sm md:text-lg font-black tracking-tight text-white leading-none uppercase">{t("bughouse")}</h2>
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2">
            {mounted && (
                <button onClick={flipBoards} className="p-1.5 md:p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-slate-400 transition-all active:scale-90" title="Flip">
                  <RotateCcw className="w-3.5 h-3.5 md:w-4 md:h-4" />
                </button>
            )}
            {(videoAuthorized || id === 'local-test') && (
                <div className="flex items-center gap-0.5">
                   <button onClick={toggleGlobalMic} className={`p-1.5 md:p-2 rounded-xl transition-all active:scale-90 ${isMicOn ? 'text-slate-400 hover:bg-white/5' : 'bg-red-500/10 text-red-500'}`}>
                      {isMicOn ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                   </button>
                   <button onClick={() => setIsCamOn(!isCamOn)} className={`p-1.5 md:p-2 rounded-xl transition-all active:scale-90 ${isCamOn ? 'bg-blue-500/10 text-blue-400' : 'bg-red-500/10 text-red-500'}`}>
                      {isCamOn ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
                   </button>
                </div>
            )}
            <button onClick={() => updateSettings({ volume: settings.volume === 0 ? 0.7 : 0 })} className="p-1.5 md:p-2 rounded-xl hover:bg-white/5 text-slate-400 transition-all">
               {settings.volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => setIsPanelOpen(true)} className="p-1.5 md:p-2 rounded-xl hover:bg-white/5 text-slate-400 transition-all">
                <Settings className="w-3.5 h-3.5 md:w-4 md:h-4" />
            </button>
        </div>
      </header>

      {/* Game Over Banner */}
      {isGameOver && (
        <div className="max-w-[1800px] mx-auto w-full mb-2 shrink-0">
          <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl md:rounded-2xl px-3 py-2 md:p-4 flex items-center justify-between shadow-xl backdrop-blur-xl">
            <div className="flex items-center gap-2 md:gap-4">
              <CheckCircle className="w-5 h-5 md:w-8 md:h-8 text-emerald-500 flex-shrink-0" />
              <div>
                <h2 className="text-base md:text-xl font-black text-white leading-tight">
                  {winnerTeam ? `🏆 ${winnerTeam} Wins!` : gameResult === '1/2-1/2' ? 'Draw!' : 'Game Over'}
                </h2>
                <p className="text-emerald-400/80 font-mono text-[10px] md:text-xs uppercase tracking-widest">
                  {gameResult === '1-0' ? 'White team wins' : gameResult === '0-1' ? 'Black team wins' : 'Match ended'}
                </p>
              </div>
            </div>
            {rematchState === 'waiting' ? (
              <span className="bg-slate-800 border border-slate-700 text-slate-400 px-3 py-1.5 rounded-full text-[10px] font-bold animate-pulse">Waiting...</span>
            ) : (
              <button
                onClick={handleRematch}
                className={`flex items-center gap-1.5 px-3 md:px-4 py-1.5 md:py-2 rounded-full font-bold text-[10px] md:text-sm transition-all shadow-lg active:scale-95
                  ${rematchState === 'offered' ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-500/30' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/30'}`}
              >
                <Swords className="w-3.5 h-3.5" />
                {rematchState === 'offered' ? 'Accept!' : 'Rematch'}
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Lobby Overlay */}
      {(!state || !state.lobby?.isAllReady) && (
        <BughouseLobby 
          state={state}
          t={t}
          id={id}
          role={useRole}
          useRole={useRole}
          claimRole={claimRole}
          toggleReady={toggleReady}
          addBot={addBot}
          removeBot={removeBot}
          updateTeamName={updateTeamName}
          fillBots={fillBots}
          startMatch={startMatch}
          spectators={spectators}
          assignRole={assignRole}
          isAdmin={isAdmin}
        />
      )}

      {/* ── DESKTOP (xl+): boards + sidebar ── */}
      <div className="hidden xl:flex max-w-[1800px] mx-auto w-full gap-4 flex-1 items-start">
        <div className="flex-1 min-w-0">
          <div className="flex flex-row gap-4 items-start justify-center">
            <div className="flex flex-col gap-1.5 w-1/2" style={{ maxWidth: 'min(480px, 44vh)' }}>
              <h3 className="text-sm font-bold text-blue-400 px-1 truncate">{team0Name}</h3>
              <BughouseBoard boardIdx={myBoardIdx} orientation={boardOrientation} fen={myBoard?.fen || "start"} clocks={clocks} playerName={playerName} isMain={true} scale={boardScale} theme={boardThemes[settings.boardTheme] || boardThemes.classic} customPieces={stableCustomPieces} onDrop={onDrop} onSquareClick={onSquareClick} formatTime={formatTime} getPlayerLabel={getPlayerLabel} />
              <BughouseBank bank={myBank || []} boardIdx={myBoardIdx} playerColor={myColor} selectedPiece={selectedPiece} setSelectedPiece={setSelectedPiece} getPieceUrl={getPieceUrl} placementHint={t("bh_click_to_place")} emptyLabel={t("bh_empty_bank")} />
            </div>
            <div className="flex flex-col gap-1.5 w-1/2" style={{ maxWidth: 'min(480px, 44vh)' }}>
              <h3 className="text-sm font-bold text-emerald-400 px-1 truncate">{team1Name}</h3>
              <BughouseBoard boardIdx={partnerBoardIdx} orientation={partnerOrientation} fen={partnerBoard?.fen || "start"} clocks={clocks} playerName={state?.lobby?.[partnerBoardIdx === 0 ? 'w0' : 'w1']?.playerName || "Partner"} isMain={false} scale={boardScale} theme={boardThemes[settings.boardTheme] || boardThemes.classic} customPieces={stableCustomPieces} onDrop={onDrop} onSquareClick={onSquareClick} formatTime={formatTime} getPlayerLabel={getPlayerLabel} />
              <BughouseBank bank={partnerBank || []} boardIdx={partnerBoardIdx} playerColor={partnerColor} selectedPiece={selectedPiece} setSelectedPiece={setSelectedPiece} getPieceUrl={getPieceUrl} placementHint={t("bh_click_to_place")} emptyLabel={t("bh_empty_bank")} />
            </div>
          </div>
        </div>
        {/* Desktop sidebar */}
        <div className="flex flex-col gap-3 w-[340px] flex-shrink-0 sticky top-4">
          {(isMicOn || isCamOn) && (
            <div className={`w-full bg-black/20 border border-white/5 rounded-2xl p-3 shadow-xl backdrop-blur-xl overflow-hidden ${!isCamOn ? 'hidden' : 'block'}`} style={{ height: `${videoHeight}px` }}>
              <VideoChat matchId={id} role={role} hideControls={true} initialMicOn={isMicOn} initialCamOn={isCamOn} />
            </div>
          )}
          <BughouseActivityLogs logs={logs} chatInput={chatInput} setChatInput={setChatInput} handleSubmit={handleChatSubmit} />
        </div>
      </div>

      {/* ── MOBILE + TABLET (< xl): boards + bottom tabs ── */}
      <div className="xl:hidden flex flex-col flex-1 min-h-0">

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            LANDSCAPE: boards side-by-side, height-constrained
            Board width = min(50vw-6px, 100vh-143px)
            S24 landscape 915×412: min(451px, 269px) → 269px each
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {isLandscape && (
          <div className="flex flex-row gap-1.5 items-start justify-center w-full shrink-0">
            <div className="flex flex-col gap-0.5 flex-shrink-0"
              style={{ width: 'min(calc(50vw - 6px), calc(100vh - 143px))' }}>
              <h3 className="text-[9px] font-bold text-blue-400 px-0.5 truncate leading-none">{team0Name}</h3>
              <BughouseBoard boardIdx={myBoardIdx} orientation={boardOrientation} fen={myBoard?.fen || "start"} clocks={clocks} playerName={playerName} isMain={true} scale={boardScale} theme={boardThemes[settings.boardTheme] || boardThemes.classic} customPieces={stableCustomPieces} showCoordinates={settings.showCoordinates} onDrop={onDrop} onSquareClick={onSquareClick} formatTime={formatTime} getPlayerLabel={getPlayerLabel} />
              <BughouseBank bank={myBank || []} boardIdx={myBoardIdx} playerColor={myColor} selectedPiece={selectedPiece} setSelectedPiece={setSelectedPiece} getPieceUrl={getPieceUrl} placementHint={t("bh_click_to_place")} emptyLabel={t("bh_empty_bank")} compact={true} />
            </div>
            <div className="flex flex-col gap-0.5 flex-shrink-0"
              style={{ width: 'min(calc(50vw - 6px), calc(100vh - 143px))' }}>
              <h3 className="text-[9px] font-bold text-emerald-400 px-0.5 truncate leading-none">{team1Name}</h3>
              <BughouseBoard boardIdx={partnerBoardIdx} orientation={partnerOrientation} fen={partnerBoard?.fen || "start"} clocks={clocks} playerName={state?.lobby?.[partnerBoardIdx === 0 ? 'w0' : 'w1']?.playerName || "Partner"} isMain={false} scale={boardScale} theme={boardThemes[settings.boardTheme] || boardThemes.classic} customPieces={stableCustomPieces} showCoordinates={settings.showCoordinates} onDrop={onDrop} onSquareClick={onSquareClick} formatTime={formatTime} getPlayerLabel={getPlayerLabel} />
              <BughouseBank bank={partnerBank || []} boardIdx={partnerBoardIdx} playerColor={partnerColor} selectedPiece={selectedPiece} setSelectedPiece={setSelectedPiece} getPieceUrl={getPieceUrl} placementHint={t("bh_click_to_place")} emptyLabel={t("bh_empty_bank")} compact={true} />
            </div>
          </div>
        )}

        {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            PORTRAIT: boards stacked vertically, full-width
            Board width ≈ 96vw, they scroll if they don't fit
        ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        {!isLandscape && (
          <div className="flex flex-col gap-2 w-full shrink-0 items-center">
            <div className="flex flex-col gap-0.5 w-full" style={{ maxWidth: 'min(96vw, 480px)' }}>
              <h3 className="text-[10px] font-bold text-blue-400 px-0.5 truncate leading-none">{team0Name}</h3>
              <BughouseBoard boardIdx={myBoardIdx} orientation={boardOrientation} fen={myBoard?.fen || "start"} clocks={clocks} playerName={playerName} isMain={true} scale={boardScale} theme={boardThemes[settings.boardTheme] || boardThemes.classic} customPieces={stableCustomPieces} showCoordinates={settings.showCoordinates} onDrop={onDrop} onSquareClick={onSquareClick} formatTime={formatTime} getPlayerLabel={getPlayerLabel} />
              <BughouseBank bank={myBank || []} boardIdx={myBoardIdx} playerColor={myColor} selectedPiece={selectedPiece} setSelectedPiece={setSelectedPiece} getPieceUrl={getPieceUrl} placementHint={t("bh_click_to_place")} emptyLabel={t("bh_empty_bank")} compact={false} />
            </div>
            <div className="flex flex-col gap-0.5 w-full" style={{ maxWidth: 'min(96vw, 480px)' }}>
              <h3 className="text-[10px] font-bold text-emerald-400 px-0.5 truncate leading-none">{team1Name}</h3>
              <BughouseBoard boardIdx={partnerBoardIdx} orientation={partnerOrientation} fen={partnerBoard?.fen || "start"} clocks={clocks} playerName={state?.lobby?.[partnerBoardIdx === 0 ? 'w0' : 'w1']?.playerName || "Partner"} isMain={false} scale={boardScale} theme={boardThemes[settings.boardTheme] || boardThemes.classic} customPieces={stableCustomPieces} showCoordinates={settings.showCoordinates} onDrop={onDrop} onSquareClick={onSquareClick} formatTime={formatTime} getPlayerLabel={getPlayerLabel} />
              <BughouseBank bank={partnerBank || []} boardIdx={partnerBoardIdx} playerColor={partnerColor} selectedPiece={selectedPiece} setSelectedPiece={setSelectedPiece} getPieceUrl={getPieceUrl} placementHint={t("bh_click_to_place")} emptyLabel={t("bh_empty_bank")} compact={false} />
            </div>
          </div>
        )}
        {/* Bottom tabs — only in portrait mode (landscape hides to save space) */}
        {!isLandscape && (
          <div className="mt-1 shrink-0">
            {/* Tab switcher */}
            <div className="flex rounded-xl overflow-hidden border border-white/5 bg-slate-900/70 mb-1">
              <button
                onClick={() => setMobileTab('chat')}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors ${
                  mobileTab === 'chat' ? 'bg-blue-600/25 text-blue-400 border-b-2 border-blue-500' : 'text-slate-500'
                }`}
              >
                <MessageSquare className="w-3 h-3" />
                Chat
                {logs.length > 0 && <span className="text-[8px] font-mono opacity-60 ml-0.5">{logs.length}</span>}
              </button>
              {(videoAuthorized || isCamOn) && (
                <button
                  onClick={() => setMobileTab('video')}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-black uppercase tracking-wider transition-colors ${
                    mobileTab === 'video' ? 'bg-blue-600/25 text-blue-400 border-b-2 border-blue-500' : 'text-slate-500'
                  }`}
                >
                  <Video className="w-3 h-3" />
                  Video
                </button>
              )}
            </div>
            {mobileTab === 'chat' && (
              <div className="bg-slate-900/60 border border-white/5 rounded-xl overflow-hidden flex flex-col"
                style={{ height: 'clamp(100px, calc(100vh - 30vh - 350px), 220px)' }}>
                <div className="flex-1 overflow-y-auto p-2 space-y-0.5 font-mono text-[11px] text-slate-400">
                  {logs.length === 0 && <p className="text-slate-600 italic text-center pt-3 text-[10px]">No messages yet</p>}
                  {logs.map((l, i) => (
                    <div key={i} className={l.includes(":") ? "text-slate-200" : "text-slate-500 italic border-l-2 border-white/5 pl-2"}>{l}</div>
                  ))}
                </div>
                <form onSubmit={handleChatSubmit} className="p-1.5 bg-white/5 border-t border-white/5 flex gap-1.5 flex-shrink-0">
                  <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type to chat..."
                    className="flex-1 bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-[12px] text-white outline-none focus:border-blue-500/50 transition-all font-mono" />
                </form>
              </div>
            )}
            {mobileTab === 'video' && (isMicOn || isCamOn || videoAuthorized) && (
              <div className="bg-slate-900/60 border border-white/5 rounded-xl overflow-hidden"
                style={{ height: 'clamp(100px, calc(100vh - 30vh - 350px), 220px)' }}>
                <VideoChat matchId={id} role={role} hideControls={true} initialMicOn={isMicOn} initialCamOn={isCamOn} />
              </div>
            )}
          </div>
        )}

      </div>
      
      {/* Promotion Dialog */}
      {pendingPromotion && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setPendingPromotion(null)}>
          <div className="bg-slate-800 border border-white/10 rounded-2xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-bold text-slate-400 mb-4 text-center uppercase tracking-widest">{t("promote_to") || "Promote to"}</p>
            <div className="flex gap-3">
              {['q', 'r', 'b', 'n'].map(p => (
                <button
                  key={p}
                  onClick={() => completePromotion(p)}
                  className="w-16 h-16 bg-white/10 hover:bg-blue-500/30 border border-white/10 hover:border-blue-400 rounded-xl transition-all active:scale-90"
                >
                  <img src={getPieceUrl(`${myColor}${p.toUpperCase()}`)} alt={p} className="w-full h-full object-contain drop-shadow-lg" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

