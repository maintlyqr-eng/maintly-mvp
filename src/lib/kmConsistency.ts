// Detección de km/horas "hacia atrás" en un historial (21/10/2026).
//
// Surgió al probar la fusión de historiales con datos incoherentes a
// propósito: dos historiales cargados por separado pueden tener, al
// juntarse, un servicio con fecha POSTERIOR y MENOS km que otro anterior.
// El alta normal ya lo impide (errorKmTooLow en dashboard/assets), así que
// esto solo pasa tras una fusión o con servicios de fecha retroactiva.
//
// No se corrige nada automáticamente (no hay forma de saber cuál de los dos
// está mal): se marca para que una persona revise. Regla: un registro es
// inconsistente si tiene km y existe otro registro con fecha ESTRICTAMENTE
// anterior y km MAYOR. Listas chicas (servicios de un activo), O(n²) sobra.
export type KmRecordLike = { id: string; service_date: string; km_hours: number | null };

export function findKmRegressions(records: KmRecordLike[]): Set<string> {
  const flagged = new Set<string>();
  const withKm = records.filter((r) => r.km_hours != null);
  for (const r of withKm) {
    const km = r.km_hours as number;
    // Máximo entre los servicios con fecha ESTRICTAMENTE anterior. Misma
    // fecha no cuenta: no se puede saber el orden real dentro del día.
    let maxBefore = -Infinity;
    for (const o of withKm) {
      if (o.id !== r.id && o.service_date < r.service_date && (o.km_hours as number) > maxBefore) {
        maxBefore = o.km_hours as number;
      }
    }
    if (km < maxBefore) flagged.add(r.id);
  }
  return flagged;
}
