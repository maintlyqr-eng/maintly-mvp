// Modelo de roles y permisos del panel admin (incremento 11, 14 jul 2026 —
// item 12 del pedido original de Facu: "Super Admin: acceso completo;
// Support Admin: usuarios/mensajes/reportes/soporte sin config crítica;
// Content Moderator: assets/registros/reportes; Analytics Viewer: solo
// estadísticas/reportes").
//
// Se modela como "capacidades" (qué dominio de datos puede tocar un rol) en
// vez de una lista fija de rutas permitidas por rol — así cada ruta se
// pregunta "¿este rol puede hacer X?" (roleHasCapability) en vez de tener
// los 4 nombres de rol hardcodeados en 20 archivos de ruta distintos. Si el
// día de mañana se agrega un rol nuevo, alcanza con tocar este archivo.

export type AdminRole = "super_admin" | "support_admin" | "content_moderator" | "analytics_viewer";

export const ADMIN_ROLES: AdminRole[] = ["super_admin", "support_admin", "content_moderator", "analytics_viewer"];

export type AdminCapability =
  | "accounts" // Maintlers (mechanics): ver/editar/suspender/verificar/soft-delete/restore
  | "assets" // assets y registros de servicio (service_records): ver/editar/soft-delete/restore
  | "qr" // códigos QR: generar lotes, desvincular
  | "reports" // reportes y moderación (content_reports + oversight de reportes entre Maintlers)
  | "support" // mensajes y herramientas de soporte (support_messages, support_thread_state)
  | "analytics" // estadísticas del dashboard (analytics, bulk-data)
  | "audit_logs" // logs de auditoría — expone acciones de TODOS los admins, no solo las propias
  | "admin_management" // crear/desactivar otros admins y asignarles rol
  | "critical_actions"; // eliminación permanente + configuración crítica del sistema

const ROLE_CAPABILITIES: Record<AdminRole, AdminCapability[]> = {
  super_admin: [
    "accounts", "assets", "qr", "reports", "support", "analytics",
    "audit_logs", "admin_management", "critical_actions",
  ],
  support_admin: ["accounts", "reports", "support"],
  // Nota de alcance: el pedido original no menciona QR explícitamente bajo
  // ningún rol limitado. Se asignó a Content Moderator porque un QR está
  // atado 1 a 1 a un asset (generarlo/desvincularlo es, en la práctica,
  // parte de administrar assets) — si Facu lo prefiere separado, es un
  // cambio de una línea acá.
  content_moderator: ["assets", "qr", "reports"],
  analytics_viewer: ["analytics", "reports"],
};

// Analytics Viewer es de solo lectura en todo lo que puede ver — a
// diferencia de los otros 3 roles, donde tener la capacidad alcanza para
// leer Y escribir. Si se agrega un rol de solo-lectura nuevo, se suma acá.
const READ_ONLY_ROLES: AdminRole[] = ["analytics_viewer"];

export function isValidAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (ADMIN_ROLES as string[]).includes(value);
}

export function roleHasCapability(role: AdminRole | null, capability: AdminCapability): boolean {
  if (!role) return false;
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

export function isRoleReadOnly(role: AdminRole | null): boolean {
  return !!role && READ_ONLY_ROLES.includes(role);
}

/** Todas las capacidades de un rol — lo usa el frontend para decidir qué secciones del sidebar mostrar. */
export function capabilitiesForRole(role: AdminRole | null): AdminCapability[] {
  if (!role) return [];
  return ROLE_CAPABILITIES[role] ?? [];
}
