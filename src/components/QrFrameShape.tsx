"use client";

import { useId } from "react";
import type { QrFrameShape as QrFrameShapeId } from "@/lib/qrThemes";

// Decorative shapes drawn BEHIND a personalized QR (see qrThemes.ts and
// QrCodeCanvas.tsx, which layers the actual QR on a plain white card
// centered on top of whichever shape is returned here — that's what keeps
// the QR itself always scannable no matter how busy the frame is).
//
// Note on style: Facu asked for a glossy "3D sticker" look like some AI-
// generated reference images he shared. There's no image-generation tool
// available in this environment to produce photoreal renders like those —
// what's here instead is hand-built SVG with gradients, a drop shadow, and
// a highlight streak to fake that glossy/rounded look. It's not a photo,
// but it's a lot closer to "designed sticker" than a flat silhouette, and
// it still prints cleanly (no external image assets to manage). Adding a
// new motif later is a new case here plus an entry in qrThemes.ts.
export default function QrFrameShape({
  shape,
  color,
  size,
}: {
  shape: QrFrameShapeId;
  color: string;
  size: number;
}) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const box = { width: size, height: size, viewBox: "0 0 200 200" };
  const grad = `qrg-${rawId}`;
  const shadow = `qrs-${rawId}`;
  const light = lighten(color, 50);
  const dark = darken(color, 28);

  const defs = (
    <defs>
      <radialGradient id={grad} cx="34%" cy="28%" r="80%">
        <stop offset="0%" stopColor={light} />
        <stop offset="55%" stopColor={color} />
        <stop offset="100%" stopColor={dark} />
      </radialGradient>
      <filter id={shadow} x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#000000" floodOpacity="0.28" />
      </filter>
    </defs>
  );
  const fill = `url(#${grad})`;

  if (shape === "flower") {
    const petals = Array.from({ length: 8 }, (_, i) => i * 45);
    return (
      <svg {...box}>
        {defs}
        <g filter={`url(#${shadow})`}>
          {petals.map((angle) => (
            <ellipse key={angle} cx="100" cy="50" rx="26" ry="44" fill={fill} transform={`rotate(${angle} 100 100)`} />
          ))}
        </g>
        <Gloss cx={78} cy={70} rx={22} ry={12} />
      </svg>
    );
  }

  if (shape === "sun") {
    const rays = Array.from({ length: 12 }, (_, i) => i * 30);
    return (
      <svg {...box}>
        {defs}
        <g filter={`url(#${shadow})`}>
          {rays.map((angle) => (
            <rect key={angle} x="96" y="4" width="8" height="36" rx="4" fill={color} transform={`rotate(${angle} 100 100)`} />
          ))}
          <circle cx="100" cy="100" r="50" fill={fill} />
        </g>
        <Gloss cx={82} cy={82} rx={20} ry={13} />
      </svg>
    );
  }

  if (shape === "star") {
    return (
      <svg {...box}>
        {defs}
        <polygon points={starPoints(100, 100, 96, 42, 5)} fill={fill} filter={`url(#${shadow})`} />
        <Gloss cx={80} cy={78} rx={20} ry={12} />
      </svg>
    );
  }

  if (shape === "wave") {
    return (
      <svg {...box}>
        {defs}
        <circle cx="100" cy="100" r="92" fill={color} opacity={0.1} />
        <g filter={`url(#${shadow})`}>
          <path d="M-10 132 Q 15 112 40 132 T 90 132 T 140 132 T 190 132 T 220 132 V210 H-10 Z" fill={dark} opacity={0.75} />
          <path d="M-10 155 Q 15 137 40 155 T 90 155 T 140 155 T 190 155 T 220 155 V210 H-10 Z" fill={fill} />
        </g>
      </svg>
    );
  }

  if (shape === "mountain") {
    return (
      <svg {...box}>
        {defs}
        <circle cx="100" cy="100" r="92" fill={color} opacity={0.1} />
        <g filter={`url(#${shadow})`}>
          <polygon points="-10,155 55,65 92,110 128,50 210,155" fill={fill} />
        </g>
      </svg>
    );
  }

  if (shape === "daisy") {
    const petals = Array.from({ length: 16 }, (_, i) => i * (360 / 16));
    return (
      <svg {...box}>
        {defs}
        <g filter={`url(#${shadow})`}>
          {petals.map((angle) => (
            <ellipse key={angle} cx="100" cy="38" rx="9" ry="36" fill={color} stroke="#d4d4d8" strokeWidth="1" transform={`rotate(${angle} 100 100)`} />
          ))}
          <circle cx="100" cy="100" r="26" fill={`url(#${grad}-daisy)`} />
        </g>
        <defs>
          <radialGradient id={`${grad}-daisy`} cx="35%" cy="30%" r="80%">
            <stop offset="0%" stopColor="#fef3c7" />
            <stop offset="60%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#b45309" />
          </radialGradient>
        </defs>
      </svg>
    );
  }

  if (shape === "wrench") {
    return (
      <svg {...box}>
        {defs}
        <g transform="rotate(45 100 100)" filter={`url(#${shadow})`}>
          <rect x="90" y="8" width="20" height="184" rx="8" fill={fill} />
          <rect x="8" y="90" width="184" height="20" rx="8" fill={fill} />
          {[[100, 22], [100, 178], [22, 100], [178, 100]].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="16" fill={fill} stroke={dark} strokeWidth="2" />
          ))}
        </g>
        <Gloss cx={92} cy={78} rx={5} ry={40} rotate={45} />
      </svg>
    );
  }

  if (shape === "gear") {
    const teeth = Array.from({ length: 10 }, (_, i) => i * 36);
    return (
      <svg {...box}>
        {defs}
        <g filter={`url(#${shadow})`}>
          <circle cx="100" cy="100" r="68" fill="none" stroke={fill} strokeWidth="10" />
          {teeth.map((angle) => (
            <rect key={angle} x="90" y="0" width="20" height="34" rx="4" fill={fill} transform={`rotate(${angle} 100 100)`} />
          ))}
        </g>
        <Gloss cx={78} cy={70} rx={18} ry={10} />
      </svg>
    );
  }

  if (shape === "soccer") {
    const patches = Array.from({ length: 10 }, (_, i) => i * 36);
    return (
      <svg {...box}>
        {defs}
        <radialGradient id={`${grad}-ball`} cx="34%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#f4f4f5" />
          <stop offset="100%" stopColor="#c4c4c8" />
        </radialGradient>
        <g filter={`url(#${shadow})`}>
          <circle cx="100" cy="100" r="96" fill={`url(#${grad}-ball)`} stroke={color} strokeWidth="2" />
          {patches.map((angle) => {
            const rad = (angle * Math.PI) / 180;
            const cx = 100 + 78 * Math.cos(rad);
            const cy = 100 + 78 * Math.sin(rad);
            return <polygon key={angle} points={polygonPoints(cx, cy, 13, 5, angle)} fill={color} />;
          })}
        </g>
        <Gloss cx={78} cy={72} rx={22} ry={13} />
      </svg>
    );
  }

  if (shape === "tennis") {
    return (
      <svg {...box}>
        {defs}
        <g filter={`url(#${shadow})`}>
          <circle cx="100" cy="100" r="96" fill={fill} />
          <path d="M14 58 Q 100 14 186 58" stroke="#fefce8" strokeWidth="7" fill="none" />
          <path d="M14 142 Q 100 186 186 142" stroke="#fefce8" strokeWidth="7" fill="none" />
        </g>
        <Gloss cx={78} cy={72} rx={22} ry={13} />
      </svg>
    );
  }

  if (shape === "skull") {
    return (
      <svg {...box}>
        {defs}
        <g filter={`url(#${shadow})`}>
          <SkullGlyph fill={fill} highlightFill={`url(#${grad}-bone)`} />
        </g>
        <defs>
          <radialGradient id={`${grad}-bone`} cx="35%" cy="25%" r="80%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#e4e4e7" />
            <stop offset="100%" stopColor="#a1a1aa" />
          </radialGradient>
        </defs>
      </svg>
    );
  }

  if (shape === "crossbones") {
    return (
      <svg {...box}>
        {defs}
        <g filter={`url(#${shadow})`}>
          <g transform="rotate(45 100 100)"><Bone fill={fill} dark={dark} /></g>
          <g transform="rotate(-45 100 100)"><Bone fill={fill} dark={dark} /></g>
          <g transform="translate(38 38) scale(0.62)">
            <SkullGlyph fill={`url(#${grad}-bone)`} />
          </g>
        </g>
        <defs>
          <radialGradient id={`${grad}-bone`} cx="35%" cy="25%" r="80%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#e4e4e7" />
            <stop offset="100%" stopColor="#a1a1aa" />
          </radialGradient>
        </defs>
      </svg>
    );
  }

  // shield
  return (
    <svg {...box}>
      {defs}
      <g filter={`url(#${shadow})`}>
        <path
          d="M100 6 L182 34 V96 C182 148 146 180 100 196 C54 180 18 148 18 96 V34 Z"
          fill={fill}
        />
      </g>
      <Gloss cx={78} cy={60} rx={22} ry={14} />
    </svg>
  );
}

function Gloss({ cx, cy, rx, ry, rotate = -20 }: { cx: number; cy: number; rx: number; ry: number; rotate?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#ffffff" opacity={0.4} transform={`rotate(${rotate} ${cx} ${cy})`} />;
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

// A small regular polygon (used for the soccer-ball texture patches).
function polygonPoints(cx: number, cy: number, r: number, sides: number, rotationDeg: number): string {
  const pts: string[] = [];
  const rotation = (rotationDeg * Math.PI) / 180;
  for (let i = 0; i < sides; i++) {
    const angle = rotation + (i * 2 * Math.PI) / sides;
    pts.push(`${cx + Math.cos(angle) * r},${cy + Math.sin(angle) * r}`);
  }
  return pts.join(" ");
}

function Bone({ fill, dark }: { fill: string; dark: string }) {
  return (
    <g>
      <rect x="26" y="92" width="148" height="16" rx="8" fill={fill} stroke={dark} strokeWidth="1.5" />
      <circle cx="26" cy="86" r="13" fill={fill} stroke={dark} strokeWidth="1.5" />
      <circle cx="26" cy="114" r="13" fill={fill} stroke={dark} strokeWidth="1.5" />
      <circle cx="174" cy="86" r="13" fill={fill} stroke={dark} strokeWidth="1.5" />
      <circle cx="174" cy="114" r="13" fill={fill} stroke={dark} strokeWidth="1.5" />
    </g>
  );
}

function SkullGlyph({ fill, highlightFill }: { fill: string; highlightFill?: string }) {
  const boneFill = highlightFill ?? fill;
  return (
    <>
      <circle cx="100" cy="88" r="68" fill={boneFill} stroke="#71717a" strokeWidth="2" />
      <rect x="58" y="135" width="84" height="34" rx="10" fill={boneFill} stroke="#71717a" strokeWidth="2" />
      <circle cx="78" cy="84" r="15" fill="#18181b" />
      <circle cx="122" cy="84" r="15" fill="#18181b" />
      <polygon points="100,100 93,118 107,118" fill="#18181b" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={68 + i * 16} y="155" width="9" height="14" fill="#18181b" />
      ))}
      <ellipse cx="78" cy="62" rx="18" ry="10" fill="#ffffff" opacity={0.35} transform="rotate(-15 78 62)" />
    </>
  );
}

function lighten(hex: string, percent: number): string {
  return mix(hex, "#ffffff", percent);
}
function darken(hex: string, percent: number): string {
  return mix(hex, "#000000", percent);
}
function mix(hex: string, target: string, percent: number): string {
  const c1 = parseHex(hex);
  const c2 = parseHex(target);
  if (!c1 || !c2) return hex;
  const p = Math.min(100, Math.max(0, percent)) / 100;
  const r = Math.round(c1.r + (c2.r - c1.r) * p);
  const g = Math.round(c1.g + (c2.g - c1.g) * p);
  const b = Math.round(c1.b + (c2.b - c1.b) * p);
  return `rgb(${r}, ${g}, ${b})`;
}
function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.replace("#", "");
  if (m.length !== 6) return null;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return null;
  return { r, g, b };
}
