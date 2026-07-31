"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, X, ZoomIn } from "lucide-react";

// Full-screen camera QR scanner. Extracted from the homepage's scanner so
// every place in the app that needs to scan a MaintlyQR code (the public
// homepage, and now the "link an existing asset" flows in the dashboard)
// shares one implementation instead of three slightly-different copies.
//
// On a successful scan, calls onDetect with the decoded value — if the QR
// encodes a full URL (e.g. https://maintlyqr.com/asset/MTLY-AB12-CD34), only
// the last path segment is passed through, so callers always get just the
// code itself.
//
// Incremento 27 (Facu): "veo q se pone en ingles aunque este en español la
// plataforma" — hasta acá este componente tenía todo su texto en inglés
// hardcodeado (ver la nota vieja en LinkExistingAssetModalIntl.tsx: era
// precedente conocido, no un bug nuevo). Se agrega useTranslations acá
// mismo, sin crear un twin "*Intl" -- a diferencia de otros componentes
// compartidos de esta app, TODOS los que usan QRScannerModal hoy
// (src/app/[locale]/page.tsx, LinkExistingAssetModalIntl, NewAssetModalIntl)
// viven bajo [locale], así que siempre hay un NextIntlClientProvider arriba
// y no hace falta la variante legacy.
export default function QRScannerModal({
  onDetect,
  onClose,
  instructions,
  onVinFallback,
}: {
  onDetect: (code: string) => void;
  onClose: () => void;
  instructions?: string;
  // Incremento 29 (Facu, escaneo de VIN): opcional a propósito -- solo el
  // Home lo pasa (donde escanear un VIN para ENCONTRAR un equipo tiene
  // sentido). LinkExistingAssetModalIntl y NewAssetModalIntl no lo pasan:
  // este último ya tiene su propio botón de cámara dedicado junto al campo
  // VIN (ver NewAssetModalIntl.tsx), así que repetirlo acá sería confuso.
  onVinFallback?: () => void;
}) {
  const t = useTranslations("QRScannerModal");
  const displayInstructions = instructions || t("defaultInstructions");
  const [camError, setCamError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [detected, setDetected] = useState("");
  const [showVinHint, setShowVinHint] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const detectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function stopCamera() {
    activeRef.current = false;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (detectTimeoutRef.current) { clearTimeout(detectTimeoutRef.current); detectTimeoutRef.current = null; }
  }

  async function requestScan() {
    if (!activeRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    if (video.readyState < video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(requestScan);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const jsQR = (await import("jsqr")).default;
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (code?.data && activeRef.current) {
      let qrValue = code.data.trim();
      try {
        const url = new URL(qrValue);
        const parts = url.pathname.split("/").filter(Boolean);
        qrValue = parts[parts.length - 1] || qrValue;
      } catch {
        // Not a URL — use as-is (e.g. "MTLY-AB12-CD34")
      }
      setDetected(qrValue);
      stopCamera();
      detectTimeoutRef.current = setTimeout(() => onDetect(qrValue), 500);
      return;
    }

    if (activeRef.current) {
      rafRef.current = requestAnimationFrame(requestScan);
    }
  }

  useEffect(() => {
    activeRef.current = true;
    setCamError("");
    setDetected("");
    setScanning(false);

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then((stream) => {
        if (!activeRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setScanning(true);
            requestScan();
          };
        }
      })
      .catch(() => {
        setCamError(t("cameraDeniedMessage"));
      });

    return () => { stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Incremento 29 (Facu, escaneo de VIN): "cuando uno escanea un vin se va a
  // dar cuenta q ya tiene historial de mantenimiento maintlyqr". El link de
  // "¿Es un vehículo? Escaneá el VIN" solo aparece después de un rato sin
  // detectar ningún QR -- así no compite visualmente con el flujo principal
  // (que sigue siendo escanear el QR físico) para la enorme mayoría de
  // escaneos, que sí encuentran uno enseguida.
  useEffect(() => {
    if (!onVinFallback || !scanning || detected || camError) return;
    const timer = setTimeout(() => setShowVinHint(true), 4000);
    return () => clearTimeout(timer);
  }, [onVinFallback, scanning, detected, camError]);

  function handleClose() {
    stopCamera();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="shrink-0 flex items-center justify-between px-5 py-4" style={{ paddingTop: "max(env(safe-area-inset-top), 16px)" }}>
        <p className="text-white font-black text-[15px]">{t("title")}</p>
        <button
          onClick={handleClose}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center transition-all"
        >
          <X size={20} className="text-white" />
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
        <canvas ref={canvasRef} className="hidden" />

        {scanning && !detected && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" />
            <div className="relative z-10 w-[260px] h-[260px]">
              <div className="absolute inset-0 rounded-2xl border-2 border-white/30" />
              <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-red-500 rounded-tl-2xl" />
              <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-red-500 rounded-tr-2xl" />
              <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-red-500 rounded-bl-2xl" />
              <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-red-500 rounded-br-2xl" />
              <div className="absolute inset-x-3 top-2 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-[scanline_2s_ease-in-out_infinite]" />
            </div>
          </div>
        )}

        {detected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-20">
            <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mb-4 animate-[pop_0.3s_ease-out]">
              <ZoomIn size={36} className="text-white" />
            </div>
            <p className="text-white font-black text-[18px]">{t("qrDetected")}</p>
          </div>
        )}

        {camError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-20 px-8 text-center">
            <div className="w-16 h-16 rounded-full bg-red-600/20 border border-red-500/40 flex items-center justify-center mb-4">
              <Camera size={28} className="text-red-400" />
            </div>
            <p className="text-white font-bold text-[16px] mb-2">{t("cameraUnavailable")}</p>
            <p className="text-white/60 text-[13px] leading-relaxed mb-6">{camError}</p>
            <button onClick={handleClose} className="bg-white text-zinc-900 font-bold px-6 py-3 rounded-xl text-[14px]">
              {t("goBack")}
            </button>
          </div>
        )}
      </div>

      {scanning && !detected && !camError && (
        <div className="shrink-0 flex flex-col items-center gap-2 py-8 px-6 text-center" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 32px)" }}>
          <p className="text-white font-bold text-[16px]">{displayInstructions}</p>
          <p className="text-white/50 text-[13px]">{t("holdSteady")}</p>
          {onVinFallback && showVinHint && (
            <button
              onClick={() => { stopCamera(); onVinFallback(); }}
              className="text-white/70 hover:text-white text-[13px] font-semibold underline underline-offset-2 mt-2"
            >
              {t("vinFallbackHint")}
            </button>
          )}
        </div>
      )}

      {!scanning && !camError && (
        <div className="shrink-0 flex flex-col items-center gap-3 py-8 px-6">
          <div className="w-8 h-8 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          <p className="text-white/60 text-[13px]">{t("startingCamera")}</p>
        </div>
      )}

      <style>{`
        @keyframes scanline {
          0%   { transform: translateY(0px);   opacity: 1; }
          50%  { transform: translateY(240px); opacity: 0.8; }
          100% { transform: translateY(0px);   opacity: 1; }
        }
        @keyframes pop {
          0%   { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </div>
  );
}
