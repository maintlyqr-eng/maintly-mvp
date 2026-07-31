"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Car, X, Keyboard, CheckCircle2, RotateCcw } from "lucide-react";
import { extractVinCandidate, isVinFormatValid, normalizeVin } from "@/lib/vinValidation";

// Incremento 29 (Facu, escaneo de VIN): "que con la camara podamos leer el
// vin de la puerta del auto". A diferencia de QRScannerModal (que usa jsQR,
// un lector de códigos hecho para eso, casi sin margen de error), acá
// estamos leyendo texto impreso con OCR genérico (Tesseract.js, corre
// entero en el navegador, la foto nunca sale del teléfono) -- mucho menos
// confiable que un QR: le afectan el reflejo de la chapa metálica, el
// ángulo, la luz, el desgaste. Por eso el diseño de este componente NUNCA
// confirma solo -- apenas "cree" haber encontrado un VIN, para de escanear
// y se lo muestra a la persona en un campo editable para que confirme o
// corrija antes de seguir.
//
// Incremento 29e (Facu, 31 jul 2026): "no me gusta ese cartel q dice algo
// de los vehiculos de eeuu, no quiero cartelitos q puedan confundir.
// hagamos simple todo" -- antes había acá un aviso amarillo cuando
// isVinChecksumPlausible (ver vinValidation.ts) no podía confirmar el
// dígito verificador, explicando que eso es normal fuera de EEUU. Aunque
// técnicamente correcto, era un detalle que no le sirve a la persona que
// está cargando un vehículo -- se sacó ese cartel por completo (la función
// isVinChecksumPlausible en sí sigue existiendo por si hace falta en el
// futuro, simplemente no se muestra nada con su resultado acá). El único
// chequeo que sigue importando para la persona es el de FORMATO (17
// caracteres válidos) -- ver hintFormat más abajo.
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

  // Facu (31 jul 2026): "es bastante celoso... no se toma su tiempo para
  // encontrar bien el VIN" -- antes, UNA sola lectura de Tesseract que
  // pareciera un VIN válido alcanzaba para pasar a confirmar, así que un
  // solo cuadro fuera de foco (típico apenas se abre la cámara, mientras
  // todavía está enfocando) podía disparar un candidato equivocado sin
  // darle tiempo real al OCR de "asentarse". Ahora se exige que el MISMO
  // candidato salga en 2 pasadas consecutivas antes de aceptarlo -- si
  // cambia entre pasada y pasada, se reinicia el conteo. Nunca se lee vía
  // useState acá adentro por la misma razón que activeRef (ver el comentario
  // grande más abajo sobre runOcrPass): son refs para que la closure
  // autoreprogramada siempre vea el valor real más reciente.
  // Facu (31 jul 2026, segunda ronda): "no me toma ni el q esta en el
  // parabrisas ni los q estan en la puerta" -- pedir 2 lecturas IDÉNTICAS
  // seguidas resultó ser demasiado estricto para una chapa real (vidrio con
  // reflejo, metal estampado con poco contraste): en vez de frenar
  // candidatos apurados, terminó impidiendo confirmar CUALQUIER lectura.
  // Vuelve a 1 -- la mejora real de precisión queda en el whitelist de
  // caracteres (ver más abajo) y el respiro de 900ms para el autoenfoque,
  // sin el costo de "nunca encuentra nada".
  const lastCandidateRef = useRef("");
  const candidateStreakRef = useRef(0);
  const REQUIRED_CONSECUTIVE_MATCHES = 1;

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

  // Facu (31 jul, tercera ronda): "la camara no agarra bien el VIN, como q
  // lo lee bastante mal". El umbral fijo de blanco/negro (antes: gris > 130
  // = blanco) funciona mal apenas cambia la luz o hay reflejo en la chapa --
  // lo que es exactamente "iluminación variable de una chapa de auto real".
  // Se reemplaza por el método de Otsu: calcula el umbral ÓPTIMO para cada
  // imagen en base a su propio histograma de grises, en vez de adivinar un
  // número fijo que sirve para algunas fotos y para otras no. Es una técnica
  // estándar de procesamiento de imágenes (no un ajuste a ojo), así que no
  // tiene el riesgo de "sobre-ajustar a mi propia intuición" que tuvo el
  // cambio de PSM/consenso anterior.
  function otsuThreshold(hist: number[], total: number): number {
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0;
    let weightBg = 0;
    let maxVariance = 0;
    let threshold = 130; // respaldo razonable si el cálculo no encuentra nada mejor
    for (let t = 0; t < 256; t++) {
      weightBg += hist[t];
      if (weightBg === 0) continue;
      const weightFg = total - weightBg;
      if (weightFg === 0) break;
      sumB += t * hist[t];
      const meanBg = sumB / weightBg;
      const meanFg = (sum - sumB) / weightFg;
      const variance = weightBg * weightFg * (meanBg - meanFg) * (meanBg - meanFg);
      if (variance > maxVariance) {
        maxVariance = variance;
        threshold = t;
      }
    }
    return threshold;
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
    // El umbral ya no es un número fijo (ver otsuThreshold arriba).
    const imgData = ctx.getImageData(0, 0, stripW, stripH);
    const d = imgData.data;
    const pixelCount = stripW * stripH;
    const gray = new Uint8ClampedArray(pixelCount);
    const hist = new Array(256).fill(0);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      gray[p] = g;
      hist[gray[p]]++;
    }
    const threshold = otsuThreshold(hist, pixelCount);
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const bw = gray[p] > threshold ? 255 : 0;
      d[i] = d[i + 1] = d[i + 2] = bw;
    }
    ctx.putImageData(imgData, 0, 0);

    // Si la franja recortada queda con poca altura real en píxeles (típico
    // si la persona sostiene el teléfono lejos de la chapa), Tesseract lee
    // mucho peor letras chiquitas -- es una limitación conocida de OCR en
    // general, no algo específico de este VIN. Se agranda la imagen antes
    // de mandarla (con "vecino más cercano", no suavizado, para no volver
    // borrosos los bordes ya binarizados en blanco/negro).
    const MIN_STRIP_HEIGHT = 200;
    if (stripH < MIN_STRIP_HEIGHT) {
      const scale = MIN_STRIP_HEIGHT / stripH;
      const upscaled = document.createElement("canvas");
      upscaled.width = Math.round(stripW * scale);
      upscaled.height = Math.round(stripH * scale);
      const upCtx = upscaled.getContext("2d");
      if (upCtx) {
        upCtx.imageSmoothingEnabled = false;
        upCtx.drawImage(canvas, 0, 0, upscaled.width, upscaled.height);
        return upscaled;
      }
    }

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
        // Pide 2 lecturas seguidas iguales antes de aceptar (ver el
        // comentario junto a la declaración de estos refs) -- un candidato
        // que cambia de una pasada a la siguiente todavía no es confiable.
        if (found === lastCandidateRef.current) {
          candidateStreakRef.current += 1;
        } else {
          lastCandidateRef.current = found;
          candidateStreakRef.current = 1;
        }
        if (candidateStreakRef.current >= REQUIRED_CONSECUTIVE_MATCHES) {
          setCandidate(found);
          setEditValue(found);
          setPhase("confirm");
          stopCamera();
          return;
        }
      } else {
        lastCandidateRef.current = "";
        candidateStreakRef.current = 0;
      }
    } catch {
      // Un fallo puntual de reconocimiento no es grave -- se reintenta en
      // el próximo ciclo. Si Tesseract nunca llegó a cargar (ver el
      // catch del useEffect de abajo), esta función ni se llama.
      lastCandidateRef.current = "";
      candidateStreakRef.current = 0;
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
    lastCandidateRef.current = "";
    candidateStreakRef.current = 0;

    let cancelled = false;

    // 1920x1080 en vez de 1280x720 (pedido "ideal", el navegador da lo más
    // cercano que la cámara soporte): más resolución real de origen = más
    // píxeles reales por letra del VIN una vez recortada la franja central,
    // que es justo lo que más ayuda al OCR con texto chico (ver también el
    // reescalado en captureGuideStrip más abajo).
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } })
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

          // Facu (31 jul 2026): por default Tesseract intenta reconocer
          // CUALQUIER letra/número/símbolo del idioma inglés, lo que deja
          // pasar muchas lecturas erróneas que dan la casualidad de
          // "parecer" un VIN de 17 caracteres. Restringir el alfabeto a
          // exactamente el que usa un VIN (sin I/O/Q, ver vinValidation.ts)
          // hace que el motor de OCR en sí mismo descarte esas confusiones.
          //
          // OJO -- había además un modo de segmentación forzado a
          // "una sola línea de texto" (PSM.SINGLE_LINE), pensado para que
          // rinda mejor con la franja recortada (ver captureGuideStrip).
          // En la práctica resultó demasiado rígido: si el recorte no
          // queda perfectamente alineado sobre SOLO el VIN (típico en una
          // chapa real, con otro texto cerca, reflejos del vidrio del
          // parabrisas, etc.), ese modo fuerza una lectura de una sola
          // línea de TODO ese ruido junto y nunca llega a ningún candidato
          // válido -- exactamente el reporte de Facu de "no me toma
          // ninguno". Se sacó, volviendo al modo de segmentación automático
          // por default, más tolerante a un recorte imperfecto.
          try {
            await worker.setParameters({
              tessedit_char_whitelist: "ABCDEFGHJKLMNPRSTUVWXYZ0123456789",
            });
          } catch {
            // Si esta versión de Tesseract.js no acepta este parámetro,
            // sigue funcionando con los defaults -- no es crítico, solo una
            // mejora de precisión.
          }

          workerRef.current = worker;

          // Facu: "es bastante celoso cuando se abre la cámara... no se
          // toma su tiempo" -- la cámara recién arranca a enfocar/exponer
          // en el instante en que este código corre; leer el primer cuadro
          // sin darle un respiro a la cámara para asentarse era la causa
          // más probable de lecturas apuradas y erróneas. 900ms es
          // imperceptible para la persona pero le da tiempo real al
          // autoenfoque antes del primer intento de OCR.
          ocrTimerRef.current = setTimeout(() => {
            if (activeRef.current) runOcrPass();
          }, 900);
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
    lastCandidateRef.current = "";
    candidateStreakRef.current = 0;
    // La cámara se cerró al confirmar un candidato (stopCamera en
    // runOcrPass) -- reabrir desde cero es más simple y confiable que
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
            // Mismo respiro de 900ms para el autoenfoque que en el arranque
            // inicial (ver el comentario grande en el useEffect de arriba).
            ocrTimerRef.current = setTimeout(() => {
              if (activeRef.current) runOcrPass();
            }, 900);
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
