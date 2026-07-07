"use client";

import type { QrFrameShape as QrFrameShapeId } from "@/lib/qrThemes";

// Decorative shapes drawn BEHIND a personalized QR (see qrThemes.ts and
// QrCodeCanvas.tsx, which layers the actual QR on a plain white card
// centered on top of whichever shape is returned here — that's what keeps
// the QR itself always scannable no matter how busy the frame is). Pure
// inline SVG, no external image assets to source or ship: adding a new
// motif later is just a new case here plus an entry in qrThemes.ts.
export default function QrFrameShape({
  shape,
  color,
  size,
}: {
  shape: QrFrameShapeId;
  color: string;
  size: number;
}) {
  const box = { width: size, height: size, viewBox: "0 0 200 200" };

  if (shape === "flower") {
    const petals = Array.from({ length: 8 }, (_, i) => i * 45);
    return (
      <svg {...box}>
        {petals.map((angle) => (
          <ellipse key={angle} cx="100" cy="50" rx="26" ry="44" fill={color} opacity={0.85} transform={`rotate(${angle} 100 100)`} />
        ))}
      </svg>
    );
  }

  if (shape === "sun") {
    const rays = Array.from({ length: 12 }, (_, i) => i * 30);
    return (
      <svg {...box}>
        {rays.map((angle) => (
          <rect key={angle} x="96" y="4" width="8" height="36" rx="4" fill={color} transform={`rotate(${angle} 100 100)`} />
        ))}
        <circle cx="100" cy="100" r="50" fill={color} opacity={0.9} />
      </svg>
    );
  }

  if (shape === "star") {
    return (
      <svg {...box}>
        <polygon points={starPoints(100, 100, 96, 42, 5)} fill={color} opacity={0.9} />
      </svg>
    );
  }

  if (shape === "wave") {
    return (
      <svg {...box}>
        <circle cx="100" cy="100" r="92" fill={color} opacity={0.1} />
        <path d="M-10 132 Q 15 112 40 132 T 90 132 T 140 132 T 190 132 T 220 132 V210 H-10 Z" fill={color} opacity={0.35} />
        <path d="M-10 155 Q 15 137 40 155 T 90 155 T 140 155 T 190 155 T 220 155 V210 H-10 Z" fill={color} opacity={0.55} />
      </svg>
    );
  }

  // mountain
  return (
    <svg {...box}>
      <circle cx="100" cy="100" r="92" fill={color} opacity={0.1} />
      <polygon points="-10,155 55,65 92,110 128,50 210,155" fill={color} opacity={0.85} />
    </svg>
  );
}

function starPoints(cx: number, cy: number, outerR: number, innerR: number, spikes: number): string {
  const pts: string[] = [];
  const step = Math.PI / spikes;
  let angle = -Math.PI / 2;
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push(`${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`);
    angle += step;
  }
  return pts.join(" ");
}
