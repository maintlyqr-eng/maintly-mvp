import { NextRequest, NextResponse } from "next/server";
import { isVinFormatValid, normalizeVin } from "@/lib/vinValidation";
import { decodeVinYear, decodeWmiMake } from "@/lib/vinDecodeOffline";
import { suggestVehicleFromVin } from "@/lib/aiVinModel";

// Incremento 29 (Facu, escaneo de VIN): "mandale a todo e incluso al
// decodificador de marca/año. asi la persona no tiene q cargar todo".
//
// Incremento 29b (Facu, 31 jul 2026): "seria bueno q use mejor sistema para
// encontrar el vehiculo xq estoy probando con una camioneta australiana y no
// lo encuentra, solo usa vehiculos de eeuu" -- NHTSA solo decodifica bien
// vehículos del mercado de EEUU. Ahora esto combina DOS fuentes en vez de
// una sola:
//
//   1. Decodificación offline de la ESTRUCTURA del VIN (marca por WMI, año
//      por la posición 10) -- ver vinDecodeOffline.ts. Funciona para
//      cualquier VIN del mundo, sin depender de ningún servicio externo.
//   2. NHTSA (vpic.nhtsa.dot.gov, gratis, sin API key) -- sigue siendo la
//      única fuente para el MODELO (ninguna estructura de VIN da eso sin una
//      base de datos por fabricante), y además puede confirmar/completar
//      marca y año cuando el vehículo sí está en su base.
//
// Se combinan dando prioridad a NHTSA cuando responde algo útil (viene de
// una base de datos real con más detalle), y usando el resultado offline
// como respaldo cuando NHTSA no tiene nada -- que es exactamente el caso
// "vehículo no vendido en EEUU" que reportó Facu. El offline nunca se llega
// a usar para MODELO porque no hay forma de derivarlo sin una base de datos
// propia por fabricante (fuera del alcance de esto, ver la respuesta a Facu
// para las opciones pagas si en algún momento se quiere cobertura completa).
//
// Deliberadamente sin auth -- es una consulta de solo lectura contra un
// servicio público externo, sin costo ni datos sensibles de por medio.
export async function GET(req: NextRequest) {
  const rawVin = req.nextUrl.searchParams.get("vin") ?? "";
  const vin = normalizeVin(rawVin);

  if (!isVinFormatValid(vin)) {
    return NextResponse.json({ error: "invalid_vin_format" }, { status: 400 });
  }

  const offlineMake = decodeWmiMake(vin);
  const offlineYear = decodeVinYear(vin, new Date().getFullYear());

  let nhtsaMake: string | null = null;
  let nhtsaModel: string | null = null;
  let nhtsaYear: number | null = null;
  let fuelTypePrimary: string | null = null;

  try {
    const res = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/decodevin/${encodeURIComponent(vin)}?format=json`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      const json = await res.json();
      const results: Array<{ Variable: string; Value: string | null }> = json?.Results ?? [];

      function field(variableName: string): string | null {
        const row = results.find((r) => r.Variable === variableName);
        const value = row?.Value?.trim();
        return value && value.toLowerCase() !== "not applicable" ? value : null;
      }

      nhtsaMake = field("Make");
      nhtsaModel = field("Model");
      const modelYearField = field("Model Year");
      nhtsaYear = modelYearField ? Number(modelYearField) : null;
      fuelTypePrimary = field("Fuel Type - Primary");
    }
  } catch {
    // Timeout, red caída del lado de NHTSA, etc. -- no es fatal, el
    // resultado offline (si hay algo) sigue sirviendo igual.
  }

  const make = nhtsaMake || offlineMake;
  const year = nhtsaYear || offlineYear;
  const model = nhtsaModel; // sin fuente offline posible, ver comentario de arriba

  // Incremento 29c (Facu, 31 jul 2026): "sumar una IA como respaldo para
  // modelo" -- se pide UNA vez, solo cuando falta algo que ni NHTSA ni la
  // tabla offline resolvieron. Si ya hay marca (de cualquiera de las dos
  // fuentes) pero no modelo, se le pide solo el modelo con esa marca como
  // contexto. Si NINGUNA fuente reconoció ni siquiera la marca (el caso
  // "camioneta no vendida en EEUU y WMI no está en la tabla offline" que
  // reportó Facu), se le pide que infiera marca Y modelo juntos. Nunca pisa
  // `make`/`model` acá -- viaja en campos separados que el formulario solo
  // usa si la persona hace click en "Usar" (ver NewAssetModalIntl.tsx).
  let aiSuggestedMake: string | null = null;
  let aiSuggestedModel: string | null = null;
  if (!make || !model) {
    const suggestion = await suggestVehicleFromVin({ vin, knownMake: make, knownYear: year });
    if (suggestion) {
      if (!make && suggestion.make) aiSuggestedMake = suggestion.make;
      if (!model && suggestion.model) aiSuggestedModel = suggestion.model;
    }
  }

  if (!make && !model && !year && !aiSuggestedMake && !aiSuggestedModel) {
    return NextResponse.json({ found: false });
  }

  return NextResponse.json({
    found: true,
    make,
    model,
    year,
    fuelType: fuelTypePrimary,
    aiSuggestedMake,
    aiSuggestedModel,
  });
}
