"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { getQrTheme } from "@/lib/qrThemes";
import QrFrameShape from "@/components/QrFrameShape";

// Renders one QR code styled per its personalization theme (color, dot
// shape, optional Maintly logo, optional decorative frame). Replaces the
// old plain api.qrserver.com <img> — that service can't do colors, dot
// styles, or an embedded logo, and depends on an external API being up.
//
// Requires the "qr-code-styling" npm package — added to package.json, but
// this sandbox can't run `npm install` (network-restricted), so run it
// locally before building: `npm install qr-code-styling`.
//
// Note on frames: for illustrated PNG frames (`frameImage`/`frameHole` in
// qrThemes.ts), `download()` composites the frame artwork and a freshly
// rendered, print-resolution QR onto one canvas and saves that as a single
// PNG — so the downloaded file looks exactly like what's on screen, not just
// a plain code. For the handful of themes still using the hand-drawn SVG
// frame (QrFrameShape.tsx — daisy, star, tennis), compositing an SVG isn't
// wired up yet, so download() falls back to exporting just the plain styled
// QR; the frame still shows up when printing a batch from "Print Sheet" or
// via the new per-card Print button, since those print the live page.
export type QrCodeCanvasHandle = { download: (filename: string) => void };

function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

const QrCodeCanvas = forwardRef<QrCodeCanvasHandle, {
  code: string;
  theme: string;
  size?: number;
  className?: string;
}>(function QrCodeCanvas({ code, theme, size = 220, className }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<any>(null);
  const def = getQrTheme(theme);

  // "plain" / "svg-frame" / "image-frame" each return a differently-shaped
  // tree, but every shape's root happens to be a plain <div> — so when
  // switching between them (e.g. a non-framed theme to a framed one),
  // React sees "same tag at the same position" and REUSES that DOM node
  // instead of unmounting it, patching its attrs in place. That's normally
  // desirable, but the qr-code-styling <canvas> was appended to it
  // *imperatively* (outside React's render), so React has no idea it's
  // there and never removes it — it becomes an orphaned, unclipped leftover
  // sitting at the reused node's top-left corner underneath the new
  // content. That was the "old QR ghost showing behind the new one" bug.
  // Keying the root by frameMode forces a full unmount/remount across a
  // shape change, so the orphan can never survive a theme switch.
  const frameMode = def.frameImage ? "image-frame" : def.frame ? "svg-frame" : "plain";

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const mod = await import("qr-code-styling").catch(() => null);
      if (cancelled || !containerRef.current || !mod) return;
      const QRCodeStyling = mod.default;

      const url = `${window.location.origin}/asset/${code}`;

      // Render at higher internal resolution than the on-screen `size` —
      // qr-code-styling's canvas bitmap is exactly width×height pixels, so
      // rendering natively at a small `size` (a 24-65px QR is common now
      // that framed themes size the QR to whatever fraction of the frame
      // the icon's hole allows) looks visibly blocky/aliased. Rendering at
      // RENDER_SCALE× and letting CSS display it at `size` gives the
      // browser real pixels to downsample from, the same trick as a retina
      // image — free sharpness, no layout change.
      const RENDER_SCALE = 3;
      const renderSize = Math.round(size * RENDER_SCALE);

      const qr = new QRCodeStyling({
        width: renderSize,
        height: renderSize,
        type: "canvas",
        data: url,
        image: def.options.logo ? "/images/qr-gear-real.png" : undefined,
        dotsOptions: { color: def.options.dotsColor, type: def.options.dotsType },
        backgroundOptions: { color: def.options.backgroundColor },
        cornersSquareOptions: { color: def.options.cornersSquareColor, type: def.options.cornersSquareType },
        cornersDotOptions: { color: def.options.cornersDotColor, type: def.options.cornersDotType },
        imageOptions: { crossOrigin: "anonymous", margin: 4, imageSize: 0.32 },
      });

      containerRef.current.innerHTML = "";
      qr.append(containerRef.current);

      // The appended <canvas> carries renderSize as its actual width/height
      // attributes (its pixel resolution) — constrain its CSS display size
      // back down to `size` so the higher resolution buys sharpness, not a
      // bigger footprint.
      const canvasEl = containerRef.current.querySelector("canvas");
      if (canvasEl) {
        canvasEl.style.width = `${size}px`;
        canvasEl.style.height = `${size}px`;
      }

      qrRef.current = qr;
    }

    render();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, theme, size]);

  useImperativeHandle(ref, () => ({
    download: async (filename: string) => {
      if (!def.frameImage || !def.frameHole) {
        qrRef.current?.download({ name: filename, extension: "png" });
        return;
      }

      // Composite path: render a fresh, print-resolution QR (independent of
      // whatever small `size` this instance is displayed at on screen) and
      // draw it onto a copy of the frame artwork at the hole's position, so
      // the exported PNG matches what's shown on screen — sticker, not just
      // bare code.
      const EXPORT_HOLE_PX = 900;
      const hole = def.frameHole;
      const aspect = def.frameAspect ?? 1;
      const frameWidth = Math.round(EXPORT_HOLE_PX / hole.w);
      const frameHeight = Math.round(frameWidth * aspect);
      const qrPx = Math.round(Math.min(hole.w * frameWidth, hole.h * frameHeight) * 0.94);
      const qrLeft = Math.round(hole.x * frameWidth + (hole.w * frameWidth - qrPx) / 2);
      const qrTop = Math.round(hole.y * frameHeight + (hole.h * frameHeight - qrPx) / 2);

      try {
        const mod = await import("qr-code-styling");
        const QRCodeStyling = mod.default;
        const url = `${window.location.origin}/asset/${code}`;
        const exportQr = new QRCodeStyling({
          width: qrPx,
          height: qrPx,
          type: "canvas",
          data: url,
          image: def.options.logo ? "/images/qr-gear-real.png" : undefined,
          dotsOptions: { color: def.options.dotsColor, type: def.options.dotsType },
          backgroundOptions: { color: def.options.backgroundColor },
          cornersSquareOptions: { color: def.options.cornersSquareColor, type: def.options.cornersSquareType },
          cornersDotOptions: { color: def.options.cornersDotColor, type: def.options.cornersDotType },
          imageOptions: { crossOrigin: "anonymous", margin: 4, imageSize: 0.32 },
        });

        // getRawData is typed to also cover qr-code-styling's Node/SVG paths
        // (Blob | Buffer | null), even though in this "use client" browser
        // context with type: "canvas" it's always a Blob in practice. Handle
        // all three so the type checker (and a genuinely failed render) are
        // both covered, instead of asserting straight to Blob.
        const rawQr = await exportQr.getRawData("png");
        if (!rawQr) throw new Error("QR export returned no data.");
        // Node's Buffer types its underlying .buffer as ArrayBufferLike
        // (which also covers SharedArrayBuffer), which TS's DOM lib won't
        // structurally accept as a BlobPart even though a real Buffer is
        // always backed by a plain ArrayBuffer. `new Uint8Array(rawQr)`
        // copies the bytes into a fresh Uint8Array with its own genuine
        // ArrayBuffer, sidestepping the mismatch — this branch never
        // actually runs in this "use client" browser context anyway
        // (type: "canvas" always yields a Blob), it's just here to satisfy
        // getRawData's wider Node/SVG-path return type.
        const qrBlob = rawQr instanceof Blob ? rawQr : new Blob([new Uint8Array(rawQr)]);
        const qrObjectUrl = URL.createObjectURL(qrBlob);
        const [frameImg, qrImg] = await Promise.all([loadImageEl(def.frameImage), loadImageEl(qrObjectUrl)]);
        URL.revokeObjectURL(qrObjectUrl);

        const canvas = document.createElement("canvas");
        canvas.width = frameWidth;
        canvas.height = frameHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context unavailable.");
        ctx.drawImage(frameImg, 0, 0, frameWidth, frameHeight);
        ctx.drawImage(qrImg, qrLeft, qrTop, qrPx, qrPx);

        canvas.toBlob((blob) => {
          if (!blob) return;
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = blobUrl;
          a.download = `${filename}.png`;
          a.click();
          URL.revokeObjectURL(blobUrl);
        }, "image/png");
      } catch {
        // Compositing failed for some reason (image blocked, etc.) — still
        // give the mechanic something rather than nothing.
        qrRef.current?.download({ name: filename, extension: "png" });
      }
    },
  }));

  // The raw canvas box — always exactly size×size, no padding on it. Padding
  // for the framed look lives on a SEPARATE wrapper below; putting padding
  // directly on this div while also pinning it to a fixed pixel size shrank
  // its content box, which made the qr-code-styling canvas (rendered at the
  // full `size`) overflow out of the top-left corner instead of sitting
  // centered — that was the "QR isn't centered" bug.
  const canvasBox = (
    <div key={frameMode} ref={containerRef} className={!def.frame && !def.frameImage ? className : undefined} style={{ width: size, height: size }} />
  );

  // Real illustrated-artwork frame (Facu's supplied PNGs, cropped to
  // transparent icons — see qrThemes.ts). frameHole marks, as fractions of
  // the source image's own width/height, where that image's pre-drawn white
  // placeholder square sits.
  //
  // `size` is the overall frame width — NOT the hole width. It used to be
  // sized so the *hole* was exactly `size` px wide (frameWidth = size /
  // hole.w), but hole.w varies a lot between icons (a soccer ball's hole
  // takes up ~54% of the image; a palm tree's only ~32%) — so the same
  // `size` produced wildly different on-screen footprints per theme (a
  // palm-tree card could render ~1.7x wider than a soccer-ball one at the
  // identical `size`), which is what overflowed/collided with neighboring
  // cards on the print sheet ("sale corrido / cortado"). Sizing the frame
  // directly to `size` keeps every theme's footprint consistent for
  // layout; the QR itself just ends up proportionally smaller inside icons
  // with a smaller hole fraction, which only matters for this on-screen
  // preview — the actual downloaded/printed export renders the QR at a
  // fixed high resolution regardless (see download() below).
  if (def.frameImage && def.frameHole) {
    const hole = def.frameHole;
    const aspect = def.frameAspect ?? 1;
    const frameWidth = size;
    const frameHeight = Math.round(frameWidth * aspect);
    const qrSize = Math.round(Math.min(hole.w * frameWidth, hole.h * frameHeight) * 0.94);
    const qrLeft = Math.round(hole.x * frameWidth + (hole.w * frameWidth - qrSize) / 2);
    const qrTop = Math.round(hole.y * frameHeight + (hole.h * frameHeight - qrSize) / 2);

    return (
      <div key={frameMode} className={className} style={{ position: "relative", width: frameWidth, height: frameHeight }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={def.frameImage}
          alt=""
          width={frameWidth}
          height={frameHeight}
          style={{ position: "absolute", inset: 0, width: frameWidth, height: frameHeight }}
        />
        <div
          style={{
            position: "absolute", left: qrLeft, top: qrTop, width: qrSize, height: qrSize,
            display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden",
          }}
        >
          <div style={{ width: size, height: size, transform: qrSize !== size ? `scale(${qrSize / size})` : undefined }}>
            {canvasBox}
          </div>
        </div>
      </div>
    );
  }

  if (!def.frame) return canvasBox;

  const frameSize = Math.round(size * 1.55);
  const cardSize = size + 16;

  return (
    <div key={frameMode} className={className} style={{ position: "relative", width: frameSize, height: frameSize }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <QrFrameShape shape={def.frame} color={def.frameColor || "#dc2626"} size={frameSize} />
      </div>
      <div
        className="bg-white rounded-2xl shadow-sm"
        style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          width: cardSize, height: cardSize,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        {canvasBox}
      </div>
    </div>
  );
});

export default QrCodeCanvas;
