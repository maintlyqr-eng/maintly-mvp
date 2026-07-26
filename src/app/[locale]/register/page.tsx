"use client";

import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Mail, Lock, Eye, EyeOff, User, Wrench } from "lucide-react";
import { supabase } from "@/lib/supabase";

// Localized copy of src/app/register/page.tsx, migrated together with
// Login (rollout page #5/#6) so both can cross-link via next-intl's
// <Link>. router.push("/register/profession") deliberately keeps
// next/navigation's plain router — that page isn't migrated yet.

export default function RegisterPage() {
  const router = useRouter();
  const t = useTranslations("RegisterPage");
  const locale = useLocale();

  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmEmailSent, setConfirmEmailSent] = useState(false);

  // Incremento 20: el botón "Continuar con Google" no existía en esta
  // página (solo estaba, sin funcionar, en Login) — Facu esperaba poder
  // registrarse con Google acá. Como el sign-up con Google no pasa por
  // handleRegister() de abajo (no hay "submit" del form, todo el flujo es
  // un redirect a Google y de vuelta), este listener es el único lugar
  // donde un registro nuevo por Google "aterriza": si la cuenta todavía no
  // tiene "profession" (columna de la migración 036) la mandamos a
  // completar el perfil, igual que hace handleRegister() para el alta con
  // email/contraseña. Mismo patrón que el listener ya existente en
  // src/app/[locale]/login/page.tsx.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) return;

      const { data: m } = await supabase.from("mechanics").select("suspended, deleted_at, profession").eq("id", session.user.id).maybeSingle();
      if (m?.deleted_at) {
        await supabase.auth.signOut();
        setError(t("deletedError"));
        return;
      }
      if (m?.suspended) {
        await supabase.auth.signOut();
        setError(t("suspendedError"));
        return;
      }
      if (!m?.profession) {
        router.push("/register/profession");
        return;
      }
      router.push("/dashboard");
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleGoogleSignIn() {
    setError("");
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.href },
    });
    if (error) {
      setGoogleLoading(false);
      setError(t("googleSignInError"));
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(t("passwordMismatchError"));
      return;
    }
    if (password.length < 6) {
      setError(t("passwordTooShortError"));
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Incremento 20: "locale" acá es lo que permite que el trigger de
        // bienvenida (migración 039) mande el mensaje de "Messages" en el
        // idioma correcto -- sin esto, siempre caía a inglés por default.
        data: { name, locale },
      },
    });

    setLoading(false);

    if (error) {
      // Raw Supabase error message — not app copy, left untranslated same
      // as elsewhere in the app.
      setError(error.message);
      return;
    }

    // Fire-and-forget welcome email — never block or fail signup on this.
    // The in-app welcome message (Messages inbox) is handled separately, on
    // the database side (see supabase/migrations/018_add_welcome_message.sql),
    // so it lands even if this request never completes.
    fetch("/api/send-welcome-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    }).catch(() => {});

    // If Supabase requires email confirmation, there is no session yet.
    if (data.session) {
      router.push("/register/profession");
    } else {
      setConfirmEmailSent(true);
    }
  }

  if (confirmEmailSent) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
        <div className="max-w-md w-full bg-white border border-zinc-200 rounded-2xl shadow-sm p-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full border border-red-100 bg-red-50 mb-4">
            <Mail size={24} className="text-red-600" />
          </div>
          <h2 className="text-[22px] font-black text-zinc-900 mb-2">{t("checkEmailTitle")}</h2>
          <p className="text-[14px] text-zinc-500 mb-6">
            {t("checkEmailDescPrefix")} <strong>{email}</strong>. {t("checkEmailDescSuffix")}
          </p>
          <Link
            href="/login"
            className="inline-block w-full bg-red-600 hover:bg-red-500 transition-all text-white font-bold py-[12px] rounded-xl text-[14px] tracking-wide uppercase"
          >
            {t("goToLoginButton")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-dvh bg-white overflow-x-hidden">

      {/* ── IMAGEN DE FONDO COMPLETA (incluye el panel blanco dibujado) ── */}
      <div className="hidden md:block absolute inset-0 z-0 bg-white">
        <Image
          src="/images/login-side.png"
          alt="MaintlyQR"
          fill
          priority
          sizes="100vw"
          className="object-contain object-center"
        />
      </div>

      {/* ── FORMULARIO FLOTANDO SOBRE EL PANEL BLANCO DE LA IMAGEN ── */}
      <div className="relative z-10 min-h-dvh flex items-center justify-center px-6 py-10 md:px-0 md:py-0">
        <div className="w-full flex md:max-w-[1536px] md:aspect-[1536/1019]">
          <div className="hidden md:block flex-1" />
          <div className="flex items-center w-full md:w-[38%] md:pr-[5%]">
            <div className="w-full max-w-[420px] mx-auto">

          <div className="text-center mb-7">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full border border-red-100 bg-red-50 mb-4">
              <Wrench size={24} className="text-red-600" />
            </div>
            <h2 className="text-[26px] font-black text-zinc-900">{t("becomeMaintler")}</h2>
            <p className="text-[13px] text-zinc-500 mt-1">{t("subtitle")}</p>
          </div>

          <form onSubmit={handleRegister}>
            {/* Name */}
            <div className="mb-4">
              <label className="text-[12px] font-bold text-zinc-700">{t("fullNameLabel")}</label>
              <div className="relative mt-1">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("fullNamePlaceholder")}
                  className="w-full rounded-xl border border-zinc-200 pl-10 pr-3 py-[12px] text-[14px] outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition-all"
                />
              </div>
            </div>

            {/* Email */}
            <div className="mb-4">
              <label className="text-[12px] font-bold text-zinc-700">{t("emailLabel")}</label>
              <div className="relative mt-1">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("emailPlaceholder")}
                  className="w-full rounded-xl border border-zinc-200 pl-10 pr-3 py-[12px] text-[14px] outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="mb-4">
              <label className="text-[12px] font-bold text-zinc-700">{t("passwordLabel")}</label>
              <div className="relative mt-1">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("passwordPlaceholder")}
                  className="w-full rounded-xl border border-zinc-200 pl-10 pr-10 py-[12px] text-[14px] outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div className="mb-5">
              <label className="text-[12px] font-bold text-zinc-700">{t("confirmPasswordLabel")}</label>
              <div className="relative mt-1">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("confirmPasswordPlaceholder")}
                  className="w-full rounded-xl border border-zinc-200 pl-10 pr-10 py-[12px] text-[14px] outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-500 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all text-white font-bold py-[13px] rounded-xl text-[14px] tracking-wide uppercase shadow-md shadow-red-900/20"
            >
              {loading ? t("creatingAccount") : t("createAccountButton")}
            </button>
          </form>

          {/* Movido fuera del <form>: este mismo mensaje de error cubre
              tanto el alta con email/contraseña (handleRegister) como el
              alta con Google (handleGoogleSignIn), que vive fuera del form
              — un solo lugar visible para cualquiera de los dos caminos. */}
          {error && (
            <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">
              {error}
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-[1px] bg-zinc-200" />
            <span className="text-[11px] text-zinc-400">{t("orDivider")}</span>
            <div className="flex-1 h-[1px] bg-zinc-200" />
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300 hover:shadow-sm active:scale-[0.98] active:shadow-none disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-150 py-[12px] rounded-xl text-[13px] font-semibold text-zinc-700"
          >
            {googleLoading ? (
              <div className="w-[18px] h-[18px] border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.08-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33C2.44 15.98 5.48 18 9 18z"/>
                <path fill="#FBBC05" d="M3.97 10.71c-.18-.54-.28-1.71-.28-1.71s.1-1.17.28-1.71V4.96H.96C.35 6.18 0 7.55 0 9s.35 2.82.96 4.04l3.01-2.33z"/>
                <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
              </svg>
            )}
            {googleLoading ? t("connectingToGoogle") : t("continueWithGoogle")}
          </button>

          <p className="text-center text-[13px] text-zinc-500 mt-6">
            {t("alreadyHaveAccount")}{" "}
            <Link href="/login" className="text-red-600 hover:text-red-700 font-bold">{t("loginLink")}</Link>
          </p>

          <p className="text-center text-[12px] text-zinc-400 mt-3">
            <Link href="/" className="hover:text-zinc-600 underline">{t("continueBrowsing")}</Link>
          </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
