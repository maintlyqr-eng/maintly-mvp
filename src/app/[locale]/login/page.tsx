"use client";

import Image from "next/image";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, User, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

// 28 jul 2026 — primera pantalla rediseñada con el nuevo sistema visual
// "industrial" (ver el comment de globals.css).
// 27 jul 2026 (segunda pasada) — Facu subió 5 imágenes nuevas hechas con
// ChatGPT para esta pantalla (desktop + mobile, versión clara y oscura de
// cada una). Las de escritorio "claras/con vehículos" (login-hero-desktop-
// light.png y la variante oscura con vehículos, -dark-alt.png) tienen la
// moto y la camioneta pegadas contra la esquina inferior derecha — justo
// donde el form vivía fijo (38% de ancho, pegado a la derecha) — así que
// meterlas tal cual hacía que el form quedara tapando la moto. La quinta
// imagen (login-hero-desktop-dark.png) es una versión oscura "limpia", sin
// vehículos, con un espacio abierto enorme en el centro — esa sí permite
// centrar el form sin riesgo de choque en ningún ancho de pantalla. Por eso
// esta pasada además pasa toda la pantalla a tema oscuro (carbón), no solo
// por estética: es la única imagen del lote que el form puede flotar
// encima con seguridad. Se guardan las otras 3 (light desktop/mobile y el
// alterno oscuro con vehículos) en public/images para una futura pantalla
// con más espacio dedicado (o un toggle claro/oscuro) — no se usan acá.
//   1. Mobile ahora usa login-hero-mobile-dark.png (recorte vertical
//      hecho a medida, ya no hay que adivinar un object-position sobre una
//      imagen horizontal como antes con login-side.png).
//   2. Desktop pasa de "imagen con panel dibujado + form encastrado en un
//      contenedor con aspect-ratio fijo" a un fondo full-bleed
//      (object-cover) con el form centrado de forma simple — más robusto
//      ante distintos anchos de ventana, y ya no depende de que el dibujo
//      tenga un panel vacío en un lugar exacto.
//   3. La tarjeta del form pasa de blanca a un panel carbón claro
//      (shadow-industrial-dark, el token pensado justamente para esto),
//      con inputs/textos adaptados a fondo oscuro. El botón de Google
//      se mantiene blanco a propósito (así se ve en cualquier fondo).
// Ningún cambio de lógica (auth, sanitizeRedirect, handlers) — solo la
// capa visual.

// Localized copy of src/app/login/page.tsx. Rollout page #5 (after Home,
// Asset, Report, Maintler, qr-empty). Migrated together with Register so
// the two pages can cross-link with next-intl's <Link> (from
// "@/i18n/navigation") and keep the visitor's chosen language — this is
// the "swap to Link once the target is migrated" step the Home page's own
// navLinks comment flags for later.
//
// router.push(redirectTo) below deliberately keeps next/navigation's plain
// (non-locale-aware) router: redirectTo defaults to "/dashboard", which
// isn't migrated yet, and can also be an arbitrary "?redirect=" value from
// another page (e.g. "/asset/ABC123") — those stay unprefixed on purpose,
// same convention as every other not-yet-migrated target in this rollout.

// Facu (26 jul 2026, revisión de seguridad): "?redirect=" venía confiado tal
// cual, sin validar. Alguien podía mandar un link tipo
// "/login?redirect=https://sitio-trucho.com" y, después de loguearse de
// verdad en MaintlyQR, terminar en un sitio externo -- un vector clásico de
// phishing (el link real es maintlyqr.com, así que no levanta sospechas
// hasta que ya inició sesión). Esto solo permite rutas internas relativas:
// tienen que empezar con un solo "/" (nunca "//", que los navegadores tratan
// como URL absoluta -- mismo esquema/host que la página actual -- ni con
// backslashes, que algunos navegadores normalizan como "//" también).
// Cualquier otra cosa cae al default seguro de siempre, "/dashboard".
function sanitizeRedirect(value: string | null): string {
  if (!value) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/dashboard";
  }
  return value;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = sanitizeRedirect(searchParams.get("redirect"));

  const t = useTranslations("LoginPage");

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) return;

      // "profession" (migración 036) también se chequea acá, no solo en
      // Register: un Maintler que se registra por primera vez con Google
      // (en vez de email/contraseña) nunca pasa por handleRegister() ni por
      // el router.push("/register/profession") que hay ahí — este listener
      // es el único lugar donde ese usuario "aterriza" después del login,
      // así que es acá donde hay que mandarlo a completar su perfil si
      // todavía no lo hizo.
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

      router.push(redirectTo);
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, redirectTo]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setError(t("incorrectCredentialsError"));
      return;
    }

    // Successful sign-in triggers onAuthStateChange above, which checks the
    // suspended flag before redirecting.
  }

  // Incremento 20: el botón de Google no tenía ningún handler — no hacía
  // absolutamente nada al clickear (bug reportado por Facu). redirectTo usa
  // la URL actual completa (con el locale y el ?redirect= si vino de otra
  // página) para que, al volver de Google, el cliente de Supabase
  // (detectSessionInUrl: true) parsee la sesión de la URL y dispare el
  // onAuthStateChange de arriba en esta misma página/idioma.
  async function handleGoogleSignIn() {
    setError("");
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.href },
    });
    // Si signInWithOAuth no tira error acá, el browser ya está siendo
    // redirigido a Google — este componente no llega a desmontarse "a
    // tiempo" así que no hace falta (ni conviene) un setGoogleLoading(false)
    // en el camino feliz.
    if (error) {
      setGoogleLoading(false);
      setError(t("googleSignInError"));
    }
  }

  return (
    <main className="relative h-dvh md:h-auto md:min-h-dvh bg-carbon overflow-hidden md:overflow-x-hidden md:overflow-y-visible flex flex-col md:items-center md:justify-center px-0 md:px-6 py-0 md:py-10">

      {/* Facu (27 jul 2026, 2da vuelta): en desktop la imagen ocupaba TODA
          la pantalla de punta a punta (absolute inset-0) con el form
          flotando centrado y chiquito encima — en monitores anchos quedaba
          un montón de espacio vacío a los costados, y encima el engranaje
          quedaba cortado arriba (el recorte centrado de object-cover caía
          sobre la zona vacía de la imagen, no sobre el logo). Ahora la
          imagen vive en un panel contenido (no de punta a punta, esquinas
          redondeadas + sombra), del mismo ancho que el form, y la tarjeta
          se "engancha" superpuesta en el borde inferior — mismo espíritu
          que mobile (franja arriba + tarjeta abajo) pero a escala de
          escritorio, para que se sienta diseñado y no un modal genérico
          flotando sobre un fondo de pantalla. Mobile no se tocó. ── */}
      <div className="w-full md:max-w-[1040px] flex flex-col flex-1 md:flex-none min-h-0">

        {/* ── HERO: mobile usa la franja angosta de 125px (recorte vertical
            hecho a medida); desktop usa un panel contenido de 380px con
            esquinas redondeadas y sombra, no full-bleed. ── */}
        <div className="relative shrink-0 overflow-hidden bg-carbon h-[125px] md:h-[380px] md:rounded-[32px] md:shadow-industrial-dark">
          <Image
            src="/images/login-hero-mobile-dark.png"
            alt="MaintlyQR"
            fill
            priority
            sizes="100vw"
            className="md:hidden"
            style={{ objectFit: "cover", objectPosition: "50% 8%" }}
          />
          <Image
            src="/images/login-hero-desktop-dark.png"
            alt="MaintlyQR"
            fill
            priority
            sizes="(max-width: 768px) 0px, 1040px"
            className="hidden md:block"
            style={{ objectFit: "cover", objectPosition: "50% 22%" }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-carbon md:bg-gradient-to-t md:from-carbon-light/90 md:via-transparent md:to-transparent" />
        </div>

        {/* ── FORMULARIO: en mobile centra en el espacio que queda debajo de
            la franja; en desktop se superpone (margen negativo) sobre el
            borde inferior del panel de arriba, como una tarjeta
            "enganchada". ── */}
        <div className="relative z-10 flex-1 min-h-0 md:flex-none flex items-center justify-center px-5 py-2 md:px-6 md:py-0 md:-mt-20 overflow-hidden md:overflow-visible">
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="w-full max-w-[420px] relative bg-carbon-light rounded-[28px] shadow-industrial-dark px-5 py-4 md:px-8 md:py-9 overflow-hidden"
        >
          {/* Línea de acento — el único "brillo metálico" de la tarjeta */}
          <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-transparent via-maintly-red to-transparent" />

          <div className="text-center mb-3 md:mb-7">
            <motion.div
              className="hidden md:inline-flex items-center justify-center w-14 h-14 rounded-full border border-red-500/30 bg-red-500/10 mb-4"
              animate={{ boxShadow: ["0 0 0 0 rgba(220,38,38,0.25)", "0 0 0 8px rgba(220,38,38,0)", "0 0 0 0 rgba(220,38,38,0)"] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeOut" }}
            >
              <User size={24} className="text-red-400" />
            </motion.div>
            <h2 className="text-[19px] md:text-[26px] font-black text-white">{t("welcomeBack")}</h2>
            <p className="hidden md:block text-[13px] text-zinc-400 mt-1">{t("subtitle")}</p>
          </div>

          <form onSubmit={handleLogin}>
          {/* Email */}
          <div className="mb-2.5 md:mb-4">
            <label className="text-[12px] font-bold text-zinc-300">{t("emailLabel")}</label>
            <div className="relative mt-1">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
                className="w-full rounded-xl border border-zinc-700 bg-carbon text-white placeholder:text-zinc-500 pl-10 pr-3 py-[9px] md:py-[12px] text-[14px] outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div className="mb-2 md:mb-3">
            <label className="text-[12px] font-bold text-zinc-300">{t("passwordLabel")}</label>
            <div className="relative mt-1">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("passwordPlaceholder")}
                className="w-full rounded-xl border border-zinc-700 bg-carbon text-white placeholder:text-zinc-500 pl-10 pr-10 py-[9px] md:py-[12px] text-[14px] outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition-all"
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

          {/* Remember + forgot */}
          <div className="flex items-center justify-between mb-2.5 md:mb-5">
            <label className="flex items-center gap-2 text-[12px] text-zinc-400 cursor-pointer">
              <input type="checkbox" className="rounded border-zinc-600 bg-carbon text-red-600 focus:ring-red-500" />
              {t("rememberMe")}
            </label>
            <a href="#" className="text-[12px] text-red-400 hover:text-red-300 font-semibold">{t("forgotPassword")}</a>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.2 }}
                className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 flex items-center gap-2 text-[12px] text-red-300 overflow-hidden"
              >
                <AlertCircle size={14} className="shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Login button */}
          <motion.button
            whileHover={{ scale: loading ? 1 : 1.015 }}
            whileTap={{ scale: loading ? 1 : 0.98 }}
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-white font-bold py-[10px] md:py-[13px] rounded-xl text-[14px] tracking-wide uppercase shadow-industrial-dark"
          >
            {loading ? t("loggingIn") : t("loginButton")}
          </motion.button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-2.5 md:my-5">
            <div className="flex-1 h-[1px] bg-zinc-700" />
            <span className="text-[11px] text-zinc-500">{t("orDivider")}</span>
            <div className="flex-1 h-[1px] bg-zinc-700" />
          </div>

          {/* Google — se mantiene blanco a propósito (así se lee bien sobre
              cualquier fondo, es la convención habitual del botón de Google) */}
          <motion.button
            whileHover={{ scale: googleLoading ? 1 : 1.015 }}
            whileTap={{ scale: googleLoading ? 1 : 0.98 }}
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 border border-zinc-300 bg-white hover:bg-zinc-50 hover:border-zinc-400 hover:shadow-sm disabled:opacity-60 disabled:cursor-not-allowed transition-colors duration-150 py-[9px] md:py-[12px] rounded-xl text-[13px] font-semibold text-zinc-700"
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

          {/* Create account */}
          <p className="text-center text-[13px] text-zinc-400 mt-3 md:mt-6">
            {t("newToMaintly")}{" "}
            <Link href="/register" className="text-red-400 hover:text-red-300 font-bold">{t("createAccountLink")}</Link>
          </p>

          {/* Browse without account */}
          <p className="text-center text-[12px] text-zinc-500 mt-1.5 md:mt-3">
            <Link href="/" className="hover:text-zinc-300 underline">{t("continueBrowsing")}</Link>
          </p>
          </motion.div>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-carbon flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
