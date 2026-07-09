"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import QrCodeCanvas, { type QrCodeCanvasHandle } from "@/components/QrCodeCanvas";
import { DEFAULT_QR_THEME } from "@/lib/qrThemes";

// The actual printable/shareable Maintler ID card — Facu's mockup had a
// dark badge-style card (photo, name, verified pill, QR, a red "Maintler
// ID" banner at the bottom) as the physical/shareable artifact, separate
// from the public /maintler/[code] profile PAGE that QR resolves to. The
// first cut of this feature only rendered a bare QR in Settings with no
// photo/name/card design around it — Facu's follow-up: "no quedo tan
// parecido a lo q te pase... ademas no se ve el QR y tampoco tengo forma
// de imprimirla o mandarla." This component is that missing piece: one
// composited PNG a Maintler can download, share (native share sheet on
// mobile — actually reaches "mandarla"), or print.
//
// Round 6: Facu sent a full desktop mockup of Settings ("algo asi te
// muestro de ejemplo para la web") with a LANDSCAPE version of this same
// card — photo/name/status/profession/location on the left, the QR on
// the right, all in one wide horizontal card instead of the earlier
// portrait/wallet-ID shape. Rebuilt around that orientation; the
// download/share/print mechanics underneath are unchanged.
//
// Deliberately a single <canvas>, not an HTML/CSS layout exported via a
// screenshot library — no new dependency needed (html2canvas and similar
// have their own cross-origin/font-rendering quirks), and the QR portion
// already has proven canvas-compositing logic in QrCodeCanvas.tsx
// (frame artwork + print-resolution QR merged into one PNG) that this
// reuses via the getBlob() handle method instead of duplicating it.
export type MaintlerCardCanvasHandle = {
  download: (filename: string) => void;
  // Web Share API with a file attachment where supported (Android Chrome,
  // iOS Safari — opens the native "send to WhatsApp/Messages/Mail/AirDrop"
  // sheet, which is what "mandarla" actually needs); falls back to a plain
  // download on desktop browsers that don't support sharing files at all.
  share: (filename: string) => Promise<void>;
  // Opens the finished card in a new tab sized to just the image and
  // triggers the browser's own print dialog — same "let the browser handle
  // print layout" approach as the QR Codes page's Print Sheet.
  print: () => void;
};

const CARD_W = 1200;
const CARD_H = 560;

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

const MaintlerCardCanvas = forwardRef<MaintlerCardCanvasHandle, {
  code: string;
  name: string;
  workshopName?: string | null;
  photoUrl?: string | null;
  verified?: boolean | null;
  profession?: string | null;
  location?: string | null;
  previewWidth?: number;
}>(function MaintlerCardCanvas({ code, name, workshopName, photoUrl, verified, profession, location, previewWidth = 320 }, ref) {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const qrHandleRef = useRef<QrCodeCanvasHandle>(null);

  // isStale lets a caller abort a slow, superseded draw mid-flight — without
  // it, two overlapping drawCard() calls (e.g. photoUrl/name changing twice
  // quickly, each triggering the preview effect below) race on the same
  // canvas, and whichever finishes LAST wins regardless of which one
  // started last, so a stale photo/name can visibly paint over a newer one.
  // Checked after the two slow network-bound awaits (photo load, QR blob).
  async function drawCard(ctx: CanvasRenderingContext2D, isStale: () => boolean = () => false) {
    const W = CARD_W, H = CARD_H;
    ctx.clearRect(0, 0, W, H);

    const bannerH = 64;
    const contentH = H - bannerH;

    const bg = ctx.createLinearGradient(0, 0, W, contentH);
    bg.addColorStop(0, "#27272a");
    bg.addColorStop(1, "#09090b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, contentH);

    // Brand mark, top-left this time (landscape leaves room for it beside
    // the content instead of needing its own dedicated row up top).
    const brandIconSize = 44;
    const brandX = 40;
    const brandY = 28;
    ctx.textAlign = "left";
    try {
      const gearIcon = await loadImageEl("/images/qr-frames/qr-gear-ring.png");
      ctx.drawImage(gearIcon, brandX, brandY, brandIconSize, brandIconSize);
    } catch {
      // Icon failed to load — the wordmark alone still identifies the card.
    }
    ctx.font = "bold 24px Arial, sans-serif";
    ctx.fillStyle = "#e4e4e7";
    ctx.fillText("MAINTLYQR", brandX + brandIconSize + 12, brandY + brandIconSize / 2 - 2);
    ctx.font = "bold 10px Arial, sans-serif";
    ctx.fillStyle = "#71717a";
    ctx.fillText("MAINTENANCE  ·  TRACKED", brandX + brandIconSize + 12, brandY + brandIconSize / 2 + 14);

    // ── LEFT: photo + identity block, vertically centered in the content
    //    band below the brand mark ──
    const bandTop = brandY + brandIconSize + 24;
    const bandBottom = contentH;
    const bandCy = bandTop + (bandBottom - bandTop) / 2;

    const photoSize = 176;
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
      ctx.font = "bold 60px Arial, sans-serif";
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

    // Text column to the right of the photo.
    const textX = photoCx + photoSize / 2 + 36;
    const textMaxWidth = 480;
    let y = bandTop + 20;

    ctx.font = "bold 34px Arial, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(truncateToWidth(ctx, name, textMaxWidth), textX, y);

    if (workshopName && workshopName !== name) {
      y += 30;
      ctx.font = "20px Arial, sans-serif";
      ctx.fillStyle = "#a1a1aa";
      ctx.fillText(truncateToWidth(ctx, workshopName, textMaxWidth), textX, y);
    }

    if (verified) {
      y += 38;
      const label = "✓ VERIFIED MAINTLER";
      ctx.font = "bold 15px Arial, sans-serif";
      const textWidth = ctx.measureText(label).width;
      const pillH = 30, padX = 14;
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
      y += 34;
      ctx.font = "16px Arial, sans-serif";
      ctx.fillStyle = "#d4d4d8";
      ctx.fillText(`🔧 ${truncateToWidth(ctx, profession, textMaxWidth - 24)}`, textX, y);
    }

    if (location) {
      y += 26;
      ctx.font = "16px Arial, sans-serif";
      ctx.fillStyle = "#a1a1aa";
      ctx.fillText(`📍 ${truncateToWidth(ctx, location, textMaxWidth - 24)}`, textX, y);
    }

    // ── RIGHT: QR block, reusing the exact composited frame+QR image
    //    QrCodeCanvas already knows how to build. No background panel
    //    behind it — the Gear Ring frame artwork already has its own
    //    transparent margin, so it sits directly on the dark card
    //    background (same fix as the portrait version, round 4: "ese
    //    fondo blanco cuadrado queda re feo en la q hiciste"). ──
    const qrBoxOuter = 320;
    const qrCx = W - 200;
    const qrCy = bandCy;
    let qrBlob: Blob | null = null;
    try {
      qrBlob = (await qrHandleRef.current?.getBlob()) ?? null;
    } catch {
      qrBlob = null;
    }
    if (isStale()) return;
    if (qrBlob) {
      try {
        const qrImg = await blobToImage(qrBlob);
        const scale = Math.min(qrBoxOuter / qrImg.width, qrBoxOuter / qrImg.height);
        const dw = qrImg.width * scale, dh = qrImg.height * scale;
        ctx.drawImage(qrImg, qrCx - dw / 2, qrCy - dh / 2, dw, dh);
      } catch {
        // Drawing the QR image failed — the rest of the card (photo, name,
        // banner) still renders fine without it.
      }
    }
    ctx.textAlign = "center";
    ctx.font = "bold 14px Arial, sans-serif";
    ctx.fillStyle = "#e4e4e7";
    ctx.fillText("SCAN TO VIEW MY PROFILE", qrCx, qrCy + qrBoxOuter / 2 + 30);
    ctx.textAlign = "left";

    // Bottom banner, full width.
    ctx.textAlign = "center";
    ctx.fillStyle = "#dc2626";
    ctx.fillRect(0, H - bannerH, W, bannerH);
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px Arial, sans-serif";
    ctx.fillText("MAINTLER ID", W / 2, H - bannerH + 24);
    ctx.font = "bold 22px Arial, sans-serif";
    ctx.fillText(code.slice(0, 8).toUpperCase(), W / 2, H - bannerH + 48);
    ctx.textAlign = "left";
  }

  async function buildCardBlob(): Promise<Blob | null> {
    const canvas = document.createElement("canvas");
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    await drawCard(ctx);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  }

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let cancelled = false;
    (async () => {
      await drawCard(ctx, () => cancelled);
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, name, workshopName, photoUrl, verified, profession, location]);

  useImperativeHandle(ref, () => ({
    download: async (filename: string) => {
      const blob = await buildCardBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.png`;
      a.click();
      URL.revokeObjectURL(url);
    },
    share: async (filename: string) => {
      const blob = await buildCardBlob();
      if (!blob) return;
      const file = new File([blob], `${filename}.png`, { type: "image/png" });
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
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.png`;
      a.click();
      URL.revokeObjectURL(url);
    },
    print: async () => {
      const blob = await buildCardBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const printWindow = window.open("", "_blank");
      if (!printWindow) { URL.revokeObjectURL(url); return; }
      printWindow.document.write(
        `<html><head><title>Maintler Card</title></head><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff;">` +
        `<img src="${url}" style="max-width:100%;max-height:100vh;" onload="window.focus();window.print();" />` +
        `</body></html>`
      );
      printWindow.document.close();
    },
  }));

  // Responsive up to previewWidth, not a fixed pixel box — a fixed width
  // (e.g. 420px for the wide landscape card in Settings) would overflow
  // the card's container on narrow phone screens. The canvas's actual
  // drawing surface stays at the full CARD_W x CARD_H resolution
  // regardless (set below in drawCard()); only the on-screen CSS size
  // scales down here.
  return (
    <div
      style={{ width: "100%", maxWidth: previewWidth, aspectRatio: `${CARD_W} / ${CARD_H}` }}
      className="shrink-0 rounded-2xl overflow-hidden shadow-sm border border-zinc-200"
    >
      <canvas ref={previewCanvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
      {/* Off-screen — only exists to produce the composited frame+QR PNG
          via getBlob(). Rendered, not display:none, since the underlying
          qr-code-styling library needs a real mounted element to draw
          into; visually hidden with an inline absolute position + zero
          size + opacity instead. */}
      <div style={{ position: "absolute", width: 0, height: 0, overflow: "hidden", opacity: 0 }} aria-hidden="true">
        <QrCodeCanvas ref={qrHandleRef} code={code} theme={DEFAULT_QR_THEME} linkPath="maintler" size={240} />
      </div>
    </div>
  );
});

export default MaintlerCardCanvas;
