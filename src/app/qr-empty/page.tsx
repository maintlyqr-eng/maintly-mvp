"use client";

import Image from "next/image";
import { Tag, TrendingUp, ShieldCheck, Lock, UserPlus, Eye } from "lucide-react";

export default function QrEmptyPage() {
  return (
    <main className="relative min-h-dvh md:h-dvh w-full bg-white md:overflow-hidden">

      {/* ── IMAGEN DE FONDO COMPLETA, escalada por ALTO para llenar la pantalla ── */}
      <div className="hidden md:flex absolute inset-0 z-0 items-center justify-center bg-white">
        <div className="relative h-full" style={{ aspectRatio: "1536/1024" }}>
          <Image
            src="/images/qr-empty-side.png"
            alt="Maintly"
            fill
            priority
            className="object-contain"
          />
        </div>
      </div>

      {/* ── CONTENEDOR que tiene EXACTAMENTE el mismo tamaño/posición que la imagen ── */}
      <div className="hidden md:flex absolute inset-0 z-10 items-center justify-center pointer-events-none">
        <div className="relative h-full" style={{ aspectRatio: "1536/1024" }}>

          {/* Panel derecho — medido en píxeles reales de la imagen 1536x1024 */}
          <div
            className="absolute flex items-center justify-center pointer-events-auto"
            style={{ left: "56.2%", right: "2.3%", top: "3%", bottom: "3%" }}
          >
            <div className="w-full max-w-[360px] mx-auto flex flex-col items-center px-4">

              {/* Icon + headline */}
              <div className="text-center mb-5 flex flex-col items-center">
                <div className="relative w-32 h-32 mb-3">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-red-50 to-red-100/50 blur-md" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Image src="/images/qr-gear.png" alt="Maintly QR" width={128} height={128} className="object-contain drop-shadow-lg" />
                  </div>
                </div>
                <h1 className="text-[24px] font-black text-zinc-900 tracking-tight leading-tight">
                  This QR code is empty
                </h1>
                <p className="text-[11.5px] text-zinc-500 mt-2 leading-relaxed max-w-[300px]">
                  No asset has been assigned to this QR code yet. Be the first to add a machine and start its maintenance journey.
                </p>
              </div>

              {/* Benefits card */}
              <div className="w-full bg-gradient-to-b from-zinc-50 to-white border border-zinc-200 rounded-2xl p-4 mb-4 space-y-3 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
                {[
                  { icon: Tag, title: "Assign an asset", sub: "Link this QR code to a machine, vehicle, equipment or any other asset." },
                  { icon: TrendingUp, title: "Track every service", sub: "Record maintenance, build history and increase asset value." },
                  { icon: ShieldCheck, title: "Build trust and transparency", sub: "Share verified history with anyone, anytime, anywhere." },
                ].map(({ icon: Icon, title, sub }) => (
                  <div key={title} className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-red-900/20">
                      <Icon size={14} />
                    </div>
                    <div>
                      <p className="text-[12px] font-bold text-zinc-900">{title}</p>
                      <p className="text-[10px] text-zinc-500 leading-relaxed mt-[2px]">{sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Divider note */}
              <p className="text-center text-[10px] text-zinc-400 mb-2.5">
                Only <span className="font-bold text-red-600">registered mechanics</span> can assign assets.
              </p>

              {/* Login button */}
              <button className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 active:scale-[0.98] transition-all text-white font-bold py-[12px] rounded-xl text-[13px] shadow-lg shadow-red-900/30 mb-2">
                <Lock size={14} /> Login to Assign this QR
              </button>

              {/* Create account button */}
              <button className="w-full flex items-center justify-center gap-2 border border-zinc-200 hover:bg-zinc-50 transition-colors text-zinc-700 font-bold py-[12px] rounded-xl text-[13px] mb-3 bg-white shadow-sm">
                <UserPlus size={14} /> Create an Account
              </button>

              <div className="w-full h-[1px] bg-zinc-200 mb-3" />

              {/* Continue as visitor */}
              <a href="#" className="w-full flex items-center justify-between text-zinc-500 hover:text-zinc-700 transition-colors">
                <div className="flex items-center gap-2">
                  <Eye size={13} />
                  <span className="text-[11px]">Continue as a visitor</span>
                </div>
                <span className="text-[10px] text-zinc-400">View QR info only ›</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── MOBILE LAYOUT ── */}
      <div className="md:hidden flex flex-col min-h-dvh px-5 py-8">
        <div className="w-full max-w-[400px] mx-auto flex flex-col items-center flex-1">

          {/* Icon + headline */}
          <div className="text-center mb-5 flex flex-col items-center">
            <div className="relative w-24 h-24 mb-3">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-red-50 to-red-100/50 blur-md" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Image src="/images/qr-gear.png" alt="Maintly QR" width={96} height={96} className="object-contain drop-shadow-lg" />
              </div>
            </div>
            <h1 className="text-[22px] font-black text-zinc-900 tracking-tight leading-tight">
              This QR code is empty
            </h1>
            <p className="text-[11.5px] text-zinc-500 mt-2 leading-relaxed max-w-[300px]">
              No asset has been assigned to this QR code yet. Be the first to add a machine and start its maintenance journey.
            </p>
          </div>

          {/* Benefits card */}
          <div className="w-full bg-gradient-to-b from-zinc-50 to-white border border-zinc-200 rounded-2xl p-4 mb-4 space-y-3 shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
            {[
              { icon: Tag, title: "Assign an asset", sub: "Link this QR code to a machine, vehicle, equipment or any other asset." },
              { icon: TrendingUp, title: "Track every service", sub: "Record maintenance, build history and increase asset value." },
              { icon: ShieldCheck, title: "Build trust and transparency", sub: "Share verified history with anyone, anytime, anywhere." },
            ].map(({ icon: Icon, title, sub }) => (
              <div key={title} className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-red-900/20">
                  <Icon size={14} />
                </div>
                <div>
                  <p className="text-[12px] font-bold text-zinc-900">{title}</p>
                  <p className="text-[10px] text-zinc-500 leading-relaxed mt-[2px]">{sub}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Divider note */}
          <p className="text-center text-[10px] text-zinc-400 mb-2.5">
            Only <span className="font-bold text-red-600">registered mechanics</span> can assign assets.
          </p>

          {/* Login button */}
          <button className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 active:scale-[0.98] transition-all text-white font-bold py-[13px] rounded-xl text-[13px] shadow-lg shadow-red-900/30 mb-2">
            <Lock size={14} /> Login to Assign this QR
          </button>

          {/* Create account button */}
          <button className="w-full flex items-center justify-center gap-2 border border-zinc-200 hover:bg-zinc-50 transition-colors text-zinc-700 font-bold py-[13px] rounded-xl text-[13px] mb-3 bg-white shadow-sm">
            <UserPlus size={14} /> Create an Account
          </button>

          <div className="w-full h-[1px] bg-zinc-200 mb-3" />

          {/* Continue as visitor */}
          <a href="#" className="w-full flex items-center justify-between text-zinc-500 hover:text-zinc-700 transition-colors">
            <div className="flex items-center gap-2">
              <Eye size={13} />
              <span className="text-[11px]">Continue as a visitor</span>
            </div>
            <span className="text-[10px] text-zinc-400">View QR info only ›</span>
          </a>
        </div>
      </div>
    </main>
  );
}
