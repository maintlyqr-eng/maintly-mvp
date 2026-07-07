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
// Note on frames: a frame (hand-drawn SVG via QrFrameShape.tsx, or a real
// illustrated PNG via `frameImage`/`frameHole` in qrThemes.ts) is a live
// on-screen / on-print decoration only. `download()` exports just the plain
// styled QR (colors/dots/logo, no frame) as a PNG, since qr-code-styling can
// only export what it drew, not surrounding page DOM. The frame DOES show up
// when printing a batch from the QR Codes page's "Print Sheet" view, since
// that prints the live page.
export type QrCodeCanvasHandle = { download: (filename: string) => void };

const QrCodeCanvas = forwardRef<QrCodeCanvasHandle, {
  code: string;
  theme: string;
  size?: number;
  className?: string;
}>(function QrCodeCanvas({ code, theme, size = 220, className }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const qrRef = useRef<any>(null);
  const def = getQrTheme(theme);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      const mod = await import("qr-code-styling").catch(() => null);
      if (cancelled || !containerRef.current || !mod) return;
      const QRCodeStyling = mod.default;

      const url = `${window.location.origin}/asset/${code}`;

      const qr = new QRCodeStyling({
        width: size,
        height: size,
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
      qrRef.current = qr;
    }

    render();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, theme, size]);

  useImperativeHandle(ref, () => ({
    download: (filename: string) => {
      qrRef.current?.download({ name: filename, extension: "png" });
    },
  }));

  // The raw canvas box — always exactly size×size, no padding on it. Padding
  // for the framed look lives on a SEPARATE wrapper below; putting padding
  // directly on this div while also pinning it to a fixed pixel size shrank
  // its content box, which made the qr-code-styling canvas (rendered at the
  // full `size`) overflow out of the top-left corner instead of sitting
  // centered — that was the "QR isn't centered" bug.
  const canvasBox = (
    <div ref={containerRef} className={!def.frame && !def.frameImage ? className : undefined} style={{ width: size, height: size }} />
  );

  // Real illustrated-artwork frame (Facu's supplied PNGs, cropped to
  // transparent icons — see qrThemes.ts). frameHole marks, as fractions of
  // the source image's own width/height, where that image's pre-drawn white
  // placeholder square sits. We size the whole image so the hole is exactly
  // `size` px wide, then position the QR to land inside it, scaled down a
  // hair (0.94) so it sits inside the hole rather than touching its edge.
  if (def.frameImage && def.frameHole) {
    const hole = def.frameHole;
    const aspect = def.frameAspect ?? 1;
    const frameWidth = Math.round(size / hole.w);
    const frameHeight = Math.round(frameWidth * aspect);
    const qrSize = Math.round(Math.min(hole.w * frameWidth, hole.h * frameHeight) * 0.94);
    const qrLeft = Math.round(hole.x * frameWidth + (hole.w * frameWidth - qrSize) / 2);
    const qrTop = Math.round(hole.y * frameHeight + (hole.h * frameHeight - qrSize) / 2);

    return (
      <div className={className} style={{ position: "relative", width: frameWidth, height: frameHeight }}>
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
    <div className={className} style={{ position: "relative", width: frameSize, height: frameSize }}>
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
