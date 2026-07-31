// Incremento 29 (Facu, escaneo de VIN): validación y limpieza del VIN
// (Vehicle Identification Number) — usado tanto por el OCR de la cámara
// (VinScannerModal.tsx) como por el campo manual de "crear equipo"
// (NewAssetModalIntl.tsx), para que ambos caminos apliquen exactamente las
// mismas reglas.

// Solo automotive/motorcycle tienen VIN -- el resto (generador, maquinaria,
// embarcación, aviación) no. Compartido acá para que tanto el formulario de
// creación como el escáner de Home usen el mismo criterio.
export const VIN_ELIGIBLE_ASSET_TYPES = ["automotive", "motorcycle"];

// El alfabeto de un VIN excluye I, O, Q a propósito (estándar ISO 3779) --
// se prestan a confundirse con 1 y 0. Se usa tanto para validar formato
// como para limpiar ruido típico del OCR (ver normalizeVinCandidate).
const VIN_CHARSET = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
const VIN_SHAPE_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

// Sube a mayúsculas y saca espacios/guiones -- ni la cámara ni la persona
// tipeando van a respetar el formato exacto siempre.
export function normalizeVin(raw: string): string {
  return raw.toUpperCase().replace(/[\s-]/g, "");
}

export function isVinFormatValid(vin: string): boolean {
  return VIN_SHAPE_RE.test(vin);
}

// Tabla de transliteración + pesos del dígito verificador (posición 9),
// estándar ISO 3779 / FMVSS 115. OJO: este dígito verificador es una
// exigencia de EEUU/Canadá -- un VIN de un auto de mercado argentino o
// europeo puede ser 100% correcto y aun así "fallar" esta cuenta, porque
// nunca se calculó así en primer lugar. Por eso este chequeo se usa solo
// como pista suave en la UI ("no pudimos confirmar este VIN, revisalo"),
// NUNCA para bloquear ni marcar como inválido -- ver el comentario en
// VinScannerModal.tsx donde se usa.
const TRANSLITERATION: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};
const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

export function isVinChecksumPlausible(vin: string): boolean {
  if (!isVinFormatValid(vin)) return false;
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const c = vin[i];
    const value = c >= "0" && c <= "9" ? Number(c) : TRANSLITERATION[c];
    if (value === undefined) return false;
    sum += value * WEIGHTS[i];
  }
  const remainder = sum % 11;
  const expected = remainder === 10 ? "X" : String(remainder);
  return vin[8] === expected;
}

// Usado por el OCR (VinScannerModal) para extraer un candidato de VIN de
// texto reconocido que puede venir con basura alrededor (saltos de línea,
// otros caracteres de la chapita, confusión O/0 o I/1). No es magia -- solo
// junta letras/dígitos válidos y recorta a 17, así que sigue dependiendo de
// que la persona confirme antes de guardar (ver VinScannerModal.tsx).
export function extractVinCandidate(ocrText: string): string | null {
  const cleaned = normalizeVin(ocrText).replace(/[^A-Z0-9]/g, "");

  // Primer intento: una corrida de 17 caracteres que YA respeta el
  // alfabeto de VIN (sin I/O/Q) -- el caso limpio.
  const direct = cleaned.match(new RegExp(`[${VIN_CHARSET}]{17}`));
  if (direct) return direct[0];

  // Segundo intento: el OCR es tesseract genérico (no entrenado
  // específicamente para VIN), así que confunde bastante seguido O~0, I~1,
  // Q~0 -- son justo las 3 letras que el estándar excluye. Se busca
  // cualquier corrida de 17 alfanuméricos comunes y se corrigen esas 3
  // confusiones antes de descartarla.
  const loose = cleaned.match(/[A-Z0-9]{17}/);
  if (!loose) return null;
  const corrected = loose[0].replace(/O/g, "0").replace(/I/g, "1").replace(/Q/g, "0");
  return isVinFormatValid(corrected) ? corrected : null;
}
