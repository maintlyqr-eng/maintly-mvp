"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck, Camera, Keyboard, User, ChevronDown, Globe, Clock, TrendingUp, LogOut, LayoutGrid, X, ZoomIn } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function HomePage() {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  const [qrCode, setQrCode] = useState("");

  // Camera scanner states
  const [showCamera, setShowCamera]   = useState(false);
  const [camError, setCamError]       = useState("");
  const [scanning, setScanning]       = useState(false);
  const [detected, setDetected]       = useState("");
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const rafRef      = useRef<number | null>(null);
  const activeRef   = useRef(false);

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

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopCamera(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function stopCamera() {
    activeRef.current = false;
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  }

  async function openCamera() {
    setCamError("");
    setDetected("");
    setShowCamera(true);
    setScanning(false);
    activeRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (!activeRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setScanning(true);
          requestScan();
        };
      }
    } catch {
      setCamError("Camera access denied. Please allow camera access in your browser settings and try again.");
    }
  }

  function closeCamera() {
    stopCamera();
    setShowCamera(false);
    setScanning(false);
    setCamError("");
    setDetected("");
  }

  async function requestScan() {
    if (!activeRef.current) return;
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    if (video.readyState < video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(requestScan);
      return;
    }

    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Dynamic import so jsQR only loads client-side
    const jsQR = (await import("jsqr")).default;
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (code?.data && activeRef.current) {
      // If QR contains a full URL, extract the last path segment (the code)
      let qrValue = code.data.trim();
      try {
        const url = new URL(qrValue);
        const parts = url.pathname.split("/").filter(Boolean);
        qrValue = parts[parts.length - 1] || qrValue;
      } catch {
        // Not a URL — use as-is (e.g. "MTLY-AB12-CD34")
      }
      setDetected(qrValue);
      stopCamera();
      setTimeout(() => {
        router.push(`/asset/${qrValue}`);
      }, 600);
      return;
    }

    if (activeRef.current) {
      rafRef.current = requestAnimationFrame(requestScan);
    }
  }

  return (
    <main className="relative h-screen overflow-hidden bg-white text-zinc-900 flex flex-col">

      {/* ── BACKGROUND ── */}
      <div className="absolute inset-0 z-0">
        <Image src="/images/fondo.png" alt="Maintly background" fill priority className="object-cover object-center" />
      </div>
      <div className="absolute inset-0 z-0 bg-white/15 pointer-events-none" />

      {/* ════ NAVBAR ════ */}
      <nav className="relative z-50 flex items-center justify-between pl-3 pr-8 bg-transparent border-b border-white/10 shrink-0" style={{height:'9vh'}}>
        <a href="/" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/qr-gear.png" alt="Maintly" style={{width: 84, height: 84, objectFit: "contain"}} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/Maintly.png" alt="" style={{width: 175, objectFit: "contain", marginLeft: -20}} />
        </a>

        <div className="hidden md:flex items-center gap-10">
          {["Product","How It Works","Industries","Pricing","Resources","API","About"].map((item) => (
            <a key={item} href="#" className="text-zinc-700 hover:text-zinc-900 font-medium transition-colors flex items-center gap-[3px]" style={{fontSize:'clamp(11px,0.85vw,13px)'}}>
              {item}
              {["Product","Resources"].includes(item) && <ChevronDown size={10} className="opacity-40" />}
            </a>
          ))}
        </div>

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
          <a href="/login" className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white font-black tracking-wide rounded-xl transition-all shadow-md shadow-red-900/20 uppercase px-5 py-2" style={{fontSize:'clamp(10px,0.75vw,12px)'}}>
            <User size={13} /> Mechanic Login
          </a>
        )}
      </nav>

      {/* ════ HERO ════ */}
      <section className="relative z-10 flex flex-col items-center text-center px-4 flex-1" style={{paddingTop:'3vh'}}>

        <h1 className="font-black leading-[1.05] tracking-tight text-zinc-900" style={{fontSize:'clamp(36px,5.5vw,68px)'}}>
          Every Machine<br />Has a <span className="text-red-600">Story.</span>
        </h1>

        <div className="w-14 h-[3px] bg-red-600 rounded-full" style={{marginTop:'1.5vh'}} />

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
            <button
              onClick={openCamera}
              className="w-full rounded-xl bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all text-white flex items-center justify-center gap-2 shadow-lg shadow-red-900/30 font-black tracking-[0.1em] uppercase"
              style={{fontSize:'clamp(9px,0.75vw,11px)', padding:'clamp(7px,0.9vh,11px) 0'}}
            >
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
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">

          {/* Hidden canvas for QR processing */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Top bar */}
          <div className="flex items-center justify-between px-5 pt-safe-top py-4 shrink-0" style={{paddingTop: 'max(env(safe-area-inset-top), 16px)'}}>
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/Maintly.png" alt="Maintly" style={{height: 18, objectFit: 'contain', filter: 'brightness(0) invert(1)'}} />
            </div>
            <button
              onClick={closeCamera}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center transition-all"
            >
              <X size={20} className="text-white" />
            </button>
          </div>

          {/* Camera feed */}
          <div className="flex-1 relative overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Scanning frame overlay */}
            {scanning && !detected && (
              <div className="absolute inset-0 flex items-center justify-center">
                {/* Dark surround */}
                <div className="absolute inset-0 bg-black/50" />

                {/* Scan window */}
                <div className="relative z-10 w-[260px] h-[260px]">
                  {/* Transparent cutout feel with corners */}
                  <div className="absolute inset-0 rounded-2xl border-2 border-white/30" />

                  {/* Corner accents */}
                  <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-red-500 rounded-tl-2xl" />
                  <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-red-500 rounded-tr-2xl" />
                  <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-red-500 rounded-bl-2xl" />
                  <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-red-500 rounded-br-2xl" />

                  {/* Scanning line animation */}
                  <div className="absolute inset-x-3 top-2 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent animate-[scanline_2s_ease-in-out_infinite]" />
                </div>
              </div>
            )}

            {/* QR detected flash */}
            {detected && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-20">
                <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center mb-4 animate-[pop_0.3s_ease-out]">
                  <ZoomIn size={36} className="text-white" />
                </div>
                <p className="text-white font-black text-[18px]">QR Detected!</p>
                <p className="text-white/60 text-[13px] mt-1">Opening history…</p>
              </div>
            )}

            {/* Error state */}
            {camError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-20 px-8 text-center">
                <div className="w-16 h-16 rounded-full bg-red-600/20 border border-red-500/40 flex items-center justify-center mb-4">
                  <Camera size={28} className="text-red-400" />
                </div>
                <p className="text-white font-bold text-[16px] mb-2">Camera unavailable</p>
                <p className="text-white/60 text-[13px] leading-relaxed mb-6">{camError}</p>
                <button
                  onClick={closeCamera}
                  className="bg-white text-zinc-900 font-bold px-6 py-3 rounded-xl text-[14px]"
                >
                  Go back
                </button>
              </div>
            )}
          </div>

          {/* Bottom instructions */}
          {scanning && !detected && !camError && (
            <div className="shrink-0 flex flex-col items-center gap-2 py-8 px-6 text-center" style={{paddingBottom: 'max(env(safe-area-inset-bottom), 32px)'}}>
              <p className="text-white font-bold text-[16px]">Point at a Maintly QR code</p>
              <p className="text-white/50 text-[13px]">Hold steady — detection is automatic</p>
            </div>
          )}

          {!scanning && !camError && (
            <div className="shrink-0 flex flex-col items-center gap-3 py-8 px-6">
              <div className="w-8 h-8 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              <p className="text-white/60 text-[13px]">Starting camera…</p>
            </div>
          )}
        </div>
      )}

      {/* Scanline animation */}
      <style>{`
        @keyframes scanline {
          0%   { transform: translateY(0px);   opacity: 1; }
          50%  { transform: translateY(240px); opacity: 0.8; }
          100% { transform: translateY(0px);   opacity: 1; }
        }
        @keyframes pop {
          0%   { transform: scale(0.5); opacity: 0; }
          70%  { transform: scale(1.1); }
          100% { transform: scale(1);   opacity: 1; }
        }
      `}</style>
    </main>
  );
}
