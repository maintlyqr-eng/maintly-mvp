// Incremento 29b (Facu, 31 jul 2026): "seria bueno q use mejor sistema para
// encontrar el vehiculo xq estoy probando con una camioneta australiana y no
// lo encuentra, solo usa vehiculos de eeuu" -- el decodificador de NHTSA
// (decode-vin/route.ts) es la base de datos oficial del gobierno de EEUU, así
// que decodifica bien marca/modelo/año de vehículos vendidos en EEUU, pero no
// tiene por qué saber nada de una camioneta armada en Tailandia y vendida en
// Australia o Argentina.
//
// Este archivo decodifica dos cosas directamente de la ESTRUCTURA del VIN
// (ISO 3779), sin depender de ninguna base de datos externa -- funcionan
// para un VIN de cualquier mercado del mundo, no solo EEUU:
//
//   1. AÑO MODELO (posición 10) -- universal, parte del propio estándar
//      internacional, no una particularidad de EEUU/Canadá (a diferencia
//      del dígito verificador de la posición 9, que sí lo es -- ver
//      vinValidation.ts).
//   2. FABRICANTE (WMI, posiciones 1-3) -- también universal en el sentido
//      de que SAE administra los códigos a nivel mundial, pero acá sí hace
//      falta una tabla real de códigos↔fabricante, y esa tabla no viene
//      integrada en ningún estándar que se pueda calcular -- hay que
//      conocerla. La tabla de abajo es un resumen armado a partir de
//      fuentes públicas (Wikibooks "Vehicle Identification Numbers (VIN
//      codes)" y agregadores de decodificadores de VIN), pensado para cubrir
//      los fabricantes más comunes a nivel global -- pero NO es la base de
//      datos oficial de SAE (que es paga) y no es exhaustiva. Si el WMI de
//      un VIN puntual no está acá, decodeWmiMake devuelve null sin más
//      (nunca "adivina").
//
// Ambos resultados se tratan igual que el resto del feature de VIN: son
// sugerencias editables, nunca autoritativas -- ver NewAssetModalIntl.tsx,
// que solo los usa para autocompletar campos que la persona dejó vacíos.
import { isVinFormatValid } from "./vinValidation";

// ── AÑO MODELO (posición 10, índice 9) ──────────────────────────────────────
//
// El código cicla cada 30 años usando el mismo alfabeto (excluye I/O/Q, más
// U, Z y el dígito 0, que tampoco se usan acá) -- por eso cada letra/dígito
// corresponde a dos años posibles (ej. "L" = 1990 o 2020). Como MaintlyQR es
// una plataforma de mantenimiento de equipos EN USO, no de autos de colección,
// se elige siempre el año más reciente de los dos que no sea futuro respecto
// de hoy -- una heurística razonable y declarada como tal, nunca presentada
// como un hecho certero (mismo criterio que isVinChecksumPlausible).
const YEAR_CODES = "ABCDEFGHJKLMNPRSTVWXY123456789";

export function decodeVinYear(vin: string, referenceYear: number): number | null {
  if (!isVinFormatValid(vin)) return null;
  const code = vin[9];
  const idx = YEAR_CODES.indexOf(code);
  if (idx === -1) return null;

  // idx 0..29 → año base 1980..2009, y el mismo idx + 30 años → 2010..2039,
  // y así sucesivamente. Se generan candidatos en varios ciclos de 30 años
  // (no solo dos) para no quedar corto si en el futuro esta plataforma se
  // usa para decodificar vehículos bien nuevos.
  let best: number | null = null;
  for (let cycle = -1; cycle <= 3; cycle++) {
    const year = 1980 + idx + cycle * 30;
    // Nunca en el futuro (más allá del año que viene, por si el VIN es de
    // un modelo recién anunciado) y siempre el más reciente que cumpla eso.
    if (year <= referenceYear + 1 && (best === null || year > best)) {
      best = year;
    }
  }
  return best;
}

// ── FABRICANTE (WMI, posiciones 1-3) ────────────────────────────────────────
//
// Agrupado por marca para que sea fácil de auditar/ampliar. Incluye, a
// propósito, códigos usados fuera de EEUU (Australia, Nueva Zelanda, Japón,
// Europa, Corea, Brasil) además de los códigos norteamericanos más comunes --
// eso es justo lo que NHTSA no cubre bien. No incluye códigos que no se
// pudieron confirmar con razonable confianza (mejor no decodificar nada que
// decodificar mal).
const WMI_MAKE_TABLE: Record<string, string> = {};
function register(codes: string[], make: string) {
  for (const c of codes) WMI_MAKE_TABLE[c] = make;
}

register(
  ["JT1", "JT2", "JT3", "JT4", "JT5", "JT6", "JT8", "JTB", "JTD", "JTE", "JTF", "JTG", "JTH", "JTK", "JTL", "JTM", "JTN", "JTP",
   "6T1", "7A4", "MR0", "MR1", "MR2", "2T1", "3TM", "4T1", "4T3", "4TA", "5TB", "5TD", "5TE", "5TF"],
  "Toyota"
);
register(
  ["1FA", "1FB", "1FC", "1FD", "1FE", "1FM", "1FT", "1F1", "1F6", "1ZV",
   "2FA", "2FD", "2FM", "2FT", "3FA", "3FC", "3FD", "3FR", "3FT",
   "WF0", "NM0", "9BF", "5LM"],
  "Ford"
);
register(
  ["JN1", "JN3", "JN4", "JN6", "JN8", "JNA", "JNC", "JNE", "JNK", "JNR", "JNX",
   "1N4", "3N1", "4N1", "4N2", "5N1", "6F4", "7A7"],
  "Nissan"
);
register(
  ["JHM", "JH1", "JH2", "JH3", "JH4", "JH6", "JHL", "SHH", "SHS",
   "1HG", "2HG", "2HJ", "2HK", "3HG", "3HM", "4S6", "5FN", "5J6", "7A3"],
  "Honda"
);
register(
  ["JM0", "JM1", "JM2", "JM3", "JM4", "JM6", "JM7", "JMZ", "1YV", "4F2", "4F4"],
  "Mazda"
);
register(
  ["JA3", "JA4", "JA7", "JL6", "JW6", "JW7", "KPH", "1Z3", "1Z5", "1Z7", "4A3", "4A4", "6MM", "7A1"],
  "Mitsubishi"
);
register(
  ["JAA", "JAB", "JAC", "JAE", "JAL", "JAM", "J87", "1GG", "4KL", "4NU", "4S1", "4S2", "LES", "LM5"],
  "Isuzu"
);
register(["JSA", "JSK", "JSL", "JS1", "JS2", "JS3", "JS4"], "Suzuki");
register(["WVW", "WV1", "WV2", "WV3", "WVG", "1V1", "1VW", "3VW", "9BW", "9DW"], "Volkswagen");
register(["WDB", "WDC", "WDD", "WDF", "VSA"], "Mercedes-Benz");
register(["WBA", "WBS", "WBY", "WB1", "WB3", "WB4", "WUA", "WU1"], "BMW");
register(["YV1", "YV2", "YV3", "YV4", "YV5"], "Volvo");
register(["VF1", "VF2", "VF6"], "Renault");
register(["VF3"], "Peugeot");
register(["ZFA", "ZFC"], "Fiat");
register(["SAL"], "Land Rover");
// Jeep: 1JC/1JT/1J4/1J7/1J8 son códigos históricos propios de Jeep; 1C4 y
// ZAC (Italia) son los que usa hoy dentro de la estructura Chrysler/
// Stellantis -- confirmado con un VIN real de Facu (1C4RJFEMXEC166194,
// Jeep Grand Cherokee 2014) durante este mismo incremento.
register(["1JC", "1JT", "1J4", "1J7", "1J8", "1C4", "ZAC"], "Jeep");
register(["1C3"], "Chrysler/Dodge"); // WMI compartido entre las dos marcas, no se puede distinguir sin más datos
register(["1C6", "3C6"], "Ram");
register(["2C3"], "Dodge");
register(["KMH", "KMJ", "KM8", "KMC", "KME", "KMF", "2HM", "5NM", "5NP"], "Hyundai");
register(["KNA", "KNC", "KND", "KNE", "KNF", "KNG", "KNJ", "KNM"], "Kia");
register(["6H8"], "Holden");
register(["1G1", "1GC", "1GT", "2G1", "3G1"], "Chevrolet");

// Se intenta primero el WMI completo de 3 caracteres (el caso normal) y,
// si no hay match, con 2 -- algunos fabricantes tienen asignado un rango
// completo bajo un prefijo más corto en vez de códigos de 3 sueltos.
export function decodeWmiMake(vin: string): string | null {
  if (!isVinFormatValid(vin)) return null;
  const wmi3 = vin.slice(0, 3);
  if (WMI_MAKE_TABLE[wmi3]) return WMI_MAKE_TABLE[wmi3];
  const wmi2 = vin.slice(0, 2);
  if (WMI_MAKE_TABLE[wmi2]) return WMI_MAKE_TABLE[wmi2];
  return null;
}
