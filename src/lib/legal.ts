// Versión vigente de los Términos de Servicio y la Política de Privacidad
// (fecha de vigencia que muestran /terms y /privacy). Se guarda en
// mechanics.terms_version al aceptar en el registro (migración 048). Si los
// documentos cambian, subir esta constante: los Maintlers con una versión
// anterior quedan identificables para pedirles que vuelvan a aceptar.
export const TERMS_VERSION = "2026-07-02";

// Clave de localStorage usada por el registro con Google: el checkbox se
// tilda ANTES de ir a Google, y al volver (onAuthStateChange) se graba en
// mechanics. localStorage sobrevive al ida y vuelta del OAuth.
export const TERMS_PENDING_STORAGE_KEY = "maintlyqr_terms_accepted_at";
