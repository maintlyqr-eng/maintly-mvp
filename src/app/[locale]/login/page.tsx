"use client";

import Image from "next/image";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, AlertCircle, QrCode } from "lucide-react";
import { supabase } from "@/lib/supabase";

// 28 jul 2026 — primera pantalla rediseñada con el nuevo sistema visual
// "industrial" (ver el comment de globals.css).
// 27 jul 2026 (4ta vuelta) — Facu mandó un mockup de referencia (hecho con
// ChatGPT) de cómo quería que quedara esto, y es un enfoque bastante
// distinto a las 3 vueltas anteriores:
//   - El logo completo (engranaje+QR + wordmark "MAINTLYQR" + el tagline
//     "MAINTENANCE · TRACKED") vive DENTRO de la tarjeta, arriba del
//     título — usando el archivo real /images/maintly-logo-full.png (el
//     mismo logo que ya se usa en otros lados de la app), no un ícono
//     genérico ni un dibujo de fondo.
//   - El fondo deja de depender de una imagen "hero" con vehículos/mapa —
//     ahora es 100% CSS (una grilla de puntos sutil + un par de
//     resplandores rojos difuminados). Esto elimina de raíz el problema de
//     las últimas 3 vueltas (recortes del engranaje, paneles vacíos que
//     alinear, scroll que no entraba) porque ya no hay ninguna imagen que
//     alinear con nada — el fondo se ve igual de bien en cualquier tamaño
//     de pantalla, siempre.
//   - La tarjeta suma un borde rojo visible (además del glow de
//     shadow-industrial-dark), como en la referencia.
//   - Se agrega una barra de 4 "features" (Seguro/Confiable/Inteligente/
//     Simple) debajo de la tarjeta — solo en desktop (oculta en mobile a
//     propósito, para no comerse el alto en una pantalla chica; ese
//     contenido no es crítico para poder loguearse).
// 27 jul 2026 (5ta vuelta) — ajustes después de ver la 4ta en producción:
//   - El logo (36-40px de alto) se veía borroso/chico — se agrandó a
//     56-64px, y se volvió a ocultar en mobile (como el ícono viejo) para
//     no perder espacio en una pantalla chica.
//   - Se restauró la franja hero de mobile (login-hero-mobile-dark.png)
//     que ya había quedado bien antes de esta ronda de cambios — esa parte
//     nunca debió tocarse.
//   - La barra de features quedaba pegada al borde de la ventana con el
//     texto cortado a la mitad (truncate) — ahora tiene margen propio y el
//     texto envuelve en dos líneas en vez de cortarse.
// 27 jul 2026 (6ta vuelta) — Facu prefirió mantener vehículos en el fondo
// ("me gusta una imagen con vehículos como la del ejemplo"), así que en vez
// de pedir una imagen nueva "mapa solo" se volvió a usar una de las 5 del
// primer lote: login-hero-desktop-dark-alt.png (la variante oscura CON
// vehículos), con object-contain para que nunca recorte nada, más un par
// de resplandores rojos de CSS encima para reforzar la atmósfera. La
// tarjeta sigue con su logo grande adentro (de la 5ta vuelta).
// Las imágenes login-hero-desktop-dark.png / -light.png / -mobile-light.png
// (del primer lote) quedan guardadas en public/images sin usarse por
// ahora, por si sirven para otra pantalla.
// 27 jul 2026 (7ma vuelta) — dos problemas más reportados sobre la 6ta:
//   - "el logo está horrible": maintly-logo-full.png es un render 3D con
//     mucho detalle fino (reflejos metálicos, sombras) que no escala bien
//     a un tamaño chico dentro de la tarjeta — se veía borroso/aplastado.
//     Se reemplazó por un lockup hecho 100% con texto real (span) + un
//     ícono simple (QrCode de lucide en un círculo con borde rojo) — nunca
//     se pixela ni se ve borroso, sea cual sea el tamaño de pantalla.
//   - "tiene escrol": el total (imagen + tarjeta + barra de features) no
//     entraba en una ventana de laptop común. Se recortó el padding del
//     <main> (py-10→py-5), el padding vertical de la tarjeta (py-9→py-7) y
//     el de la barra de features (py-5→py-3.5, sin margin-bottom extra),
//     además de varios márgenes internos del form — debería entrar sin
//     scroll en pantallas de laptop normales ahora.
// 28 jul 2026 (8va vuelta) — cambio de fondo: "todo está al medio y se ve
// feo, quiero usar más pantalla" + Facu subió una imagen nueva hecha a
// medida (mapa del mundo con líneas rojas de "alcance global" + un cluster
// de máquinas/vehículos/electrodomésticos de todo tipo — auto, moto,
// excavadora, heladera, lavarropas, generador, bomba, taladro) y mandó
// aparte un mockup de referencia (SOLO de estilo, no para copiar literal)
// mostrando un layout asimétrico de 2 columnas que usa toda la pantalla.
//   - Diagnóstico de la 6ta/7ma vuelta: el fondo usaba object-contain
//     centrado en TODO el <main>, mientras la tarjeta se centraba por su
//     cuenta en el viewport completo -- son dos lógicas de centrado
//     independientes, así que en cualquier ventana que no fuera
//     *exactamente* 16:9 (proporción de la imagen) la imagen quedaba
//     achicada+centrada por un lado, y la tarjeta centrada en otro punto
//     por el otro lado -- de ahí el "todo está al medio", en realidad
//     imagen y tarjeta ni siquiera estaban alineadas entre sí.
//   - Fix: se adopta el mismo patrón que ya funciona en Register (ver su
//     comment) -- la imagen nueva SÍ tiene un panel vacío real de fondo
//     claro en su ~38% derecho (a propósito, para que la tarjeta se
//     "enganche" ahí), así que el contenido (spacer invisible + columna
//     angosta con la tarjeta) vive dentro de un contenedor con el MISMO
//     aspect-ratio (1672:941) y el mismo max-width que la imagen de fondo
//     -- las dos cosas escalan y se centran exactamente igual sea cual sea
//     el tamaño de ventana, así que la tarjeta siempre cae sobre la zona
//     vacía real de la imagen en vez de flotar centrada en el medio de la
//     nada.
//   - Se sacaron los dos "glows" rojos de CSS (blur-red) que vivían en un
//     div sin scopear a `md:` -- ese era el origen del "apareció un
//     rectángulo rojo en el fondo" que Facu vio en el celular. Ya no hacen
//     falta: ahora hay una imagen real de fondo.
//   - El fondo de <main> pasa a un gris muy claro (md:bg-[#e9eaec]) SOLO en
//     desktop, para que si queda alguna franja de "letterbox" arriba/abajo
//     de la imagen se mezcle con el gris clarito de la imagen en vez de
//     mostrar barras negras (bg-carbon) contra una imagen clara. Mobile no
//     se toca -- sigue siendo la franja hero oscura que ya había quedado
//     bien aprobada.
//   - La tarjeta y la barra de features quedan igual que la 7ma vuelta
//     (mismo logo-lockup de texto, mismos campos) -- lo único que cambió
//     acá es DÓNDE caen dentro de la pantalla, no su contenido.
//   - Pendiente/a confirmar con Facu: esta imagen no trae el logo de
//     MaintlyQR "horneado" adentro (a diferencia del mockup de referencia,
//     que sí tenía un teléfono con la app + QR grande) -- por ahora el
//     único texto de marca visible en desktop es el logo-lockup adentro de
//     la tarjeta. Si Facu quiere más presencia de marca superpuesta sobre
//     la imagen (título grande, tagline, etc.) eso se suma en otra vuelta
//     una vez que confirme posición/tamaño, para no repetir el error de
//     adivinar texto encima de una imagen que no tiene un espacio pensado
//     para eso.
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

  // 28 jul 2026 (9na vuelta): la tarjeta se extrae a una variable porque
  // ahora mobile y desktop usan estructuras de layout totalmente distintas
  // (ver comment más abajo) y necesitan montarla cada uno en su propio
  // contenedor — el contenido de la tarjeta en sí (header, form, Google,
  // links) no cambió nada, es exactamente el mismo JSX de antes.
  const card = (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      className="w-full relative bg-carbon-light rounded-[28px] border border-red-500/40 shadow-industrial-dark px-5 py-4 md:px-8 md:py-7 overflow-hidden"
    >
          <div className="text-center mb-3 md:mb-5">
            {/* Facu (27 jul 2026, 7ma vuelta): "el logo está horrible" —
                sacamos el archivo maintly-logo-full.png (un render 3D con
                mucho detalle fino que no escala bien a este tamaño chico,
                se veía borroso/aplastado) y lo reemplazamos por un lockup
                hecho con texto real + un ícono simple — se ve nítido a
                cualquier tamaño porque no depende de una imagen rasterizada,
                y usa los mismos colores de marca (blanco + rojo). ── */}
            <div className="hidden md:flex items-center justify-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-carbon border-2 border-red-500 flex items-center justify-center shrink-0">
                <QrCode size={16} className="text-red-500" />
              </div>
              <span className="text-[22px] font-black tracking-tight">
                <span className="text-white">MAINTLY</span><span className="text-red-500">QR</span>
              </span>
            </div>
            <p className="hidden md:block text-[9.5px] tracking-[0.25em] text-zinc-500 uppercase mb-3">
              Maintenance · Tracked
            </p>
            <h2 className="text-[19px] md:text-[24px] font-black text-white">{t("welcomeBack")}</h2>
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
          <div className="flex items-center justify-between mb-2.5 md:mb-4">
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
          <div className="flex items-center gap-3 my-2.5 md:my-4">
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
          <p className="text-center text-[13px] text-zinc-400 mt-3 md:mt-5">
            {t("newToMaintly")}{" "}
            <Link href="/register" className="text-red-400 hover:text-red-300 font-bold">{t("createAccountLink")}</Link>
          </p>

          {/* Browse without account */}
          <p className="text-center text-[12px] text-zinc-500 mt-1.5 md:mt-3">
            <Link href="/" className="hover:text-zinc-300 underline">{t("continueBrowsing")}</Link>
          </p>
    </motion.div>
  );

  // 28 jul 2026 (12va vuelta) — Facu: "le mandaste el rectángulo negro ese
  // feo con Confiable y no sé qué... ese te voy a pasar yo una imagen, así
  // la montás ahí arriba". Se saca la barra de features por completo (el
  // panel armado con ícono+título+descripción de Lucide) — cuando mande
  // la imagen para esa zona se monta en su lugar. FeatureItem y los íconos
  // ShieldCheck/Clock/BarChart3 quedaban sin uso al sacar esto, así que
  // también se sacaron sus imports de arriba.

  return (
    <main className="relative h-dvh bg-carbon overflow-hidden flex flex-col">

      {/* ── HERO MOBILE (< md) — esto ya había quedado bien antes, se
          mantiene tal cual: recorte vertical hecho a medida
          (login-hero-mobile-dark.png). ── */}
      <div className="md:hidden relative z-10 h-[125px] shrink-0 overflow-hidden bg-carbon">
        <Image
          src="/images/login-hero-mobile-dark.png"
          alt="MaintlyQR"
          fill
          priority
          sizes="100vw"
          style={{ objectFit: "cover", objectPosition: "50% 8%" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-carbon" />
      </div>

      {/* ── CONTENIDO MOBILE — sin cambios, la tarjeta centrada tal cual
          ya había quedado aprobada ("en el celu quedó perfecto"). ── */}
      <div className="md:hidden relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center px-5 py-2 overflow-hidden">
        <div className="w-full max-w-[440px] mx-auto">
          {card}
        </div>
      </div>

      {/* ── FONDO (desktop, 12va vuelta) — Facu: "la idea es usar el fondo
          entero de fondo y montar encima el cuadro de login en la parte
          de la imagen donde hay un vacío... vos ahí recortaste la imagen
          de fondo y quedo mal". Se saca el recorte (object-cover) y se
          vuelve a object-contain: la imagen se ve SIEMPRE completa, nunca
          se pierde ni un pixel de ella. Si en alguna ventana queda alguna
          franja de letterbox, se mezcla con el gris clarito de fondo
          (bg-[#e9eaec]) en vez de mostrar barras oscuras. ── */}
      <div className="hidden md:block absolute inset-0 z-0 bg-[#e9eaec]">
        <Image
          src="/images/login-hero-desktop-worldmap.png"
          alt="MaintlyQR"
          fill
          priority
          sizes="100vw"
          className="object-contain object-center"
        />
      </div>

      {/* ── CONTENIDO (desktop, 12va vuelta) — la tarjeta se "engancha"
          en la zona vacía real de la imagen (su ~38% derecho) con el
          mismo truco que ya funciona en Register: un contenedor con el
          MISMO aspect-ratio (1672:941) y el mismo max-width que la
          imagen de fondo — al escalarse y centrarse exactamente igual
          que la imagen (misma lógica de "contain"), la tarjeta siempre
          cae sobre la parte vacía real, sea cual sea el tamaño de
          ventana, en vez de flotar centrada por su cuenta. ── */}
      <div className="hidden md:flex relative z-10 flex-1 min-h-0 items-center justify-center overflow-hidden">
        <div className="w-full flex max-w-[1672px] aspect-[1672/941]">
          <div className="flex-1" />
          <div className="flex items-center w-[38%] pr-[5%]">
            <div className="w-full max-w-[420px] mx-auto">
              {card}
            </div>
          </div>
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
