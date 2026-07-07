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
// Note on frames: the frame shape (see QrFrameShape.tsx) is a live on-screen
// / on-print decoration only. `download()` exports just the plain styled QR
// (colors/dots/logo, no frame) as a PNG, since qr-code-styling can only
// export what it drew, not surrounding page DOM. The frame DOES show up
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
    <div ref={containerRef} className={!def.frame ? className : undefined} style={{ width: size, height: size }} />
  );

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
