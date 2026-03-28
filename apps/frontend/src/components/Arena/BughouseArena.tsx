"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Chessboard } from "react-chessboard";
import { Swords, Settings, RotateCcw, Video, VideoOff, CheckCircle, Volume2, VolumeX, Mic, MicOff, PhoneOff, UserPlus } from "lucide-react";
import { useSettingsContext } from "@/providers/SettingsProvider";
import { create, toBinary, fromBinary } from "@bufbuild/protobuf";
import { MatchUpdateSchema } from "@antigravity/contracts";
import { Chess, Square } from "chess.js";
import { useTranslation } from "@/i18n";
import { useSettings, boardThemes } from "@/hooks/useSettings";
import DailyIframe from "@daily-co/daily-js";
import VideoChat from "./VideoChat";

const piecesLabels = ["wP", "wN", "wB", "wR", "wQ", "wK", "bP", "bN", "bB", "bR", "bQ", "bK"];

function makePieceComponent(pieceCode: string, urlRef: React.MutableRefObject<(p: string) => string>) {
  function PieceImg(props: { svgStyle?: React.CSSProperties; square?: string } = {}) {
    return <img src={urlRef.current(pieceCode)} style={props.svgStyle} className="w-full h-full object-contain pointer-events-none" alt={pieceCode} />;
  }
  return PieceImg;
}

const getPieceUrlRef: { current: (p: string) => string } = { current: () => "" };

const stableCustomPieces = Object.fromEntries(
  piecesLabels.map(p => [p, makePieceComponent(p, getPieceUrlRef)])
);

export default function BughouseArena() {
  const [mounted, setMounted] = useState(false);
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const role = searchParams?.get("role") || "spectator"; 

  const { t } = useTranslation();
  const { settings, updateSettings, getPieceUrl } = useSettings();
  const { setIsPanelOpen } = useSettingsContext();
  getPieceUrlRef.current = getPieceUrl;

  const [state, setState] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedPiece, setSelectedPiece] = useState<{char: string, board: number} | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<{boardIdx: number, source: string, target: string} | null>(null);
  const [clocks, setClocks] = useState({ w0: 180000, b0: 180000, w1: 180000, b1: 180000 });
  const [rematchState, setRematchState] = useState<"default" | "offered" | "waiting">("default");
  const [playerName, setPlayerName] = useState("Player");
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">(role.startsWith("b") ? "black" : "white");
  const [partnerOrientation, setPartnerOrientation] = useState<"white" | "black">(role.startsWith("b") ? "white" : "black");
  const [isMicOn, setIsMicOn] = useState(false);
  const [isCamOn, setIsCamOn] = useState(false);
  const [videoAuthorized, setVideoAuthorized] = useState(false);
  const [videoHeight, setVideoHeight] = useState(180);
  const [boardScale, setBoardScale] = useState(100);
  const [chatInput, setChatInput] = useState("");
  const wsRef = useRef<WebSocket | null>(null);
  const router = useRouter(); 

  useEffect(() => {
    if (!isMicOn && !isCamOn) return;
    const interval = setInterval(() => {
      const call = DailyIframe.getCallInstance();
      if (call) {
        const local = call.participants().local;
        if (local) {
          setIsMicOn(local.audio);
          setIsCamOn(local.video);
        }
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isMicOn, isCamOn]);

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

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const isProd = typeof window !== "undefined" && window.location.protocol === "https:";
    const rawUrl = process.env.NEXT_PUBLIC_BACKEND_URL || (typeof window !== "undefined" ? (isProd ? window.location.hostname : window.location.hostname + ":8787") : "localhost:8787");
    let host = rawUrl;
    try {
      if (rawUrl.includes("://")) {
        host = new URL(rawUrl).host;
      }
    } catch (e) {}

    const wsUrl = `${protocol}//${host}/bughouse/${id}?name=${encodeURIComponent(name)}&role=${role}`;
    
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onmessage = async (ev) => {
       if (typeof ev.data === 'string') {
          try {
             const data = JSON.parse(ev.data);
             if (data.type === 'video_enabled') {
                setVideoAuthorized(data.enabled);
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
             if (status.clocks) {
                setClocks({
                   w0: Number(status.clocks.w0), b0: Number(status.clocks.b0),
                   w1: Number(status.clocks.w1), b1: Number(status.clocks.b1)
                });
             }
          } else if (val.event.case === "lobbyInfo") {
             const lobby = val.event.value;
             setState((prev: any) => ({ ...prev, lobby }));
          }
       } else if (update.event.case === "chat") {
          const val = update.event.value as any;
          setLogs(prev => [...prev, `${val.sender}: ${val.text}`]);
       }
    };

    const checkVideo = async () => {
       try {
          const isProd = window.location.protocol === "https:";
          const backendUrl = isProd ? `https://${window.location.host}` : `http://${window.location.hostname}:8787`;
          const res = await fetch(`${backendUrl}/api/video/token?matchId=${id}&role=${role}`);
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
    const u = create(MatchUpdateSchema, { event: { case: "lobby", value: { type: "rematch", role, name: playerName } } });
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
    const u = create(MatchUpdateSchema, { event: { case: "lobby", value: { type: "claim", role: r, name: playerName } as any } });
    wsRef.current.send(toBinary(MatchUpdateSchema, u));
  };

  const toggleReady = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const u = create(MatchUpdateSchema, { event: { case: "lobby", value: { type: "ready", role, name: playerName } as any } });
    wsRef.current.send(toBinary(MatchUpdateSchema, u));
  };

  const addBot = (r: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const u = create(MatchUpdateSchema, { event: { case: "lobby", value: { type: "bot_add", role: r } as any } });
    wsRef.current.send(toBinary(MatchUpdateSchema, u));
  };

  const removeBot = (r: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    const u = create(MatchUpdateSchema, { event: { case: "lobby", value: { type: "bot_remove", role: r } as any } });
    wsRef.current.send(toBinary(MatchUpdateSchema, u));
  };

  const formatTime = (ms: number) => {
     const totalSec = Math.floor(ms / 1000);
     const min = Math.floor(totalSec / 60);
     const sec = totalSec % 60;
     return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  if (!mounted || !id) return <div className="min-h-screen bg-[#07090E]" />;

  const isTeam2 = role.endsWith('1');
  const myBoardIdx = isTeam2 ? 1 : 0;
  const partnerBoardIdx = 1 - myBoardIdx;
  const myBoard = myBoardIdx === 0 ? state?.board0 : state?.board1;
  const partnerBoard = partnerBoardIdx === 0 ? state?.board0 : state?.board1;
  const myBankW = myBoardIdx === 0 ? state?.bank0w : state?.bank1w;
  const myBankB = myBoardIdx === 0 ? state?.bank0b : state?.bank1b;
  const partnerBankW = partnerBoardIdx === 0 ? state?.bank0w : state?.bank1w;
  const partnerBankB = partnerBoardIdx === 0 ? state?.bank0b : state?.bank1b;

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
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-2xl flex items-center justify-center p-6 animate-in fade-in duration-500">
           {!state ? (
               <div className="p-12 text-center">
                 <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-6" />
                 <p className="text-white font-black tracking-widest text-sm uppercase">{t("bh_connecting")}</p>
              </div>
           ) : (
             <div className="max-w-4xl w-full bg-slate-900/50 border border-white/10 rounded-[3rem] p-12 shadow-2xl relative overflow-hidden">
               <div className="text-center mb-10">
                  <div className="flex justify-center mb-6">
                     <div className="p-4 bg-white/10 rounded-full">
                        <Swords className="w-12 h-12 text-white" />
                     </div>
                  </div>
                  <h2 className="text-4xl font-black uppercase tracking-tighter text-white">{t("bh_assemble_teams")}</h2>
                  <p className="text-slate-400 mt-2 font-medium">{t("bh_lobby_hint")}</p>
               </div>

              <div className="grid grid-cols-2 gap-8 mb-12">
                 {/* Team White */}
                  <div className="space-y-4">
                     <h3 className="text-sm font-black text-blue-500 uppercase tracking-widest text-center">{t("bh_team0")}</h3>
                    {["w0", "b0"].map(r => {
                       const slot = state.lobby?.[r];
                       if (!slot) return <div key={r} className="p-6 rounded-3xl border border-white/5 bg-white/5 animate-pulse h-[88px]" />;
                       return (
                          <div key={r} className={`group relative p-6 rounded-3xl border transition-all duration-300 ${slot.isClaimed ? 'bg-white/5 border-white/10' : 'bg-blue-500/5 border-blue-500/20 hover:border-blue-500/50 cursor-pointer'}`} onClick={() => !slot.isClaimed && claimRole(r)}>
                             <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${r.startsWith('w') ? 'bg-white text-black' : 'bg-slate-800 text-white'}`}>
                                      {r.slice(0,1).toUpperCase()}
                                   </div>
                                    <div>
                                       <div className="text-xs font-black text-slate-500 uppercase tracking-widest">{r === 'w0' ? t('bh_board0_w') : t('bh_board0_b')}</div>
                                       <div className="text-lg font-bold text-white">{slot.isClaimed ? slot.playerName : t('bh_empty_slot')}</div>
                                    </div>
                                </div>
                                {slot.isClaimed ? (
                                   <div className="flex items-center gap-2">
                                      {slot.isReady ? <CheckCircle className="w-6 h-6 text-emerald-500" /> : <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />}
                                      {slot.isBot && <button onClick={(e) => { e.stopPropagation(); removeBot(r); }} className="text-[10px] font-black p-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 transition-all uppercase">Kick Bot</button>}
                                   </div>
                                ) : (
                                   <button 
                                      onClick={(e) => { e.stopPropagation(); addBot(r); }} 
                                      className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-blue-500/20 rounded-xl text-slate-500 hover:text-white transition-all group/bot"
                                   >
                                      <UserPlus className="w-4 h-4" />
                                      <span className="text-[9px] font-black uppercase tracking-widest hidden group-hover/bot:block animate-in fade-in slide-in-from-right-1">{t("bh_add_bot")}</span>
                                   </button>
                                )}
                             </div>
                             {slot.isClaimed && (
                                <div className="absolute top-2 right-2 flex gap-1">
                                   {slot.isBot && <button onClick={(e) => { e.stopPropagation(); removeBot(r); }} className="text-[9px] font-black px-2 py-1 bg-red-500/20 text-red-500 rounded hover:bg-red-500/40 transition-all uppercase">{t("bh_kick_bot")}</button>}
                                </div>
                             )}
                             {slot.isClaimed && slot.sessionId === (state?.mySessionId || '') && (
                                <div className="absolute inset-0 border-2 border-blue-500 rounded-3xl pointer-events-none shadow-[0_0_20px_rgba(59,130,246,0.3)]" />
                             )}
                          </div>
                       );
                    })}
                 </div>

                 {/* Team Black */}
                  <div className="space-y-4">
                     <h3 className="text-sm font-black text-emerald-500 uppercase tracking-widest text-center">{t("bh_team1")}</h3>
                    {["b1", "w1"].map(r => {
                       const slot = state.lobby?.[r];
                       if (!slot) return <div key={r} className="p-6 rounded-3xl border border-white/5 bg-white/5 animate-pulse h-[88px]" />;
                       return (
                          <div key={r} className={`group relative p-6 rounded-3xl border transition-all duration-300 ${slot.isClaimed ? 'bg-white/5 border-white/10' : 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/50 cursor-pointer'}`} onClick={() => !slot.isClaimed && claimRole(r)}>
                             <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${r.startsWith('w') ? 'bg-white text-black' : 'bg-slate-800 text-white'}`}>
                                      {r.slice(0,1).toUpperCase()}
                                   </div>
                                    <div>
                                       <div className="text-xs font-black text-slate-500 uppercase tracking-widest">{r === 'b1' ? t('bh_board1_b') : t('bh_board1_w')}</div>
                                       <div className="text-lg font-bold text-white">{slot.isClaimed ? slot.playerName : t('bh_empty_slot')}</div>
                                    </div>
                                </div>
                                {slot.isClaimed ? (
                                   <div className="flex items-center gap-2">
                                      {slot.isReady ? <CheckCircle className="w-6 h-6 text-emerald-500" /> : <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />}
                                      {slot.isBot && <button onClick={(e) => { e.stopPropagation(); removeBot(r); }} className="text-[10px] font-black p-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500/30 transition-all uppercase">Kick Bot</button>}
                                   </div>
                                ) : (
                                   <button onClick={(e) => { e.stopPropagation(); addBot(r); }} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl text-slate-500 hover:text-white transition-all">
                                      <UserPlus className="w-5 h-5" />
                                   </button>
                                )}
                             </div>
                          </div>
                       );
                    })}
                 </div>
              </div>

              <div className="flex flex-col items-center gap-6">
                 {state.lobby?.[role]?.isClaimed ? (
                    <button 
                     onClick={toggleReady}
                     className={`w-full py-6 rounded-3xl font-black text-xl tracking-widest transition-all duration-500 shadow-2xl active:scale-[0.98] ${
                        state.lobby?.[role]?.isReady 
                           ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20' 
                           : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/40'
                     }`}
                  >
                     {state.lobby?.[role]?.isReady ? t("bh_cancel_ready") : t("bh_ready")}
                  </button>
                 ) : (
                    <p className="text-amber-500 font-bold animate-pulse text-sm">Select a role to enable Ready button</p>
                 )}
                 <div className="text-slate-500 text-[10px] uppercase font-black space-x-4">
                    <span>Waiting for: {Object.values(state.lobby || {}).filter((s:any) => !s.isReady).length} Players</span>
                    <span>•</span>
                    <span>Match ID: {id}</span>
                 </div>
              </div>
           </div>
           )}
        </div>
      )}

      <div className="max-w-[1700px] mx-auto w-full flex flex-col gap-8 flex-1">
        {/* Top Video Ribbon - Visible if Cam is on, but VideoChat loads if either is on */}
        {(isMicOn || isCamOn) && (
            <div 
              className={`w-full bg-black/20 border border-white/5 rounded-3xl p-4 shadow-2xl backdrop-blur-xl animate-in slide-in-from-top duration-500 overflow-hidden ${!isCamOn ? 'hidden' : 'block'}`} 
              style={{ height: `${videoHeight}px` }}
            >
                <VideoChat matchId={id} role={role} hideControls={true} />
            </div>
        )}
        {/* Invisible VideoChat for Mic-only mode */}
        {(isMicOn && !isCamOn) && (
            <div className="hidden">
                <VideoChat matchId={id} role={role} hideControls={true} />
            </div>
        )}

        {/* Boards Section */}
        <div 
          className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start mx-auto transition-all duration-300"
          style={{ width: `${boardScale}%`, maxWidth: '100%' }}
        >
             {/* My Board */}
             <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center px-4 bg-white/5 rounded-t-2xl py-2 border border-white/5">
                    <div className="text-sm font-black text-slate-400 uppercase tracking-widest">{getPlayerLabel(boardOrientation === 'white' ? 'b' + myBoardIdx : 'w' + myBoardIdx)}</div>
                    <div className="text-2xl font-mono font-bold text-white">{formatTime(boardOrientation === 'white' ? (myBoardIdx === 0 ? clocks.b0 : clocks.b1) : (myBoardIdx === 0 ? clocks.w0 : clocks.w1))}</div>
                </div>
                <div className="aspect-square border-4 border-slate-900 rounded-2xl overflow-hidden shadow-2xl relative bg-slate-800">
                    <Chessboard options={{
                        id: `b0-${myBoardIdx}`,
                        position: myBoard?.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                        boardOrientation: boardOrientation,
                        darkSquareStyle: { backgroundColor: boardThemes[settings.boardTheme]?.dark },
                        lightSquareStyle: { backgroundColor: boardThemes[settings.boardTheme]?.light },
                        pieces: stableCustomPieces as any,
                        onPieceDrop: ({ sourceSquare, targetSquare, piece }) => {
                             if (!piece || !sourceSquare || !targetSquare) return false;
                             return onDrop(myBoardIdx, sourceSquare as any, targetSquare as any, piece as any);
                        },
                        onSquareClick: (s: any) => onSquareClick(myBoardIdx, s)
                    }} />
                </div>
                <div className="flex justify-between items-center px-4 bg-white/5 rounded-b-2xl py-2 border border-white/5">
                    <div className="text-sm font-black text-slate-400 uppercase tracking-widest">{getPlayerLabel(boardOrientation === 'white' ? 'w' + myBoardIdx : 'b' + myBoardIdx)}</div>
                    <div className="text-2xl font-mono font-bold text-white">{formatTime(boardOrientation === 'white' ? (myBoardIdx === 0 ? clocks.w0 : clocks.w1) : (myBoardIdx === 0 ? clocks.b0 : clocks.b1))}</div>
                </div>
                <div className="h-12 bg-white/5 rounded-xl flex items-center px-4 gap-2">
                    {myBankW?.map((p: string, i: number) => <button key={i} onClick={() => setSelectedPiece({char: p, board: myBoardIdx})} className="text-lg font-black text-blue-400">{p}</button>)}
                </div>
             </div>

             {/* Partner Board */}
             <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center px-4 bg-white/5 rounded-t-2xl py-2 border border-white/5">
                    <div className="text-sm font-black text-slate-400 uppercase tracking-widest">{getPlayerLabel(partnerOrientation === 'white' ? 'b' + partnerBoardIdx : 'w' + partnerBoardIdx)}</div>
                    <div className="text-2xl font-mono font-bold text-white">{formatTime(partnerOrientation === 'white' ? (partnerBoardIdx === 0 ? clocks.b0 : clocks.b1) : (partnerBoardIdx === 0 ? clocks.w0 : clocks.w1))}</div>
                </div>
                <div className="aspect-square border-4 border-slate-900 rounded-2xl overflow-hidden shadow-2xl relative bg-slate-800 opacity-90 hover:opacity-100 transition-opacity">
                    <Chessboard options={{
                        id: `b1-${partnerBoardIdx}`,
                        position: partnerBoard?.fen || "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                        boardOrientation: partnerOrientation,
                        darkSquareStyle: { backgroundColor: boardThemes[settings.boardTheme]?.dark },
                        lightSquareStyle: { backgroundColor: boardThemes[settings.boardTheme]?.light },
                        pieces: stableCustomPieces as any,
                        onPieceDrop: ({ sourceSquare, targetSquare, piece }) => {
                             if (!piece || !sourceSquare || !targetSquare) return false;
                             return onDrop(partnerBoardIdx, sourceSquare as any, targetSquare as any, piece as any);
                        },
                        onSquareClick: (s: any) => onSquareClick(partnerBoardIdx, s)
                    }} />
                </div>
                <div className="flex justify-between items-center px-4 bg-white/5 rounded-b-2xl py-2 border border-white/5">
                    <div className="text-sm font-black text-slate-400 uppercase tracking-widest">{getPlayerLabel(partnerOrientation === 'white' ? 'w' + partnerBoardIdx : 'b' + partnerBoardIdx)}</div>
                    <div className="text-2xl font-mono font-bold text-white">{formatTime(partnerOrientation === 'white' ? (partnerBoardIdx === 0 ? clocks.w0 : clocks.w1) : (partnerBoardIdx === 0 ? clocks.b0 : clocks.b1))}</div>
                </div>
             </div>
        </div>

        {/* Activity Logs Section */}
        <div className="flex flex-col bg-black/40 border border-white/5 rounded-3xl overflow-hidden h-[240px] shadow-2xl backdrop-blur-xl w-full mb-12">
           <div className="px-6 py-3 border-b border-white/5 bg-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2 uppercase tracking-[0.2em] text-[10px] font-black text-slate-500">
                 <RotateCcw className="w-4 h-4 text-blue-500"/> Activity Logs
              </div>
           </div>
           <div className="flex-1 p-6 overflow-y-auto font-mono text-xs text-slate-400 space-y-2 custom-scrollbar">
              {logs.map((l, i) => <div key={i} className="border-l-2 border-white/5 pl-3">{l}</div>)}
           </div>
           <form onSubmit={handleChatSubmit} className="p-4 bg-white/5 border-t border-white/5 flex gap-3">
              <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Type to chat..." className="flex-1 bg-black/30 border border-white/10 rounded-xl px-6 py-3 text-sm text-white outline-none focus:border-blue-500/50 transition-all font-mono" />
           </form>
        </div>
      </div>
    </div>
  );
}
