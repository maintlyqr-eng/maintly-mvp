"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import PasswordInput from "@/components/PasswordInput";

// Página que abre la persona invitada desde el link que le mandó el Super
// Admin (/admin/invite?t=<token>, ver /api/admin/invite). Muestra para
// quién es la invitación y el rol, pide una contraseña, y al aceptar la
// deja logueada y la manda al panel.

type State = { kind: "loading" } | { kind: "invalid" } | { kind: "expired" } | { kind: "ready"; username: string; role: string };

function AdminInviteInner() {
  const t = useTranslations("AdminInvitePage");
  const tAdmin = useTranslations("AdminPage");
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("t") ?? "";

  const [state, setState] = useState<State>({ kind: "loading" });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setState({ kind: "invalid" }); return; }
    fetch(`/api/admin/invite?t=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (j?.ok) setState({ kind: "ready", username: j.username, role: j.role });
        else setState({ kind: j?.reason === "expired" ? "expired" : "invalid" });
      })
      .catch(() => setState({ kind: "invalid" }));
  }, [token]);

  const roleLabel: Record<string, string> = {
    super_admin: tAdmin("roleSuperAdmin"),
    support_admin: tAdmin("roleSupportAdmin"),
    content_moderator: tAdmin("roleContentModerator"),
    analytics_viewer: tAdmin("roleAnalyticsViewer"),
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError(t("tooShort")); return; }
    if (password !== confirm) { setError(t("mismatch")); return; }
    setSubmitting(true);
    try {
      const r = await fetch("/api/admin/invite", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, password }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) {
        setError(j?.error === "expired" ? t("expiredTitle") : j?.error === "password_too_short" ? t("tooShort") : t("invalidTitle"));
        return;
      }
      router.push("/admin");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl border border-zinc-200 shadow-sm p-7">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck size={20} className="text-red-600" />
          <h1 className="text-[18px] font-black text-zinc-900">{t("title")}</h1>
        </div>

        {state.kind === "loading" && <p className="text-[13px] text-zinc-400 mt-4">{t("checking")}</p>}

        {(state.kind === "invalid" || state.kind === "expired") && (
          <div className="mt-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-bold text-amber-800">{state.kind === "expired" ? t("expiredTitle") : t("invalidTitle")}</p>
              <p className="text-[12px] text-amber-700 mt-1">{t("askNewLink")}</p>
            </div>
          </div>
        )}

        {state.kind === "ready" && (
          <form onSubmit={submit} className="mt-4 space-y-4">
            <p className="text-[13px] text-zinc-600">
              {t.rich("intro", {
                user: () => <span className="font-bold text-zinc-900">{state.username}</span>,
                role: () => <span className="font-bold text-zinc-900">{roleLabel[state.role] ?? state.role}</span>,
              })}
            </p>
            <div>
              <label className="text-[12px] font-bold text-zinc-700">{t("passwordLabel")}</label>
              <PasswordInput
                value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus
                wrapperClassName="mt-1"
                className="w-full rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500"
              />
              <p className="text-[11px] text-zinc-400 mt-1">{t("passwordHint")}</p>
            </div>
            <div>
              <label className="text-[12px] font-bold text-zinc-700">{t("confirmLabel")}</label>
              <PasswordInput
                value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password"
                wrapperClassName="mt-1"
                className="w-full rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500"
              />
            </div>
            {error && <p className="text-[12px] text-red-600">{error}</p>}
            <button
              type="submit" disabled={submitting}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-[13px] font-bold py-3 rounded-xl transition-colors"
            >
              {submitting ? t("submitting") : t("submit")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// useSearchParams necesita un límite de Suspense para el build estático.
export default function AdminInvitePage() {
  return (
    <Suspense fallback={null}>
      <AdminInviteInner />
    </Suspense>
  );
}
