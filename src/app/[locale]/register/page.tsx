"use client";

import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, User, Wrench, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

// 27 jul 2026 — pantalla hermana del Login (mismo sistema visual
// "industrial" oscuro, ver el comment de globals.css y de login/page.tsx).
// Facu subió 4 imágenes hechas a medida para esta pantalla en particular
// (register-hero-*): a diferencia de las que usamos en Login, estas SÍ
// tienen un panel vacío real y grande de un solo lado (a la derecha en las
// de escritorio, arriba en las verticales) — por eso acá el desktop vuelve
// al patrón "imagen de fondo con aspect-ratio calcado al form + form
// pegado al panel vacío" (el mismo que tenía el Login viejo con
// login-side.png, antes de que lo cambiáramos por la tarjeta "enganchada" —
// ese cambio fue porque las imágenes del Login no tenían un panel
// dedicado; estas sí, así que el patrón original funciona bien acá).
// Mobile suma la franja hero que esta pantalla nunca tuvo (antes el
// celular veía el form flotando directo sobre blanco liso, sin tarjeta ni
// identidad de marca). A diferencia del Login, acá NO forzamos "una sola
// pantalla sin scroll" — este form tiene 4 campos (vs. 2 en Login) y
// preferimos dejar un scroll natural de respaldo antes que arriesgarnos a
// cortar contenido en celulares chicos. Ninguna lógica tocada (signUp,
// Google, confirmEmailSent, validaciones, etc.) — solo la capa visual.

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
      <main className="min-h-dvh flex items-center justify-center bg-carbon px-4">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="max-w-md w-full bg-carbon-light border border-zinc-800 rounded-2xl shadow-industrial-dark p-8 text-center"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full border border-red-500/30 bg-red-500/10 mb-4">
            <Mail size={24} className="text-red-400" />
          </div>
          <h2 className="text-[22px] font-black text-white mb-2">{t("checkEmailTitle")}</h2>
          <p className="text-[14px] text-zinc-400 mb-6">
            {t("checkEmailDescPrefix")} <strong className="text-zinc-200">{email}</strong>. {t("checkEmailDescSuffix")}
          </p>
          <Link
            href="/login"
            className="inline-block w-full bg-red-600 hover:bg-red-500 transition-all text-white font-bold py-[12px] rounded-xl text-[14px] tracking-wide uppercase shadow-industrial-dark"
          >
            {t("goToLoginButton")}
          </Link>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="relative min-h-dvh bg-carbon overflow-x-hidden flex flex-col md:block">

      {/* ── HERO MOBILE (< md): esta pantalla nunca había tenido identidad
          visual en el celular — el form flotaba directo sobre blanco liso.
          Recorte vertical hecho a medida (register-hero-mobile-dark.png),
          con object-position apuntando a la zona de abajo de la imagen
          (ahí está el generador/camioneta/moto — el panel vacío de esta
          imagen en particular queda arriba, al revés que en Login). ── */}
      <div className="md:hidden relative h-[140px] shrink-0 overflow-hidden bg-carbon">
        <Image
          src="/images/register-hero-mobile-dark.png"
          alt="MaintlyQR"
          fill
          priority
          sizes="100vw"
          style={{ objectFit: "cover", objectPosition: "50% 85%" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-carbon" />
      </div>

      {/* ── IMAGEN DE FONDO (desktop): a diferencia del Login, esta imagen
          sí tiene un panel vacío real y grande (a la derecha, ~65% del
          ancho) — el mismo patrón que usaba el Login viejo con
          login-side.png: contenedor con aspect-ratio calcado 1:1 a la
          imagen (object-contain, sin recortar nada) + spacer + columna del
          form pegada al panel vacío. ── */}
      <div className="hidden md:block absolute inset-0 z-0 bg-carbon">
        <Image
          src="/images/register-hero-desktop-dark.png"
          alt="MaintlyQR"
          fill
          priority
          sizes="100vw"
          className="object-contain object-center"
        />
      </div>

      {/* ── FORMULARIO ── */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-6 md:px-0 md:py-0">
        <div className="w-full flex md:max-w-[1672px] md:aspect-[1672/941]">
          <div className="hidden md:block flex-1" />
          <div className="flex items-center w-full md:w-[38%] md:pr-[5%]">
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              className="w-full max-w-[420px] mx-auto relative bg-carbon-light rounded-[28px] shadow-industrial-dark px-6 py-6 md:px-8 md:py-9 overflow-hidden"
            >
              {/* Línea de acento — el único "brillo metálico" de la tarjeta */}
              <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-maintly-red to-transparent" />

              <div className="text-center mb-4 md:mb-7">
                <div className="hidden md:inline-flex items-center justify-center w-14 h-14 rounded-full border border-red-500/30 bg-red-500/10 mb-4">
                  <Wrench size={24} className="text-red-400" />
                </div>
                <h2 className="text-[20px] md:text-[26px] font-black text-white">{t("becomeMaintler")}</h2>
                <p className="hidden md:block text-[13px] text-zinc-400 mt-1">{t("subtitle")}</p>
              </div>

              <form onSubmit={handleRegister}>
                {/* Name */}
                <div className="mb-3 md:mb-4">
                  <label className="text-[12px] font-bold text-zinc-300">{t("fullNameLabel")}</label>
                  <div className="relative mt-1">
                    <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("fullNamePlaceholder")}
                      className="w-full rounded-xl border border-zinc-700 bg-carbon text-white placeholder:text-zinc-500 pl-10 pr-3 py-[10px] md:py-[12px] text-[14px] outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition-all"
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="mb-3 md:mb-4">
                  <label className="text-[12px] font-bold text-zinc-300">{t("emailLabel")}</label>
                  <div className="relative mt-1">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("emailPlaceholder")}
                      className="w-full rounded-xl border border-zinc-700 bg-carbon text-white placeholder:text-zinc-500 pl-10 pr-3 py-[10px] md:py-[12px] text-[14px] outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition-all"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="mb-3 md:mb-4">
                  <label className="text-[12px] font-bold text-zinc-300">{t("passwordLabel")}</label>
                  <div className="relative mt-1">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t("passwordPlaceholder")}
                      className="w-full rounded-xl border border-zinc-700 bg-carbon text-white placeholder:text-zinc-500 pl-10 pr-10 py-[10px] md:py-[12px] text-[14px] outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Confirm password */}
                <div className="mb-4 md:mb-5">
                  <label className="text-[12px] font-bold text-zinc-300">{t("confirmPasswordLabel")}</label>
                  <div className="relative mt-1">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={t("confirmPasswordPlaceholder")}
                      className="w-full rounded-xl border border-zinc-700 bg-carbon text-white placeholder:text-zinc-500 pl-10 pr-10 py-[10px] md:py-[12px] text-[14px] outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition-all"
                    />
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: loading ? 1 : 1.015 }}
                  whileTap={{ scale: loading ? 1 : 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-white font-bold py-[11px] md:py-[13px] rounded-xl text-[14px] tracking-wide uppercase shadow-industrial-dark"
                >
                  {loading ? t("creatingAccount") : t("createAccountButton")}
                </motion.button>
              </form>

              {/* Movido fuera del <form>: este mismo mensaje de error cubre
                  tanto el alta con email/contraseña (handleRegister) como el
                  alta con Google (handleGoogleSignIn), que vive fuera del form
                  — un solo lugar visible para cualquiera de los dos caminos. */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: "auto", marginTop: 16 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    transition={{ duration: 0.2 }}
                    className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 flex items-center gap-2 text-[12px] text-red-300 overflow-hidden"
                  >
                    <AlertCircle size={14} className="shrink-0" />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Divider */}
              <div className="flex items-center gap-3 my-4 md:my-5">
                <div className="flex-1 h-[1px] bg-zinc-700" />
                <span className="text-[11px] text-zinc-500">{t("orDivider")}</span>
                <div className="flex-1 h-[1px] bg-zinc-700" />
              </div>

              {/* Google — se mantiene blanco a propósito (así se lee bien
                  sobre cualquier fondo, es la convención habitual del botón
                  de Google) */}
              <motion.button
                whileHover={{ scale: googleLoading ? 1 : 1.015 }}
                whileTap={{ scale: googleLoading ? 1 : 0.98 }}
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading}
                className="w-full flex items-center justify-center gap-3 border border-zinc-300 bg-white hover:bg-zinc-50 hover:border-zinc-400 hover:shadow-sm disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150 py-[10px] md:py-[12px] rounded-xl text-[13px] font-semibold text-zinc-700"
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
              </motion.button>

              <p className="text-center text-[13px] text-zinc-400 mt-4 md:mt-6">
                {t("alreadyHaveAccount")}{" "}
                <Link href="/login" className="text-red-400 hover:text-red-300 font-bold">{t("loginLink")}</Link>
              </p>

              <p className="text-center text-[12px] text-zinc-500 mt-2 md:mt-3">
                <Link href="/" className="hover:text-zinc-300 underline">{t("continueBrowsing")}</Link>
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </main>
  );
}
