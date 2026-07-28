"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, ShieldCheck, Camera, Keyboard, User, Globe, Clock, TrendingUp, LogOut, LayoutGrid, X, Menu, Wrench, FileText, ExternalLink, ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabase";
import QRScannerModal from "@/components/QRScannerModal";
import LanguageSwitcher from "@/components/LanguageSwitcher";

type PublicStats = { machines: number; services: number; mechanics: number };

export default function HomePage() {
  const router = useRouter();
  const t = useTranslations("HomePage");
  const tNav = useTranslations("Nav");
  const [loggedIn, setLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState<PublicStats | null>(null);

  // Camera scanner — the actual camera/jsQR logic lives in QRScannerModal,
  // shared with the "link existing asset" flows in the dashboard.
  const [showCamera, setShowCamera] = useState(false);

  // Incremento 22 (Facu): en mobile el Home ahora es un diseño propio,
  // distinto al de desktop (mismo criterio que ya usamos en Login/Register)
  // -- una foto a pantalla completa con lo esencial (marca + las 2 acciones)
  // sin scroll, y el contenido secundario (sellos, stats, pilares, footer)
  // en una sección aparte más abajo, a la que se llega con un toque de
  // scroll. Este ref apunta a esa sección para el botón "Ver más".
  const moreRef = useRef<HTMLDivElement>(null);

  // Incremento 20: cuando Google vuelve acá con la sesión en el hash de la
  // URL (#access_token=...), pasa un par de segundos entre que la página
  // carga y el listener de onAuthStateChange de abajo la procesa y
  // redirige a /dashboard o /register/profession. Sin esto, en el medio
  // se alcanza a ver la landing pública entera (Home) antes del salto --
  // el "flash" que reportó Facu. useLayoutEffect corre sincrónicamente
  // apenas se monta el componente, ANTES de que el navegador pinte algo
  // en pantalla, así que el usuario nunca llega a ver ese contenido: arranca
  // directo con el spinner. El valor inicial (false) es el mismo que ya
  // renderizó el servidor, así que no hay mismatch de hidratación -- recién
  // cambia del lado del cliente, después del primer render.
  const [authRedirecting, setAuthRedirecting] = useState(false);
  useLayoutEffect(() => {
    if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
      setAuthRedirecting(true);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setLoggedIn(true);
        const name = session.user.user_metadata?.name || session.user.email || "User";
        setUserName(name.split(" ")[0]);
      } else {
        setLoggedIn(false);
        setUserName("");
      }

      // Incremento 20: red de contención para el login con Google. Login y
      // Register ya tienen su propio listener que manda a /dashboard o
      // /register/profession apenas se establece la sesión — pero ese
      // listener solo corre si Supabase efectivamente redirige de vuelta a
      // esa misma página. Si por lo que sea (redirect_to no coincide con
      // la lista de "Redirect URLs" configurada en Supabase, typo de
      // www/no-www, etc.) Supabase termina mandando al usuario acá a Home
      // en cambio, sin esto se quedaría logueado pero mirando la landing
      // pública. Se filtra específicamente por el evento "SIGNED_IN" (no
      // "INITIAL_SESSION") para no redirigir a alguien que ya estaba
      // logueado y simplemente entró a mirar la home a propósito.
      if (event === "SIGNED_IN" && session) {
        const { data: m } = await supabase.from("mechanics").select("suspended, deleted_at, profession").eq("id", session.user.id).maybeSingle();
        if (m?.deleted_at || m?.suspended) return; // el listener de Login ya muestra el error si vino de ahí; acá no hay dónde mostrarlo, así que no forzamos nada más.
        router.push(m?.profession ? "/dashboard" : "/register/profession");
      }
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real, live platform stats for the trust bar — no made-up numbers.
  // get_public_stats() is a security-definer function (migration 016) that
  // only ever returns three counts, never any row-level data.
  useEffect(() => {
    supabase.rpc("get_public_stats").then(({ data }) => {
      const row = data?.[0];
      if (row) {
        setStats({
          machines: row.machines_count ?? 0,
          services: row.services_count ?? 0,
          mechanics: row.mechanics_count ?? 0,
        });
      }
    });
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setLoggedIn(false);
  }

  function handleGoToAsset() {
    const code = qrCode.trim();
    if (!code) return;
    router.push(`/asset/${code}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleGoToAsset();
  }

  // ── CAMERA SCANNER ────────────────────────────────────────────────────────────

  function openCamera() {
    setShowCamera(true);
  }

  function handleScanDetect(code: string) {
    setShowCamera(false);
    router.push(`/asset/${code}`);
  }

  // Nav links below all point at pages that haven't been migrated under
  // src/app/[locale]/ yet (see MAINTLYQR_FEATURE_BACKLOG.md for rollout
  // order) — they stay plain, un-prefixed <a href> on purpose. Once a given
  // target page gets its own [locale] version, swap that one entry to
  // next-intl's <Link> (from "@/i18n/navigation") so it keeps the visitor's
  // current language.
  const navLinks = [
    { label: tNav("product"), href: "/product" },
    { label: tNav("howItWorks"), href: "/how-it-works" },
    { label: tNav("industries"), href: "/industries" },
    { label: tNav("pricing"), href: "/pricing" },
    { label: tNav("resources"), href: "/resources" },
    { label: "API", href: "/api" },
    { label: tNav("about"), href: "/about" },
  ];

  // Incremento 20: mientras se resuelve el redirect post-Google (ver
  // useLayoutEffect de arriba), se muestra este spinner en vez de toda la
  // landing -- se llega hasta acá (después de todos los hooks) para
  // respetar las reglas de hooks, sin condicionar ninguno de ellos.
  if (authRedirecting) {
    return (
      <main className="min-h-dvh flex items-center justify-center bg-white">
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  // Incremento 22: estos 4 bloques (sellos de confianza, stats en vivo,
  // pilares, footer) se muestran en dos lugares distintos ahora -- adentro
  // de la sección de hero de desktop (como siempre) y en la nueva sección
  // secundaria de mobile, más abajo del hero a pantalla completa. Viven acá
  // como variables para no duplicar el JSX/las traducciones en los dos
  // lugares (mismo patrón que "const card" en Login/Register).
  const trustBar = (
    <div className="flex flex-wrap items-center justify-center gap-3 text-zinc-500" style={{marginTop:'0.4vh'}}>
      <ShieldCheck className="text-red-500 shrink-0" style={{width:'clamp(11px,0.9vw,14px)', height:'clamp(11px,0.9vw,14px)'}} />
      <span style={{fontSize:'clamp(10px,0.8vw,12px)'}}>{t("trustBarText")}</span>
      <div className="flex -space-x-2">
        {["#dc2626","#1d4ed8","#16a34a","#d97706","#7c3aed"].map((color, i) => (
          <div key={i} className="rounded-full border-2 border-white flex items-center justify-center text-white font-black" style={{background:color, width:'clamp(18px,1.6vw,22px)', height:'clamp(18px,1.6vw,22px)', fontSize:'clamp(6px,0.5vw,8px)'}}>
            {["JM","AS","RK","LP","TW"][i]}
          </div>
        ))}
      </div>
      <a
        href="/asset/demogen001"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 font-black uppercase tracking-wide text-white bg-red-600 hover:bg-red-500 active:scale-[0.97] transition-all rounded-full shadow-md shadow-red-900/25 whitespace-nowrap"
        style={{fontSize:'clamp(9px,0.75vw,11px)', padding:'clamp(5px,0.7vh,8px) clamp(10px,1vw,14px)'}}
      >
        {t("viewLiveExample")} <ExternalLink style={{width:'clamp(9px,0.75vw,11px)', height:'clamp(9px,0.75vw,11px)'}} />
      </a>
    </div>
  );

  const statsGrid = (
    <div className="w-full max-w-[680px] grid grid-cols-2 md:grid-cols-4 rounded-2xl overflow-hidden bg-zinc-900 shadow-lg" style={{marginTop:'0.5vh'}}>
      {[
        { icon: Globe, value: stats ? stats.machines.toLocaleString() : "—", label: t("statMachines") },
        { icon: FileText, value: stats ? stats.services.toLocaleString() : "—", label: t("statServices") },
        { icon: Wrench, value: stats ? stats.mechanics.toLocaleString() : "—", label: t("statMechanics") },
        { icon: TrendingUp, value: null, label: t("statGrowing") },
      ].map(({ icon: Icon, value, label }, i) => (
        <div key={label} className={["flex flex-row items-center justify-center gap-1.5 px-2 border-white/10", i % 2 === 0 ? "border-r" : "", i < 2 ? "border-b" : "", "md:border-b-0", i < 3 ? "md:border-r" : "md:border-r-0"].filter(Boolean).join(" ")} style={{paddingTop:'clamp(6px,0.8vh,11px)', paddingBottom:'clamp(6px,0.8vh,11px)'}}>
          <Icon className="text-red-500 shrink-0" style={{width:'clamp(13px,1.1vw,17px)', height:'clamp(13px,1.1vw,17px)'}} />
          <div className="flex flex-col items-start leading-none">
            {value !== null && (
              <p className="font-black text-white leading-none" style={{fontSize:'clamp(13px,1.3vw,18px)'}}>{value}</p>
            )}
            <p className="text-zinc-400 font-semibold uppercase tracking-wide leading-tight" style={{fontSize:'clamp(8px,0.55vw,8.5px)', marginTop: value !== null ? '1px' : '0'}}>{label}</p>
          </div>
        </div>
      ))}
    </div>
  );

  // i18n QA round 3 (Facu): "Access Anywhere" etc. es corto en inglés pero
  // sus equivalentes en español/portugués son notablemente más largos
  // ("Acceso Desde Cualquier Lugar"). Por eso la columna es max-w-[680px] en
  // vez de 540px -- le da lugar al texto largo en una sola línea. El wrap
  // de abajo queda como red de contención para cualquier idioma futuro con
  // texto aún más largo.
  const pillarsGrid = (
    <div className="w-full max-w-[680px] grid grid-cols-2 md:grid-cols-4 rounded-2xl overflow-hidden border border-zinc-200 bg-white/92 backdrop-blur-sm shadow-sm" style={{marginTop:'0.4vh'}}>
      {[
        { icon: ShieldCheck, title: t("pillarSecure") },
        { icon: Globe, title: t("pillarAccess") },
        { icon: Clock, title: t("pillarHistory") },
        { icon: TrendingUp, title: t("pillarGrow") },
      ].map(({ icon: Icon, title }, i) => (
        <div key={title} className={["flex flex-row items-center justify-center gap-1 px-1 border-zinc-200", i % 2 === 0 ? "border-r" : "", i < 2 ? "border-b" : "", "md:border-b-0", i < 3 ? "md:border-r" : "md:border-r-0"].filter(Boolean).join(" ")} style={{paddingTop:'clamp(6px,0.7vh,10px)', paddingBottom:'clamp(6px,0.7vh,10px)'}}>
          <div className="rounded-full border border-red-200 bg-red-50 flex items-center justify-center text-red-500 shrink-0" style={{width:'clamp(16px,1.4vw,20px)', height:'clamp(16px,1.4vw,20px)'}}>
            <Icon style={{width:'clamp(8px,0.75vw,11px)', height:'clamp(8px,0.75vw,11px)'}} />
          </div>
          <p className="font-black tracking-normal text-zinc-800 leading-tight uppercase text-center" style={{fontSize:'clamp(8px,0.56vw,8.5px)'}}>{title}</p>
        </div>
      ))}
    </div>
  );

  const footerLinks = (
    <div className="flex justify-center items-center gap-3 flex-wrap" style={{marginTop:'0.15vh', marginBottom:'0.15vh'}}>
      <span className="tracking-[0.2em] text-zinc-400 font-semibold uppercase" style={{fontSize:'clamp(8px,0.55vw,8px)'}}>{t("footerBrand")}</span>
      <span className="text-red-400" style={{fontSize:'clamp(6px,0.5vw,7px)'}}>•</span>
      <span className="tracking-[0.2em] text-zinc-400 font-semibold uppercase" style={{fontSize:'clamp(8px,0.55vw,8px)'}}>{t("footerTagline")}</span>
      <span className="text-red-400" style={{fontSize:'clamp(6px,0.5vw,7px)'}}>•</span>
      <Link href="/terms" className="tracking-[0.2em] text-zinc-400 hover:text-red-500 font-semibold uppercase transition-colors" style={{fontSize:'clamp(8px,0.55vw,8px)'}}>{t("footerTerms")}</Link>
      <span className="text-red-400" style={{fontSize:'clamp(6px,0.5vw,7px)'}}>•</span>
      <Link href="/privacy" className="tracking-[0.2em] text-zinc-400 hover:text-red-500 font-semibold uppercase transition-colors" style={{fontSize:'clamp(8px,0.55vw,8px)'}}>{t("footerPrivacy")}</Link>
      <span className="text-red-400" style={{fontSize:'clamp(6px,0.5vw,7px)'}}>•</span>
      <Link href="/cookies" className="tracking-[0.2em] text-zinc-400 hover:text-red-500 font-semibold uppercase transition-colors" style={{fontSize:'clamp(8px,0.55vw,8px)'}}>{t("footerCookies")}</Link>
      <span className="text-red-400" style={{fontSize:'clamp(6px,0.5vw,7px)'}}>•</span>
      <span className="tracking-[0.2em] text-zinc-400 font-semibold uppercase" style={{fontSize:'clamp(8px,0.55vw,8px)'}}>{t("footerRights")}</span>
    </div>
  );

  return (
    <main className="relative min-h-dvh md:h-dvh overflow-x-hidden md:overflow-hidden bg-white text-zinc-900 flex flex-col">

      {/* ── BACKGROUND (desktop only — mobile tiene su propia foto a pantalla
           completa en la sección de hero de abajo, no esta) ── */}
      <div className="hidden md:block absolute inset-0 z-0">
        <Image src="/images/fondo.jpg" alt="MaintlyQR background" fill priority sizes="100vw" quality={90} className="object-cover object-center" />
      </div>
      <div className="hidden md:block absolute inset-0 z-0 bg-white/15 pointer-events-none" />

      {/* ════ NAVBAR ════ */}
      <nav className="relative z-50 flex items-center justify-between pl-3 pr-4 md:pr-8 bg-transparent border-b border-white/10 shrink-0 h-16 md:h-[7.2vh]">
        <a href="/" aria-label={t("homeAriaLabel")} className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/maintly-logo-full.png" alt="MaintlyQR" className="h-10 md:h-[clamp(40px,7vh,84px)] w-auto object-contain" />
        </a>

        <div className="hidden md:flex items-center gap-10">
          {navLinks.map(({ label, href }) => (
            <a key={href} href={href} className="text-zinc-700 hover:text-zinc-900 font-medium transition-colors" style={{fontSize:'clamp(11px,0.85vw,13px)'}}>
              {label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-4">
          <LanguageSwitcher />
          {loggedIn ? (
            <div className="flex items-center gap-2">
              <a href="/dashboard" className="flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white font-black tracking-wide rounded-xl transition-all shadow-md px-4 py-2" style={{fontSize:'clamp(10px,0.75vw,12px)'}}>
                <LayoutGrid size={13} /> {userName}
              </a>
              <button onClick={handleLogout} className="flex items-center gap-1.5 text-zinc-500 hover:text-red-600 transition-colors border border-zinc-200 rounded-xl px-3 py-2" style={{fontSize:'clamp(10px,0.75vw,12px)'}}>
                <LogOut size={13} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <Link href="/login" className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-black tracking-wide rounded-xl transition-all uppercase px-4 py-2 shadow-md shadow-red-900/20" style={{fontSize:'clamp(10px,0.75vw,12px)'}}>
                <User size={13} /> {tNav("login")}
              </Link>
            </div>
          )}
        </div>

        {/* Incremento 21 (Facu): en mobile quiere el botón de login/dashboard
            visible de una, sin tener que abrir el menú hamburguesa.
            IMPORTANTE: el md:hidden va en este DIV envolvente, no solo en
            sus hijos -- un div con display:flex sigue contando como un
            elemento más para el justify-between del <nav> aunque todos sus
            hijos tengan md:hidden y no se vea nada adentro. La primera
            versión de este bloque tenía el md:hidden únicamente en los
            hijos, así que en desktop quedaba un 4to elemento fantasma
            (invisible pero ocupando lugar) después del bloque de
            login/idioma, y eso corría todo ese bloque hacia la izquierda
            -- exactamente el bug que reportó Facu. Con md:hidden acá afuera,
            en desktop este div completo desaparece del layout (display:none)
            y el <nav> vuelve a tener sus 3 elementos de siempre. */}
        <div className="md:hidden flex items-center gap-2">
          <div className="flex items-center">
            {loggedIn ? (
              <a href="/dashboard" className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-black tracking-wide rounded-lg transition-all shadow-md px-3 py-1.5 text-[11px]">
                <LayoutGrid size={12} /> {userName}
              </a>
            ) : (
              <Link href="/login" className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white font-black tracking-wide rounded-lg transition-all uppercase px-3 py-1.5 text-[11px] shadow-md shadow-red-900/20">
                <User size={12} /> {tNav("login")}
              </Link>
            )}
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-zinc-700 hover:text-zinc-900 p-2"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      {mobileMenuOpen && (
        <div className="md:hidden relative z-40 bg-white border-b border-zinc-200 shadow-lg flex flex-col px-5 py-4 gap-1">
          {navLinks.map(({ label, href }) => (
            <a key={href} href={href} onClick={() => setMobileMenuOpen(false)} className="text-zinc-700 hover:text-zinc-900 font-medium py-2 border-b border-zinc-100 last:border-0">
              {label}
            </a>
          ))}
          <div className="py-2">
            <LanguageSwitcher />
          </div>
          {loggedIn && (
            <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} className="flex items-center justify-center gap-1.5 text-zinc-500 hover:text-red-600 transition-colors border border-zinc-200 rounded-xl px-3 py-3 text-[13px] mt-2">
              <LogOut size={14} /> {tNav("logout")}
            </button>
          )}
        </div>
      )}

      {/* ════ MOBILE HERO — diseño propio, foto a pantalla completa ════
          Incremento 22 (Facu): "en el celu se puede usar otro diseño...
          como hicimos con el login". Altura fija = 100dvh menos la navbar
          (h-16 = 4rem), así siempre se ve como "una pantalla completa" sin
          importar cuánto contenido haya más abajo -- lo secundario vive en
          la sección aparte que sigue, y esa sí puede scrollear. */}
      <section className="md:hidden relative shrink-0 overflow-hidden" style={{height:'calc(100dvh - 4rem)'}}>
        <div className="absolute inset-0 z-0">
          <Image src="/images/login-hero-mobile-light.png" alt="MaintlyQR" fill priority sizes="100vw" className="object-cover object-top" />
        </div>

        {/* La foto ya trae su propio ícono de engranaje+QR arriba, así que
            acá no se repite un logo aparte -- el texto va directamente en
            la franja vacía de la imagen (mapa mundial de fondo, sin
            vehículos todavía). */}
        <div className="absolute left-0 right-0 z-10 text-center px-5" style={{top:'29%'}}>
          <h1 className="font-black leading-[1.02] tracking-tighter text-zinc-900 uppercase text-[28px]">
            {t("heroTitleLine1")}<br />{t("heroTitleLine2Prefix")}<span className="text-red-600">{t("heroTitleHighlight")}</span>
          </h1>
          <div className="w-12 h-[3px] bg-red-600 rounded-full mx-auto" style={{marginTop:'0.7vh', marginBottom:'0.7vh'}} />
          <p className="font-bold text-zinc-800 text-[13.5px]">
            <span className="text-red-600 font-black">{t("heroSubtitleHighlight")}</span> {t("heroSubtitleRest")}
          </p>
          <p className="text-zinc-600 text-[11.5px] leading-[1.35] mt-1 max-w-[300px] mx-auto">
            {t("heroDescription")}
          </p>
        </div>

        {/* Scrim para que los botones de abajo (que ya son sólidos, no
            necesitan esto para leerse) asienten prolijo sobre los vehículos
            de la foto en vez de cortar de golpe. */}
        <div className="absolute left-0 right-0 bottom-0 z-0 pointer-events-none" style={{height:'34%', background:'linear-gradient(to top, rgba(255,255,255,0.88), rgba(255,255,255,0))'}} />

        <div className="absolute left-0 right-0 z-10 px-5" style={{bottom:'3vh'}}>
          <div className="flex flex-row gap-2.5 w-full">
            <button
              onClick={openCamera}
              className="flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 rounded-2xl bg-red-600 active:scale-[0.98] transition-all text-white shadow-lg shadow-red-900/30 py-3.5 px-2"
            >
              <span className="flex items-center gap-1.5 font-black uppercase tracking-wide text-[12.5px]">
                <Camera size={14} /> {t("scanCardTitle")}
              </span>
              <span className="text-[9.5px] font-medium text-red-100">{t("scanCardDescriptionLine1")}</span>
            </button>

            <div className="flex-1 min-w-0 flex items-center gap-1.5 rounded-2xl bg-white/95 border border-zinc-200 shadow-md py-1.5 pl-3 pr-1.5">
              <Keyboard size={14} className="text-zinc-400 shrink-0" />
              <input
                type="text"
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("enterCardPlaceholder")}
                className="flex-1 min-w-0 bg-transparent outline-none text-[12px] text-zinc-700 placeholder:text-zinc-400 text-ellipsis"
              />
              <button
                onClick={handleGoToAsset}
                disabled={!qrCode.trim()}
                aria-label={t("enterCardTitle")}
                className="rounded-xl bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all p-2 flex items-center justify-center shrink-0"
              >
                <ArrowRight size={13} className="text-white" />
              </button>
            </div>
          </div>

          <button
            onClick={() => moreRef.current?.scrollIntoView({ behavior: "smooth" })}
            className="flex flex-col items-center gap-0.5 text-zinc-600/80 mx-auto"
            style={{marginTop:'1vh'}}
          >
            <span className="text-[9px] font-bold uppercase tracking-[0.15em]">{t("scrollForMore")}</span>
            <ChevronDown size={14} />
          </button>
        </div>
      </section>

      {/* ════ MOBILE — CONTENIDO SECUNDARIO (con scroll) ════
          Sellos de confianza, stats en vivo, pilares y footer -- ya no
          compiten por espacio en la pantalla principal, así que quedan acá
          abajo, alcanzables con un toque de scroll. */}
      <section ref={moreRef} className="md:hidden relative z-10 bg-white px-4 pt-6 pb-6 flex flex-col items-center gap-3">
        {trustBar}
        {statsGrid}
        {pillarsGrid}
        {footerLinks}
      </section>

      {/* ════ DESKTOP HERO ════ (sin cambios de diseño — Facu ya aprobó
          este layout; solo vive detrás de hidden md:flex ahora que mobile
          tiene su propia sección arriba) */}
      <section className="hidden md:flex relative z-10 flex-col items-center text-center px-4 flex-1 min-h-0" style={{paddingTop:'1vh'}}>

        <a href="/" aria-label={t("homeAriaLabel")} className="transition-transform duration-300 ease-out hover:scale-[1.3] active:scale-95">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/qr-gear-real.png"
            alt="MaintlyQR"
            className="object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.15)] cursor-pointer"
            style={{ width: 'clamp(130px,min(19vw,22.5vh),300px)', height: 'clamp(130px,min(19vw,22.5vh),300px)', marginBottom: '0.6vh' }}
          />
        </a>

        <h1 className="font-black leading-[0.98] tracking-tighter text-zinc-900 uppercase" style={{fontSize:'clamp(36px,min(7.2vw,8.8vh),74px)'}}>
          {t("heroTitleLine1")}<br />{t("heroTitleLine2Prefix")}<span className="text-red-600">{t("heroTitleHighlight")}</span>
        </h1>

        <div className="w-14 h-[3px] bg-red-600 rounded-full" style={{marginTop:'0.8vh'}} />

        <p className="font-semibold text-zinc-800" style={{fontSize:'clamp(13px,1.2vw,18px)', marginTop:'0.6vh'}}>
          <span className="text-red-600 font-black">{t("heroSubtitleHighlight")}</span> {t("heroSubtitleRest")}
        </p>
        <p className="text-zinc-500 max-w-lg leading-[1.4]" style={{fontSize:'clamp(11px,0.9vw,14px)', marginTop:'0.2vh'}}>
          {t("heroDescription")}
        </p>

        {/* ── ACTION CARDS ── */}
        <div className="flex flex-row items-stretch w-full max-w-[680px] rounded-2xl overflow-hidden shadow-[0_8px_50px_rgba(0,0,0,0.13)] border border-zinc-200/80" style={{marginTop:'0.8vh'}}>

          {/* SCAN QR */}
          <div className="flex-1 bg-zinc-900 flex flex-col items-center text-center px-7 rounded-l-2xl" style={{paddingTop:'0.9vh', paddingBottom:'0.9vh'}}>
            <div className="rounded-full bg-red-600/15 border border-red-600/30 flex items-center justify-center mb-3" style={{width:'clamp(40px,4vw,56px)', height:'clamp(40px,4vw,56px)'}}>
              <Camera className="text-red-500" style={{width:'clamp(18px,1.8vw,26px)', height:'clamp(18px,1.8vw,26px)'}} />
            </div>
            <h2 className="font-black tracking-[0.06em] text-white mb-1 uppercase" style={{fontSize:'clamp(10px,0.7vw,12px)'}}>{t("scanCardTitle")}</h2>
            <p className="text-zinc-400 leading-tight flex-1" style={{fontSize:'clamp(9px,0.7vw,11px)', marginBottom:'1.5vh'}}>
              {t("scanCardDescriptionLine1")}<br />{t("scanCardDescriptionLine2")}
            </p>
            <button
              onClick={openCamera}
              className="w-full rounded-xl bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all text-white flex items-center justify-center gap-2 shadow-lg shadow-red-900/30 font-black tracking-[0.1em] uppercase"
              style={{fontSize:'clamp(9px,0.75vw,11px)', padding:'clamp(7px,0.9vh,11px) 0'}}
            >
              <Camera style={{width:'clamp(11px,0.9vw,14px)', height:'clamp(11px,0.9vw,14px)'}} /> {t("scanCardButton")}
            </button>
          </div>

          {/* OR */}
          <div className="flex flex-col items-center justify-center bg-white px-3 shrink-0 gap-2">
            <div className="h-auto w-[1px] flex-1 bg-zinc-200" />
            <div className="rounded-full border-2 border-zinc-200 bg-white flex items-center justify-center shrink-0" style={{width:'clamp(28px,2.5vw,36px)', height:'clamp(28px,2.5vw,36px)'}}>
              <span className="text-zinc-400 font-black" style={{fontSize:'clamp(8px,0.65vw,10px)'}}>{t("or")}</span>
            </div>
            <div className="h-auto w-[1px] flex-1 bg-zinc-200" />
          </div>

          {/* ENTER QR */}
          <div className="flex-1 bg-white flex flex-col items-center text-center px-7 rounded-r-2xl" style={{paddingTop:'0.9vh', paddingBottom:'0.9vh'}}>
            <div className="rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center mb-3" style={{width:'clamp(40px,4vw,56px)', height:'clamp(40px,4vw,56px)'}}>
              <Keyboard className="text-zinc-500" style={{width:'clamp(16px,1.5vw,22px)', height:'clamp(16px,1.5vw,22px)'}} />
            </div>
            <h2 className="font-black tracking-[0.06em] text-zinc-900 mb-1 uppercase" style={{fontSize:'clamp(10px,0.7vw,12px)'}}>{t("enterCardTitle")}</h2>
            <p className="text-zinc-400 leading-tight flex-1" style={{fontSize:'clamp(9px,0.7vw,11px)', marginBottom:'1.5vh'}}>
              {t("enterCardDescriptionLine1")}<br />{t("enterCardDescriptionLine2")}
            </p>
            <div className="w-full flex gap-2">
              <input
                type="text"
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t("enterCardPlaceholder")}
                className="flex-1 rounded-xl bg-zinc-50 border border-zinc-200 focus:border-red-500 outline-none px-3 text-zinc-700 placeholder:text-zinc-400 transition-all"
                style={{fontSize:'clamp(9px,0.7vw,11px)', padding:'clamp(7px,0.9vh,11px) 12px'}}
              />
              <button
                onClick={handleGoToAsset}
                disabled={!qrCode.trim()}
                className="rounded-xl bg-red-600 hover:bg-red-500 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all px-3 flex items-center justify-center shrink-0 shadow-md shadow-red-900/20"
              >
                <ArrowRight className="text-white" style={{width:'clamp(12px,1.1vw,16px)', height:'clamp(12px,1.1vw,16px)'}} />
              </button>
            </div>
          </div>
        </div>

        {trustBar}
        {statsGrid}
        {pillarsGrid}
        {footerLinks}

      </section>

      {/* ════ CAMERA OVERLAY ════ */}
      {showCamera && (
        <QRScannerModal onDetect={handleScanDetect} onClose={() => setShowCamera(false)} />
      )}
    </main>
  );
}
