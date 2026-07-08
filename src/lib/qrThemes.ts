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
// a sun, industry-flavored motifs, etc.) — see QrFrameShape.tsx. Kept for a
// handful of themes (daisy, star, tennis) that don't have a matching PNG
// asset. Most decorative themes now use `frameImage` instead (see below) —
// real illustrated artwork Facu supplied, cropped and cleaned into
// public/images/qr-frames/.
export type QrFrameShape =
  | "flower" | "sun" | "star" | "wave" | "mountain"
  | "daisy" | "wrench" | "gear" | "soccer" | "tennis" | "skull" | "crossbones" | "shield";

// A hole rectangle, in fractions (0-1) of the frameImage's own width/height,
// marking where that image's pre-drawn white placeholder square sits. The
// real QR is sized/positioned to land exactly inside it. Computed once by
// analyzing each source PNG's opaque near-white region — see the project
// notes for the extraction method (connected-component analysis, not naive
// grid slicing, which bled neighboring artwork into a couple of early crops
// before the process was fixed).
export interface QrFrameHole {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface QrThemeDef {
  id: string;
  name: string;
  description: string;
  category: "professional" | "playful" | "industry";
  frame?: QrFrameShape;
  frameColor?: string;
  frameImage?: string; // path under /public, e.g. "/images/qr-frames/qr-flower.png"
  frameHole?: QrFrameHole;
  frameAspect?: number; // source image height / width, so layout doesn't jump waiting on image load
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
    id: "shield",
    name: "Shield",
    description: "An illustrated shield badge — a serious, protective look for a certificate feel.",
    category: "professional",
    frameImage: "/images/qr-frames/qr-shield.png", frameAspect: 1.1317,
    frameHole: { x: 0.2488, y: 0.2629, w: 0.5024, h: 0.4397 },
    options: {
      dotsColor: "#0f172a", dotsType: "square", backgroundColor: "#ffffff",
      cornersSquareColor: "#0f172a", cornersSquareType: "square",
      cornersDotColor: "#0f172a", cornersDotType: "square", logo: false,
    },
  },

  // --- Playful ---
  {
    id: "bloom",
    name: "Bloom",
    description: "The QR sits inside an illustrated metallic flower — a fun, decorative option for anyone who wants something less industrial.",
    category: "playful",
    frameImage: "/images/qr-frames/qr-flower.png", frameAspect: 1.1232,
    frameHole: { x: 0.2428, y: 0.2839, w: 0.5145, h: 0.4452 },
    options: {
      dotsColor: "#27272a", dotsType: "rounded", backgroundColor: "#ffffff",
      cornersSquareColor: "#ec4899", cornersSquareType: "extra-rounded",
      cornersDotColor: "#ec4899", cornersDotType: "dot", logo: false,
    },
  },
  {
    id: "sunburst",
    name: "Sunburst",
    description: "The QR sits inside a bright illustrated sun with radiating rays.",
    category: "playful",
    frameImage: "/images/qr-frames/qr-sun.png", frameAspect: 1.0193,
    frameHole: { x: 0.3282, y: 0.3447, w: 0.332, h: 0.322 },
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
    id: "skull",
    name: "Skull",
    description: "A bold illustrated skull frame — a favorite for motorcycles and off-road gear.",
    category: "playful",
    frameImage: "/images/qr-frames/qr-skull.png", frameAspect: 1.0897,
    frameHole: { x: 0.2791, y: 0.3811, w: 0.4385, h: 0.3994 },
    options: {
      dotsColor: "#18181b", dotsType: "square", backgroundColor: "#ffffff",
      cornersSquareColor: "#18181b", cornersSquareType: "square",
      cornersDotColor: "#18181b", cornersDotType: "square", logo: false,
    },
  },
  {
    id: "crossbones",
    name: "Skull & Crossbones",
    description: "Skull and crossed bones — pirate-flag style, fully illustrated.",
    category: "playful",
    frameImage: "/images/qr-frames/qr-crossbones.png", frameAspect: 0.9181,
    frameHole: { x: 0.3103, y: 0.4507, w: 0.375, h: 0.4038 },
    options: {
      dotsColor: "#18181b", dotsType: "square", backgroundColor: "#ffffff",
      cornersSquareColor: "#18181b", cornersSquareType: "square",
      cornersDotColor: "#18181b", cornersDotType: "square", logo: false,
    },
  },
  {
    id: "petal-badge",
    name: "Petal Badge",
    description: "A six-petal metallic badge — a sturdier, more formal alternative to Bloom.",
    category: "playful",
    frameImage: "/images/qr-frames/qr-petal-badge.png", frameAspect: 1.1388,
    frameHole: { x: 0.3062, y: 0.3277, w: 0.378, h: 0.3319 },
    options: {
      dotsColor: "#27272a", dotsType: "rounded", backgroundColor: "#ffffff",
      cornersSquareColor: "#dc2626", cornersSquareType: "extra-rounded",
      cornersDotColor: "#dc2626", cornersDotType: "dot", logo: false,
    },
  },
  {
    id: "crown",
    name: "Crown",
    description: "A jeweled gold crown — a regal, standout option.",
    category: "playful",
    frameImage: "/images/qr-frames/qr-crown.png", frameAspect: 1.0592,
    frameHole: { x: 0.2892, y: 0.4276, w: 0.4181, h: 0.398 },
    options: {
      dotsColor: "#27272a", dotsType: "dots", backgroundColor: "#ffffff",
      cornersSquareColor: "#eab308", cornersSquareType: "extra-rounded",
      cornersDotColor: "#eab308", cornersDotType: "dot", logo: false,
    },
  },
  {
    id: "diamond",
    name: "Diamond",
    description: "A faceted icy-blue diamond frame.",
    category: "playful",
    frameImage: "/images/qr-frames/qr-diamond.png", frameAspect: 0.8771,
    frameHole: { x: 0.3056, y: 0.2008, w: 0.3887, h: 0.4432 },
    options: {
      dotsColor: "#27272a", dotsType: "dots", backgroundColor: "#ffffff",
      cornersSquareColor: "#0ea5e9", cornersSquareType: "extra-rounded",
      cornersDotColor: "#0ea5e9", cornersDotType: "dot", logo: false,
    },
  },
  {
    id: "cherry-blossom",
    name: "Cherry Blossom",
    description: "A ring of pink cherry blossoms.",
    category: "playful",
    frameImage: "/images/qr-frames/qr-cherry-blossom.png", frameAspect: 1.0,
    frameHole: { x: 0.3097, y: 0.323, w: 0.3761, h: 0.3761 },
    options: {
      dotsColor: "#27272a", dotsType: "dots", backgroundColor: "#ffffff",
      cornersSquareColor: "#ec4899", cornersSquareType: "extra-rounded",
      cornersDotColor: "#ec4899", cornersDotType: "dot", logo: false,
    },
  },
  {
    id: "heart-crown",
    name: "Crowned Heart",
    description: "A glossy pink heart topped with a small gold crown.",
    category: "playful",
    frameImage: "/images/qr-frames/qr-heart-crown.png", frameAspect: 1.0,
    frameHole: { x: 0.3097, y: 0.3407, w: 0.3761, h: 0.3761 },
    options: {
      dotsColor: "#27272a", dotsType: "dots", backgroundColor: "#ffffff",
      cornersSquareColor: "#ec4899", cornersSquareType: "extra-rounded",
      cornersDotColor: "#ec4899", cornersDotType: "dot", logo: false,
    },
  },
  {
    id: "butterfly",
    name: "Butterfly",
    description: "A purple-and-pink illustrated butterfly.",
    category: "playful",
    frameImage: "/images/qr-frames/qr-butterfly.png", frameAspect: 0.9778,
    frameHole: { x: 0.3022, y: 0.3045, w: 0.3867, h: 0.3909 },
    options: {
      dotsColor: "#27272a", dotsType: "dots", backgroundColor: "#ffffff",
      cornersSquareColor: "#a855f7", cornersSquareType: "extra-rounded",
      cornersDotColor: "#a855f7", cornersDotType: "dot", logo: false,
    },
  },
  {
    id: "lotus",
    name: "Lotus",
    description: "A soft pink lotus flower in bloom.",
    category: "playful",
    frameImage: "/images/qr-frames/qr-lotus.png", frameAspect: 0.9149,
    frameHole: { x: 0.3149, y: 0.3535, w: 0.3617, h: 0.4 },
    options: {
      dotsColor: "#27272a", dotsType: "dots", backgroundColor: "#ffffff",
      cornersSquareColor: "#ec4899", cornersSquareType: "extra-rounded",
      cornersDotColor: "#ec4899", cornersDotType: "dot", logo: false,
    },
  },
  {
    id: "bow",
    name: "Bow Ribbon",
    description: "A round frame finished with a pink bow.",
    category: "playful",
    frameImage: "/images/qr-frames/qr-bow.png", frameAspect: 1.13,
    frameHole: { x: 0.285, y: 0.1991, w: 0.43, h: 0.3717 },
    options: {
      dotsColor: "#27272a", dotsType: "dots", backgroundColor: "#ffffff",
      cornersSquareColor: "#ec4899", cornersSquareType: "extra-rounded",
      cornersDotColor: "#ec4899", cornersDotType: "dot", logo: false,
    },
  },
  {
    id: "unicorn",
    name: "Unicorn",
    description: "A pastel unicorn face with a gold horn — a kids' favorite.",
    category: "playful",
    frameImage: "/images/qr-frames/qr-unicorn.png", frameAspect: 1.1429,
    frameHole: { x: 0.2679, y: 0.4896, w: 0.4405, h: 0.3854 },
    options: {
      dotsColor: "#27272a", dotsType: "dots", backgroundColor: "#ffffff",
      cornersSquareColor: "#a855f7", cornersSquareType: "extra-rounded",
      cornersDotColor: "#a855f7", cornersDotType: "dot", logo: false,
    },
  },
  {
    id: "paw",
    name: "Paw Print",
    description: "A pink-and-black paw print — for pet-related equipment or a shop mascot.",
    category: "playful",
    frameImage: "/images/qr-frames/qr-paw.png", frameAspect: 1.0294,
    frameHole: { x: 0.3059, y: 0.36, w: 0.3765, h: 0.36 },
    options: {
      dotsColor: "#18181b", dotsType: "rounded", backgroundColor: "#ffffff",
      cornersSquareColor: "#ec4899", cornersSquareType: "extra-rounded",
      cornersDotColor: "#ec4899", cornersDotType: "dot", logo: false,
    },
  },
  {
    id: "cat",
    name: "Cat Face",
    description: "A friendly white cat face.",
    category: "playful",
    frameImage: "/images/qr-frames/qr-cat.png", frameAspect: 0.8808,
    frameHole: { x: 0.3109, y: 0.2882, w: 0.3782, h: 0.4353 },
    options: {
      dotsColor: "#27272a", dotsType: "rounded", backgroundColor: "#ffffff",
      cornersSquareColor: "#f472b6", cornersSquareType: "extra-rounded",
      cornersDotColor: "#f472b6", cornersDotType: "dot", logo: false,
    },
  },
  {
    id: "dog",
    name: "Dog Face",
    description: "A floppy-eared brown dog face with a bone.",
    category: "playful",
    frameImage: "/images/qr-frames/qr-dog.png", frameAspect: 0.8507,
    frameHole: { x: 0.3134, y: 0.2164, w: 0.3682, h: 0.4444 },
    options: {
      dotsColor: "#27272a", dotsType: "rounded", backgroundColor: "#ffffff",
      cornersSquareColor: "#92400e", cornersSquareType: "extra-rounded",
      cornersDotColor: "#92400e", cornersDotType: "dot", logo: false,
    },
  },
  {
    id: "starburst",
    name: "Starburst Pink",
    description: "A spiky pink star badge.",
    category: "playful",
    frameImage: "/images/qr-frames/qr-starburst.png", frameAspect: 0.9222,
    frameHole: { x: 0.2889, y: 0.3554, w: 0.4167, h: 0.4458 },
    options: {
      dotsColor: "#27272a", dotsType: "dots", backgroundColor: "#ffffff",
      cornersSquareColor: "#ec4899", cornersSquareType: "dot",
      cornersDotColor: "#ec4899", cornersDotType: "dot", logo: false,
    },
  },
  {
    id: "wreath",
    name: "Heart Wreath",
    description: "A laurel wreath with small pink hearts.",
    category: "playful",
    frameImage: "/images/qr-frames/qr-wreath.png", frameAspect: 0.9066,
    frameHole: { x: 0.3077, y: 0.2727, w: 0.3901, h: 0.4364 },
    options: {
      dotsColor: "#27272a", dotsType: "dots", backgroundColor: "#ffffff",
      cornersSquareColor: "#16a34a", cornersSquareType: "extra-rounded",
      cornersDotColor: "#16a34a", cornersDotType: "dot", logo: false,
    },
  },

  // --- Industry & hobby ---
  {
    id: "wave",
    name: "Wave",
    description: "A rolling ocean wave for marine and outdoor equipment.",
    category: "industry",
    frameImage: "/images/qr-frames/qr-wave.png", frameAspect: 0.9848,
    frameHole: { x: 0.2879, y: 0.3179, w: 0.3788, h: 0.3897 },
    options: {
      dotsColor: "#18181b", dotsType: "classy", backgroundColor: "#ffffff",
      cornersSquareColor: "#0891b2", cornersSquareType: "extra-rounded",
      cornersDotColor: "#0891b2", cornersDotType: "dot", logo: false,
    },
  },
  {
    id: "peak",
    name: "Peak",
    description: "A mountain-and-forest scene for off-road, farm, and outdoor gear.",
    category: "industry",
    frameImage: "/images/qr-frames/qr-mountain.png", frameAspect: 0.8109,
    frameHole: { x: 0.3193, y: 0.3523, w: 0.3487, h: 0.4301 },
    options: {
      dotsColor: "#18181b", dotsType: "classy-rounded", backgroundColor: "#ffffff",
      cornersSquareColor: "#15803d", cornersSquareType: "square",
      cornersDotColor: "#15803d", cornersDotType: "square", logo: false,
    },
  },
  {
    id: "wrench-cross",
    name: "Lug Wrench",
    description: "A tire iron/lug wrench cross — built for the actual mechanic's shop.",
    category: "industry",
    frameImage: "/images/qr-frames/qr-wrench.png", frameAspect: 0.9274,
    frameHole: { x: 0.3065, y: 0.2957, w: 0.379, h: 0.4 },
    options: {
      dotsColor: "#18181b", dotsType: "square", backgroundColor: "#ffffff",
      cornersSquareColor: "#52525b", cornersSquareType: "square",
      cornersDotColor: "#52525b", cornersDotType: "square", logo: false,
    },
  },
  {
    id: "gear-ring",
    name: "Gear Ring",
    description: "A big illustrated cog frame — an industrial alternative to the small Maintly logo. Black-and-red finder patterns for a bold, classic scan look.",
    category: "industry",
    frameImage: "/images/qr-frames/qr-gear-ring.png", frameAspect: 0.9788,
    frameHole: { x: 0.3178, y: 0.3203, w: 0.3686, h: 0.368 },
    options: {
      dotsColor: "#18181b", dotsType: "square", backgroundColor: "#ffffff",
      cornersSquareColor: "#18181b", cornersSquareType: "square",
      cornersDotColor: "#dc2626", cornersDotType: "square", logo: false,
    },
  },
  {
    id: "soccer",
    name: "Soccer Ball",
    description: "A classic soccer-ball frame, for sports equipment and gear.",
    category: "industry",
    frameImage: "/images/qr-frames/qr-soccer.png", frameAspect: 1.0177,
    frameHole: { x: 0.2305, y: 0.2404, w: 0.5355, h: 0.5226 },
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
    id: "hex-frame",
    name: "Hex Frame",
    description: "A brushed-steel hexagonal frame with rivets.",
    category: "industry",
    frameImage: "/images/qr-frames/qr-hex-frame.png", frameAspect: 0.902,
    frameHole: { x: 0.2432, y: 0.2472, w: 0.5101, h: 0.4869 },
    options: {
      dotsColor: "#18181b", dotsType: "square", backgroundColor: "#ffffff",
      cornersSquareColor: "#52525b", cornersSquareType: "square",
      cornersDotColor: "#52525b", cornersDotType: "square", logo: false,
    },
  },
  {
    id: "hex-bolt",
    name: "Bolt Plate",
    description: "A bolted steel hex plate — a heavier, more industrial variant of Hex Frame.",
    category: "industry",
    frameImage: "/images/qr-frames/qr-hex-bolt.png", frameAspect: 0.8839,
    frameHole: { x: 0.3036, y: 0.2525, w: 0.3839, h: 0.4394 },
    options: {
      dotsColor: "#18181b", dotsType: "square", backgroundColor: "#ffffff",
      cornersSquareColor: "#3f3f46", cornersSquareType: "square",
      cornersDotColor: "#3f3f46", cornersDotType: "square", logo: false,
    },
  },
  {
    id: "piston",
    name: "Piston",
    description: "An engine piston — a natural fit for engines and small motors.",
    category: "industry",
    frameImage: "/images/qr-frames/qr-piston.png", frameAspect: 1.5094,
    frameHole: { x: 0.2264, y: 0.3042, w: 0.5346, h: 0.35 },
    options: {
      dotsColor: "#18181b", dotsType: "classy", backgroundColor: "#ffffff",
      cornersSquareColor: "#52525b", cornersSquareType: "square",
      cornersDotColor: "#52525b", cornersDotType: "square", logo: false,
    },
  },
  {
    id: "lightning",
    name: "Lightning Bolt",
    description: "A gold-and-black lightning bolt — for electrical equipment and generators.",
    category: "industry",
    frameImage: "/images/qr-frames/qr-lightning.png", frameAspect: 1.0986,
    frameHole: { x: 0.2394, y: 0.2094, w: 0.4695, h: 0.4274 },
    options: {
      dotsColor: "#18181b", dotsType: "square", backgroundColor: "#ffffff",
      cornersSquareColor: "#eab308", cornersSquareType: "extra-rounded",
      cornersDotColor: "#eab308", cornersDotType: "dot", logo: false,
    },
  },
  {
    id: "car",
    name: "Sports Car",
    description: "A sleek black sports car, front-on.",
    category: "industry",
    frameImage: "/images/qr-frames/qr-car.png", frameAspect: 0.7577,
    frameHole: { x: 0.3128, y: 0.3314, w: 0.3612, h: 0.4767 },
    options: {
      dotsColor: "#18181b", dotsType: "classy-rounded", backgroundColor: "#ffffff",
      cornersSquareColor: "#dc2626", cornersSquareType: "extra-rounded",
      cornersDotColor: "#dc2626", cornersDotType: "dot", logo: false,
    },
  },
  {
    id: "motorcycle",
    name: "Motorcycle",
    description: "A red-and-black motorcycle, front-on.",
    category: "industry",
    frameImage: "/images/qr-frames/qr-motorcycle.png", frameAspect: 0.9204,
    frameHole: { x: 0.3284, y: 0.3351, w: 0.3383, h: 0.3838 },
    options: {
      dotsColor: "#18181b", dotsType: "square", backgroundColor: "#ffffff",
      cornersSquareColor: "#dc2626", cornersSquareType: "extra-rounded",
      cornersDotColor: "#dc2626", cornersDotType: "dot", logo: false,
    },
  },
  {
    id: "pickup",
    name: "Pickup Truck",
    description: "A pickup truck, rear view.",
    category: "industry",
    frameImage: "/images/qr-frames/qr-pickup.png", frameAspect: 0.7972,
    frameHole: { x: 0.2995, y: 0.2832, w: 0.3963, h: 0.4913 },
    options: {
      dotsColor: "#18181b", dotsType: "square", backgroundColor: "#ffffff",
      cornersSquareColor: "#3f3f46", cornersSquareType: "square",
      cornersDotColor: "#3f3f46", cornersDotType: "square", logo: false,
    },
  },
  {
    id: "tractor",
    name: "Tractor",
    description: "A red farm tractor, rear view — for agricultural equipment.",
    category: "industry",
    frameImage: "/images/qr-frames/qr-tractor.png", frameAspect: 0.8326,
    frameHole: { x: 0.3172, y: 0.3333, w: 0.3436, h: 0.4127 },
    options: {
      dotsColor: "#18181b", dotsType: "square", backgroundColor: "#ffffff",
      cornersSquareColor: "#dc2626", cornersSquareType: "square",
      cornersDotColor: "#dc2626", cornersDotType: "square", logo: false,
    },
  },
  {
    id: "semi",
    name: "Semi Truck",
    description: "A big-rig semi truck grille, front-on.",
    category: "industry",
    frameImage: "/images/qr-frames/qr-semi.png", frameAspect: 1.0714,
    frameHole: { x: 0.2857, y: 0.3857, w: 0.4082, h: 0.3857 },
    options: {
      dotsColor: "#18181b", dotsType: "square", backgroundColor: "#ffffff",
      cornersSquareColor: "#52525b", cornersSquareType: "square",
      cornersDotColor: "#52525b", cornersDotType: "square", logo: false,
    },
  },
  {
    id: "anchor",
    name: "Anchor",
    description: "A navy ship's anchor with rope — for marine equipment.",
    category: "industry",
    frameImage: "/images/qr-frames/qr-anchor.png", frameAspect: 1.1117,
    frameHole: { x: 0.3401, y: 0.3425, w: 0.3807, h: 0.3425 },
    options: {
      dotsColor: "#18181b", dotsType: "classy", backgroundColor: "#ffffff",
      cornersSquareColor: "#1e40af", cornersSquareType: "square",
      cornersDotColor: "#1e40af", cornersDotType: "square", logo: false,
    },
  },
  {
    id: "compass",
    name: "Compass",
    description: "A navigational compass rose.",
    category: "industry",
    frameImage: "/images/qr-frames/qr-compass.png", frameAspect: 1.0891,
    frameHole: { x: 0.3119, y: 0.3409, w: 0.3762, h: 0.3409 },
    options: {
      dotsColor: "#27272a", dotsType: "classy", backgroundColor: "#ffffff",
      cornersSquareColor: "#52525b", cornersSquareType: "square",
      cornersDotColor: "#52525b", cornersDotType: "square", logo: false,
    },
  },
  {
    id: "palm",
    name: "Palm Sunset",
    description: "Palm trees against a sunset — a beach/outdoor vibe.",
    category: "industry",
    frameImage: "/images/qr-frames/qr-palm.png", frameAspect: 0.8405,
    frameHole: { x: 0.3405, y: 0.3128, w: 0.319, h: 0.3795 },
    options: {
      dotsColor: "#27272a", dotsType: "rounded", backgroundColor: "#ffffff",
      cornersSquareColor: "#f97316", cornersSquareType: "extra-rounded",
      cornersDotColor: "#f97316", cornersDotType: "dot", logo: false,
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
