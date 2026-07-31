import { NextRequest, NextResponse } from "next/server";
import { extractVinCandidate, isVinFormatValid } from "@/lib/vinValidation";
import { logServerError } from "@/lib/errorLog";

// Incremento 29g (Facu, 31 jul 2026): "poder sacarle una foto con la camara
// y q la IA haga todo el laburo de reconocer q es VIN... yo cuando le saco
// una foto a algo chatgpt o gemini se da cuenta cual es el VIN". Reemplaza
// por completo el enfoque anterior (Tesseract.js, OCR genérico corriendo en
// el navegador -- ver el historial de VinScannerModal.tsx) por reconocimiento
// real de imagen vía Gemini (la misma API/clave que ya se usa en
// aiVinModel.ts para sugerir marca/modelo). A diferencia de un OCR genérico,
// un modelo de visión entiende la FOTO como foto: encuentra la chapa del
// VIN aunque no esté perfectamente encuadrada, ignora texto irrelevante
// alrededor, y tolera mucho mejor reflejos/ángulo -- exactamente lo que
// Facu describía.
//
// Trade-off explícito, comunicado y aceptado por Facu antes de este cambio:
// la foto ya NO se procesa 100% en el teléfono -- viaja a este endpoint y de
// acá a la API de Gemini para ser analizada. Sigue sin costo mientras se
// mantenga dentro del nivel gratuito de Gemini.
//
// Deliberadamente sin auth, igual que decode-vin -- es un anexo de lectura
// (analizar una foto y devolver un posible VIN) sin escribir nada ni
// exponer datos sensibles de la cuenta.
const MODEL = "gemini-2.5-flash";
const MAX_IMAGE_BASE64_CHARS = 8_000_000; // ~6MB de imagen real -- de sobra para un frame de cámara, evita abuso

const PROMPT = `You are looking at a photo taken by someone trying to scan a vehicle's VIN (Vehicle Identification Number) plate for a maintenance-tracking app.

Find the VIN in this photo if it is visible and legible. A VIN is always exactly 17 characters (letters and digits), and never contains the letters I, O, or Q (they're excluded from the standard to avoid confusion with 1 and 0). It's typically stamped on a metal plate visible through the windshield on the dashboard, on a sticker/plate on the driver's-side door jamb, or engraved on the engine bay firewall.

If you can clearly read a 17-character VIN in the photo, respond with it. If the photo doesn't contain a readable VIN (wrong angle, too blurry, not a vehicle, etc.), say so honestly instead of guessing.

Respond with ONLY a JSON object, no other text, no markdown fences:
{"vin": "<the 17-character VIN exactly as it appears, or null if you can't confidently read one>"}`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Mismo patrón "no-op si falta configuración" del resto de la app --
    // pero acá SÍ importa avisarle al que llama (a diferencia de
    // aiVinModel.ts, que es un simple respaldo opcional): sin esto, el
    // escaneo por cámara directamente no tiene otro camino, ya que
    // reemplazó al OCR local.
    return NextResponse.json({ error: "ai_unavailable" }, { status: 503 });
  }

  let body: { image?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const image = body.image;
  if (!image || typeof image !== "string" || image.length > MAX_IMAGE_BASE64_CHARS) {
    return NextResponse.json({ error: "invalid_image" }, { status: 400 });
  }
  // El frontend manda el data URL completo (data:image/jpeg;base64,....) --
  // a Gemini solo le corresponde la parte después de la coma.
  const base64Data = image.includes(",") ? image.slice(image.indexOf(",") + 1) : image;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: "image/jpeg", data: base64Data } },
                { text: PROMPT },
              ],
            },
          ],
          // Mismo motivo que en aiVinModel.ts: sin esto, el modelo puede
          // gastar todo el presupuesto de tokens "pensando" y devolver
          // texto vacío. Leer un VIN de una foto no necesita razonamiento.
          generationConfig: { maxOutputTokens: 150, thinkingConfig: { thinkingBudget: 0 } },
        }),
        signal: AbortSignal.timeout(15000), // una foto tarda más que solo texto -- más margen que aiVinModel.ts
      }
    );

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      await logServerError({
        source: "server",
        severity: "warning",
        message: `[scan-vin-photo] Gemini respondió ${res.status}`,
        stack: bodyText.slice(0, 500),
        route: "/api/scan-vin-photo",
      });
      return NextResponse.json({ found: false });
    }

    const json = await res.json();
    const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    if (!cleaned) return NextResponse.json({ found: false });

    let parsed: { vin?: unknown };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json({ found: false });
    }

    const rawVin = typeof parsed.vin === "string" ? parsed.vin : "";
    // Se reutiliza exactamente la misma limpieza/validación que antes usaba
    // el resultado de Tesseract -- así el candidato que llega al frontend
    // siempre tiene la forma correcta (17 caracteres, alfabeto de VIN), sea
    // cual sea la fuente.
    const candidate = rawVin ? extractVinCandidate(rawVin) : null;
    if (!candidate || !isVinFormatValid(candidate)) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({ found: true, vin: candidate });
  } catch (err) {
    await logServerError({
      source: "server",
      severity: "warning",
      message: "[scan-vin-photo] Excepción al llamar a Gemini",
      stack: err instanceof Error ? err.message : String(err),
      route: "/api/scan-vin-photo",
    });
    return NextResponse.json({ found: false });
  }
}
