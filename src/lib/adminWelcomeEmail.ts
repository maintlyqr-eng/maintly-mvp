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
  es: { f: "bienvenida", m: "bienvenido", n: "bienvenido/a" },
  en: { f: "welcome", m: "welcome", n: "welcome" },
  pt: { f: "bem-vinda", m: "bem-vindo", n: "bem-vindo(a)" },
};
function cap(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }

type Copy = {
  subject: (w: string) => string;
  title: (name: string, w: string) => string;
  p1: (role: string) => string;
  p2: string;
  button: string;
  p3: string;
  p4: string;
  signoff: string;
};

const COPY: Record<Locale, Copy> = {
  es: {
    subject: (w) => `${cap(w)} al equipo de MaintlyQR`,
    title: (n, w) => `¡${cap(w)} al equipo, ${n}!`,
    p1: (r) => `Desde hoy formás parte de MaintlyQR con el rol de <strong>${r}</strong>. Estamos construyendo el historial de service por QR de alcance mundial, y vos sos parte de eso.`,
    p2: "Con este link vas a poder crear tu contraseña y entrar a tu nuevo rol en el panel:",
    button: "Entrar a mi rol",
    p3: "El link es personal y vence en 7 días. Si venció, pedí uno nuevo y te lo generamos al instante.",
    p4: "Me alegra mucho que te sumes. Espero que disfrutes trabajar con nuestro equipo; cualquier duda, respondé este mail y te contesto yo.",
    signoff: "Facundo Ledesma<br>CEO, MaintlyQR",
  },
  en: {
    subject: () => "Welcome to the MaintlyQR team",
    title: (n) => `Welcome to the team, ${n}!`,
    p1: (r) => `As of today you're part of MaintlyQR as <strong>${r}</strong>. We're building the worldwide QR service history, and you're part of it.`,
    p2: "Use this link to create your password and sign in to your new role in the panel:",
    button: "Sign in to my role",
    p3: "The link is personal and expires in 7 days. If it expires, ask for a new one and we'll generate it right away.",
    p4: "I'm really glad to have you on board. I hope you enjoy working with our team; any questions, reply to this email and I'll answer personally.",
    signoff: "Facundo Ledesma<br>CEO, MaintlyQR",
  },
  pt: {
    subject: (w) => `${cap(w)} à equipe do MaintlyQR`,
    title: (n, w) => `${cap(w)} à equipe, ${n}!`,
    p1: (r) => `A partir de hoje você faz parte do MaintlyQR com o papel de <strong>${r}</strong>. Estamos construindo o histórico de manutenção por QR de alcance mundial, e você faz parte disso.`,
    p2: "Com este link você vai poder criar sua senha e acessar seu novo papel no painel:",
    button: "Acessar meu papel",
    p3: "O link é pessoal e vence em 7 dias. Se vencer, peça um novo e geramos na hora.",
    p4: "Fico muito feliz com a sua chegada. Espero que goste de trabalhar com a nossa equipe; qualquer dúvida, responda este e-mail e eu mesmo respondo.",
    signoff: "Facundo Ledesma<br>CEO, MaintlyQR",
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

  const text = `${c.title(name, w).replace(/<[^>]+>/g, "")}

${c.p1(role).replace(/<[^>]+>/g, "")}

${c.p2}
${params.inviteLink}

${c.p3}

${c.p4}

${c.signoff.replace(/<br>/g, "\n")}`;

  const html = `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;max-width:480px;width:100%;">
          <tr><td style="background-color:#dc2626;padding:28px 32px;"><span style="color:#ffffff;font-size:20px;font-weight:900;letter-spacing:0.02em;">MaintlyQR</span></td></tr>
          <tr><td style="padding:32px;">
            <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;color:#18181b;">${escapeHtml(c.title(name, w))}</h1>
            <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">${c.p1(escapeHtml(role))}</p>
            <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#3f3f46;">${c.p2}</p>
            <a href="${params.inviteLink}" style="display:inline-block;background-color:#dc2626;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:0.03em;text-transform:uppercase;padding:12px 24px;border-radius:10px;">${c.button}</a>
            <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#71717a;word-break:break-all;">${escapeHtml(params.inviteLink)}</p>
            <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#71717a;">${c.p3}</p>
            <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#3f3f46;">${c.p4}</p>
            <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#18181b;font-weight:700;">${c.signoff}</p>
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
