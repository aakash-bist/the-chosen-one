import { Pointer } from "lucide-react";
import React, { useEffect, useRef, useState, type JSX } from "react";

type Finger = {
  id: number;
  x: number;
  y: number;
  color: string;
  createdAt: number;
};

const DEFAULT_BG = "#0A0A0A";
const RING_SIZE = 84;
const ELIMINATION_INTERVAL = 4000; // 4 seconds

function randomUniqueColor(existing: Set<string>) {
  for (let tries = 0; tries < 30; tries++) {
    const h = Math.floor(Math.random() * 360);
    const s = 70 + Math.floor(Math.random() * 15);
    const l = 45 + Math.floor(Math.random() * 8);
    const c = `hsl(${h} ${s}% ${l}%)`;
    if (!existing.has(c)) return c;
  }
  return `hsl(${Math.floor(Math.random() * 360)} 75% 50%)`;
}

// Preload sounds once
const soundCache: Record<string, HTMLAudioElement> = {
  add: new Audio("/sounds/add.mp3"),
  remove: new Audio("/sounds/remove.mp3"),
  win: new Audio("/sounds/win.mp3"),
};

Object.values(soundCache).forEach(audio => {
  audio.load(); // preload
});

// Always clone for guaranteed play
function playSound(type: keyof typeof soundCache) {
  const audio = soundCache[type].cloneNode(true) as HTMLAudioElement;
  audio.volume = 0.5;
  audio.play().catch(() => {});
}

export default function FingerPickerGame(): JSX.Element {
  const [fingers, setFingers] = useState<Map<number, Finger>>(new Map());
  const [winnerId, setWinnerId] = useState<number | null>(null);
  const [bgColor, setBgColor] = useState<string>(DEFAULT_BG);
  const eliminationTimerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  function upsertFinger(id: number, clientX: number, clientY: number) {
    setFingers(prev => {
      const next = new Map(prev);
      const existing = new Set(Array.from(next.values()).map(f => f.color));
      if (next.has(id)) {
        const f = next.get(id)!;
        next.set(id, { ...f, x: clientX, y: clientY });
      } else {
        const color = randomUniqueColor(existing);
        next.set(id, { id, x: clientX, y: clientY, color, createdAt: Date.now() });
        playSound("add");  // 🔊 finger added
      }
      return next;
    });
  }

  function removeFinger(id: number) {
    setFingers(prev => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      if (next.size > 0) playSound("remove");  // 🔊 finger removed
      return next;
    });
  }

  function resetEliminationTimer() {
    if (eliminationTimerRef.current) {
      window.clearInterval(eliminationTimerRef.current);
      eliminationTimerRef.current = null;
    }

    if (fingers.size <= 1) return;

    eliminationTimerRef.current = window.setInterval(() => {
      setFingers(prev => {
        if (prev.size <= 1) {
          // Stop when only one left
          if (eliminationTimerRef.current) {
            window.clearInterval(eliminationTimerRef.current);
            eliminationTimerRef.current = null;
          }
          return prev;
        }

        const keys = Array.from(prev.keys());
        const loserId = keys[Math.floor(Math.random() * keys.length)];
        const next = new Map(prev);
        next.delete(loserId);

        if (next.size > 0) playSound("remove"); // 🔊 eliminated

        if (next.size === 1) {
          const [finalId] = next.keys();
          setWinnerId(finalId);
          const f = next.get(finalId);
          if (f) {
            playSound("win"); // 🔊 winner
            // setBgColor(f.color);
          }
        }

        return next;
      });
    }, ELIMINATION_INTERVAL);
  }

  useEffect(() => {
    const container = containerRef.current ?? document.body;

    function onPointerDown(e: PointerEvent) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      (e.target as Element).setPointerCapture?.(e.pointerId);
      upsertFinger(e.pointerId, e.clientX, e.clientY);
    }

    function onPointerMove(e: PointerEvent) {
      if (!e.isPrimary && e.pointerType === "mouse") return;
      if (fingers.has(e.pointerId)) {
        upsertFinger(e.pointerId, e.clientX, e.clientY);
      }
    }

    function onPointerUp(e: PointerEvent) {
      try { (e.target as Element).releasePointerCapture?.(e.pointerId); } catch {}
      removeFinger(e.pointerId);
    }

    container.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);

    return () => {
      container.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [fingers]);

  // Restart elimination when fingers change
  useEffect(() => {
    if (fingers.size > 1) {
      resetEliminationTimer();
    } else {
      if (eliminationTimerRef.current) {
        window.clearInterval(eliminationTimerRef.current);
        eliminationTimerRef.current = null;
      }
      if (fingers.size === 0) {
        // playSound("win"); // 🔊 winner (single player)
        setWinnerId(null);
        setBgColor(DEFAULT_BG);
      }
    }
  }, [Array.from(fingers.keys()).toString()]);

  function ringStyle(f: Finger) {
    const left = f.x + RING_SIZE / 100;
    const top = f.y + RING_SIZE / 100;
    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${RING_SIZE}px`,
      height: `${RING_SIZE}px`,
      boxShadow: `0 0 28px 8px ${f.color}, inset 0 0 6px ${f.color}`,
      border: `2px solid rgba(255,255,255,0.06)`,
    } as React.CSSProperties;
  }

  return (
    <div
      ref={containerRef}
      className="w-screen h-screen fixed inset-0 overflow-hidden flex items-center justify-center select-none px-4"
      style={{
        background: bgColor,
        transition: "background 700ms ease",
        touchAction: "none",
        WebkitUserSelect: "none",
        userSelect: "none",
        WebkitTouchCallout: "none",
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {fingers.size === 0 && (
        <div className="text-center select-none px-6">
          <Pointer size={120} color="#e0e0e0" strokeWidth={0.75} />
          <h1 className="text-white text-2xl font-semibold mt-2">The Chosen One by B!st</h1>
        </div>
      )}

      {Array.from(fingers.values()).map(f => (
        <div
          key={f.id}
          className="pointer-events-none absolute rounded-full transform -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
          style={ringStyle(f)}
        >
          <div
            style={{
              width: 14,
              height: 14,
              background: "rgba(255,255,255,0.9)",
              borderRadius: 999,
              boxShadow: `0 2px 10px ${f.color}`,
            }}
          />

          {winnerId === f.id && (
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%,-50%)",
                width: RING_SIZE * 1.4,
                height: RING_SIZE * 1.4,
                borderRadius: 9999,
                boxShadow: `0 0 18px 6px ${f.color}`,
                animation: "finger-pulse 1200ms infinite",
                opacity: 0.95,
                pointerEvents: "none",
              }}
            />
          )}
        </div>
      ))}

      <style>{`
        @keyframes finger-pulse {
          0% { transform: translate(-50%,-50%) scale(0.9); opacity: 0.7; }
          50% { transform: translate(-50%,-50%) scale(1.05); opacity: 1; }
          100% { transform: translate(-50%,-50%) scale(0.9); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
