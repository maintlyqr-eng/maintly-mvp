"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Car, X, Keyboard, CheckCircle2, RotateCcw } from "lucide-react";
import { isVinFormatValid, normalizeVin } from "@/lib/vinValidation";

// Incremento 29 (Facu, escaneo de VIN): "que con la camara podamos leer el
// vin de la puerta del auto".
//
// Incremento 29h (Facu, 31 jul 2026): "poder sacarle una foto con la
// camara y q la IA haga todo el laburo de reconocer q es VIN... yo cuando
// le saco una foto a algo chatgpt o gemini se da cuenta cual es el VIN y
// me lo busca". Tenía razón -- hasta acá esto usaba Tesseract.js, un OCR
// GENÉRICO que lee letras a ciegas sin entender la imagen (no distingue la
// chapa del resto, no interpreta reflejos/ángulo/contexto). Eso explica
// por qué era tan poco confiable pase lo que pase se le ajustara. Se
// reemplaza por completo: ahora se le manda la foto entera a Gemini (misma
// API/clave que ya usa aiVinModel.ts para marca/modelo), que SÍ entiende
// la foto como foto y encuentra el VIN aunque no esté perfectamente
// encuadrado -- ver /api/scan-vin-photo/route.ts.
//
// Trade-off que se le explicó a Facu antes de este cambio (eligió "Sí,
// cambiar a Gemini" entre 3 opciones): la foto ya NO se queda 100% en el
// teléfono como con Tesseract -- viaja al servidor y de ahí a Gemini para
// ser analizada. A cambio, el reconocimiento es muchísimo más capaz.
//
// El diseño de "nunca confirmar solo" se mantiene igual que antes -- ya
// sea un OCR genérico o un modelo de visión real, ESTE componente nunca
// guarda un VIN sin que la persona lo vea en un campo editable y confirme
// o corrija primero. Eso no cambia con el motor de reconocimiento.
//
// Siempre hay, además, un link para escribir el VIN a mano sin cámara --
// para cuando la chapa está en mal estado o el reconocimiento simplemente
// no da (sin conexión, Gemini no disponible, etc.).
export default function VinScannerModal({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (vin: string) => void;
}) {
  const t = useTranslations("VinScannerModal");
  const [phase, setPhase] = useState<"scanning" | "confirm" | "manual">("scanning");
  const [camError, setCamError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [candidate, setCandidate] = useState("");
  const [editValue, setEditValue] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef(false);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cuánto se espera entre una foto y la siguiente mientras no se encontró
  // nada todavía. Un llamado a Gemini tarda bastante más que una pasada
  // local de Tesseract (viaje de ida y vuelta por internet), así que el
  // intervalo es más largo que el que tenía el OCR local -- no tiene
  // sentido (ni es gratis) mandar una foto nueva cada 1.2s.
  const SCAN_INTERVAL_MS = 2500;
  const CAMERA_SETTLE_MS = 900; // le da tiempo real al autoenfoque antes de la primera foto

  function stopCamera() {
    activeRef.current = false;
    if (streamRef.current) { streamRef.current.getTracks().forEach((tr) => tr.stop()); streamRef.current = null; }
    if (scanTimerRef.current) { clearTimeout(scanTimerRef.current); scanTimerRef.current = null; }
  }

  // Captura el cuadro ENTERO de la cámara (no solo la franja guía como
  // antes) -- a diferencia de un OCR genérico, Gemini entiende contexto,
  // así que darle más de la imagen (dónde está la chapa en relación al
  // resto del auto) ayuda en vez de estorbar. Se reescala a un ancho
  // manejable antes de convertir a JPEG: ni hace falta la resolución nativa
  // para que Gemini lea el texto, y una imagen más chica viaja más rápido.
  function captureFrameAsJpeg(): string | null {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) return null;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    const MAX_WIDTH = 1024;
    const scale = vw > MAX_WIDTH ? MAX_WIDTH / vw : 1;
    canvas.width = Math.round(vw * scale);
    canvas.height = Math.round(vh * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  }

  // IMPORTANTE: esta función se auto-reprograma con setTimeout(runScanPass,
  // ...) -- es la MISMA closure la que se vuelve a llamar a sí misma en
  // cada ciclo, nunca una versión "fresca" ligada al render más reciente.
  // Por eso el único gate que puede usar de forma confiable es activeRef
  // (un ref, siempre lee el valor actual) -- ver el comentario histórico
  // de este mismo patrón que ya existía acá con el OCR local: sigue
  // aplicando igual con el nuevo motor de reconocimiento.
  async function runScanPass() {
    if (!activeRef.current) return;
    const photo = captureFrameAsJpeg();
    if (!photo) {
      if (activeRef.current) scanTimerRef.current = setTimeout(runScanPass, 700);
      return;
    }

    try {
      const res = await fetch("/api/scan-vin-photo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ image: photo }),
      });
      const json = await res.json();
      if (!activeRef.current) return;

      if (json?.found && json?.vin) {
        setCandidate(json.vin);
        setEditValue(json.vin);
        setPhase("confirm");
        stopCamera();
        return;
      }
    } catch {
      // Sin conexión, timeout, Gemini no disponible, etc. -- no es grave,
      // se reintenta en el próximo ciclo. La persona siempre tiene el link
      // de escribir el VIN a mano si esto no da resultado.
    }
    if (activeRef.current) {
      scanTimerRef.current = setTimeout(runScanPass, SCAN_INTERVAL_MS);
    }
  }

  useEffect(() => {
    if (!open) return;
    activeRef.current = true;
    setCamError("");
    setScanning(false);
    setPhase("scanning");
    setCandidate("");
    setEditValue("");

    let cancelled = false;

    // 1920x1080 pedido "ideal" (el navegador da lo más cercano que la
    // cámara soporte) -- más resolución real de origen para que, incluso
    // reescalada antes de subir (ver captureFrameAsJpeg), la foto llegue
    // con buen detalle.
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } })
      .then((stream) => {
        if (!activeRef.current || cancelled) { stream.getTracks().forEach((tr) => tr.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setScanning(true);
            scanTimerRef.current = setTimeout(() => {
              if (activeRef.current) runScanPass();
            }, CAMERA_SETTLE_MS);
          };
        }
      })
      .catch(() => {
        setCamError(t("cameraDeniedMessage"));
      });

    return () => {
      cancelled = true;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleClose() {
    stopCamera();
    onClose();
  }

  function handleRetry() {
    setPhase("scanning");
    setCandidate("");
    setEditValue("");
    activeRef.current = true;
    // La cámara se cerró al confirmar un candidato (stopCamera en
    // runScanPass) -- reabrir desde cero es más simple y confiable que
    // tratar de reanudar el mismo stream.
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } })
      .then((stream) => {
        if (!activeRef.current) { stream.getTracks().forEach((tr) => tr.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setScanning(true);
            scanTimerRef.current = setTimeout(() => {
              if (activeRef.current) runScanPass();
            }, CAMERA_SETTLE_MS);
          };
        }
      })
      .catch(() => setCamError(t("cameraDeniedMessage")));
  }

  function handleGoManual() {
    stopCamera();
    setPhase("manual");
    setEditValue("");
  }

  function handleConfirmSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = normalizeVin(editValue);
    onConfirm(cleaned);
  }

  if (!open) return null;

  const normalizedEdit = normalizeVin(editValue);
  const formatOk = isVinFormatValid(normalizedEdit);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="shrink-0 flex items-center justify-between px-5 py-4" style={{ paddingTop: "max(env(safe-area-inset-top), 16px)" }}>
        <p className="text-white font-black text-[15px] flex items-center gap-2">
          <Car size={16} /> {t("title")}
        </p>
        <button onClick={handleClose} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center transition-all">
          <X size={20} className="text-white" />
        </button>
      </div>

      {phase === "scanning" && (
        <>
          <div className="flex-1 relative overflow-hidden">
            <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />

            {scanning && !camError && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="absolute inset-0 bg-black/50" />
                <div className="relative z-10 w-[86%] rounded-xl border-2 border-white/70" style={{ height: "22%" }}>
                  <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-red-500 rounded-tl-xl" />
                  <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-red-500 rounded-tr-xl" />
                  <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-red-500 rounded-bl-xl" />
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-red-500 rounded-br-xl" />
                </div>
              </div>
            )}

            {camError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-20 px-8 text-center">
                <div className="w-16 h-16 rounded-full bg-red-600/20 border border-red-500/40 flex items-center justify-center mb-4">
                  <Car size={28} className="text-red-400" />
                </div>
                <p className="text-white font-bold text-[16px] mb-2">{t("cameraUnavailable")}</p>
                <p className="text-white/60 text-[13px] leading-relaxed mb-6">{camError}</p>
                <button onClick={handleClose} className="bg-white text-zinc-900 font-bold px-6 py-3 rounded-xl text-[14px]">
                  {t("goBack")}
                </button>
              </div>
            )}

            {!scanning && !camError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                <p className="text-white/60 text-[13px]">{t("startingCamera")}</p>
              </div>
            )}
          </div>

          {scanning && !camError && (
            <div className="shrink-0 flex flex-col items-center gap-3 py-6 px-6 text-center" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}>
              <p className="text-white font-bold text-[15px]">{t("instructions")}</p>
              <p className="text-white/50 text-[12px]">{t("holdSteady")}</p>
              <button onClick={handleGoManual} className="flex items-center gap-2 text-white/70 hover:text-white text-[13px] font-semibold underline underline-offset-2 mt-1">
                <Keyboard size={14} /> {t("typeManually")}
              </button>
            </div>
          )}
        </>
      )}

      {(phase === "confirm" || phase === "manual") && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-1">
              {phase === "confirm"
                ? <CheckCircle2 size={18} className="text-green-600 shrink-0" />
                : <Keyboard size={18} className="text-zinc-500 shrink-0" />}
              <h3 className="text-[15px] font-black text-zinc-900">
                {phase === "confirm" ? t("confirmTitle") : t("manualTitle")}
              </h3>
            </div>
            <p className="text-[12px] text-zinc-500 mb-4">
              {phase === "confirm" ? t("confirmSubtitle") : t("manualSubtitle")}
            </p>

            <form onSubmit={handleConfirmSubmit}>
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">{t("vinFieldLabel")}</label>
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value.toUpperCase())}
                maxLength={17}
                autoFocus
                placeholder={t("vinFieldPlaceholder")}
                className="w-full bg-zinc-50 border border-zinc-200 focus:border-red-400 focus:bg-white rounded-xl px-4 py-3 text-[16px] tracking-wider font-mono text-zinc-900 placeholder-zinc-400 outline-none transition-all uppercase"
              />

              {editValue.length > 0 && !formatOk && (
                <p className="text-[11px] text-zinc-400 mt-1.5">{t("hintFormat", { count: normalizedEdit.length })}</p>
              )}

              <div className="flex gap-2 mt-5">
                {phase === "confirm" && (
                  <button type="button" onClick={handleRetry} className="flex items-center justify-center gap-1.5 border border-zinc-200 text-zinc-600 hover:bg-zinc-50 font-bold py-3 rounded-xl text-[13px] px-4">
                    <RotateCcw size={14} /> {t("retryButton")}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!formatOk}
                  className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-white font-black py-3 rounded-xl text-[14px]"
                >
                  {t("confirmButton")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
