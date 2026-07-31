"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Car, X, Keyboard, CheckCircle2, RotateCcw, AlertTriangle } from "lucide-react";
import { extractVinCandidate, isVinChecksumPlausible, isVinFormatValid, normalizeVin } from "@/lib/vinValidation";

// Incremento 29 (Facu, escaneo de VIN): "que con la camara podamos leer el
// vin de la puerta del auto". A diferencia de QRScannerModal (que usa jsQR,
// un lector de códigos hecho para eso, casi sin margen de error), acá
// estamos leyendo texto impreso con OCR genérico (Tesseract.js, corre
// entero en el navegador, la foto nunca sale del teléfono) -- mucho menos
// confiable que un QR: le afectan el reflejo de la chapa metálica, el
// ángulo, la luz, el desgaste. Por eso el diseño de este componente parte
// de la base de que el OCR se va a equivocar seguido, y arma una red de
// seguridad en dos capas:
//   1. Nunca confirma solo -- apenas "cree" haber encontrado un VIN, para
//      de escanear y se lo muestra a la persona en un campo editable para
//      que confirme o corrija antes de seguir.
//   2. isVinChecksumPlausible (ver vinValidation.ts) da una pista extra,
//      pero NUNCA bloquea -- muchos VIN de autos de mercado
//      argentino/latinoamericano no van a pasar esa cuenta aunque estén
//      perfectos, porque ese dígito verificador es una exigencia de EEUU,
//      no un estándar universal.
//
// Siempre hay, además, un link para escribir el VIN a mano sin cámara --
// para cuando la chapa está en mal estado o el OCR simplemente no da.
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
  const workerRef = useRef<any>(null);
  const ocrTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function stopCamera() {
    activeRef.current = false;
    if (streamRef.current) { streamRef.current.getTracks().forEach((tr) => tr.stop()); streamRef.current = null; }
    if (ocrTimerRef.current) { clearTimeout(ocrTimerRef.current); ocrTimerRef.current = null; }
  }

  async function stopWorker() {
    if (workerRef.current) {
      try { await workerRef.current.terminate(); } catch { /* ya terminado o nunca llegó a inicializar */ }
      workerRef.current = null;
    }
  }

  // Recorta solo la franja central (donde está la guía en pantalla) en vez
  // de mandarle el cuadro entero a Tesseract -- más rápido, y el OCR
  // rinde mejor cuando el texto ocupa la mayor parte de la imagen en vez
  // de ser una franja chiquita perdida en medio de una foto grande.
  function captureGuideStrip(): HTMLCanvasElement | null {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) return null;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    // Misma proporción que el recuadro guía renderizado abajo (86% ancho,
    // banda angosta al centro).
    const stripW = vw * 0.86;
    const stripH = vh * 0.22;
    const sx = (vw - stripW) / 2;
    const sy = (vh - stripH) / 2;

    canvas.width = stripW;
    canvas.height = stripH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, sx, sy, stripW, stripH, 0, 0, stripW, stripH);

    // Blanco y negro a puro contraste -- ayuda bastante al OCR con texto
    // grabado/estampado en metal, que suele tener poco contraste de por sí.
    const imgData = ctx.getImageData(0, 0, stripW, stripH);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const bw = gray > 130 ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = bw;
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  // IMPORTANTE: esta función se auto-reprograma con setTimeout(runOcrPass,
  // ...) -- es la MISMA closure la que se vuelve a llamar a sí misma en
  // cada ciclo, nunca una versión "fresca" ligada al render más reciente.
  // Por eso el único gate que puede usar de forma confiable es activeRef
  // (un ref, siempre lee el valor actual) -- si acá adentro se llegara a
  // leer `phase` (estado de React) para decidir si seguir, quedaría
  // pegado para siempre al valor que tenía la primera vez que se creó esta
  // closure (por ejemplo, después de un Reintentar el estado ya volvió a
  // "scanning" pero esta función seguiría viendo "confirm" y se cortaría
  // sola sin volver a escanear). activeRef.current ya se pone en false
  // exactamente en los 3 casos donde este loop tiene que parar (VIN
  // encontrado, se pasó a carga manual, o se cerró el modal), así que
  // alcanza como único gate.
  async function runOcrPass() {
    if (!activeRef.current) return;
    const strip = captureGuideStrip();
    if (!strip || !workerRef.current) {
      if (activeRef.current) ocrTimerRef.current = setTimeout(runOcrPass, 700);
      return;
    }

    try {
      const { data } = await workerRef.current.recognize(strip);
      const found = extractVinCandidate(data?.text ?? "");
      if (found && activeRef.current) {
        setCandidate(found);
        setEditValue(found);
        setPhase("confirm");
        stopCamera();
        return;
      }
    } catch {
      // Un fallo puntual de reconocimiento no es grave -- se reintenta en
      // el próximo ciclo. Si Tesseract nunca llegó a cargar (ver el
      // catch del useEffect de abajo), esta función ni se llama.
    }
    if (activeRef.current) {
      ocrTimerRef.current = setTimeout(runOcrPass, 1200);
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

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then(async (stream) => {
        if (!activeRef.current || cancelled) { stream.getTracks().forEach((tr) => tr.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setScanning(true);
          };
        }

        // Tesseract se carga dinámicamente (igual que jsQR en
        // QRScannerModal) -- así ninguna otra página paga el costo de este
        // paquete pesado si nunca abre el escáner de VIN.
        try {
          const { createWorker } = await import("tesseract.js");
          const worker = await createWorker("eng");
          if (cancelled || !activeRef.current) { await worker.terminate(); return; }
          workerRef.current = worker;
          runOcrPass();
        } catch {
          // No se pudo inicializar el OCR (sin conexión para bajar los
          // datos del idioma, navegador viejo, etc.) -- no rompe el
          // escáner, simplemente nunca va a "encontrar" nada solo, y la
          // persona igual tiene el link de escribirlo a mano.
        }
      })
      .catch(() => {
        setCamError(t("cameraDeniedMessage"));
      });

    return () => {
      cancelled = true;
      stopCamera();
      stopWorker();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleClose() {
    stopCamera();
    stopWorker();
    onClose();
  }

  function handleRetry() {
    setPhase("scanning");
    setCandidate("");
    setEditValue("");
    activeRef.current = true;
    // La cámara se cerró al confirmar un candidato (stopCamera en
    // runOcrPass) -- reabrir desde cero es más simple y confiable que
    // tratar de reanudar el mismo stream.
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then((stream) => {
        if (!activeRef.current) { stream.getTracks().forEach((tr) => tr.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setScanning(true);
            runOcrPass();
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
  const checksumOk = formatOk && isVinChecksumPlausible(normalizedEdit);

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
              {formatOk && !checksumOk && (
                <div className="flex items-start gap-1.5 mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-amber-700 leading-snug">{t("checksumHint")}</p>
                </div>
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
