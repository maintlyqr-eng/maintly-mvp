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
    p1: (r) => `Nos alegra mucho que te sumes a esta aventura como <strong>${r}</strong>.`,
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
    p1: (r) => `We're thrilled to have you join this adventure as <strong>${r}</strong>.`,
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
    p1: (r) => `Estamos muito felizes por você se juntar a esta aventura como <strong>${r}</strong>.`,
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

${strip(c.p1(role))}

${c.p2}
${c.p3}

${c.p4}
🔗 ${params.inviteLink}

${c.p5}

${c.p6(w)}

${strip(c.signoff.replace(/<br>/g, "\n"))}`;

  const P = (inner: string, extra = "") => `<p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;${extra}">${inner}</p>`;
  const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;max-width:480px;width:100%;">
          <tr><td style="background-color:#dc2626;padding:28px 32px;"><span style="color:#ffffff;font-size:20px;font-weight:900;letter-spacing:0.02em;">MaintlyQR</span></td></tr>
          <tr><td style="padding:32px;">
            <h1 style="margin:0 0 20px;font-size:22px;font-weight:900;color:#18181b;line-height:1.3;">${escapeHtml(c.title(name, w))}</h1>
            ${P(c.p1(escapeHtml(role)))}
            ${P(c.p2)}
            ${P(c.p3, "font-weight:700;color:#18181b;")}
            ${P(c.p4)}
            <a href="${params.inviteLink}" style="display:inline-block;background-color:#dc2626;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:0.03em;text-transform:uppercase;padding:12px 24px;border-radius:10px;">${c.button}</a>
            <p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#71717a;word-break:break-all;">🔗 ${escapeHtml(params.inviteLink)}</p>
            <p style="margin:16px 0 24px;font-size:13px;line-height:1.6;color:#71717a;">${c.p5}</p>
            ${P(c.p6(w), "font-weight:700;color:#18181b;")}
            <p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#18181b;font-weight:700;">${c.signoff}</p>
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
