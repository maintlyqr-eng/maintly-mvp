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
// Deliberately a single <canvas>, not an HTML/CSS layout exported via a
// screenshot library — no new dependency needed (html2canvas and similar
// have their own cross-origin/font-rendering quirks), and the QR portion
// already has proven canvas-compositing logic in QrCodeCanvas.tsx
// (frame artwork + print-resolution QR merged into one PNG) that this
// reuses via the new getBlob() handle method instead of duplicating it.
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

const CARD_W = 900;
const CARD_H = 1360;

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

const MaintlerCardCanvas = forwardRef<MaintlerCardCanvasHandle, {
  code: string;
  name: string;
  workshopName?: string | null;
  photoUrl?: string | null;
  verified?: boolean | null;
  profession?: string | null;
  previewWidth?: number;
}>(function MaintlerCardCanvas({ code, name, workshopName, photoUrl, verified, profession, previewWidth = 260 }, ref) {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const qrHandleRef = useRef<QrCodeCanvasHandle>(null);

  async function drawCard(ctx: CanvasRenderingContext2D) {
    const W = CARD_W, H = CARD_H;
    ctx.clearRect(0, 0, W, H);

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#27272a");
    bg.addColorStop(1, "#09090b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Brand mark — the actual gear/QR icon graphic already used across the
    // app (same artwork as the QR frame itself, see qrThemes.ts's Gear
    // Ring theme), not just a plain text label. Facu, comparing this card
    // side-by-side against his own mockup: "podes poner el logo y maintly
    // que ya tenes para arriba."
    ctx.textAlign = "left";
    ctx.font = "bold 32px Arial, sans-serif";
    const wordmark = "MAINTLYQR";
    const wordmarkWidth = ctx.measureText(wordmark).width;
    const brandIconSize = 56;
    const brandGap = 16;
    const brandLockupWidth = brandIconSize + brandGap + wordmarkWidth;
    const brandX = W / 2 - brandLockupWidth / 2;
    const brandY = 36;
    try {
      const gearIcon = await loadImageEl("/images/qr-frames/qr-gear-ring.png");
      ctx.drawImage(gearIcon, brandX, brandY, brandIconSize, brandIconSize);
    } catch {
      // Icon failed to load — the wordmark alone still identifies the card.
    }
    ctx.fillStyle = "#e4e4e7";
    ctx.fillText(wordmark, brandX + brandIconSize + brandGap, brandY + brandIconSize / 2 + 11);
    ctx.textAlign = "center";
    ctx.fillStyle = "#71717a";
    ctx.font = "bold 13px Arial, sans-serif";
    ctx.fillText("MAINTENANCE  ·  TRACKED", W / 2, brandY + brandIconSize + 26);

    // Photo (circular, center-cropped) or an initials placeholder.
    const photoSize = 260;
    const photoCx = W / 2;
    const photoCy = 175 + photoSize / 2;
    let photoDrawn = false;
    if (photoUrl) {
      try {
        const img = await loadImageEl(photoUrl);
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
      ctx.font = "bold 88px Arial, sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillText(initialsOf(name), photoCx, photoCy + 4);
      ctx.textBaseline = "alphabetic";
    }
    ctx.beginPath();
    ctx.arc(photoCx, photoCy, photoSize / 2, 0, Math.PI * 2);
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#dc2626";
    ctx.stroke();

    let y = photoCy + photoSize / 2 + 70;
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 50px Arial, sans-serif";
    ctx.fillText(name, W / 2, y);

    if (workshopName && workshopName !== name) {
      y += 42;
      ctx.fillStyle = "#a1a1aa";
      ctx.font = "26px Arial, sans-serif";
      ctx.fillText(workshopName, W / 2, y);
    }

    if (verified) {
      y += 60;
      const label = "✓ VERIFIED MAINTLER";
      ctx.font = "bold 24px Arial, sans-serif";
      const textWidth = ctx.measureText(label).width;
      const pillH = 52, padX = 26;
      const pillW = textWidth + padX * 2;
      roundRect(ctx, W / 2 - pillW / 2, y - pillH + 14, pillW, pillH, pillH / 2);
      ctx.fillStyle = "rgba(16,185,129,0.16)";
      ctx.fill();
      ctx.fillStyle = "#34d399";
      ctx.textBaseline = "middle";
      ctx.fillText(label, W / 2, y - pillH / 2 + 14 + 2);
      ctx.textBaseline = "alphabetic";
    }

    if (profession) {
      y += 46;
      ctx.fillStyle = "#a1a1aa";
      ctx.font = "22px Arial, sans-serif";
      ctx.fillText(profession, W / 2, y);
    }

    // QR block, reusing the exact composited frame+QR image QrCodeCanvas
    // already knows how to build (see getBlob() on that component). No
    // background panel behind it anymore — Facu, comparing this card
    // against his own mockup: "ese fondo blanco cuadrado queda re feo en
    // la q hiciste." The Gear Ring frame artwork already has its own
    // transparent margin around the metal gear teeth (only the QR's own
    // white circle in the middle is opaque), so drawing it straight onto
    // the dark card background reproduces the mockup's look with nothing
    // extra needed here.
    const qrBoxOuter = 480;
    const qrBoxY = H - 660;
    let qrBlob: Blob | null = null;
    try {
      qrBlob = (await qrHandleRef.current?.getBlob()) ?? null;
    } catch {
      qrBlob = null;
    }
    if (qrBlob) {
      try {
        const qrImg = await blobToImage(qrBlob);
        const scale = Math.min(qrBoxOuter / qrImg.width, qrBoxOuter / qrImg.height);
        const dw = qrImg.width * scale, dh = qrImg.height * scale;
        ctx.drawImage(qrImg, W / 2 - dw / 2, qrBoxY + (qrBoxOuter - dh) / 2, dw, dh);
      } catch {
        // Drawing the QR image failed — the rest of the card (photo, name,
        // banner) still renders fine without it.
      }
    }

    const captionY = qrBoxY + qrBoxOuter + 50;
    ctx.fillStyle = "#e4e4e7";
    ctx.font = "bold 24px Arial, sans-serif";
    ctx.fillText("SCAN TO VIEW MY PROFILE", W / 2, captionY);

    const bannerH = 100;
    ctx.fillStyle = "#dc2626";
    ctx.fillRect(0, H - bannerH, W, bannerH);
    ctx.fillStyle = "#ffffff";
    ctx.font = "18px Arial, sans-serif";
    ctx.fillText("MAINTLER ID", W / 2, H - bannerH + 34);
    ctx.font = "bold 30px Arial, sans-serif";
    ctx.fillText(code.slice(0, 8).toUpperCase(), W / 2, H - bannerH + 74);
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
      await drawCard(ctx);
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, name, workshopName, photoUrl, verified, profession]);

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

  const previewHeight = Math.round(previewWidth * (CARD_H / CARD_W));

  return (
    <div style={{ width: previewWidth, height: previewHeight }} className="shrink-0 rounded-2xl overflow-hidden shadow-sm border border-zinc-200">
      <canvas ref={previewCanvasRef} style={{ width: previewWidth, height: previewHeight, display: "block" }} />
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
