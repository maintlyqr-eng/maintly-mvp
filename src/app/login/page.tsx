"use client";

import Image from "next/image";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, User, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) return;

      const { data: m } = await supabase.from("mechanics").select("suspended").eq("id", session.user.id).single();
      if (m?.suspended) {
        await supabase.auth.signOut();
        setError("This account has been suspended. Contact support if you think this is a mistake.");
        return;
      }

      router.push(redirectTo);
    });
    return () => subscription.unsubscribe();
  }, [router, redirectTo]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setError("Incorrect email or password. Please try again.");
      return;
    }

    // Successful sign-in triggers onAuthStateChange above, which checks the
    // suspended flag before redirecting.
  }

  return (
    <main className="relative min-h-dvh bg-white overflow-x-hidden">

      {/* ── IMAGEN DE FONDO COMPLETA (incluye el panel blanco dibujado) ── */}
      <div className="hidden md:block absolute inset-0 z-0 bg-white">
        <Image
          src="/images/login-side.png"
          alt="Maintly"
          fill
          priority
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
              <User size={24} className="text-red-600" />
            </div>
            <h2 className="text-[26px] font-black text-zinc-900">Welcome back</h2>
            <p className="text-[13px] text-zinc-500 mt-1">Log in to your Maintly account</p>
          </div>

          <form onSubmit={handleLogin}>
          {/* Email */}
          <div className="mb-4">
            <label className="text-[12px] font-bold text-zinc-700">Email address</label>
            <div className="relative mt-1">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full rounded-xl border border-zinc-200 pl-10 pr-3 py-[12px] text-[14px] outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div className="mb-3">
            <label className="text-[12px] font-bold text-zinc-700">Password</label>
            <div className="relative mt-1">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
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

          {/* Remember + forgot */}
          <div className="flex items-center justify-between mb-5">
            <label className="flex items-center gap-2 text-[12px] text-zinc-600 cursor-pointer">
              <input type="checkbox" className="rounded border-zinc-300 text-red-600 focus:ring-red-500" />
              Remember me
            </label>
            <a href="#" className="text-[12px] text-red-600 hover:text-red-700 font-semibold">Forgot password?</a>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 flex items-center gap-2 text-[12px] text-red-700">
              <AlertCircle size={14} className="shrink-0" />
              {error}
            </div>
          )}

          {/* Login button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-500 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all text-white font-bold py-[13px] rounded-xl text-[14px] tracking-wide uppercase shadow-md shadow-red-900/20"
          >
            {loading ? "Logging in..." : "Login"}
          </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-[1px] bg-zinc-200" />
            <span className="text-[11px] text-zinc-400">OR</span>
            <div className="flex-1 h-[1px] bg-zinc-200" />
          </div>

          {/* Google */}
          <button className="w-full flex items-center justify-center gap-3 border border-zinc-200 hover:bg-zinc-50 transition-colors py-[12px] rounded-xl text-[13px] font-semibold text-zinc-700">
            <svg width="18" height="18" viewBox="0 0 18 18">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.08-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33C2.44 15.98 5.48 18 9 18z"/>
              <path fill="#FBBC05" d="M3.97 10.71c-.18-.54-.28-1.71-.28-1.71s.1-1.17.28-1.71V4.96H.96C.35 6.18 0 7.55 0 9s.35 2.82.96 4.04l3.01-2.33z"/>
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
            </svg>
            Continue with Google
          </button>

          {/* Create account */}
          <p className="text-center text-[13px] text-zinc-500 mt-6">
            New to Maintly?{" "}
            <a href="/register" className="text-red-600 hover:text-red-700 font-bold">Create an account</a>
          </p>

          {/* Browse without account */}
          <p className="text-center text-[12px] text-zinc-400 mt-3">
            <a href="/" className="hover:text-zinc-600 underline">Continue browsing without an account</a>
          </p>
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
