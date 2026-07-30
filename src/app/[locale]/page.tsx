"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight, ShieldCheck, Camera, Keyboard, User, Globe, Clock, TrendingUp, LogOut, LayoutGrid, X, Menu, Wrench, FileText, ExternalLink, MessageCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import QRScannerModal from "@/components/QRScannerModal";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ContactUsModal from "@/components/ContactUsModal";

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

  // Incremento 26 (Facu): botón "Hablemos" en la navbar, visible para
  // cualquiera (logueado o no) en desktop y mobile -- ver el comentario
  // completo en ContactUsModal.tsx.
  const [showContactUs, setShowContactUs] = useState(false);

  // Incremento 22 (Facu): en mobile el Home ahora es un diseño propio,
  // distinto al de desktop (mismo criterio que ya usamos en Login/Register)
  // -- una foto a pantalla completa con TODO el contenido (marca, acciones,
  // stats, sellos, pilares y footer) comprimido dentro de una sola sección
  // de altura fija, sin scroll alguno (pedido explícito de Facu: "no quiero
  // escrol").

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
  // Incremento 25 (Facu): "cuando estoy logueado y vuelvo al home, se queda
  // un rato y vuelve al dashboard" -- en desktop y en celu. Esto pasaba en
  // visitas NORMALES a Home ya logueado, no solo volviendo de Google. Causa:
  // el listener de abajo confiaba en el nombre del evento ("SIGNED_IN") para
  // decidir si redirigir, pero el cliente de Supabase puede re-emitir
  // "SIGNED_IN" bastante después de cargar la página (por ej. al refrescar
  // el token en segundo plano, o al volver a poner foco en la pestaña) aun
  // cuando la sesión ya estaba activa de antes -- de ahí el "se queda un
  // rato y vuelve", no era instantáneo. authRedirectingRef guarda en un ref
  // (no en el estado, porque el listener de abajo se suscribe una sola vez
  // al montar y quedaría con el valor viejo si usáramos el estado) si
  // realmente estamos en medio de un regreso de Google con el token en el
  // hash de la URL. Ahora el redirect de seguridad solo se dispara en ESE
  // caso puntual, nunca en una visita común a Home ya logueado.
  const authRedirectingRef = useRef(false);
  useLayoutEffect(() => {
    if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
      setAuthRedirecting(true);
      authRedirectingRef.current = true;
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
      // pública.
      // Incremento 25: además de filtrar por el evento "SIGNED_IN", ahora
      // también exigimos authRedirectingRef.current -- es decir, que
      // realmente hayamos detectado el hash de Google en la URL al cargar
      // esta página. Así el redirect de seguridad sigue funcionando para el
      // caso que lo motivó (login con Google mal redirigido a Home), pero
      // ya no dispara en una visita común y silvestre a Home estando
      // logueado, sin importar qué evento reporte Supabase de fondo.
      if (event === "SIGNED_IN" && session && authRedirectingRef.current) {
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
          {/* Incremento 26 (Facu): "no veo como a simple vista la posibilidad
              de contactar a alguien de maintlyqr" -- para una empresa o un
              taller que recién llega y no sabe a quién preguntarle. Estilo
              outline (no rojo) a propósito, para no competir con el CTA de
              Iniciar Sesión -- este es el botón secundario de la navbar.
              El texto "Hablemos" se esconde entre md y xl (queda solo el
              ícono) -- confirmé con una maqueta que la navbar de escritorio
              actual ya se queda sin lugar entre 768-1024px con los 7 links +
              selector de idioma + este botón + login todos con su texto
              completo; el rediseño de escritorio (próximo) va a resolver el
              layout entero, pero mientras tanto esto evita que ESTE botón
              agregue una regresión nueva ahí. */}
          <button
            onClick={() => setShowContactUs(true)}
            className="flex items-center gap-2 border border-zinc-300 bg-white/70 text-zinc-700 hover:border-red-300 hover:text-red-600 font-black tracking-wide rounded-xl transition-all px-3 xl:px-4 py-2"
            style={{fontSize:'clamp(10px,0.75vw,12px)'}}
          >
            <MessageCircle size={13} /> <span className="hidden xl:inline">{tNav("contactUs")}</span>
          </button>
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
          {/* Incremento 26: mismo botón "Hablemos" que en desktop, acá solo
              el ícono (sin lugar para el texto) -- siempre visible al lado
              del login, sin necesidad de abrir el menú hamburguesa. */}
          <button
            onClick={() => setShowContactUs(true)}
            aria-label={tNav("contactUs")}
            className="text-zinc-700 hover:text-red-600 p-2"
          >
            <MessageCircle size={20} />
          </button>
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
          <button
            onClick={() => { setShowContactUs(true); setMobileMenuOpen(false); }}
            className="flex items-center justify-center gap-1.5 border border-zinc-300 text-zinc-700 hover:border-red-300 hover:text-red-600 font-black tracking-wide rounded-xl transition-all px-3 py-2.5 text-[13px] mb-2"
          >
            <MessageCircle size={14} /> {tNav("contactUs")}
          </button>
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
          como hicimos con el login". Incremento 23: Facu probó la primera
          versión (con una sección secundaria más abajo, alcanzable con
          scroll) y fue tajante -- "no quiero scrol", ni siquiera un poquito.
          Esta versión mete TODO (stats, sellos, pilares, footer) adentro de
          esta misma pantalla, usando el hueco que la foto deja libre entre
          el título y los botones (ahí solo se veían los vehículos de fondo,
          sin nada útil). Altura fija = 100dvh menos la navbar (h-16 = 4rem),
          así entra exactamente una pantalla, siempre, sin excepción. */}
      <section className="md:hidden relative shrink-0 overflow-hidden" style={{height:'calc(100dvh - 4rem)'}}>
        <div className="absolute inset-0 z-0">
          <Image src="/images/login-hero-mobile-light.png" alt="MaintlyQR" fill priority sizes="100vw" className="object-cover object-top" />
        </div>

        {/* La foto ya trae su propio ícono de engranaje+QR arriba, así que
            acá no se repite un logo aparte -- el texto va directamente en
            la franja vacía de la imagen (mapa mundial de fondo, sin
            vehículos todavía). Sin el párrafo de descripción larga (que sí
            tiene desktop) -- acá no entraba sin apretar todo lo de abajo.
            Incremento 24 (Facu): "quedo la frase montada arriba del logo y
            mucho espacio vacio" -- el ícono engranaje+QR de la foto ocupa
            hasta ~26% de la altura de la imagen, y el top:25% de antes
            quedaba justo en ese límite (sin margen, así que en su celular
            real se solapaban). Lo bajamos a 34% para que quede un margen
            de sobra debajo del ícono en cualquier dispositivo. */}
        <div className="absolute left-0 right-0 z-10 text-center px-5" style={{top:'34%'}}>
          <h1 className="font-black leading-[1.0] tracking-tighter text-zinc-900 uppercase text-[26px]">
            {t("heroTitleLine1")}<br />{t("heroTitleLine2Prefix")}<span className="text-red-600">{t("heroTitleHighlight")}</span>
          </h1>
          <div className="w-11 h-[3px] bg-red-600 rounded-full mx-auto" style={{marginTop:'1vh', marginBottom:'1vh'}} />
          <p className="font-bold text-zinc-800 text-[13px]">
            <span className="text-red-600 font-black">{t("heroSubtitleHighlight")}</span> {t("heroSubtitleRest")}
          </p>
        </div>

        {/* Scrim para que el bloque de abajo (stats + botones + sellos +
            pilares + footer, todo junto ahora) asiente prolijo sobre los
            vehículos de la foto en vez de cortar de golpe. */}
        <div className="absolute left-0 right-0 bottom-0 z-0 pointer-events-none" style={{height:'52%', background:'linear-gradient(to top, rgba(255,255,255,0.94), rgba(255,255,255,0))'}} />

        {/* Incremento 24: con el texto bajado para no pisar el ícono, quedaba
            un hueco vacío grande entre el subtítulo y este bloque. En vez de
            dejarlo vacío, agrandamos todo lo de acá abajo (stats, botones,
            sellos, pilares) -- ya habíamos verificado con capturas reales
            que sobraba mucho margen (200-400px), así que hay lugar de sobra
            para textos e iconos más grandes sin arriesgar el "no quiero
            escrol". */}
        <div className="absolute left-0 right-0 z-10 px-4" style={{bottom:'1.5vh'}}>
          {/* Stats en vivo — antes vivían en la sección secundaria; ahora
              entran acá arriba de los botones, en el hueco de la foto. */}
          <div className="w-full grid grid-cols-4 rounded-xl overflow-hidden bg-zinc-900/95" style={{marginBottom:'1.2vh'}}>
            {[
              { value: stats ? stats.machines.toLocaleString() : "—", label: t("statMachines") },
              { value: stats ? stats.services.toLocaleString() : "—", label: t("statServices") },
              { value: stats ? stats.mechanics.toLocaleString() : "—", label: t("statMechanics") },
              { value: null, label: t("statGrowing") },
            ].map(({ value, label }, i) => (
              <div key={label} className={["flex flex-col items-center justify-center gap-px py-[9px] px-0.5 border-white/15", i < 3 ? "border-r" : ""].join(" ")}>
                {value !== null && <p className="font-black text-white leading-none text-[16px]">{value}</p>}
                <p className="text-zinc-400 font-semibold uppercase tracking-wide leading-[1.15] text-[7.5px] text-center">{label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-row gap-2 w-full" style={{marginBottom:'1.2vh'}}>
            <button
              onClick={openCamera}
              className="flex-1 min-w-0 flex items-center justify-center gap-1.5 rounded-xl bg-red-600 active:scale-[0.98] transition-all text-white shadow-lg shadow-red-900/30 font-black uppercase tracking-wide text-[13px] py-[13px] px-1.5"
            >
              <Camera size={15} /> {t("scanCardTitle")}
            </button>

            <div className="flex-1 min-w-0 flex items-center gap-1.5 rounded-xl bg-white/97 border border-zinc-200 shadow-md py-2 pl-3 pr-2">
              <Keyboard size={15} className="text-zinc-400 shrink-0" />
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
                className="rounded-lg bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all p-[7px] flex items-center justify-center shrink-0"
              >
                <ArrowRight size={13} className="text-white" />
              </button>
            </div>
          </div>

          {/* Sellos de confianza — versión compacta de una sola línea. */}
          <div className="flex flex-nowrap items-center justify-center gap-[5px] text-zinc-500 overflow-hidden" style={{marginBottom:'1.1vh'}}>
            <ShieldCheck className="text-red-500 shrink-0" size={11} />
            <span className="text-[8.5px] whitespace-nowrap">{t("trustBarText")}</span>
            <div className="flex -space-x-1.5 shrink-0">
              {["#dc2626","#1d4ed8","#16a34a","#d97706","#7c3aed"].map((color, i) => (
                <div key={i} className="rounded-full border border-white" style={{background:color, width:'14px', height:'14px'}} />
              ))}
            </div>
            <a
              href="/asset/demogen001"
              target="_blank"
              rel="noopener noreferrer"
              className="font-black uppercase tracking-wide text-white bg-red-600 rounded-full whitespace-nowrap shrink-0 text-[8px] px-2 py-[3.5px]"
            >
              {t("viewLiveExample")}
            </a>
          </div>

          {/* Pilares — 2x2, versión compacta. */}
          <div className="w-full grid grid-cols-2 rounded-lg overflow-hidden border border-zinc-200 bg-white/95" style={{marginBottom:'1vh'}}>
            {[
              { icon: ShieldCheck, title: t("pillarSecure") },
              { icon: Globe, title: t("pillarAccess") },
              { icon: Clock, title: t("pillarHistory") },
              { icon: TrendingUp, title: t("pillarGrow") },
            ].map(({ icon: Icon, title }, i) => (
              <div key={title} className={["flex flex-row items-center justify-center gap-1.5 py-[7px] px-1 border-zinc-200", i % 2 === 0 ? "border-r" : "", i < 2 ? "border-b" : ""].filter(Boolean).join(" ")}>
                <div className="rounded-full border border-red-200 bg-red-50 flex items-center justify-center text-red-500 shrink-0" style={{width:'14px', height:'14px'}}>
                  <Icon size={8} />
                </div>
                <p className="font-black text-zinc-800 uppercase leading-[1.15] text-[7.5px] text-center">{title}</p>
              </div>
            ))}
          </div>

          {/* Footer — versión mínima, solo lo esencial (marca + legales). */}
          <div className="flex justify-center items-center gap-1.5 flex-wrap">
            <span className="tracking-wide text-zinc-400 font-semibold uppercase text-[7px]">{t("footerBrand")}</span>
            <span className="text-red-400 text-[7px]">•</span>
            <Link href="/terms" className="tracking-wide text-zinc-400 font-semibold uppercase text-[7px]">{t("footerTerms")}</Link>
            <span className="text-red-400 text-[7px]">•</span>
            <Link href="/privacy" className="tracking-wide text-zinc-400 font-semibold uppercase text-[7px]">{t("footerPrivacy")}</Link>
            <span className="text-red-400 text-[7px]">•</span>
            <Link href="/cookies" className="tracking-wide text-zinc-400 font-semibold uppercase text-[7px]">{t("footerCookies")}</Link>
          </div>
        </div>
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

      {/* ════ CONTACT US ("Hablemos") ════ Incremento 26 */}
      <ContactUsModal open={showContactUs} onClose={() => setShowContactUs(false)} />
    </main>
  );
}
