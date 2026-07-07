// Personalization presets for printable QR codes (dashboard/qr-codes).
// Each theme is a full qr-code-styling config: dot shape/color, corner
// shape/color, background, and whether to embed the Maintly gear logo in
// the center. Stored per-code as `qr_codes.theme` (see migration 017) so a
// mechanic can change a code's look at any time without regenerating it —
// the underlying data the QR encodes (the code itself) never changes.

export type QrDotType = "square" | "rounded" | "dots" | "classy" | "classy-rounded" | "extra-rounded";
export type QrCornerSquareType = "square" | "dot" | "extra-rounded";
export type QrCornerDotType = "square" | "dot";

// A "frame" is an optional decorative shape drawn behind the QR (a flower,
// a sun, industry-flavored motifs, etc.) — see QrFrameShape.tsx. The QR
// itself always sits on a plain white card in the center so the frame never
// touches the actual modules and scannability is never compromised.
export type QrFrameShape =
  | "flower" | "sun" | "star" | "wave" | "mountain"
  | "daisy" | "wrench" | "gear" | "soccer" | "tennis" | "skull" | "crossbones" | "shield";

export interface QrThemeDef {
  id: string;
  name: string;
  description: string;
  category: "professional" | "playful" | "industry";
  frame?: QrFrameShape;
  frameColor?: string;
  options: {
    dotsColor: string;
    dotsType: QrDotType;
    backgroundColor: string;
    cornersSquareColor: string;
    cornersSquareType: QrCornerSquareType;
    cornersDotColor: string;
    cornersDotType: QrCornerDotType;
    logo: boolean;
  };
}

export const qrThemes: QrThemeDef[] = [
  {
    id: "classic",
    name: "Classic",
    description: "Plain black on white. Prints cheaply and scans reliably anywhere.",
    category: "professional",
    options: {
      dotsColor: "#18181b", dotsType: "square", backgroundColor: "#ffffff",
      cornersSquareColor: "#18181b", cornersSquareType: "square",
      cornersDotColor: "#18181b", cornersDotType: "square", logo: false,
    },
  },
  {
    id: "maintly-red",
    name: "Maintly Red",
    description: "Brand red modules with the Maintly gear in the center.",
    category: "professional",
    options: {
      dotsColor: "#dc2626", dotsType: "rounded", backgroundColor: "#ffffff",
      cornersSquareColor: "#dc2626", cornersSquareType: "extra-rounded",
      cornersDotColor: "#dc2626", cornersDotType: "dot", logo: true,
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "White modules on near-black — a premium, low-glare label.",
    category: "professional",
    options: {
      dotsColor: "#fafafa", dotsType: "dots", backgroundColor: "#18181b",
      cornersSquareColor: "#dc2626", cornersSquareType: "extra-rounded",
      cornersDotColor: "#fafafa", cornersDotType: "dot", logo: true,
    },
  },
  {
    id: "outline-gear",
    name: "Outline Gear",
    description: "Rounded, chunky modules styled after the Maintly gear, with the logo front and center.",
    category: "professional",
    options: {
      dotsColor: "#27272a", dotsType: "classy-rounded", backgroundColor: "#ffffff",
      cornersSquareColor: "#dc2626", cornersSquareType: "extra-rounded",
      cornersDotColor: "#dc2626", cornersDotType: "dot", logo: true,
    },
  },
  {
    id: "minimal-dot",
    name: "Minimal Dot",
    description: "Soft grey dots, no logo — subtle, for equipment where a bold sticker looks out of place.",
    category: "professional",
    options: {
      dotsColor: "#52525b", dotsType: "dots", backgroundColor: "#ffffff",
      cornersSquareColor: "#52525b", cornersSquareType: "dot",
      cornersDotColor: "#52525b", cornersDotType: "dot", logo: false,
    },
  },
  {
    id: "bold-frame",
    name: "Bold Frame",
    description: "High-contrast squares with a heavy red frame — built to stay scannable on grimy, worn equipment.",
    category: "professional",
    options: {
      dotsColor: "#18181b", dotsType: "square", backgroundColor: "#ffffff",
      cornersSquareColor: "#dc2626", cornersSquareType: "square",
      cornersDotColor: "#18181b", cornersDotType: "square", logo: false,
    },
  },
  {
    id: "bloom",
    name: "Bloom",
    description: "The QR sits inside a flower — a fun, decorative option for anyone who wants something less industrial.",
    category: "playful",
    frame: "flower",
    frameColor: "#ec4899",
    options: {
      dotsColor: "#27272a", dotsType: "rounded", backgroundColor: "#ffffff",
      cornersSquareColor: "#ec4899", cornersSquareType: "extra-rounded",
      cornersDotColor: "#ec4899", cornersDotType: "dot", logo: false,
    },
  },
  {
    id: "sunburst",
    name: "Sunburst",
    description: "The QR sits inside a bright sun with radiating rays.",
    category: "playful",
    frame: "sun",
    frameColor: "#f59e0b",
    options: {
      dotsColor: "#27272a", dotsType: "rounded", backgroundColor: "#ffffff",
      cornersSquareColor: "#f59e0b", cornersSquareType: "extra-rounded",
      cornersDotColor: "#f59e0b", cornersDotType: "dot", logo: false,
    },
  },
  {
    id: "star",
    name: "Star",
    description: "A playful star frame — a favorite for kids' bikes and scooters.",
    category: "playful",
    frame: "star",
    frameColor: "#3b82f6",
    options: {
      dotsColor: "#27272a", dotsType: "dots", backgroundColor: "#ffffff",
      cornersSquareColor: "#3b82f6", cornersSquareType: "dot",
      cornersDotColor: "#3b82f6", cornersDotType: "dot", logo: false,
    },
  },
  {
    id: "wave",
    name: "Wave",
    description: "A rolling-wave motif for marine and outdoor equipment.",
    category: "industry",
    frame: "wave",
    frameColor: "#0891b2",
    options: {
      dotsColor: "#18181b", dotsType: "classy", backgroundColor: "#ffffff",
      cornersSquareColor: "#0891b2", cornersSquareType: "extra-rounded",
      cornersDotColor: "#0891b2", cornersDotType: "dot", logo: false,
    },
  },
  {
    id: "peak",
    name: "Peak",
    description: "A mountain-ridge motif for off-road, farm, and outdoor gear.",
    category: "industry",
    frame: "mountain",
    frameColor: "#15803d",
    options: {
      dotsColor: "#18181b", dotsType: "classy-rounded", backgroundColor: "#ffffff",
      cornersSquareColor: "#15803d", cornersSquareType: "square",
      cornersDotColor: "#15803d", cornersDotType: "square", logo: false,
    },
  },
  {
    id: "daisy",
    name: "Daisy",
    description: "Thin white petals — a softer, more delicate flower than Bloom.",
    category: "playful",
    frame: "daisy",
    frameColor: "#f4f4f5",
    options: {
      dotsColor: "#27272a", dotsType: "dots", backgroundColor: "#ffffff",
      cornersSquareColor: "#f59e0b", cornersSquareType: "dot",
      cornersDotColor: "#f59e0b", cornersDotType: "dot", logo: false,
    },
  },
  {
    id: "wrench-cross",
    name: "Lug Wrench",
    description: "A tire iron/lug wrench cross — built for the actual mechanic's shop.",
    category: "industry",
    frame: "wrench",
    frameColor: "#52525b",
    options: {
      dotsColor: "#18181b", dotsType: "square", backgroundColor: "#ffffff",
      cornersSquareColor: "#52525b", cornersSquareType: "square",
      cornersDotColor: "#52525b", cornersDotType: "square", logo: false,
    },
  },
  {
    id: "gear-ring",
    name: "Gear Ring",
    description: "A big cog frame — an industrial alternative to the small Maintly logo.",
    category: "industry",
    frame: "gear",
    frameColor: "#f97316",
    options: {
      dotsColor: "#18181b", dotsType: "classy", backgroundColor: "#ffffff",
      cornersSquareColor: "#f97316", cornersSquareType: "square",
      cornersDotColor: "#f97316", cornersDotType: "square", logo: false,
    },
  },
  {
    id: "soccer",
    name: "Soccer Ball",
    description: "A soccer-ball texture ring, for sports equipment and gear.",
    category: "industry",
    frame: "soccer",
    frameColor: "#18181b",
    options: {
      dotsColor: "#18181b", dotsType: "square", backgroundColor: "#ffffff",
      cornersSquareColor: "#18181b", cornersSquareType: "square",
      cornersDotColor: "#18181b", cornersDotType: "square", logo: false,
    },
  },
  {
    id: "tennis",
    name: "Tennis Ball",
    description: "Lime green with the classic curved seam.",
    category: "industry",
    frame: "tennis",
    frameColor: "#a3e635",
    options: {
      dotsColor: "#27272a", dotsType: "dots", backgroundColor: "#ffffff",
      cornersSquareColor: "#65a30d", cornersSquareType: "dot",
      cornersDotColor: "#65a30d", cornersDotType: "dot", logo: false,
    },
  },
  {
    id: "skull",
    name: "Skull",
    description: "A bold skull frame — a favorite for motorcycles and off-road gear.",
    category: "playful",
    frame: "skull",
    frameColor: "#e4e4e7",
    options: {
      dotsColor: "#18181b", dotsType: "square", backgroundColor: "#ffffff",
      cornersSquareColor: "#18181b", cornersSquareType: "square",
      cornersDotColor: "#18181b", cornersDotType: "square", logo: false,
    },
  },
  {
    id: "crossbones",
    name: "Skull & Crossbones",
    description: "Skull and crossed bones — pirate-flag style.",
    category: "playful",
    frame: "crossbones",
    frameColor: "#e4e4e7",
    options: {
      dotsColor: "#18181b", dotsType: "square", backgroundColor: "#ffffff",
      cornersSquareColor: "#18181b", cornersSquareType: "square",
      cornersDotColor: "#18181b", cornersDotType: "square", logo: false,
    },
  },
  {
    id: "shield",
    name: "Shield",
    description: "A shield outline — a serious, protective look for a badge or certificate feel.",
    category: "professional",
    frame: "shield",
    frameColor: "#0f172a",
    options: {
      dotsColor: "#0f172a", dotsType: "square", backgroundColor: "#ffffff",
      cornersSquareColor: "#0f172a", cornersSquareType: "square",
      cornersDotColor: "#0f172a", cornersDotType: "square", logo: false,
    },
  },
];

export const QR_THEME_CATEGORIES: { id: QrThemeDef["category"]; label: string }[] = [
  { id: "professional", label: "Professional" },
  { id: "playful", label: "Playful" },
  { id: "industry", label: "Industry & hobby" },
];

export const DEFAULT_QR_THEME = "classic";

export function getQrTheme(id: string | null | undefined): QrThemeDef {
  return qrThemes.find((t) => t.id === id) ?? qrThemes[0];
}

export function isValidQrTheme(id: string): boolean {
  return qrThemes.some((t) => t.id === id);
}
