// Incremento 29c (Facu, 31 jul 2026): después de mejorar la decodificación
// offline de marca/año (vinDecodeOffline.ts), Facu preguntó por qué ChatGPT
// "siempre encuentra" el VIN incluso de autos argentinos/australianos. La
// respuesta honesta: ChatGPT en una conversación tiene navegación web en
// vivo + conocimiento general, Y hay una persona (Facu) revisando la
// respuesta antes de confiar en ella. Automatizar eso mismo acá (sin
// revisión humana, auto-completando un campo) tiene riesgo real de
// inventar un modelo incorrecto.
//
// Se le presentaron 3 opciones a Facu (dejarlo como está / sumar una IA
// como respaldo, claramente marcada como sugerencia sin confirmar / evaluar
// un servicio pago con base de datos global real) y eligió la opción de
// IA. Este archivo es exactamente eso: SOLO se usa cuando NHTSA + la
// decodificación offline no llegaron a un dato (nunca para pisar un dato
// real). El resultado SIEMPRE viaja en campos separados (`aiSuggestedMake`
// / `aiSuggestedModel` en /api/decode-vin) que el formulario nunca
// autocompleta solo -- requiere un click explícito de la persona ("Usar")
// para pasar al campo correspondiente. Ver NewAssetModalIntl.tsx.
//
// Incremento 29d (Facu, 31 jul 2026): "quiero q usemos el q sea mas liviano
// o facil... si no tengo q estar pagando o abriendo cuentas es mejor" --
// se cambió de Anthropic (Claude) a Gemini (Google) porque la API de
// Gemini tiene un nivel gratuito real: no pide tarjeta ni cargar crédito,
// solo una cuenta de Google (que Facu ya tiene, es su Gmail). Anthropic en
// cambio exige cargar crédito mínimo antes de poder usar la API. Mismo
// patrón de siempre: sin la variable de entorno GEMINI_API_KEY configurada,
// esto no rompe nada, simplemente nunca hay sugerencia de IA disponible.
const MODEL = "gemini-2.5-flash"; // modelo estable de Google con nivel gratuito, alcanza de sobra para esto

// Incremento 29f (Facu, 31 jul 2026): "sigue sin encontrar la marca y
// modelo" incluso ya con GEMINI_API_KEY configurada y el bug de
// thinkingBudget resuelto. Causa más probable: se descartaba de entrada
// cualquier respuesta con confidence "low" -- pero un WMI realmente no
// cubierto por NHTSA NI por la tabla offline (justo el caso para el que
// existe este respaldo) es, casi por definición, un caso donde a la IA
// tampoco le va a sobrar confianza. El diseño original terminaba
// descartando la sugerencia exactamente en los casos donde más falta
// hacía. Como esto NUNCA se autocompleta solo (siempre requiere el click
// "Usar" del NewAssetModalIntl.tsx), no hay riesgo real en mostrar también
// una sugerencia de baja confianza -- la persona la ve, decide si le
// sirve o no. Se deja de usar confidence como filtro de todo o nada.
export type AiVinSuggestion = {
  make: string | null;
  model: string | null;
  confidence: "high" | "medium" | "low";
};

// Best-effort, nunca puede romper el flujo de decode-vin -- ver el catch
// interno de logServerError, que ya está pensado para esto.
async function logAiVinFailure(message: string, detail: string) {
  try {
    const { logServerError } = await import("@/lib/errorLog");
    await logServerError({
      source: "server",
      severity: "warning",
      message: `[aiVinModel] ${message}`,
      stack: detail || null,
      route: "/api/decode-vin",
    });
  } catch {
    // Si ni siquiera esto funciona (por ejemplo Supabase caído), no hay
    // nada más que hacer -- ya de por sí es un caso best-effort.
  }
}

// `knownMake` es opcional a propósito: si ya la sabemos (NHTSA o la tabla
// offline de WMI) se le da como contexto y solo se le pide MODELO -- pero si
// el WMI no está en ninguna de las dos fuentes (justo el caso "camioneta
// tailandesa/australiana no cubierta" que reportó Facu), se le pide que
// infiera AMBAS cosas a partir de la estructura del VIN y su conocimiento
// general de fabricantes.
export async function suggestVehicleFromVin(params: {
  vin: string;
  knownMake: string | null;
  knownYear: number | null;
}): Promise<AiVinSuggestion | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const { vin, knownMake, knownYear } = params;
  const yearLine = knownYear ? `Model year: ${knownYear}` : "Model year: unknown";
  const prompt = knownMake
    ? `You are helping identify a vehicle from its VIN (Vehicle Identification Number) for a maintenance-tracking app. The manufacturer is already known.

VIN: ${vin}
Make: ${knownMake}
${yearLine}

Based on the VIN structure (especially the VDS section, characters 4-8) and the known make, what is the most likely specific model (e.g. "Hilux", "Ranger", "Corolla")? This vehicle may be sold in any country, not just the US.

Respond with ONLY a JSON object, no other text, no markdown fences:
{"model": "<model name or null if you are not reasonably confident>", "confidence": "high" | "medium" | "low"}`
    : `You are helping identify a vehicle from its VIN (Vehicle Identification Number) for a maintenance-tracking app. Neither a free WMI lookup table nor the US NHTSA database recognized this VIN's manufacturer code (WMI, the first 3 characters) -- this is common for vehicles sold outside the US/Canada.

VIN: ${vin}
${yearLine}

Based on the WMI (first 3 characters: "${vin.slice(0, 3)}") and the rest of the VIN structure, what manufacturer and specific model is this most likely to be? This vehicle may be sold in any country (e.g. Argentina, Australia, Thailand-built export models).

Respond with ONLY a JSON object, no other text, no markdown fences:
{"make": "<manufacturer name or null if not reasonably confident>", "model": "<model name or null if not reasonably confident>", "confidence": "high" | "medium" | "low"}`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          // thinkingBudget: 0 -- gemini-2.5-flash "piensa" internamente antes
          // de responder por defecto, y esos tokens de pensamiento salen del
          // mismo presupuesto que maxOutputTokens. Sin esto, con un límite
          // chico (necesario para que esto sea rápido y barato) el modelo
          // gastaba TODO el presupuesto pensando y devolvía texto vacío --
          // por eso nunca aparecía la sugerencia de marca/modelo aunque la
          // clave estuviera bien configurada. No hace falta "pensar" para
          // esta tarea (identificar un fabricante a partir de un patrón de
          // caracteres), así que se desactiva por completo.
          generationConfig: { maxOutputTokens: 300, thinkingConfig: { thinkingBudget: 0 } },
        }),
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) {
      // Se guarda en el mismo panel de Errores que ya usa el resto de la
      // app (ver errorLog.ts) -- así, si esto vuelve a fallar en
      // producción, hay una forma real de ver por qué (clave inválida,
      // cuota agotada, modelo no disponible para esa clave, etc.) en vez
      // de tener que adivinar a ciegas como esta vez.
      const bodyText = await res.text().catch(() => "");
      void logAiVinFailure(`Gemini respondió ${res.status}`, bodyText.slice(0, 500));
      return null;
    }

    const json = await res.json();
    const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    // Por si el modelo agrega fences de markdown a pesar de que se le pidió
    // que no lo haga -- más robusto que fallar directamente.
    const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

    if (!cleaned) {
      void logAiVinFailure("Gemini devolvió texto vacío", JSON.stringify(json).slice(0, 500));
      return null;
    }

    const parsed = JSON.parse(cleaned);
    if (!parsed) return null;

    const make = knownMake || (typeof parsed.make === "string" && parsed.make.trim() ? parsed.make.trim() : null);
    const model = typeof parsed.model === "string" && parsed.model.trim() ? parsed.model.trim() : null;
    if (!make && !model) return null;

    const confidence: AiVinSuggestion["confidence"] =
      parsed.confidence === "high" || parsed.confidence === "medium" ? parsed.confidence : "low";
    return { make, model, confidence };
  } catch (err) {
    // Timeout, JSON inválido, API caída, etc. -- nunca debe romper el
    // formulario de creación de equipo, así que simplemente no hay
    // sugerencia esta vez. Igual que arriba, queda registrado.
    void logAiVinFailure("Excepción al llamar a Gemini", err instanceof Error ? err.message : String(err));
    return null;
  }
}
