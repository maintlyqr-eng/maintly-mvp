// Mail de bienvenida al EQUIPO de MaintlyQR (Facu, 21/10/2026: "quiero
// hacer sentir sentido de pertenencia desde el minuto 0"). Se manda al
// crear un admin por invitación con email cargado, y desde "Reenviar mail".
// Misma estética que el mail de bienvenida de los mecánicos
// (src/app/api/send-welcome-email/route.ts). Solo servidor.

type Locale = "es" | "en" | "pt";
export type Salutation = "f" | "m" | "n";

// "bienvenida" / "bienvenido" / "bienvenido/a" según el tratamiento elegido
// por quien invita (nunca se adivina por el nombre).
const WELCOME: Record<Locale, Record<Salutation, string>> = {
  es: { f: "Bienvenida", m: "Bienvenido", n: "Bienvenido/a" },
  en: { f: "Welcome", m: "Welcome", n: "Welcome" },
  pt: { f: "Bem-vinda", m: "Bem-vindo", n: "Bem-vindo(a)" },
};

type Copy = {
  subject: (w: string) => string;
  title: (name: string, w: string) => string;
  p1: (role: string) => string;
  p2: string;
  p3: string;
  p4: string;
  button: string;
  p5: string;
  p6: (w: string) => string;
  signoff: string;
};

// Texto aprobado por Facu (21/10/2026). El saludo (w) viene con mayúscula
// inicial: "Bienvenida" / "Bienvenido" / "Bienvenido/a".
const COPY: Record<Locale, Copy> = {
  es: {
    subject: (w) => `🚀 ¡${w} al equipo de MaintlyQR!`,
    title: (n, w) => `🚀 ¡${w} al equipo de MaintlyQR, ${n}!`,
    p1: (r) => `Nos alegra mucho que te sumes a esta aventura como <strong>${r}</strong>`,
    p2: "Estamos construyendo algo con una visión muy clara: transformar la manera en que las personas y las empresas gestionan el mantenimiento de sus equipos, en cualquier parte del mundo.",
    p3: "Y ahora vos también sos parte de ese camino. ❤️",
    p4: "Para comenzar, activá tu acceso al panel de MaintlyQR desde el siguiente enlace:",
    button: "Activar mi acceso",
    p5: "Este enlace es personal y estará disponible durante 7 días.",
    p6: (w) => `¡${w} a bordo! Lo mejor está por venir.`,
    signoff: "Facundo Ledesma<br>Founder &amp; CEO | MaintlyQR",
  },
  en: {
    subject: () => "🚀 Welcome to the MaintlyQR team!",
    title: (n) => `🚀 Welcome to the MaintlyQR team, ${n}!`,
    p1: (r) => `We're thrilled to have you join this adventure as <strong>${r}</strong>`,
    p2: "We're building something with a very clear vision: to transform the way people and companies manage the maintenance of their equipment, anywhere in the world.",
    p3: "And now you're part of that journey too. ❤️",
    p4: "To get started, activate your access to the MaintlyQR panel through this link:",
    button: "Activate my access",
    p5: "This link is personal and will be available for 7 days.",
    p6: () => "Welcome aboard! The best is yet to come.",
    signoff: "Facundo Ledesma<br>Founder &amp; CEO | MaintlyQR",
  },
  pt: {
    subject: (w) => `🚀 ${w} à equipe do MaintlyQR!`,
    title: (n, w) => `🚀 ${w} à equipe do MaintlyQR, ${n}!`,
    p1: (r) => `Estamos muito felizes por você se juntar a esta aventura como <strong>${r}</strong>`,
    p2: "Estamos construindo algo com uma visão muito clara: transformar a maneira como pessoas e empresas gerenciam a manutenção de seus equipamentos, em qualquer lugar do mundo.",
    p3: "E agora você também faz parte desse caminho. ❤️",
    p4: "Para começar, ative seu acesso ao painel do MaintlyQR pelo link a seguir:",
    button: "Ativar meu acesso",
    p5: "Este link é pessoal e ficará disponível por 7 dias.",
    p6: (w) => `${w} a bordo! O melhor ainda está por vir.`,
    signoff: "Facundo Ledesma<br>Founder &amp; CEO | MaintlyQR",
  },
};

const ROLE_LABEL: Record<Locale, Record<string, string>> = {
  es: { super_admin: "Super Admin", support_admin: "Admin de Soporte", content_moderator: "Moderador de Contenido", analytics_viewer: "Visor de Analíticas", marketing: "Social Media & Marketing Manager" },
  en: { super_admin: "Super Admin", support_admin: "Support Admin", content_moderator: "Content Moderator", analytics_viewer: "Analytics Viewer", marketing: "Social Media & Marketing Manager" },
  pt: { super_admin: "Super Admin", support_admin: "Admin de Suporte", content_moderator: "Moderador de Conteúdo", analytics_viewer: "Visualizador de Análises", marketing: "Social Media & Marketing Manager" },
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function displayName(username: string): string {
  const first = username.split(/[._\-\s]/)[0];
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : username;
}

export async function sendAdminWelcomeEmail(params: { to: string; username: string; role: string; inviteLink: string; locale?: string; displayName?: string | null; salutation?: Salutation | null }): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: true, skipped: true };
  const locale: Locale = params.locale === "en" || params.locale === "pt" ? params.locale : "es";
  const c = COPY[locale];
  const role = ROLE_LABEL[locale][params.role] ?? params.role;
  const name = params.displayName?.trim() || displayName(params.username);
  const w = WELCOME[locale][params.salutation ?? "n"];
  const from = process.env.RESEND_FROM_EMAIL || "MaintlyQR <onboarding@resend.dev>";

  const strip = (x: string) => x.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&");
  const text = `${strip(c.title(name, w))}

${strip(c.p1(role))}.

${c.p2}
${c.p3}

${c.p4}
🔗 ${params.inviteLink}

${c.p5}

${c.p6(w)}

${strip(c.signoff.replace(/<br>/g, "\n"))}`;

  // Diseño (Facu: "dale estilo"): identidad Maintly — cabecera grafito con
  // el wordmark, línea roja tipo LED, rol en etiqueta, visión en bloque
  // destacado, botón rojo grande, firma con cargo. Todo inline (mail).
  const SITE = "https://www.maintlyqr.com";
  const roleBadge = (r: string) => `<span style="display:inline-block;background-color:#fef2f2;color:#b91c1c;border:1px solid #fecaca;border-radius:999px;padding:4px 12px;font-size:12px;font-weight:800;letter-spacing:0.02em;">${r}</span>`;
  const p1Html = c.p1(roleBadge(escapeHtml(role)));
  const html = `<!DOCTYPE html>
<html lang="${locale}">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(c.subject(w))}</title></head>
  <body style="margin:0;padding:0;background-color:#eceef1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(strip(c.p1(role)))}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eceef1;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">

          <!-- Cabecera grafito -->
          <tr><td style="background-color:#1c1f24;border-radius:20px 20px 0 0;padding:30px 36px 26px;text-align:center;">
            <div style="font-family:Arial Black,'Segoe UI Black',Impact,Helvetica,Arial,sans-serif;font-size:34px;line-height:1;font-weight:900;letter-spacing:0.04em;color:#ffffff;">MAINTLY<span style="color:#e0242b;">QR</span></div>
            <div style="margin-top:8px;font-size:9px;line-height:1;font-weight:700;letter-spacing:0.38em;color:#9aa0a8;"><span style="color:#e0242b;">&#8212;</span>&nbsp; MAINTENANCE &nbsp;<span style="color:#e0242b;">&#8226;</span>&nbsp; TRACKED &nbsp;<span style="color:#e0242b;">&#8212;</span></div>
          </td></tr>
          <!-- Línea LED -->
          <tr><td style="height:4px;background-color:#e0242b;font-size:0;line-height:0;">&nbsp;</td></tr>

          <!-- Cuerpo -->
          <tr><td style="background-color:#ffffff;padding:36px 36px 8px;">
            <p style="margin:0 0 10px;font-size:13px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#e0242b;">${escapeHtml(locale === "es" ? "Equipo MaintlyQR" : locale === "pt" ? "Equipe MaintlyQR" : "MaintlyQR Team")}</p>
            <h1 style="margin:0 0 22px;font-size:26px;line-height:1.25;font-weight:900;color:#18181b;letter-spacing:-0.01em;">${escapeHtml(c.title(name, w))}</h1>
            <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#3f3f46;">${p1Html}</p>
          </td></tr>

          <!-- Bloque visión -->
          <tr><td style="background-color:#ffffff;padding:0 36px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f7f9;border-left:4px solid #e0242b;border-radius:0 14px 14px 0;">
              <tr><td style="padding:18px 20px;">
                <p style="margin:0 0 10px;font-size:15px;line-height:1.65;color:#27272a;">${c.p2}</p>
                <p style="margin:0;font-size:15px;line-height:1.65;color:#18181b;font-weight:800;">${c.p3}</p>
              </td></tr>
            </table>
          </td></tr>

          <!-- CTA -->
          <tr><td style="background-color:#ffffff;padding:26px 36px 10px;">
            <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#3f3f46;">${c.p4}</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td align="center" style="background-color:#e0242b;border-radius:12px;box-shadow:0 8px 24px rgba(224,36,43,0.35);">
              <a href="${params.inviteLink}" style="display:inline-block;padding:15px 34px;color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;letter-spacing:0.06em;text-transform:uppercase;">${c.button} &rarr;</a>
            </td></tr></table>
            <p style="margin:16px 0 0;font-size:11px;line-height:1.6;color:#a1a1aa;text-align:center;word-break:break-all;">${escapeHtml(params.inviteLink)}</p>
            <p style="margin:14px 0 0;font-size:13px;line-height:1.6;color:#71717a;text-align:center;">${c.p5}</p>
          </td></tr>

          <!-- Cierre + firma -->
          <tr><td style="background-color:#ffffff;padding:26px 36px 34px;border-radius:0 0 20px 20px;">
            <p style="margin:0 0 26px;font-size:17px;line-height:1.5;font-weight:900;color:#18181b;">${c.p6(w)}</p>
            <table role="presentation" cellpadding="0" cellspacing="0"><tr>
              <td style="width:44px;height:44px;border-radius:22px;background-color:#1c1f24;color:#ffffff;text-align:center;vertical-align:middle;font-size:16px;font-weight:900;">FL</td>
              <td style="padding-left:14px;">
                <p style="margin:0;font-size:15px;font-weight:900;color:#18181b;">Facundo Ledesma</p>
                <p style="margin:2px 0 0;font-size:12px;font-weight:700;letter-spacing:0.04em;color:#e0242b;">Founder &amp; CEO &nbsp;|&nbsp; MaintlyQR</p>
              </td>
            </tr></table>
          </td></tr>

          <!-- Pie -->
          <tr><td style="padding:18px 12px 0;text-align:center;">
            <p style="margin:0;font-size:11px;line-height:1.6;color:#a1a1aa;">MaintlyQR &middot; <a href="${SITE}" style="color:#a1a1aa;text-decoration:underline;">www.maintlyqr.com</a><br>${escapeHtml(locale === "es" ? "Historial de mantenimiento por QR, en cualquier parte del mundo." : locale === "pt" ? "Histórico de manutenção por QR, em qualquer lugar do mundo." : "QR-based maintenance history, anywhere in the world.")}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({ from, to: params.to, subject: c.subject(w), html, text });
    if (error) return { ok: false, error: String(error.message ?? error) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
