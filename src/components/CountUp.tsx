"use client";

// Número que, cuando cambia, pasa del valor anterior al nuevo con una
// transición corta (portada: estadísticas que se actualizan solas).
import { useEffect, useRef, useState } from "react";

export default function CountUp({ value, className, style }: { value: number | null; className?: string; style?: React.CSSProperties }) {
  const [shown, setShown] = useState<number | null>(value);
  const prev = useRef<number | null>(value);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (value == null) return;
    const from = prev.current ?? value; const to = value; prev.current = value;
    if (from === to) { setShown(to); return; }
    setFlash(true);
    const start = performance.now(); const dur = 700;
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / dur); const e = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(from + (to - from) * e));
      if (p < 1) raf = requestAnimationFrame(step); else setTimeout(() => setFlash(false), 400);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={`${className ?? ""} transition-colors duration-500 ${flash ? "text-red-500" : ""}`} style={style}>{shown == null ? "—" : shown.toLocaleString()}</span>;
}
