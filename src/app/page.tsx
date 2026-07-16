"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck, Camera, Keyboard, User, Globe, Clock, TrendingUp, LogOut, LayoutGrid, X, Menu, Wrench, FileText, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";
import QRScannerModal from "@/components/QRScannerModal";

type PublicStats = { machines: number; services: number; mechanics: number };

export default function HomePage() {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [stats, setStats] = useState<PublicStats | null>(null);

  // Camera scanner — the actual camera/jsQR logic lives in QRScannerModal,
  // shared with the "link existing asset" flows in the dashboard.
  const [showCamera, setShowCamera] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setLoggedIn(true);
        const name = session.user.user_metadata?.name || session.user.email || "User";
        setUserName(name.split(" ")[0]);
      } else {
        setLoggedIn(false);
        setUserName("");
      }
    });
    return () => subscription.unsubscribe();
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

  return (
    <main className="relative min-h-dvh md:h-dvh overflow-x-hidden md:overflow-hidden bg-white text-zinc-900 flex flex-col">

      {/* ── BACKGROUND ── */}
      <div className="absolute inset-0 z-0">
        <Image src="/images/fondo.jpg" alt="MaintlyQR background" fill priority sizes="100vw" quality={90} className="object-cover object-center" />
      </div>
      <div className="absolute inset-0 z-0 bg-white/15 pointer-events-none" />

      {/* ════ NAVBAR ════ */}
      <nav className="relative z-50 flex items-center justify-between pl-3 pr-4 md:pr-8 bg-transparent border-b border-white/10 shrink-0 h-16 md:h-[7.2vh]">
        <a href="/" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/maintly-logo-full.png" alt="MaintlyQR" className="h-10 md:h-[clamp(40px,7vh,84px)] w-auto object-contain" />
        </a>

        <div className="hidden md:flex items-center gap-10">
          {[
            { label: "Product", href: "/product" },
            { label: "How It Works", href: "/how-it-works" },
            { label: "Industries", href: "/industries" },
            { label: "Pricing", href: "/pricing" },
            { label: "Resources", href: "/resources" },
            { label: "API", href: "/api" },
            { label: "About", href: "/about" },
          ].map(({ label, href }) => (
            <a key={label} href={href} className="text-zinc-700 hover:text-zinc-900 font-medium transition-colors" style={{fontSize:'clamp(11px,0.85vw,13px)'}}>
              {label}
            </a>
          ))}
        </div>

        <div className="hidden md:block">
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
            <a href="/login" className="flex items-center gap-2 text-zinc-700 hover:text-zinc-900 font-black tracking-wide rounded-xl transition-all border border-zinc-300 hover:border-zinc-400 uppercase px-4 py-2" style={{fontSize:'clamp(10px,0.75vw,12px)'}}>
              <User size={13} /> Login
            </a>
          </div>
        )}
        </div>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden text-zinc-700 hover:text-zinc-900 p-2"
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {mobileMenuOpen && (
        <div className="md:hidden relative z-40 bg-white border-b border-zinc-200 shadow-lg flex flex-col px-5 py-4 gap-1">
          {[
            { label: "Product", href: "/product" },
            { label: "How It Works", href: "/how-it-works" },
            { label: "Industries", href: "/industries" },
            { label: "Pricing", href: "/pricing" },
            { label: "Resources", href: "/resources" },
            { label: "API", href: "/api" },
            { label: "About", href: "/about" },
          ].map(({ label, href }) => (
            <a key={label} href={href} onClick={() => setMobileMenuOpen(false)} className="text-zinc-700 hover:text-zinc-900 font-medium py-2 border-b border-zinc-100 last:border-0">
              {label}
            </a>
          ))}
          <div className="pt-3">
            {loggedIn ? (
              <div className="flex flex-col gap-2">
                <a href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white font-black tracking-wide rounded-xl transition-all shadow-md px-4 py-3 text-[13px]">
                  <LayoutGrid size={14} /> {userName}
                </a>
                <button onClick={() => { handleLogout(); setMobileMenuOpen(false); }} className="flex items-center justify-center gap-1.5 text-zinc-500 hover:text-red-600 transition-colors border border-zinc-200 rounded-xl px-3 py-3 text-[13px]">
                  <LogOut size={14} /> Log out
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <a href="/login" onClick={() => setMobileMenuOpen(false)} className="flex items-center justify-center gap-2 text-zinc-700 font-black tracking-wide rounded-xl transition-all border border-zinc-300 uppercase px-5 py-3 text-[13px]">
                  <User size={14} /> Login
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════ HERO ════ */}
      <section className="relative z-10 flex flex-col items-center text-center px-4 flex-1 pb-8 md:pb-0" style={{paddingTop:'1vh'}}>

        <a href="/" aria-label="MaintlyQR home" className="transition-transform duration-300 ease-out hover:scale-[1.3] active:scale-95">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/qr-gear-real.png"
            alt="MaintlyQR"
            className="object-contain drop-shadow-[0_8px_24px_rgba(0,0,0,0.15)] cursor-pointer"
            style={{ width: 'clamp(130px,min(19vw,22.5vh),300px)', height: 'clamp(130px,min(19vw,22.5vh),300px)', marginBottom: '0.6vh' }}
          />
        </a>

        <h1 className="font-black leading-[0.98] tracking-tighter text-zinc-900 uppercase" style={{fontSize:'clamp(36px,min(7.2vw,8.8vh),74px)'}}>
          Every Machine<br />Has a <span className="text-red-600">Story.</span>
        </h1>

        <div className="w-14 h-[3px] bg-red-600 rounded-full" style={{marginTop:'0.8vh'}} />

        <p className="font-semibold text-zinc-800" style={{fontSize:'clamp(13px,1.2vw,18px)', marginTop:'0.6vh'}}>
          <span className="text-red-600 font-black">One QR.</span> Lifetime Maintenance History.
        </p>
        <p className="text-zinc-500 max-w-lg leading-[1.4]" style={{fontSize:'clamp(11px,0.9vw,14px)', marginTop:'0.2vh'}}>
          Scan any QR code and instantly access the complete maintenance history of any machine, anywhere in the world.
        </p>

        {/* ── ACTION CARDS ── */}
        <div className="flex flex-col md:flex-row items-stretch w-full max-w-[540px] rounded-2xl overflow-hidden shadow-[0_8px_50px_rgba(0,0,0,0.13)] border border-zinc-200/80" style={{marginTop:'0.8vh'}}>

          {/* SCAN QR */}
          <div className="flex-1 bg-zinc-900 flex flex-col items-center text-center px-7 rounded-t-2xl md:rounded-t-none md:rounded-l-2xl" style={{paddingTop:'0.9vh', paddingBottom:'0.9vh'}}>
            <div className="rounded-full bg-red-600/15 border border-red-600/30 flex items-center justify-center mb-3" style={{width:'clamp(40px,4vw,56px)', height:'clamp(40px,4vw,56px)'}}>
              <Camera className="text-red-500" style={{width:'clamp(18px,1.8vw,26px)', height:'clamp(18px,1.8vw,26px)'}} />
            </div>
            <h2 className="font-black tracking-[0.06em] text-white mb-1 uppercase whitespace-nowrap" style={{fontSize:'clamp(10px,0.7vw,12px)'}}>Scan QR Code</h2>
            <p className="text-zinc-400 leading-tight flex-1" style={{fontSize:'clamp(9px,0.7vw,11px)', marginBottom:'1.5vh'}}>
              Use your camera to<br />scan any QR code
            </p>
            <button
              onClick={openCamera}
              className="w-full rounded-xl bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all text-white flex items-center justify-center gap-2 shadow-lg shadow-red-900/30 font-black tracking-[0.1em] uppercase"
              style={{fontSize:'clamp(9px,0.75vw,11px)', padding:'clamp(7px,0.9vh,11px) 0'}}
            >
              <Camera style={{width:'clamp(11px,0.9vw,14px)', height:'clamp(11px,0.9vw,14px)'}} /> Open Camera
            </button>
          </div>

          {/* OR */}
          <div className="flex flex-row md:flex-col items-center justify-center bg-white px-3 md:px-3 py-3 md:py-0 shrink-0 gap-2">
            <div className="h-[1px] w-auto md:h-auto md:w-[1px] flex-1 bg-zinc-200" />
            <div className="rounded-full border-2 border-zinc-200 bg-white flex items-center justify-center shrink-0" style={{width:'clamp(28px,2.5vw,36px)', height:'clamp(28px,2.5vw,36px)'}}>
              <span className="text-zinc-400 font-black" style={{fontSize:'clamp(8px,0.65vw,10px)'}}>OR</span>
            </div>
            <div className="h-[1px] w-auto md:h-auto md:w-[1px] flex-1 bg-zinc-200" />
          </div>

          {/* ENTER QR */}
          <div className="flex-1 bg-white flex flex-col items-center text-center px-7 rounded-b-2xl md:rounded-b-none md:rounded-r-2xl" style={{paddingTop:'0.9vh', paddingBottom:'0.9vh'}}>
            <div className="rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center mb-3" style={{width:'clamp(40px,4vw,56px)', height:'clamp(40px,4vw,56px)'}}>
              <Keyboard className="text-zinc-500" style={{width:'clamp(16px,1.5vw,22px)', height:'clamp(16px,1.5vw,22px)'}} />
            </div>
            <h2 className="font-black tracking-[0.06em] text-zinc-900 mb-1 uppercase whitespace-nowrap" style={{fontSize:'clamp(10px,0.7vw,12px)'}}>Enter QR Code</h2>
            <p className="text-zinc-400 leading-tight flex-1" style={{fontSize:'clamp(9px,0.7vw,11px)', marginBottom:'1.5vh'}}>
              Type or paste your<br />MaintlyQR code
            </p>
            <div className="w-full flex gap-2">
              <input
                type="text"
                value={qrCode}
                onChange={(e) => setQrCode(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Paste your code here"
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

        <div className="flex flex-wrap items-center justify-center gap-3 text-zinc-500" style={{marginTop:'0.4vh'}}>
          <ShieldCheck className="text-red-500 shrink-0" style={{width:'clamp(11px,0.9vw,14px)', height:'clamp(11px,0.9vw,14px)'}} />
          <span style={{fontSize:'clamp(10px,0.8vw,12px)'}}>Open history. No login required.</span>
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
            View Live Example <ExternalLink style={{width:'clamp(9px,0.75vw,11px)', height:'clamp(9px,0.75vw,11px)'}} />
          </a>
        </div>

        {/* ── LIVE STATS ── */}
        <div className="w-full max-w-[540px] grid grid-cols-2 md:grid-cols-4 rounded-2xl overflow-hidden bg-zinc-900 shadow-lg" style={{marginTop:'0.5vh'}}>
          {[
            { icon: Globe, value: stats ? stats.machines.toLocaleString() : "—", label: "Machines Tracked" },
            { icon: FileText, value: stats ? stats.services.toLocaleString() : "—", label: "Services Logged" },
            { icon: Wrench, value: stats ? stats.mechanics.toLocaleString() : "—", label: "Verified Maintlers" },
            { icon: TrendingUp, value: null, label: "Growing Every Day" },
          ].map(({ icon: Icon, value, label }, i) => (
            <div key={label} className={["flex flex-row items-center justify-center gap-1.5 px-2 border-white/10", i % 2 === 0 ? "border-r" : "", i < 2 ? "border-b" : "", "md:border-b-0", i < 3 ? "md:border-r" : "md:border-r-0"].filter(Boolean).join(" ")} style={{paddingTop:'clamp(6px,0.8vh,11px)', paddingBottom:'clamp(6px,0.8vh,11px)'}}>
              <Icon className="text-red-500 shrink-0" style={{width:'clamp(13px,1.1vw,17px)', height:'clamp(13px,1.1vw,17px)'}} />
              <div className="flex flex-col items-start leading-none">
                {value !== null && (
                  <p className="font-black text-white leading-none" style={{fontSize:'clamp(13px,1.3vw,18px)'}}>{value}</p>
                )}
                <p className="text-zinc-400 font-semibold uppercase tracking-wide leading-tight whitespace-nowrap" style={{fontSize:'clamp(6.5px,0.55vw,8.5px)', marginTop: value !== null ? '1px' : '0'}}>{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── PILLARS ── */}
        <div className="w-full max-w-[540px] grid grid-cols-2 md:grid-cols-4 rounded-2xl overflow-hidden border border-zinc-200 bg-white/92 backdrop-blur-sm shadow-sm" style={{marginTop:'0.4vh'}}>
          {[
            { icon: ShieldCheck, title: "100% Secure" },
            { icon: Globe, title: "Access Anywhere" },
            { icon: Clock, title: "Full History" },
            { icon: TrendingUp, title: "Built to Grow" },
          ].map(({ icon: Icon, title }, i) => (
            <div key={title} className={["flex flex-row items-center justify-center gap-1 px-1 border-zinc-200", i % 2 === 0 ? "border-r" : "", i < 2 ? "border-b" : "", "md:border-b-0", i < 3 ? "md:border-r" : "md:border-r-0"].filter(Boolean).join(" ")} style={{paddingTop:'clamp(6px,0.7vh,10px)', paddingBottom:'clamp(6px,0.7vh,10px)'}}>
              <div className="rounded-full border border-red-200 bg-red-50 flex items-center justify-center text-red-500 shrink-0" style={{width:'clamp(16px,1.4vw,20px)', height:'clamp(16px,1.4vw,20px)'}}>
                <Icon style={{width:'clamp(8px,0.75vw,11px)', height:'clamp(8px,0.75vw,11px)'}} />
              </div>
              <p className="font-black tracking-normal text-zinc-800 leading-tight uppercase whitespace-nowrap" style={{fontSize:'clamp(6.5px,0.56vw,8.5px)'}}>{title}</p>
            </div>
          ))}
        </div>

        {/* ── FOOTER ── */}
        <div className="flex justify-center items-center gap-3 flex-wrap" style={{marginTop:'0.15vh', marginBottom:'0.15vh'}}>
          <span className="tracking-[0.2em] text-zinc-400 font-semibold uppercase" style={{fontSize:'clamp(6.5px,0.55vw,8px)'}}>MaintlyQR®</span>
          <span className="text-red-400" style={{fontSize:'clamp(6px,0.5vw,7px)'}}>•</span>
          <span className="tracking-[0.2em] text-zinc-400 font-semibold uppercase" style={{fontSize:'clamp(6.5px,0.55vw,8px)'}}>Maintenance. Tracked.</span>
          <span className="text-red-400" style={{fontSize:'clamp(6px,0.5vw,7px)'}}>•</span>
          <a href="/terms" className="tracking-[0.2em] text-zinc-400 hover:text-red-500 font-semibold uppercase transition-colors" style={{fontSize:'clamp(6.5px,0.55vw,8px)'}}>Terms</a>
          <span className="text-red-400" style={{fontSize:'clamp(6px,0.5vw,7px)'}}>•</span>
          <a href="/privacy" className="tracking-[0.2em] text-zinc-400 hover:text-red-500 font-semibold uppercase transition-colors" style={{fontSize:'clamp(6.5px,0.55vw,8px)'}}>Privacy</a>
          <span className="text-red-400" style={{fontSize:'clamp(6px,0.5vw,7px)'}}>•</span>
          <a href="/cookies" className="tracking-[0.2em] text-zinc-400 hover:text-red-500 font-semibold uppercase transition-colors" style={{fontSize:'clamp(6.5px,0.55vw,8px)'}}>Cookies</a>
          <span className="text-red-400" style={{fontSize:'clamp(6px,0.5vw,7px)'}}>•</span>
          <span className="tracking-[0.2em] text-zinc-400 font-semibold uppercase" style={{fontSize:'clamp(6.5px,0.55vw,8px)'}}>All Rights Reserved</span>
        </div>

      </section>

      {/* ════ CAMERA OVERLAY ════ */}
      {showCamera && (
        <QRScannerModal onDetect={handleScanDetect} onClose={() => setShowCamera(false)} />
      )}
    </main>
  );
}
