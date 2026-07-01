"use client";

import Image from "next/image";
import { ArrowRight, ShieldCheck, Camera, Keyboard, User, ChevronDown, Globe, Clock, TrendingUp } from "lucide-react";

export default function HomePage() {
  return (
    <main className="relative h-screen overflow-hidden bg-white text-zinc-900 flex flex-col">

      {/* ── FONDO ── */}
      <div className="absolute inset-0 z-0">
        <Image src="/images/fondo.png" alt="Maintly background" fill priority className="object-cover object-center" />
      </div>
      <div className="absolute inset-0 z-0 bg-white/15 pointer-events-none" />

      {/* ════ NAVBAR ════ */}
      <nav className="relative z-50 flex items-center justify-between pl-3 pr-8 bg-transparent border-b border-white/10 shrink-0" style={{height:'7vh'}}>
        <div className="flex items-center gap-0">
          <Image src="/images/qr-gear.png" alt="Maintly" width={105} height={105} className="object-contain drop-shadow-md shrink-0 mt-5" priority />
          <Image src="/images/Maintly.png" alt="Maintly" width={1080} height={1080} className="object-contain w-[230px] h-auto -ml-14 mt-7" priority />
        </div>

        <div className="hidden md:flex items-center gap-10">
          {["Product","How It Works","Industries","Pricing","Resources","API","About"].map((item) => (
            <a key={item} href="#" className="text-zinc-700 hover:text-zinc-900 font-medium transition-colors flex items-center gap-[3px]" style={{fontSize:'clamp(11px,0.85vw,13px)'}}>
              {item}
              {["Product","Resources"].includes(item) && <ChevronDown size={10} className="opacity-40" />}
            </a>
          ))}
        </div>

        <a href="/dashboard" className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-black tracking-wide rounded-xl transition-all shadow-md shadow-red-900/20 uppercase px-5 py-2" style={{fontSize:'clamp(10px,0.75vw,12px)'}}>
          <User size={13} /> Login
        </a>
      </nav>

      {/* ════ HERO ════ */}
      <section className="relative z-10 flex flex-col items-center text-center px-4 flex-1" style={{paddingTop:'3vh'}}>

        {/* Título */}
        <h1 className="font-black leading-[1.05] tracking-tight text-zinc-900" style={{fontSize:'clamp(36px,5.5vw,68px)'}}>
          Every Machine<br />Has a <span className="text-red-600">Story.</span>
        </h1>

        {/* Línea roja */}
        <div className="w-14 h-[3px] bg-red-600 rounded-full" style={{marginTop:'1.5vh'}} />

        {/* Subtítulo */}
        <p className="font-semibold text-zinc-800" style={{fontSize:'clamp(13px,1.2vw,18px)', marginTop:'1.5vh'}}>
          <span className="text-red-600 font-black">One QR.</span> Lifetime Maintenance History.
        </p>
        <p className="text-zinc-500 max-w-lg leading-relaxed" style={{fontSize:'clamp(11px,0.9vw,14px)', marginTop:'0.8vh'}}>
          Scan any QR code and instantly access the complete maintenance history of any machine, anywhere in the world.
        </p>

        {/* ── ACTION CARDS ── */}
        <div className="flex items-stretch w-full max-w-[540px] rounded-2xl overflow-hidden shadow-[0_8px_50px_rgba(0,0,0,0.13)] border border-zinc-200/80" style={{marginTop:'2.5vh'}}>

          {/* SCAN QR */}
          <div className="flex-1 bg-zinc-900 flex flex-col items-center text-center px-7 rounded-l-2xl" style={{paddingTop:'2.5vh', paddingBottom:'2.5vh'}}>
            <div className="rounded-full bg-red-600/15 border border-red-600/30 flex items-center justify-center mb-3" style={{width:'clamp(40px,4vw,56px)', height:'clamp(40px,4vw,56px)'}}>
              <Camera className="text-red-500" style={{width:'clamp(18px,1.8vw,26px)', height:'clamp(18px,1.8vw,26px)'}} />
            </div>
            <h2 className="font-black tracking-[0.12em] text-white mb-1 uppercase" style={{fontSize:'clamp(10px,0.8vw,13px)'}}>Scan QR Code</h2>
            <p className="text-zinc-400 leading-tight flex-1" style={{fontSize:'clamp(9px,0.7vw,11px)', marginBottom:'1.5vh'}}>
              Use your camera to<br />scan any QR code
            </p>
            <button className="w-full rounded-xl bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all text-white flex items-center justify-center gap-2 shadow-lg shadow-red-900/30 font-black tracking-[0.1em] uppercase" style={{fontSize:'clamp(9px,0.75vw,11px)', padding:'clamp(7px,0.9vh,11px) 0'}}>
              <Camera style={{width:'clamp(11px,0.9vw,14px)', height:'clamp(11px,0.9vw,14px)'}} /> Open Camera
            </button>
          </div>

          {/* OR */}
          <div className="flex flex-col items-center justify-center bg-white px-3 shrink-0 gap-2">
            <div className="w-[1px] flex-1 bg-zinc-200" />
            <div className="rounded-full border-2 border-zinc-200 bg-white flex items-center justify-center shrink-0" style={{width:'clamp(28px,2.5vw,36px)', height:'clamp(28px,2.5vw,36px)'}}>
              <span className="text-zinc-400 font-black" style={{fontSize:'clamp(8px,0.65vw,10px)'}}>OR</span>
            </div>
            <div className="w-[1px] flex-1 bg-zinc-200" />
          </div>

          {/* ENTER QR */}
          <div className="flex-1 bg-white flex flex-col items-center text-center px-7 rounded-r-2xl" style={{paddingTop:'2.5vh', paddingBottom:'2.5vh'}}>
            <div className="rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center mb-3" style={{width:'clamp(40px,4vw,56px)', height:'clamp(40px,4vw,56px)'}}>
              <Keyboard className="text-zinc-500" style={{width:'clamp(16px,1.5vw,22px)', height:'clamp(16px,1.5vw,22px)'}} />
            </div>
            <h2 className="font-black tracking-[0.12em] text-zinc-900 mb-1 uppercase" style={{fontSize:'clamp(10px,0.8vw,13px)'}}>Enter QR Code</h2>
            <p className="text-zinc-400 leading-tight flex-1" style={{fontSize:'clamp(9px,0.7vw,11px)', marginBottom:'1.5vh'}}>
              Type or paste your<br />Maintly code
            </p>
            <div className="w-full flex gap-2">
              <input
                type="text"
                placeholder="e.g. MTLY-AB12-CD34"
                className="flex-1 rounded-xl bg-zinc-50 border border-zinc-200 focus:border-red-500 outline-none px-3 text-zinc-700 placeholder:text-zinc-400 transition-all"
                style={{fontSize:'clamp(9px,0.7vw,11px)', padding:'clamp(7px,0.9vh,11px) 12px'}}
              />
              <button className="rounded-xl bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all px-3 flex items-center justify-center shrink-0 shadow-md shadow-red-900/20">
                <ArrowRight className="text-white" style={{width:'clamp(12px,1.1vw,16px)', height:'clamp(12px,1.1vw,16px)'}} />
              </button>
            </div>
          </div>
        </div>

        {/* Open history */}
        <div className="flex items-center gap-2 text-zinc-500" style={{marginTop:'1.2vh'}}>
          <ShieldCheck className="text-red-500 shrink-0" style={{width:'clamp(11px,0.9vw,14px)', height:'clamp(11px,0.9vw,14px)'}} />
          <span style={{fontSize:'clamp(10px,0.8vw,12px)'}}>Open history. No login required.</span>
        </div>

        {/* ── SOCIAL PROOF ── */}
        <div className="flex items-center gap-4" style={{marginTop:'1.2vh'}}>
          <p className="tracking-[0.25em] text-zinc-400 font-semibold uppercase" style={{fontSize:'clamp(7px,0.55vw,9px)'}}>Trusted by Professionals Worldwide</p>
          <div className="flex -space-x-2">
            {["#dc2626","#1d4ed8","#16a34a","#d97706","#7c3aed"].map((color, i) => (
              <div key={i} className="rounded-full border-2 border-white flex items-center justify-center text-white font-black" style={{background:color, width:'clamp(22px,2vw,28px)', height:'clamp(22px,2vw,28px)', fontSize:'clamp(7px,0.55vw,9px)'}}>
                {["JM","AS","RK","LP","TW"][i]}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-red-600 text-white font-black rounded-full px-2" style={{fontSize:'clamp(8px,0.65vw,10px)', padding:'2px 8px'}}>10K+</span>
            <span className="text-zinc-500 font-medium" style={{fontSize:'clamp(9px,0.7vw,11px)'}}>machines tracked globally</span>
          </div>
        </div>

        {/* ── MECHANIC LOGIN ── */}
        <div className="w-full max-w-[540px] rounded-2xl border border-zinc-200 bg-white/92 backdrop-blur-sm shadow-sm flex items-center justify-between gap-4" style={{marginTop:'1.5vh', padding:'clamp(10px,1.3vh,16px) clamp(14px,1.5vw,22px)'}}>
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-zinc-200 bg-zinc-50 flex items-center justify-center text-zinc-400 shrink-0" style={{width:'clamp(28px,2.5vw,36px)', height:'clamp(28px,2.5vw,36px)'}}>
              <ShieldCheck style={{width:'clamp(12px,1vw,15px)', height:'clamp(12px,1vw,15px)'}} />
            </div>
            <div className="text-left">
              <p className="font-black text-zinc-900 tracking-wide uppercase leading-tight" style={{fontSize:'clamp(10px,0.8vw,12px)'}}>Mechanic / Company Access</p>
              <p className="text-zinc-400 leading-tight mt-[1px]" style={{fontSize:'clamp(8px,0.65vw,10px)'}}>Create services, manage assets and grow your business.</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <a href="/dashboard" className="flex items-center gap-2 rounded-xl bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all text-white whitespace-nowrap shadow-md shadow-red-900/20 uppercase font-black tracking-wide" style={{fontSize:'clamp(8px,0.65vw,10px)', padding:'clamp(6px,0.8vh,9px) clamp(12px,1.2vw,18px)'}}>
              <User style={{width:'clamp(10px,0.85vw,13px)', height:'clamp(10px,0.85vw,13px)'}} /> Mechanic Login
            </a>
            <a href="/dashboard" className="text-zinc-400 hover:text-zinc-600 transition-colors" style={{fontSize:'clamp(8px,0.65vw,10px)'}}>Create Account ›</a>
          </div>
        </div>

        {/* ── PILLARS ── */}
        <div className="w-full max-w-[540px] grid grid-cols-4 rounded-2xl overflow-hidden border border-zinc-200 bg-white/92 backdrop-blur-sm shadow-sm" style={{marginTop:'1.2vh'}}>
          {[
            { icon: ShieldCheck, title: "100% Secure", sub: "Your data is safe and encrypted" },
            { icon: Globe, title: "Access Anywhere", sub: "Global access to your maintenance history" },
            { icon: Clock, title: "Full History", sub: "Every service, every part, every time" },
            { icon: TrendingUp, title: "Built to Grow", sub: "Scalable for individuals and enterprises" },
          ].map(({ icon: Icon, title, sub }, i) => (
            <div key={title} className={`flex flex-col items-center text-center px-3 ${i < 3 ? "border-r border-zinc-200" : ""}`} style={{paddingTop:'clamp(8px,1vh,14px)', paddingBottom:'clamp(8px,1vh,14px)'}}>
              <div className="rounded-full border border-red-200 bg-red-50 flex items-center justify-center text-red-500 shrink-0" style={{width:'clamp(24px,2.2vw,30px)', height:'clamp(24px,2.2vw,30px)', marginBottom:'clamp(4px,0.5vh,8px)'}}>
                <Icon style={{width:'clamp(10px,0.9vw,13px)', height:'clamp(10px,0.9vw,13px)'}} />
              </div>
              <p className="font-black tracking-wide text-zinc-800 leading-tight uppercase" style={{fontSize:'clamp(7px,0.6vw,9px)', marginBottom:'2px'}}>{title}</p>
              <p className="text-zinc-400 leading-tight" style={{fontSize:'clamp(7px,0.58vw,8.5px)'}}>{sub}</p>
            </div>
          ))}
        </div>

        {/* ── FOOTER ── */}
        <div className="flex justify-center items-center gap-3 flex-wrap" style={{marginTop:'1vh', marginBottom:'1vh'}}>
          <span className="tracking-[0.2em] text-zinc-400 font-semibold uppercase" style={{fontSize:'clamp(6.5px,0.55vw,8px)'}}>Maintly®</span>
          <span className="text-red-400" style={{fontSize:'clamp(6px,0.5vw,7px)'}}>•</span>
          <span className="tracking-[0.2em] text-zinc-400 font-semibold uppercase" style={{fontSize:'clamp(6.5px,0.55vw,8px)'}}>Maintenance. Tracked.</span>
          <span className="text-red-400" style={{fontSize:'clamp(6px,0.5vw,7px)'}}>•</span>
          <span className="tracking-[0.2em] text-zinc-400 font-semibold uppercase" style={{fontSize:'clamp(6.5px,0.55vw,8px)'}}>All Rights Reserved</span>
        </div>

      </section>
    </main>
  );
}
