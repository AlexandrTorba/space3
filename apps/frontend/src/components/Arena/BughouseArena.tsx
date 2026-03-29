"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Chessboard } from "react-chessboard";
import { Swords, Settings, RotateCcw, Video, VideoOff, CheckCircle, Volume2, VolumeX, Mic, MicOff, PhoneOff, UserPlus, CheckCircle2, Play, Users } from "lucide-react";
import { useSettingsContext } from "@/providers/SettingsProvider";
import { create, toBinary, fromBinary } from "@bufbuild/protobuf";
import { MatchUpdateSchema } from "@antigravity/contracts";
import { Chess, Square } from "chess.js";
import { useTranslation } from "@/i18n";
import { useSettings, boardThemes } from "@/hooks/useSettings";
import DailyIframe from "@daily-co/daily-js";
import VideoChat from "./VideoChat";
import { BughouseBoard } from "./BughouseArena/BughouseBoard";
import { BughouseLobby } from "./BughouseArena/BughouseLobby";
import { BughouseBank } from "./BughouseArena/BughouseBank";
import { BughouseActivityLogs } from "./BughouseArena/BughouseActivityLogs";

const piecesLabels = ["wP", "wN", "wB", "wR", "wQ", "wK", "bP", "bN", "bB", "bR", "bQ", "bK"];

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
  const [chatInput, setChatInput] = useState("");
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

    return () => { ws.close(); };
  }, [id, role]);

  const onDrop = (boardIdx: number, sourceSquare: string, targetSquare: string, piece?: string) => {
     if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return false;
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
     const update = create(MatchUpdateSchema, {
        event: { 
          case: "bughouse", 
          value: { 
            type: "drop", 
            boardIdx, 
            square, 
            piece: selectedPiece.char 
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
  const myBankW = myBoardIdx === 0 ? state?.bank0w : state?.bank1w;
  const myBankB = myBoardIdx === 0 ? state?.bank0b : state?.bank1b;
  const partnerBankW = partnerBoardIdx === 0 ? state?.bank0w : state?.bank1w;
  const partnerBankB = partnerBoardIdx === 0 ? state?.bank0b : state?.bank1b;

  const isAdmin = mySessionId === adminSessionId;

  return (
    <div className="min-h-screen flex flex-col p-4 md:p-8 bg-[#07090E] text-slate-100 selection:bg-blue-500/30 overflow-x-hidden">
      <header className="flex justify-between items-center mb-6 max-w-[1600px] mx-auto w-full px-2">
        <div className="flex items-center gap-4 bg-white/5 border border-white/10 px-6 py-2 rounded-2xl backdrop-blur-xl">
          <Swords className="w-8 h-8 text-blue-400" />
          <div>
            <h1 className="text-xs font-black tracking-[0.2em] text-blue-500/80 uppercase leading-none mb-1">AntigravityChess</h1>
            <h2 className="text-2xl font-black tracking-tight text-white leading-none uppercase">{t("bughouse")}</h2>
          </div>
        </div>

        <div className="flex items-center gap-4">
            {mounted && (
                <button onClick={flipBoards} className="p-3 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 text-slate-400 transition-all active:scale-90">
                  <RotateCcw className="w-6 h-6" />
                </button>
            )}
            <div className="flex items-center bg-white/5 rounded-[1.5rem] p-1 border border-white/5 shadow-inner">
                <div className="flex items-center gap-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-white/5">
                    {t("arena_title").split(' ')[0]}
                    <input 
                      type="range" min="50" max="150" value={boardScale} 
                      onChange={(e) => setBoardScale(parseInt(e.target.value))}
                      className="w-20 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-emerald-500" 
                    />
                </div>
                {(videoAuthorized || id === 'local-test') && (
                    <div className="flex items-center gap-1 border-r border-white/5 pr-2 mr-2">
                         <div className="flex items-center gap-3 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest border-r border-white/5 mr-1">
                             Video
                             <input 
                                type="range" min="100" max="400" value={videoHeight} 
                                onChange={(e) => setVideoHeight(parseInt(e.target.value))}
                                className="w-20 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-blue-500" 
                             />
                         </div>
                       <button 
                          onClick={toggleGlobalMic} 
                          className={`p-3 rounded-2xl transition-all active:scale-90 ${isMicOn ? 'text-slate-400 hover:bg-white/5' : 'bg-red-500/10 text-red-500'}`}
                          title={isMicOn ? "Mute Mic" : "Unmute Mic"}
                       >
                          {isMicOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                       </button>
                       <button 
                          onClick={() => setIsCamOn(!isCamOn)} 
                          className={`p-3 rounded-2xl transition-all active:scale-90 ${isCamOn ? 'bg-blue-500/10 text-blue-400 shadow-[inset_0_0_20px_rgba(59,130,246,0.1)]' : 'bg-red-500/10 text-red-500'}`}
                          title={isCamOn ? "Stop Camera" : "Start Camera"}
                       >
                          {isCamOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                       </button>
                    </div>
                )}
                <button onClick={() => updateSettings({ volume: settings.volume === 0 ? 0.7 : 0 })} className="p-3 rounded-2xl hover:bg-white/5 text-slate-400 transition-all">
                   {settings.volume === 0 ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                 </button>
                <button onClick={() => setIsPanelOpen(true)} className="p-3 rounded-2xl hover:bg-white/5 text-slate-400 transition-all">
                    <Settings className="w-6 h-6" />
                </button>
            </div>
        </div>
      </header>
      
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

      <div className="max-w-[1800px] mx-auto w-full grid grid-cols-1 xl:grid-cols-[1fr,380px] gap-8 flex-1 items-start">
        {/* Main Game Area */}
        <div className="flex flex-col gap-8">
            <div className="flex flex-col lg:flex-row gap-8 items-start justify-center">
                 <div className="flex flex-col gap-6">
                     <div className="flex items-center justify-between gap-4 px-2">
                        <h3 className="text-xl font-bold text-blue-400">{team0Name}</h3>
                     </div>
                      <BughouseBoard 
                         boardIdx={myBoardIdx}
                         orientation={boardOrientation}
                         fen={myBoard?.fen || "start"}
                         clocks={clocks}
                         playerName={playerName}
                         isMain={true}
                         scale={boardScale}
                         theme={boardThemes[settings.boardTheme] || boardThemes.classic}
                         customPieces={stableCustomPieces}
                         onDrop={onDrop}
                         onSquareClick={onSquareClick}
                         formatTime={formatTime}
                         getPlayerLabel={getPlayerLabel}
                      />
                     <BughouseBank 
                         bank={myBankW || []} 
                         boardIdx={myBoardIdx} 
                         setSelectedPiece={setSelectedPiece} 
                         getPieceUrl={getPieceUrl} 
                     />
                 </div>

                 <div className="flex flex-col gap-6 opacity-90">
                     <div className="flex items-center justify-between gap-4 px-2">
                        <h3 className="text-xl font-bold text-emerald-400">{team1Name}</h3>
                     </div>
                      <BughouseBoard 
                         boardIdx={partnerBoardIdx}
                         orientation={partnerOrientation}
                         fen={partnerBoard?.fen || "start"}
                         clocks={clocks}
                         playerName={state?.lobby?.[partnerBoardIdx === 0 ? 'w0' : 'w1']?.playerName || "Partner"}
                         isMain={false}
                         scale={boardScale}
                         theme={boardThemes[settings.boardTheme] || boardThemes.classic}
                         customPieces={stableCustomPieces}
                         onDrop={onDrop}
                         onSquareClick={onSquareClick}
                         formatTime={formatTime}
                         getPlayerLabel={getPlayerLabel}
                      />
                     <BughouseBank 
                         bank={myBoardIdx === 0 ? state?.bank0b : state?.bank1b} 
                         boardIdx={partnerBoardIdx} 
                         setSelectedPiece={setSelectedPiece} 
                         getPieceUrl={getPieceUrl} 
                     />
                 </div>
            </div>
        </div>

        {/* Sidebar: Video & Chat */}
        <div className="flex flex-col gap-4 sticky top-8">
            {(isMicOn || isCamOn) && (
                <div 
                  className={`w-full bg-black/20 border border-white/5 rounded-3xl p-4 shadow-2xl backdrop-blur-xl overflow-hidden ${!isCamOn ? 'hidden' : 'block'}`} 
                  style={{ height: `${videoHeight}px` }}
                >
                    <VideoChat 
                      matchId={id} 
                      role={role} 
                      hideControls={true} 
                      initialMicOn={isMicOn} 
                      initialCamOn={isCamOn} 
                    />
                </div>
            )}
            
            <BughouseActivityLogs 
                logs={logs}
                chatInput={chatInput}
                setChatInput={setChatInput}
                handleSubmit={handleChatSubmit}
            />
        </div>
      </div>
    </div>
  );
}
