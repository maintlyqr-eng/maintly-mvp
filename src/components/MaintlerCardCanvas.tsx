"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { X, Download, Share2, Printer } from "lucide-react";
import QrCodeCanvas, { type QrCodeCanvasHandle } from "@/components/QrCodeCanvas";
import { DEFAULT_QR_THEME } from "@/lib/qrThemes";
import { computeBadges, yearsSince, type MaintlerStats } from "@/lib/maintlerScore";
import { assetTypeOptions, assetTypeImg } from "@/lib/assetTypes";

// Round 7 (July 9, 2026): Facu sent a fresh mockup — a real credit-card-
// shaped, double-sided ID card (front: photo/name/status/QR; back: bio,
// specialties, stats, badges, contact, a small share QR) — and asked
// specifically for THIS component (not the /maintler/[code] report page)
// to become that: "yo lo q busco es q el mecanico pueda imprimir esa
// tarjeta y q sea una especie de tarjeta de credito." Two decisions from
// that conversation shape everything below:
//   1. Every figure on the back is real, computed data — same principle
//      as maintlerScore.ts and the public card ("verified, tamper-proof",
//      not self-reported). The mockup's "Reports Uploaded" became
//      "Documents Uploaded" (a real count of Document Library uploads,
//      passed in via `documentsCount`); a badge like "Top Rated" that has
//      no real number behind it was dropped rather than faked.
//   2. "Print" in Settings already prints the full public report page
//      (round 5) — Facu chose to keep that and add a SEPARATE action here
//      (`printCard`) that prints this physical card instead, front then
//      back, one per page.
//
// Badges are computed via the same computeBadges() thresholds the public
// card and Settings' "Maintly Stats" panel already use (single source of
// truth for what counts as "100+ Services" etc.) — but computeBadges()
// returns a lucide *React component* per badge, which can't be drawn into
// a 2D canvas context. styleFor() below maps each real label to a
// canvas-drawable emoji + color instead of re-deriving the thresholds.
export type MaintlerCardSpecialty = { asset_type: string; services_count: number };

export type MaintlerCardCanvasHandle = {
  // Downloads BOTH sides as two separate PNG files (`${base}-front.png`,
  // `${base}-back.png`) — a physical card is two-sided, so "download my
  // card" should hand over both faces, not just the front.
  download: (filenameBase: string) => Promise<void>;
  // Web Share API, front image only (share sheets handle a single file far
  // more reliably across browsers than two at once, and the front is the
  // "identity" side someone would actually send).
  share: (filenameBase: string) => Promise<void>;
  // NEW: opens the browser print dialog with the front on one page and the
  // back on the next — separate from Settings' existing "Print" button,
  // which prints the full public report page instead.
  printCard: () => Promise<void>;
  // NEW: opens a built-in modal previewing both sides at a larger, legible
  // size, so a Maintler can actually read the back before deciding to
  // download/print/share it.
  view: () => void;
};

const CARD_W = 1050;
const CARD_H = 660;

function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  return loadImageEl(url).finally(() => URL.revokeObjectURL(url));
}

// Round 8 take 3 (Facu: "no entiendo por qué no usás el logo con el
// MaintlyQR que tenés para el home") — the real wordmark asset
// (maintly-logo-full.png, the same file the landing page and dashboard
// sidebar use) has BLACK "MAINTLY" lettering and a dark-gray subtitle,
// because it was made for light backgrounds. Drawn as-is on this card's
// near-black background, "MAINTLY" would be almost invisible (its RGB is
// close to the card's own background color) — that's the actual reason a
// hand-drawn substitute was used instead of the real file. This recolors
// just a cropped region of the source image (the wordmark half, not the
// metallic gear icon half, which already reads fine on dark and would be
// damaged by naive brightness recoloring) so it's legible on a dark card:
// solid dark lettering -> white, the mid-gray subtitle -> light gray, the
// red "QR"/accent pixels are left untouched.
function recolorWordmarkForDark(img: HTMLImageElement, srcX: number, srcW: number): HTMLCanvasElement {
  const off = document.createElement("canvas");
  off.width = srcW;
  off.height = img.height;
  const octx = off.getContext("2d")!;
  octx.drawImage(img, srcX, 0, srcW, img.height, 0, 0, srcW, img.height);
  const frame = octx.getImageData(0, 0, srcW, img.height);
  const px = frame.data;
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3];
    if (a === 0) continue;
    const r = px[i], g = px[i + 1], b = px[i + 2];
    if (r > g + 30 && r > b + 30) continue; // red "QR" lettering — leave as-is
    const brightness = (r + g + b) / 3;
    if (brightness < 60) {
      px[i] = 255; px[i + 1] = 255; px[i + 2] = 255; // bold "MAINTLY" -> white
    } else if (brightness < 170) {
      px[i] = 195; px[i + 1] = 195; px[i + 2] = 200; // subtitle -> light gray
    }
  }
  octx.putImageData(frame, 0, 0);
  return off;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function initialsOf(name: string) {
  return name.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "M";
}

function truncateToWidth(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(cut + "…").width > maxWidth) {
    cut = cut.slice(0, -1);
  }
  return cut + "…";
}

// Simple manual word-wrap — canvas has no native text-wrapping. Only used
// for the auto-generated "About" blurb below, which is short and built
// from a small set of real fields, so overflow beyond maxLines is not a
// realistic case in practice.
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 3): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (current && ctx.measureText(test).width > maxWidth) {
      lines.push(current);
      current = w;
      if (lines.length === maxLines) break;
    } else {
      current = test;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines.slice(0, maxLines);
}

// A small concentric-arc "scan/signal" glyph for the front's bottom-right
// caption — canvas has no icon font available, so this is drawn directly
// rather than pulling in an image asset for one small detail.
function drawSignalGlyph(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.save();
  ctx.strokeStyle = "#e4e4e7";
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    const r = (size / 3) * (i + 1);
    ctx.globalAlpha = 1 - i * 0.22;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, -Math.PI * 0.75, -Math.PI * 0.25);
    ctx.stroke();
  }
  ctx.restore();
}

function assetTypeLabel(type: string) {
  return assetTypeOptions.find((o) => o.value === type)?.label ?? type;
}

// Maps each REAL badge label (from computeBadges()'s canonical thresholds —
// same numbers the public card and Settings' Maintly Stats panel use) to a
// canvas-drawable emoji + color. Doesn't re-derive the thresholds — just
// styles whatever labels computeBadges() actually returned, so this can't
// drift from the single source of truth for what counts as "100+ Services"
// etc.
function styleForBadge(label: string): { emoji: string; bg: string } {
  if (label === "Verified") return { emoji: "✓", bg: "#059669" };
  if (label.includes("Services")) return { emoji: "🔧", bg: "#2563eb" };
  if (label.includes("Years Active")) return { emoji: "📅", bg: "#d97706" };
  if (label === "Multi-Asset Specialist") return { emoji: "📦", bg: "#7c3aed" };
  return { emoji: "⭐", bg: "#71717a" };
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Props = {
  code: string;
  name: string;
  workshopName?: string | null;
  photoUrl?: string | null;
  verified?: boolean | null;
  profession?: string | null;
  location?: string | null;
  createdAt?: string | null;
  stats?: MaintlerStats | null;
  documentsCount?: number;
  specialties?: MaintlerCardSpecialty[];
  contactEmail?: string | null;
  contactPhone?: string | null;
  websiteUrl?: string | null;
  previewWidth?: number;
  // Round 8 (Facu: "no me gustan tantos botones... que la tarjeta sea un
  // boton, si uno toca la tarjeta deberia mostrar la tarjeta de ambos lados
  // y ahi dar la posibilidad de imprimirla") — when true, the live preview
  // itself becomes the entry point into the view modal, instead of Settings
  // needing a separate "View" button calling the imperative handle. Default
  // false so the /maintler/[code] self-view banner (a small 110px preview
  // in a very different layout context) is completely unaffected unless a
  // caller opts in.
  clickToView?: boolean;
};

const EMPTY_STATS: MaintlerStats = { services_count: 0, assets_count: 0, customers_count: 0, repeat_customers_count: 0 };

const MaintlerCardCanvas = forwardRef<MaintlerCardCanvasHandle, Props>(function MaintlerCardCanvas(
  {
    code, name, workshopName, photoUrl, verified, profession, location, createdAt,
    stats, documentsCount = 0, specialties = [], contactEmail, contactPhone, websiteUrl,
    previewWidth = 320,
    clickToView = false,
  },
  ref
) {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const qrFrontHandleRef = useRef<QrCodeCanvasHandle>(null);
  const qrBackHandleRef = useRef<QrCodeCanvasHandle>(null);

  const [viewOpen, setViewOpen] = useState(false);
  const viewFrontCanvasRef = useRef<HTMLCanvasElement>(null);
  const viewBackCanvasRef = useRef<HTMLCanvasElement>(null);

  const effStats = stats ?? EMPTY_STATS;
  const years = createdAt ? yearsSince(createdAt) : 0;
  const activeSpecialties = specialties.filter((s) => s.services_count > 0).sort((a, b) => b.services_count - a.services_count);
  const domBadges = computeBadges(!!verified, effStats, activeSpecialties.length, years);

  // ── FRONT ──
  // Round 8 take 2: the first attempt (frontcard.png) baked in fixed icon
  // rows/guide lines, which forced every field into an exact pre-drawn slot
  // — Facu: "quedaron raras", and sent a second, much emptier background
  // (frontcard1.png, same 1536×1024 native size as backcard.png) so this
  // component has room to lay the identity fields out itself, the same way
  // it already does successfully on the back. So this is effectively the
  // pre-template hand-drawn layout (two-pass vertically-centered text
  // block, emoji-icon fields, hand-drawn brand mark/signal glyph) again —
  // just painted over Facu's real card art instead of a flat gradient.
  // Only the QR position was measured off the artwork (it sits inside the
  // circular gear watermark on the right; see /tmp/card_test/), and the
  // Maintler ID/"scan to view" placement respects this template's
  // asymmetric bottom bar (red only on the left ~57%, plain card-black on
  // the right, unlike frontcard.png's full-width banner).
  async function drawFront(ctx: CanvasRenderingContext2D, isStale: () => boolean = () => false) {
    const W = CARD_W, H = CARD_H;
    ctx.clearRect(0, 0, W, H);

    try {
      const bgImg = await loadImageEl("/images/frontcard1.png");
      if (isStale()) return;
      ctx.drawImage(bgImg, 0, 0, W, H);
    } catch {
      // Background art failed to load (offline, moved file) — fall back to
      // a plain dark card so the data is still legible rather than blank.
      ctx.fillStyle = "#09090b";
      ctx.fillRect(0, 0, W, H);
    }

    // Brand mark, top-left, over the artwork's subtle hexagon pattern — the
    // REAL logo asset (maintly-logo-full.png, same file the landing page
    // and dashboard sidebar use), not hand-drawn text. The gear-icon half
    // is drawn straight from the source (it already reads fine on dark);
    // the wordmark half is recolored for a dark background (see
    // recolorWordmarkForDark above — the source file is black-on-white).
    //
    // Sizing note (round 9, Facu: "quedo todo peor... se ven mal y chico"):
    // this canvas is CARD_W×CARD_H=1050×660 for print/download quality, but
    // on screen it's always displayed shrunk to ~40-50% of that (the
    // Settings preview and the view-modal both cap it well under 1050px
    // wide) — sizes tuned to look right at full canvas resolution read as
    // illegible mush once scaled down for actual on-screen viewing. Every
    // font/icon size on both faces was bumped up from this round on with
    // that real display scale in mind, verified by rendering the canvas
    // AND then shrinking it in the browser the same way the app does (see
    // /tmp/card_test/*_scaled.html) rather than just eyeballing it at 1:1.
    const brandIconSize = 66;
    const brandX = 40, brandY = 30;
    ctx.textAlign = "left";
    try {
      const logo = await loadImageEl("/images/maintly-logo-full.png");
      if (isStale()) return;
      const iconSrcW = 475; // gear-icon half of the 1619×477 source
      ctx.drawImage(logo, 0, 0, iconSrcW, logo.height, brandX, brandY, brandIconSize, brandIconSize);
      const wmSrcX = 490, wmSrcW = logo.width - wmSrcX;
      const wordmark = recolorWordmarkForDark(logo, wmSrcX, wmSrcW);
      const wmH = 56;
      const wmW = wmH * (wordmark.width / wordmark.height);
      ctx.drawImage(wordmark, brandX + brandIconSize + 14, brandY + brandIconSize / 2 - wmH / 2, wmW, wmH);
    } catch {
      // Logo failed to load — fall back to plain text so the card still
      // identifies itself.
      ctx.font = "bold 30px Arial, sans-serif";
      ctx.fillStyle = "#e4e4e7";
      ctx.fillText("MAINTLYQR", brandX + brandIconSize + 14, brandY + brandIconSize / 2 - 2);
      ctx.font = "bold 12px Arial, sans-serif";
      ctx.fillStyle = "#71717a";
      ctx.fillText("MAINTENANCE  ·  TRACKED", brandX + brandIconSize + 14, brandY + brandIconSize / 2 + 17);
    }

    // Photo + identity block. contentH stops where the artwork's left-side
    // red bar begins (measured off frontcard1.png), so the block centers
    // against the space actually available above it, not the full card.
    const contentH = 522;
    const bandTop = brandY + brandIconSize + 26;
    const bandCy = bandTop + (contentH - bandTop) / 2;

    const photoSize = 200;
    const photoCx = 40 + photoSize / 2;
    const photoCy = bandCy;
    let photoDrawn = false;
    if (photoUrl) {
      try {
        const img = await loadImageEl(photoUrl);
        if (isStale()) return;
        ctx.save();
        ctx.beginPath();
        ctx.arc(photoCx, photoCy, photoSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        const scale = Math.max(photoSize / img.width, photoSize / img.height);
        const dw = img.width * scale, dh = img.height * scale;
        ctx.drawImage(img, photoCx - dw / 2, photoCy - dh / 2, dw, dh);
        ctx.restore();
        photoDrawn = true;
      } catch {
        // Image blocked (CORS on a non-Supabase host, network hiccup) —
        // fall through to the initials placeholder below.
      }
    }
    if (!photoDrawn) {
      ctx.beginPath();
      ctx.arc(photoCx, photoCy, photoSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = "#3f3f46";
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 56px Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(initialsOf(name), photoCx, photoCy + 4);
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
    }
    ctx.beginPath();
    ctx.arc(photoCx, photoCy, photoSize / 2, 0, Math.PI * 2);
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#dc2626";
    ctx.stroke();

    const textX = photoCx + photoSize / 2 + 36;
    const textMaxWidth = 340; // clear of the circular gear watermark on the right

    // Two-pass layout: work out how tall this text column will be (it
    // varies — not every Maintler has a workshop/profession/location set),
    // THEN center that whole block against the photo's true center
    // (bandCy) — same fix from the previous round, carried over.
    const showWorkshop = !!(workshopName && workshopName !== name);
    let textSpan = 0;
    if (showWorkshop) textSpan += 32;
    if (verified) textSpan += 40;
    if (profession) textSpan += 36;
    if (location) textSpan += 30;
    if (createdAt) textSpan += 30;
    const topPad = 26;
    const bottomPad = 10;
    const blockH = textSpan + topPad + bottomPad;
    let y = bandCy - blockH / 2 + topPad;

    ctx.font = "bold 36px Arial, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(truncateToWidth(ctx, name, textMaxWidth), textX, y);

    if (showWorkshop) {
      y += 32;
      ctx.font = "22px Arial, sans-serif";
      ctx.fillStyle = "#a1a1aa";
      ctx.fillText(truncateToWidth(ctx, workshopName!, textMaxWidth), textX, y);
    }

    if (verified) {
      y += 40;
      const label = "✓ VERIFIED MAINTLER";
      ctx.font = "bold 16px Arial, sans-serif";
      const textWidth = ctx.measureText(label).width;
      const pillH = 32, padX = 14;
      const pillW = textWidth + padX * 2;
      roundRect(ctx, textX, y - pillH + 8, pillW, pillH, pillH / 2);
      ctx.fillStyle = "rgba(16,185,129,0.16)";
      ctx.fill();
      ctx.fillStyle = "#34d399";
      ctx.textBaseline = "middle";
      ctx.fillText(label, textX + padX, y - pillH / 2 + 8 + 1);
      ctx.textBaseline = "alphabetic";
    }

    if (profession) {
      y += 36;
      ctx.font = "19px Arial, sans-serif";
      ctx.fillStyle = "#d4d4d8";
      ctx.fillText(`🔧 ${truncateToWidth(ctx, profession, textMaxWidth - 26)}`, textX, y);
    }

    if (location) {
      y += 30;
      ctx.font = "19px Arial, sans-serif";
      ctx.fillStyle = "#a1a1aa";
      ctx.fillText(`📍 ${truncateToWidth(ctx, location, textMaxWidth - 26)}`, textX, y);
    }

    if (createdAt) {
      y += 30;
      ctx.font = "17px Arial, sans-serif";
      ctx.fillStyle = "#71717a";
      const memberSince = new Date(createdAt).toLocaleDateString("en-US", { day: "2-digit", month: "2-digit", year: "numeric" });
      ctx.fillText(`📅 Member since ${memberSince}`, textX, y);
    }

    // QR, on its own white rounded-square badge with a red ring border —
    // same visual language as the photo circle on the left (red accent
    // ring), so it reads as a deliberate, matching design element instead
    // of a bare image floating over the artwork. Previously this just sat
    // loose on top of the background's decorative gear-ring texture with
    // no frame of its own, which is what actually looked "wrong" (round
    // 10, Facu: "el q esta mal es el q estas montando vos con el qr") —
    // not the background art itself. Vertically centered on bandCy, the
    // same value the photo uses, so the two sides balance instead of the
    // QR sitting noticeably higher than the photo.
    const qrOuter = 190;
    const qrPad = 16;
    const qrPlateSize = qrOuter + qrPad * 2;
    const qrCx = 786, qrCy = bandCy;
    roundRect(ctx, qrCx - qrPlateSize / 2, qrCy - qrPlateSize / 2, qrPlateSize, qrPlateSize, 20);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#dc2626";
    ctx.stroke();
    let qrBlob: Blob | null = null;
    try {
      qrBlob = (await qrFrontHandleRef.current?.getBlob()) ?? null;
    } catch {
      qrBlob = null;
    }
    if (isStale()) return;
    if (qrBlob) {
      try {
        const qrImg = await blobToImage(qrBlob);
        const scale = Math.min(qrOuter / qrImg.width, qrOuter / qrImg.height);
        const dw = qrImg.width * scale, dh = qrImg.height * scale;
        ctx.drawImage(qrImg, qrCx - dw / 2, qrCy - dh / 2, dw, dh);
      } catch {
        // Drawing the QR image failed — the rest of the card still
        // renders fine without it.
      }
    }

    // Maintler ID, in the red bar on the left (the only part of this
    // template's bottom edge that's actually red — it stops at roughly
    // 57% of the card's width, unlike frontcard.png's full-width banner).
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = "bold 13px Arial, sans-serif";
    ctx.fillText("MAINTLER ID", 40, 555);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px Arial, sans-serif";
    ctx.fillText(code.slice(0, 8).toUpperCase(), 40, 585);

    // "Scan to view" + signal glyph sit on the plain card-black area to the
    // right of the red bar (this template has no red there to match).
    ctx.textAlign = "right";
    ctx.fillStyle = "#e4e4e7";
    ctx.font = "bold 15px Arial, sans-serif";
    ctx.fillText("SCAN TO VIEW MY PROFILE", W - 80, 590);
    drawSignalGlyph(ctx, W - 42, 580, 26);
    ctx.textAlign = "left";
  }

  // ── BACK ──
  // Round 8: Facu's real back-card artwork (backcard.png, 1536×1024) — a
  // dark card with subtle corner gear/globe watermarks and a red bottom
  // banner (with a decorative notch cut into its top edge), but with NO
  // baked-in field placeholders — unlike the front, the content sections
  // below (ABOUT ME/SPECIALTIES/STATS/BADGES/CONTACT/SHARE) are still laid
  // out by this component itself, just on top of his real background
  // instead of a hand-drawn gradient. BACK_CONTENT_H is the artwork's real
  // banner top (measured off the source PNG the same way as the front —
  // see /tmp/card_test/ — then scaled from 1536×1024 into CARD_W×CARD_H),
  // replacing the old `H - BANNER_H` guess so CONTACT/SHARE never overlap
  // the real (taller) red banner.
  async function drawBack(ctx: CanvasRenderingContext2D, isStale: () => boolean = () => false) {
    const W = CARD_W, H = CARD_H;
    ctx.clearRect(0, 0, W, H);
    const BACK_CONTENT_H = 552;
    const contentH = BACK_CONTENT_H;

    try {
      const bgImg = await loadImageEl("/images/backcard.png");
      if (isStale()) return;
      ctx.drawImage(bgImg, 0, 0, W, H);
    } catch {
      ctx.fillStyle = "#09090b";
      ctx.fillRect(0, 0, W, H);
    }

    // Sizing note (round 9, Facu: "quedo todo peor... se ven mal y chico"):
    // same reason as the front — this canvas is always shown shrunk to
    // ~40-50% on screen, so every font/icon size below was bumped up from
    // this round on and re-verified by rendering the canvas AND then
    // shrinking it in the browser the same way the app does (see
    // /tmp/card_test/*_scaled.html), not just checked at full 1050px
    // resolution.
    const pad = 36;
    const colLeftX = pad, colLeftW = 430;
    const colMidX = colLeftX + colLeftW + 26, colMidW = 220;
    const colRightX = colMidX + colMidW + 26, colRightW = W - pad - colRightX;

    ctx.textAlign = "left";

    // ── ABOUT ME (left column, top) ──
    let leftY = 54;
    ctx.font = "bold 15px Arial, sans-serif";
    ctx.fillStyle = "#dc2626";
    ctx.fillText("ABOUT ME", colLeftX, leftY);
    leftY += 26;

    const topSpecialty = activeSpecialties[0] ? assetTypeLabel(activeSpecialties[0].asset_type) : null;
    const aboutParts: string[] = [];
    aboutParts.push(
      profession && verified
        ? `Verified ${profession} on MaintlyQR${years > 0 ? ` for ${years} year${years === 1 ? "" : "s"}` : ""}.`
        : `Active Maintler on MaintlyQR${years > 0 ? ` for ${years} year${years === 1 ? "" : "s"}` : ""}.`
    );
    if (topSpecialty) aboutParts.push(`Specialized in ${topSpecialty.toLowerCase()} maintenance.`);
    ctx.font = "17px Arial, sans-serif";
    ctx.fillStyle = "#d4d4d8";
    const aboutLines = wrapText(ctx, aboutParts.join(" "), colLeftW, 3);
    for (const line of aboutLines) {
      ctx.fillText(line, colLeftX, leftY);
      leftY += 24;
    }
    leftY += 20;

    // ── SPECIALTIES (left column, below About) — only real, logged
    // categories; hidden entirely if none yet, same call already made on
    // the public card for a brand-new Maintler with zero services. ──
    if (activeSpecialties.length > 0) {
      ctx.font = "bold 15px Arial, sans-serif";
      ctx.fillStyle = "#dc2626";
      ctx.fillText("SPECIALTIES", colLeftX, leftY);
      leftY += 26;

      const iconSize = 38;
      const perRow = 3;
      const cellW = colLeftW / perRow;
      const shown = activeSpecialties.slice(0, 6);
      for (let i = 0; i < shown.length; i++) {
        const row = Math.floor(i / perRow), col = i % perRow;
        const cx = colLeftX + col * cellW + iconSize / 2;
        const cy = leftY + row * 70 + iconSize / 2;
        const imgSrc = assetTypeImg[shown[i].asset_type];
        if (imgSrc) {
          try {
            const img = await loadImageEl(imgSrc);
            if (isStale()) return;
            ctx.drawImage(img, cx - iconSize / 2, cy - iconSize / 2, iconSize, iconSize);
          } catch {
            // Icon failed to load — the label below still identifies it.
          }
        }
        ctx.font = "13px Arial, sans-serif";
        ctx.fillStyle = "#a1a1aa";
        ctx.textAlign = "center";
        const label = truncateToWidth(ctx, assetTypeLabel(shown[i].asset_type), cellW - 6);
        ctx.fillText(label, cx, cy + iconSize / 2 + 18);
        ctx.textAlign = "left";
      }
      leftY += Math.ceil(shown.length / perRow) * 70 + 4;
    }

    // ── STATS (middle column) — real numbers only, same figures Settings'
    // own "Maintly Stats" panel and the public card show. ──
    let midY = 54;
    ctx.font = "bold 15px Arial, sans-serif";
    ctx.fillStyle = "#dc2626";
    ctx.fillText("STATS", colMidX, midY);
    midY += 32;

    const statRows: [string, number][] = [
      ["Services Logged", effStats.services_count],
      ["Assets Maintained", effStats.assets_count],
      ["Documents Uploaded", documentsCount],
      ["Repeat Customers", effStats.repeat_customers_count],
      ["Years Active", years],
    ];
    for (const [label, value] of statRows) {
      ctx.font = "14px Arial, sans-serif";
      ctx.fillStyle = "#a1a1aa";
      ctx.fillText(truncateToWidth(ctx, label, colMidW - 50), colMidX, midY);
      ctx.font = "bold 20px Arial, sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "right";
      ctx.fillText(String(value), colMidX + colMidW, midY);
      ctx.textAlign = "left";
      midY += 38;
    }

    // ── BADGES (right column) — every label here comes straight from
    // computeBadges()'s real thresholds (see styleForBadge() above); a
    // profession badge is appended only when it's an actually-verified,
    // declared profession, not a decorative filler. ──
    let rightY = 54;
    ctx.font = "bold 15px Arial, sans-serif";
    ctx.fillStyle = "#dc2626";
    ctx.fillText("BADGES", colRightX, rightY);
    rightY += 28;

    const cardBadges = [...domBadges.map((b) => ({ label: b.label, ...styleForBadge(b.label) }))];
    if (verified && profession) cardBadges.push({ label: profession, emoji: "🛠", bg: "#dc2626" });

    let badgesBottomY = rightY;
    if (cardBadges.length === 0) {
      ctx.font = "14px Arial, sans-serif";
      ctx.fillStyle = "#71717a";
      ctx.fillText("Keep logging services", colRightX, rightY);
      ctx.fillText("to unlock badges.", colRightX, rightY + 20);
      badgesBottomY = rightY + 20;
    } else {
      // Vertically center the badge grid within the same content height the
      // ABOUT ME/SPECIALTIES and STATS columns actually use (leftY/midY) —
      // otherwise, with only 2-3 real badges, this column reads as sparse
      // and cut-off next to the two fuller columns beside it (Facu's
      // feedback on the badges looking cramped near the accent line).
      // Bigger circles when there are few badges also helps the column
      // feel intentional rather than empty.
      const perRow = 2;
      const cellW = colRightW / perRow;
      const shown = cardBadges.slice(0, 6);
      const rows = Math.ceil(shown.length / perRow);
      const rowH = 84;
      const iconR = shown.length <= 2 ? 34 : 27;
      const gridH = rows * rowH;
      const availableH = Math.max(leftY, midY) - rightY;
      const startOffset = Math.max(0, (availableH - gridH) / 2);
      const gridStartY = rightY + startOffset;
      for (let i = 0; i < shown.length; i++) {
        const row = Math.floor(i / perRow), col = i % perRow;
        const cx = colRightX + col * cellW + cellW / 2;
        const cy = gridStartY + row * rowH + iconR;
        ctx.beginPath();
        ctx.arc(cx, cy, iconR, 0, Math.PI * 2);
        ctx.fillStyle = shown[i].bg;
        ctx.fill();
        ctx.font = `${iconR}px Arial, sans-serif`;
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(shown[i].emoji, cx, cy + 1);
        ctx.textBaseline = "alphabetic";
        ctx.font = "12.5px Arial, sans-serif";
        ctx.fillStyle = "#d4d4d8";
        ctx.fillText(truncateToWidth(ctx, shown[i].label, cellW - 4), cx, cy + iconR + 18);
        ctx.textAlign = "left";
      }
      badgesBottomY = gridStartY + gridH;
    }

    // ── CONTACT + SHARE MY CARD, bottom row above the banner ──
    // Pull CONTACT/SHARE up close to wherever the real content actually
    // ends, instead of always pinning them to a fixed distance from the
    // banner — that fixed pin left a large dead gap in the middle for any
    // Maintler whose content (specialties/stats/badges) doesn't fill the
    // card, which read as "sparse" for the same reason the badges column
    // originally did. contentH-150 remains a CEILING only, so CONTACT/SHARE
    // never lose their guaranteed room above the bottom banner when content
    // is unusually tall.
    const contentBottom = Math.max(leftY, midY, badgesBottomY + 10);
    const dividerY = Math.min(contentBottom + 20, contentH - 150);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad, dividerY);
    ctx.lineTo(W - pad, dividerY);
    ctx.stroke();

    let contactY = dividerY + 32;
    ctx.font = "bold 15px Arial, sans-serif";
    ctx.fillStyle = "#dc2626";
    ctx.fillText("CONTACT", colLeftX, contactY);
    contactY += 26;

    const contactRows: string[] = [];
    if (contactEmail) contactRows.push(`✉ ${contactEmail}`);
    if (contactPhone) contactRows.push(`📞 ${contactPhone}`);
    if (websiteUrl) contactRows.push(`🌐 ${websiteUrl.replace(/^https?:\/\//, "")}`);
    if (contactRows.length === 0) {
      ctx.font = "14px Arial, sans-serif";
      ctx.fillStyle = "#71717a";
      ctx.fillText("No public contact info added yet.", colLeftX, contactY);
    } else {
      ctx.font = "15px Arial, sans-serif";
      ctx.fillStyle = "#d4d4d8";
      for (const row of contactRows) {
        ctx.fillText(truncateToWidth(ctx, row, colMidX + colMidW - colLeftX - 20), colLeftX, contactY);
        contactY += 25;
      }
    }

    // Small "share my card" QR, bottom-right of the content area.
    const shareBoxSize = 110;
    const shareCx = W - pad - shareBoxSize / 2;
    const shareCy = dividerY + 32 + shareBoxSize / 2 - 10;
    roundRect(ctx, shareCx - shareBoxSize / 2, shareCy - shareBoxSize / 2, shareBoxSize, shareBoxSize, 12);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    let shareBlob: Blob | null = null;
    try {
      shareBlob = (await qrBackHandleRef.current?.getBlob()) ?? null;
    } catch {
      shareBlob = null;
    }
    if (isStale()) return;
    if (shareBlob) {
      try {
        const shareImg = await blobToImage(shareBlob);
        const inner = shareBoxSize - 16;
        ctx.drawImage(shareImg, shareCx - inner / 2, shareCy - inner / 2, inner, inner);
      } catch {
        // Falls back to the blank white box — the physical card is still
        // usable via the front's main QR.
      }
    }
    ctx.textAlign = "right";
    ctx.font = "bold 14px Arial, sans-serif";
    ctx.fillStyle = "#e4e4e7";
    ctx.fillText("SHARE MY CARD", W - pad, shareCy - shareBoxSize / 2 - 12);
    ctx.font = "12px Arial, sans-serif";
    ctx.fillStyle = "#71717a";
    ctx.fillText("Scan or share with anyone.", W - pad, shareCy + shareBoxSize / 2 + 20);
    ctx.textAlign = "left";

    // Brand + Maintler ID, over the artwork's (otherwise blank) red banner
    // — same pairing as the front, so either side alone still identifies
    // the card if separated. Both sit clear of the banner's center notch
    // (native x 882–1067, scaled ~603–729): the wordmark ends well before
    // it, "MAINTLER ID" is right-aligned and starts well after it. The
    // wordmark is the real logo asset (see recolorWordmarkForDark above),
    // not hand-drawn text.
    ctx.textAlign = "left";
    try {
      const logo = await loadImageEl("/images/maintly-logo-full.png");
      if (isStale()) return;
      const wordmark = recolorWordmarkForDark(logo, 490, logo.width - 490);
      const wmH = 44;
      const wmW = wmH * (wordmark.width / wordmark.height);
      ctx.drawImage(wordmark, pad, BACK_CONTENT_H + 27, wmW, wmH);
    } catch {
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 19px Arial, sans-serif";
      ctx.fillText("MAINTLYQR", pad, BACK_CONTENT_H + 48);
      ctx.font = "13px Arial, sans-serif";
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillText("MAINTENANCE · TRACKED", pad, BACK_CONTENT_H + 68);
    }
    ctx.textAlign = "right";
    ctx.font = "bold 16px Arial, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`MAINTLER ID: ${code.slice(0, 8).toUpperCase()}`, W - pad, BACK_CONTENT_H + 48);
    ctx.textAlign = "left";
  }

  async function buildBlob(drawFn: (ctx: CanvasRenderingContext2D, isStale?: () => boolean) => Promise<void>): Promise<Blob | null> {
    const canvas = document.createElement("canvas");
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    await drawFn(ctx);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  // Live inline preview — front only (same visual slot this component has
  // always occupied in Settings); the back is drawn on demand (download/
  // share/print/view) rather than kept permanently mounted.
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let cancelled = false;
    (async () => { await drawFront(ctx, () => cancelled); })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, name, workshopName, photoUrl, verified, profession, location, createdAt]);

  // View-modal preview — draws both sides into the modal's own canvases
  // once it opens.
  useEffect(() => {
    if (!viewOpen) return;
    let cancelled = false;
    const fCanvas = viewFrontCanvasRef.current;
    const bCanvas = viewBackCanvasRef.current;
    if (fCanvas) { fCanvas.width = CARD_W; fCanvas.height = CARD_H; }
    if (bCanvas) { bCanvas.width = CARD_W; bCanvas.height = CARD_H; }
    (async () => {
      if (fCanvas) {
        const fctx = fCanvas.getContext("2d");
        if (fctx) await drawFront(fctx, () => cancelled);
      }
      if (cancelled) return;
      if (bCanvas) {
        const bctx = bCanvas.getContext("2d");
        if (bctx) await drawBack(bctx, () => cancelled);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewOpen, code, name, workshopName, photoUrl, verified, profession, location, createdAt, documentsCount, contactEmail, contactPhone, websiteUrl]);

  useImperativeHandle(ref, () => ({
    download: async (filenameBase: string) => {
      const [frontBlob, backBlob] = await Promise.all([buildBlob(drawFront), buildBlob(drawBack)]);
      if (frontBlob) triggerDownload(frontBlob, `${filenameBase}-front.png`);
      if (backBlob) triggerDownload(backBlob, `${filenameBase}-back.png`);
    },
    share: async (filenameBase: string) => {
      const blob = await buildBlob(drawFront);
      if (!blob) return;
      const file = new File([blob], `${filenameBase}-front.png`, { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "My Maintler Card", text: "Scan my MaintlyQR Maintler card" });
          return;
        } catch {
          // User cancelled the share sheet, or the browser refused mid-way
          // — fall through to a plain download rather than doing nothing.
        }
      }
      triggerDownload(blob, `${filenameBase}-front.png`);
    },
    printCard: async () => {
      const [frontBlob, backBlob] = await Promise.all([buildBlob(drawFront), buildBlob(drawBack)]);
      if (!frontBlob && !backBlob) return;
      const frontUrl = frontBlob ? URL.createObjectURL(frontBlob) : "";
      const backUrl = backBlob ? URL.createObjectURL(backBlob) : "";
      const printWindow = window.open("", "_blank");
      if (!printWindow) return;
      printWindow.document.write(
        `<html><head><title>Maintler Card</title><style>` +
        `body{margin:0;background:#fff;}` +
        `.page{display:flex;align-items:center;justify-content:center;min-height:100vh;}` +
        `.page img{max-width:92%;max-height:92vh;}` +
        `@media print{.page{page-break-after:always;}.page:last-child{page-break-after:auto;}}` +
        `</style></head><body>` +
        (frontUrl ? `<div class="page"><img src="${frontUrl}" /></div>` : "") +
        (backUrl ? `<div class="page"><img src="${backUrl}" /></div>` : "") +
        `<script>window.onload=function(){window.focus();window.print();};</script>` +
        `</body></html>`
      );
      printWindow.document.close();
    },
    view: () => setViewOpen(true),
  }));

  // These three thin wrappers just reuse the same buildBlob/download logic
  // the imperative handle exposes, so the view modal's own action buttons
  // don't need Settings to pass in separate callbacks — the modal is fully
  // self-contained.
  async function downloadFromModal() {
    const [frontBlob, backBlob] = await Promise.all([buildBlob(drawFront), buildBlob(drawBack)]);
    if (frontBlob) triggerDownload(frontBlob, "maintlyqr-card-front.png");
    if (backBlob) triggerDownload(backBlob, "maintlyqr-card-back.png");
  }
  async function shareFromModal() {
    const blob = await buildBlob(drawFront);
    if (!blob) return;
    const file = new File([blob], "maintlyqr-card-front.png", { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean };
    if (nav.canShare && nav.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "My Maintler Card", text: "Scan my MaintlyQR Maintler card" });
        return;
      } catch {
        // Falls through to a plain download below.
      }
    }
    triggerDownload(blob, "maintlyqr-card-front.png");
  }
  async function printFromModal() {
    const [frontBlob, backBlob] = await Promise.all([buildBlob(drawFront), buildBlob(drawBack)]);
    if (!frontBlob && !backBlob) return;
    const frontUrl = frontBlob ? URL.createObjectURL(frontBlob) : "";
    const backUrl = backBlob ? URL.createObjectURL(backBlob) : "";
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(
      `<html><head><title>Maintler Card</title><style>` +
      `body{margin:0;background:#fff;}` +
      `.page{display:flex;align-items:center;justify-content:center;min-height:100vh;}` +
      `.page img{max-width:92%;max-height:92vh;}` +
      `@media print{.page{page-break-after:always;}.page:last-child{page-break-after:auto;}}` +
      `</style></head><body>` +
      (frontUrl ? `<div class="page"><img src="${frontUrl}" /></div>` : "") +
      (backUrl ? `<div class="page"><img src="${backUrl}" /></div>` : "") +
      `<script>window.onload=function(){window.focus();window.print();};</script>` +
      `</body></html>`
    );
    printWindow.document.close();
  }

  return (
    <>
      <div
        style={{ width: "100%", maxWidth: previewWidth, aspectRatio: `${CARD_W} / ${CARD_H}` }}
        className={`shrink-0 rounded-2xl overflow-hidden shadow-sm border border-zinc-200 ${clickToView ? "cursor-pointer hover:border-red-300 hover:shadow-md transition-all" : ""}`}
        {...(clickToView
          ? {
              onClick: () => setViewOpen(true),
              role: "button" as const,
              tabIndex: 0,
              "aria-label": "View both sides of your Maintler card",
              onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setViewOpen(true); }
              },
            }
          : {})}
      >
        <canvas ref={previewCanvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
        {/* Off-screen — only exist to produce composited QR PNGs via
            getBlob(). Rendered, not display:none, since qr-code-styling
            needs a real mounted element to draw into. */}
        <div style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", opacity: 0 }} aria-hidden="true">
          <QrCodeCanvas ref={qrFrontHandleRef} code={code} theme={DEFAULT_QR_THEME} linkPath="maintler" size={240} />
          <QrCodeCanvas ref={qrBackHandleRef} code={code} theme="classic" linkPath="maintler" size={220} />
        </div>
      </div>
      {clickToView && (
        <p className="text-center text-[11px] text-zinc-400 mt-2">
          Tap the card to view both sides &amp; print
        </p>
      )}

      {viewOpen && (
        <div className="fixed inset-0 z-[100] bg-zinc-900/70 flex items-center justify-center p-4" onClick={() => setViewOpen(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-7xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-black text-zinc-900">My Maintler Card</h3>
              <button onClick={() => setViewOpen(false)} className="text-zinc-400 hover:text-zinc-700">
                <X size={20} />
              </button>
            </div>
            <div className="flex flex-col md:flex-row gap-6 items-center justify-center">
              <div className="w-full md:w-1/2">
                <div style={{ width: "100%", aspectRatio: `${CARD_W} / ${CARD_H}` }} className="rounded-2xl overflow-hidden border border-zinc-200 shadow-sm">
                  <canvas ref={viewFrontCanvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
                </div>
                <p className="text-center text-[11px] font-bold text-zinc-400 mt-2 uppercase tracking-wide">Front</p>
              </div>
              <div className="w-full md:w-1/2">
                <div style={{ width: "100%", aspectRatio: `${CARD_W} / ${CARD_H}` }} className="rounded-2xl overflow-hidden border border-zinc-200 shadow-sm">
                  <canvas ref={viewBackCanvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
                </div>
                <p className="text-center text-[11px] font-bold text-zinc-400 mt-2 uppercase tracking-wide">Back</p>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => downloadFromModal()}
                className="flex items-center gap-1.5 text-[12px] font-bold text-white bg-zinc-900 hover:bg-zinc-800 px-4 py-2.5 rounded-xl transition-colors"
              >
                <Download size={13} /> Download Both
              </button>
              <button
                onClick={() => printFromModal()}
                className="flex items-center gap-1.5 text-[12px] font-bold text-zinc-600 hover:text-red-600 border border-zinc-200 hover:bg-zinc-50 px-4 py-2.5 rounded-xl transition-colors"
              >
                <Printer size={13} /> Print Card
              </button>
              <button
                onClick={() => shareFromModal()}
                className="flex items-center gap-1.5 text-[12px] font-bold text-zinc-600 hover:text-red-600 border border-zinc-200 hover:bg-zinc-50 px-4 py-2.5 rounded-xl transition-colors"
              >
                <Share2 size={13} /> Share
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default MaintlerCardCanvas;
