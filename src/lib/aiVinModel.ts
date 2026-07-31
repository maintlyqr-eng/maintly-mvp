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
// IA. Este archivo es exactamente eso: SOLO se usa cuando NHTSA no devolvió
// modelo (nunca para pisar un dato real de una base de datos), y el
// resultado SIEMPRE viaja en un campo separado (`aiSuggestedModel` en
// /api/decode-vin) que el formulario nunca autocompleta solo -- requiere un
// click explícito de la persona ("Usar") para pasar al campo Modelo. Ver
// NewAssetModalIntl.tsx.
//
// Requiere la variable de entorno ANTHROPIC_API_KEY (mismo patrón que
// RESEND_API_KEY: sin configurar, esto no rompe nada, simplemente nunca
// hay sugerencia de IA disponible).
const MODEL = "claude-haiku-4-5"; // rápido y barato -- alcanza de sobra para esto, no hace falta un modelo más grande

export type AiVinModelSuggestion = { model: string; confidence: "high" | "medium" };

export async function suggestVehicleModelFromVin(params: {
  vin: string;
  make: string;
  year: number | null;
}): Promise<AiVinModelSuggestion | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const { vin, make, year } = params;
  const prompt = `You are helping identify a vehicle from its VIN (Vehicle Identification Number) for a maintenance-tracking app. The manufacturer is already known.

VIN: ${vin}
Make: ${make}
${year ? `Model year: ${year}` : "Model year: unknown"}

Based on the VIN structure (especially the VDS section, characters 4-8) and the known make, what is the most likely specific model (e.g. "Hilux", "Ranger", "Corolla")? This vehicle may be sold in any country, not just the US.

Respond with ONLY a JSON object, no other text, no markdown fences:
{"model": "<model name or null if you are not reasonably confident>", "confidence": "high" | "medium" | "low"}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 100,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;

    const json = await res.json();
    const text: string = json?.content?.[0]?.text ?? "";
    // Por si el modelo agrega fences de markdown a pesar de que se le pidió
    // que no lo haga -- más robusto que fallar directamente.
    const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

    const parsed = JSON.parse(cleaned);
    if (
      parsed &&
      typeof parsed.model === "string" &&
      parsed.model.trim() &&
      (parsed.confidence === "high" || parsed.confidence === "medium")
    ) {
      // "low" se descarta a propósito -- si ni la IA está segura, no vale
      // la pena mostrárselo a la persona como sugerencia.
      return { model: parsed.model.trim(), confidence: parsed.confidence };
    }
    return null;
  } catch {
    // Timeout, JSON inválido, API caída, etc. -- nunca debe romper el
    // formulario de creación de equipo, así que simplemente no hay
    // sugerencia esta vez.
    return null;
  }
}
