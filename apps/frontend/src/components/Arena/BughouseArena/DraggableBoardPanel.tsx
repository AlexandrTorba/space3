"use client";

import React, { useRef, useState, useEffect, useCallback, ReactNode } from "react";

export const BH_PANEL_PREFIX = "bh_panel_v2_";
const BH_SIZE_PREFIX = "bh_size_v2_";

/** Clear all saved positions AND sizes (called by Reset Layout) */
export function resetAllPanelPositions() {
  if (typeof window === "undefined") return;
  Object.keys(localStorage)
    .filter((k) => k.startsWith(BH_PANEL_PREFIX) || k.startsWith(BH_SIZE_PREFIX))
    .forEach((k) => localStorage.removeItem(k));
}

/**
 * Compute the smart default layout for the bughouse desktop arena.
 * Returns positions and sizes that keep everything visible within the viewport.
 */
export function computeDefaultLayout(
  vw = typeof window !== "undefined" ? window.innerWidth : 1440,
  vh = typeof window !== "undefined" ? window.innerHeight : 900
) {
  const headerH = 64;
  const pad = 12;
  const gap = 16;

  const availH = vh - headerH - pad;

  // Board 0: fill ~85% of available height, cap at 480px
  const board0W = Math.min(480, Math.floor(availH * 0.85));
  // Board 1: exactly 75% of board0
  const board1W = Math.round(board0W * 0.75);

  const b0x = pad;
  const b0y = 0;
  const b1x = b0x + board0W + gap;
  const b1y = 0;

  const chatX = b1x + board1W + gap;
  const chatW = Math.max(260, Math.min(340, vw - chatX - pad));
  const chatH = Math.min(380, Math.floor(availH * 0.55));

  const videoX = chatX;
  const videoY = chatH + gap;
  const videoW = chatW;
  const videoH = Math.min(220, availH - videoY - pad);

  return {
    board0: { x: b0x, y: b0y, w: board0W },
    board1: { x: b1x, y: b1y, w: board1W },
    chat:   { x: chatX,  y: 0,      w: chatW,  h: chatH  },
    video:  { x: videoX, y: videoY, w: videoW, h: videoH },
  };
}

// ─────────────────────────────────────────────────────────────────────────────

interface DraggableBoardPanelProps {
  defaultX: number;
  defaultY: number;
  minWidth?: number;
  label: string;
  labelColor?: string;
  children: ReactNode;
  panelId: string;
  /** Increment to force a position+size reset */
  layoutKey?: number;
  /** Allow user to resize the panel by dragging bottom-right corner */
  resizable?: boolean;
  defaultPanelWidth?: number;
  defaultPanelHeight?: number;
  minPanelWidth?: number;
  minPanelHeight?: number;
}

export const DraggableBoardPanel: React.FC<DraggableBoardPanelProps> = ({
  defaultX,
  defaultY,
  minWidth = 180,
  label,
  labelColor = "#60a5fa",
  children,
  panelId,
  layoutKey = 0,
  resizable = false,
  defaultPanelWidth,
  defaultPanelHeight,
  minPanelWidth = 200,
  minPanelHeight = 120,
}) => {
  const posSKey  = BH_PANEL_PREFIX + panelId;
  const sizeSKey = BH_SIZE_PREFIX + panelId;

  // ── Initial position ──────────────────────────────────────────────────────
  const getInitialPos = useCallback((): { x: number; y: number } => {
    if (typeof window === "undefined") return { x: defaultX, y: defaultY };
    try {
      const raw = localStorage.getItem(posSKey);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return { x: defaultX, y: defaultY };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Initial size (only for resizable panels) ──────────────────────────────
  const getInitialSize = useCallback((): { w: number; h: number } | null => {
    if (!resizable) return null;
    if (typeof window === "undefined")
      return defaultPanelWidth ? { w: defaultPanelWidth, h: defaultPanelHeight ?? 300 } : null;
    try {
      const raw = localStorage.getItem(sizeSKey);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return defaultPanelWidth ? { w: defaultPanelWidth, h: defaultPanelHeight ?? 300 } : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [pos,       setPos]       = useState(getInitialPos);
  const [panelSize, setPanelSize] = useState<{ w: number; h: number } | null>(getInitialSize);
  const [isSnapping, setIsSnapping] = useState(false);
  const [justDropped, setJustDropped] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Reset when layoutKey changes ──────────────────────────────────────────
  useEffect(() => {
    if (layoutKey > 0) {
      setPos({ x: defaultX, y: defaultY });
      if (resizable && defaultPanelWidth) {
        setPanelSize({ w: defaultPanelWidth, h: defaultPanelHeight ?? 300 });
      } else if (resizable) {
        setPanelSize(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey]);

  // ── Persist position ──────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem(posSKey, JSON.stringify(pos)); } catch (_) {}
  }, [pos, posSKey]);

  // ── Persist size ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!resizable || !panelSize || typeof window === "undefined") return;
    try { localStorage.setItem(sizeSKey, JSON.stringify(panelSize)); } catch (_) {}
  }, [panelSize, sizeSKey, resizable]);

  // ── Snap-aware drag logic ─────────────────────────────────────────────────
  const SNAP_THRESHOLD = 18; // px — proximity to trigger a snap
  const dragging = useRef<{ ox: number; oy: number; px: number; py: number } | null>(null);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!dragging.current || !panelRef.current) return;

    const rawX = dragging.current.px + (e.clientX - dragging.current.ox);
    const rawY = Math.max(0, dragging.current.py + (e.clientY - dragging.current.oy));

    const myW = panelRef.current.offsetWidth;
    const myH = panelRef.current.offsetHeight;
    const myR = rawX + myW;
    const myB = rawY + myH;

    let sx = rawX, sy = rawY, snapped = false;
    const T = SNAP_THRESHOLD;

    // ── Snap to workspace left / top edges ──────────────────────────────
    if (Math.abs(rawX) < T)  { sx = 0; snapped = true; }
    if (Math.abs(rawY) < T)  { sy = 0; snapped = true; }

    // ── Snap to workspace right edge ─────────────────────────────────────
    const container = panelRef.current.offsetParent as HTMLElement | null;
    const cW = container?.offsetWidth ?? 9999;
    if (Math.abs(myR - cW) < T) { sx = cW - myW; snapped = true; }

    // ── Snap to other panels ──────────────────────────────────────────────
    if (container) {
      const panels = container.querySelectorAll<HTMLElement>('[data-panel-id]');
      for (const other of Array.from(panels)) {
        if (other === panelRef.current) continue;
        const oL = other.offsetLeft;
        const oT = other.offsetTop;
        const oR = oL + other.offsetWidth;
        const oB = oT + other.offsetHeight;

        // ── Horizontal snaps ─────────────────────────────────────────
        // my right → other's left (side-by-side)
        if (Math.abs(myR - oL) < T) { sx = oL - myW; snapped = true; }
        // my left → other's right
        if (Math.abs(rawX - oR) < T) { sx = oR; snapped = true; }
        // my left → other's left (column align)
        if (Math.abs(rawX - oL) < T) { sx = oL; snapped = true; }
        // my right → other's right (column align)
        if (Math.abs(myR - oR) < T) { sx = oR - myW; snapped = true; }

        // ── Vertical snaps ────────────────────────────────────────────
        // my bottom → other's top (stack above)
        if (Math.abs(myB - oT) < T) { sy = oT - myH; snapped = true; }
        // my top → other's bottom (stack below)
        if (Math.abs(rawY - oB) < T) { sy = oB; snapped = true; }
        // my top → other's top (row align)
        if (Math.abs(rawY - oT) < T) { sy = oT; snapped = true; }
        // my bottom → other's bottom (row align)
        if (Math.abs(myB - oB) < T) { sy = oB - myH; snapped = true; }
      }
    }

    setPos({ x: sx, y: sy });
    setIsSnapping(snapped);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerUp = useCallback(() => {
    dragging.current = null;
    setIsSnapping(false);
    // Brief settle animation
    setJustDropped(true);
    setTimeout(() => setJustDropped(false), 250);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup",   onPointerUp);
  }, [onPointerMove]);

  const onHandlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    e.stopPropagation();
    setJustDropped(false);
    dragging.current = { ox: e.clientX, oy: e.clientY, px: pos.x, py: pos.y };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup",   onPointerUp);
  }, [pos, onPointerMove, onPointerUp]);

  // ── Resize logic ──────────────────────────────────────────────────────────
  const resizing = useRef<{ ox: number; oy: number; sw: number; sh: number } | null>(null);

  const onResizeMove = useCallback((e: PointerEvent) => {
    if (!resizing.current) return;
    setPanelSize({
      w: Math.max(minPanelWidth,  resizing.current.sw + (e.clientX - resizing.current.ox)),
      h: Math.max(minPanelHeight, resizing.current.sh + (e.clientY - resizing.current.oy)),
    });
  }, [minPanelWidth, minPanelHeight]);

  const onResizeUp = useCallback(() => {
    resizing.current = null;
    window.removeEventListener("pointermove", onResizeMove);
    window.removeEventListener("pointerup",   onResizeUp);
  }, [onResizeMove]);

  const onResizePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const cur = panelSize ?? {
      w: panelRef.current?.offsetWidth  ?? (defaultPanelWidth  ?? 320),
      h: panelRef.current?.offsetHeight ?? (defaultPanelHeight ?? 300),
    };
    resizing.current = { ox: e.clientX, oy: e.clientY, sw: cur.w, sh: cur.h };
    window.addEventListener("pointermove", onResizeMove);
    window.addEventListener("pointerup",   onResizeUp);
  }, [panelSize, defaultPanelWidth, defaultPanelHeight, onResizeMove, onResizeUp]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup",   onPointerUp);
      window.removeEventListener("pointermove", onResizeMove);
      window.removeEventListener("pointerup",   onResizeUp);
    };
  }, [onPointerMove, onPointerUp, onResizeMove, onResizeUp]);

  return (
    <div
      ref={panelRef}
      data-panel-id={panelId}
      style={{
        position: "absolute",
        left: pos.x,
        top: pos.y,
        minWidth,
        zIndex: isSnapping ? 20 : 10,
        // Subtle blue glow when snapping to indicate magnetic lock
        boxShadow: isSnapping
          ? '0 0 0 1.5px rgba(96,165,250,0.55), 0 8px 40px rgba(0,0,0,0.65)'
          : '0 8px 32px rgba(0,0,0,0.55)',
        // Micro settle animation on drop
        transition: justDropped
          ? 'box-shadow 0.25s ease'
          : 'box-shadow 0.15s ease',
      }}
      className="flex flex-col rounded-xl"
    >
      {/* ── Drag handle ───────────────────────────────────────── */}
      <div
        onPointerDown={onHandlePointerDown}
        style={{
          cursor: "grab",
          touchAction: "none",
          userSelect: "none",
          WebkitUserSelect: "none",
          color: labelColor,
          minHeight: 28,           // ensures easy grab target even at y=0
        } as React.CSSProperties}
        className="flex items-center gap-1.5 px-2 py-2 mb-0.5 text-[10px] font-black tracking-widest uppercase hover:bg-white/8 active:bg-white/12 rounded-lg transition-colors select-none"
        title="Drag to move"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"
          className={`shrink-0 transition-opacity ${isSnapping ? 'opacity-100' : 'opacity-60'}`}>
          <circle cx="2" cy="2" r="1.1" /><circle cx="8" cy="2" r="1.1" />
          <circle cx="2" cy="5" r="1.1" /><circle cx="8" cy="5" r="1.1" />
          <circle cx="2" cy="8" r="1.1" /><circle cx="8" cy="8" r="1.1" />
        </svg>
        <span className="truncate flex-1">{label}</span>

        {/* Snap indicator */}
        {isSnapping && (
          <span className="text-[8px] opacity-60 font-mono shrink-0 animate-pulse">⊕</span>
        )}

        {/* Resize size readout */}
        {resizable && panelSize && !isSnapping && (
          <span className="opacity-30 text-[8px] font-mono shrink-0">
            {panelSize.w}×{panelSize.h}
          </span>
        )}
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div
        style={
          panelSize
            ? { width: panelSize.w, height: panelSize.h, overflow: "hidden", position: "relative" }
            : { position: "relative" }
        }
      >
        {children}

        {/* ── Resize handle (bottom-right) ─────────────────────────────── */}
        {resizable && (
          <div
            onPointerDown={onResizePointerDown}
            title="Resize panel"
            style={{ cursor: "nwse-resize", touchAction: "none" }}
            className="
              absolute bottom-0 right-0
              w-5 h-5
              flex items-end justify-end
              pb-0.5 pr-0.5
              text-white/25 hover:text-white/70
              transition-colors z-20
            "
          >
            {/* Three diagonal dots indicating resize */}
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <circle cx="8" cy="8" r="1.2" />
              <circle cx="5" cy="8" r="1.2" />
              <circle cx="8" cy="5" r="1.2" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
};
