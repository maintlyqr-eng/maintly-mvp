import { NextRequest, NextResponse } from "next/server";
import { isVinFormatValid, normalizeVin } from "@/lib/vinValidation";

// Incremento 29 (Facu, escaneo de VIN): "mandale a todo e incluso al
// decodificador de marca/año. asi la persona no tiene q cargar todo".
//
// GET /api/decode-vin?vin=XXXXXXXXXXXXXXXXX
// Proxy hacia el decodificador público y gratuito de VIN de NHTSA (agencia
// de EEUU, vpic.nhtsa.dot.gov) -- no hace falta API key. Se llama desde acá
// (servidor) en vez de directo desde el navegador para no depender de que
// ese dominio tenga CORS habilitado siempre, y para tener un solo lugar
// donde ajustar esto si en el futuro cambia de proveedor.
//
// OJO cobertura (avisado a Facu antes de implementar esto): el WMI
// (los primeros 3 caracteres del VIN) es un registro administrado por SAE
// a nivel mundial, así que en general reconoce fabricantes globales (Ford,
// Toyota, VW, Chevrolet, etc.) -- pero como la base de NHTSA está pensada
// para el mercado de EEUU, un vehículo de fabricación/mercado
// específicamente argentino o de otro país de la región puede no
// decodificar bien, o devolver campos vacíos. Por eso esto SIEMPRE se trata
// como una sugerencia editable en el formulario, nunca como un dato
// definitivo -- ver NewAssetModalIntl.tsx.
//
// Deliberadamente sin auth -- es una consulta de solo lectura contra un
// servicio público externo, sin costo ni datos sensibles de por medio.
export async function GET(req: NextRequest) {
  const rawVin = req.nextUrl.searchParams.get("vin") ?? "";
  const vin = normalizeVin(rawVin);

  if (!isVinFormatValid(vin)) {
    return NextResponse.json({ error: "invalid_vin_format" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${encodeURIComponent(vin)}?format=json`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) {
      return NextResponse.json({ error: "decoder_unavailable" }, { status: 502 });
    }
    const json = await res.json();
    const results: Array<{ Variable: string; Value: string | null }> = json?.Results ?? [];

    function field(variableName: string): string | null {
      const row = results.find((r) => r.Variable === variableName);
      const value = row?.Value?.trim();
      return value && value.toLowerCase() !== "not applicable" ? value : null;
    }

    const make = field("Make");
    const model = field("Model");
    const modelYear = field("Model Year");
    const fuelTypePrimary = field("Fuel Type - Primary");

    // Sin match útil (VIN válido en formato pero el WMI no está en la base
    // de NHTSA -- exactamente el caso "mercado no-EEUU" del comentario de
    // arriba) -- se devuelve found:false en vez de un objeto con todo null,
    // para que el formulario sepa que no hay nada para autocompletar.
    if (!make && !model && !modelYear) {
      return NextResponse.json({ found: false });
    }

    return NextResponse.json({
      found: true,
      make,
      model,
      year: modelYear ? Number(modelYear) : null,
      fuelType: fuelTypePrimary,
    });
  } catch {
    // Timeout, red caída del lado de NHTSA, etc. -- nunca debería romper el
    // formulario de creación, así que se devuelve "no encontrado" en vez de
    // un 500 que el cliente tendría que andar manejando como caso especial.
    return NextResponse.json({ found: false });
  }
}
