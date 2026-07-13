"use client";

import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Mail, Lock, Eye, EyeOff, User, Wrench } from "lucide-react";
import { supabase } from "@/lib/supabase";

// Localized copy of src/app/register/page.tsx, migrated together with
// Login (rollout page #5/#6) so both can cross-link via next-intl's
// <Link>. router.push("/register/profession") deliberately keeps
// next/navigation's plain router — that page isn't migrated yet.

export default function RegisterPage() {
  const router = useRouter();
  const t = useTranslations("RegisterPage");

  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmEmailSent, setConfirmEmailSent] = useState(false);

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
        data: { name },
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
      <main className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
        <div className="max-w-md w-full bg-white border border-zinc-200 rounded-2xl shadow-sm p-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full border border-red-100 bg-red-50 mb-4">
            <Mail size={24} className="text-red-600" />
          </div>
          <h2 className="text-[22px] font-black text-zinc-900 mb-2">{t("checkEmailTitle")}</h2>
          <p className="text-[14px] text-zinc-500 mb-6">
            {t("checkEmailDescPrefix")} <strong>{email}</strong>. {t("checkEmailDescSuffix")}
          </p>
          <Link
            href="/login"
            className="inline-block w-full bg-red-600 hover:bg-red-500 transition-all text-white font-bold py-[12px] rounded-xl text-[14px] tracking-wide uppercase"
          >
            {t("goToLoginButton")}
          </Link>
        </div>
      </main>
    );
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
              <Wrench size={24} className="text-red-600" />
            </div>
            <h2 className="text-[26px] font-black text-zinc-900">{t("becomeMaintler")}</h2>
            <p className="text-[13px] text-zinc-500 mt-1">{t("subtitle")}</p>
          </div>

          <form onSubmit={handleRegister}>
            {/* Name */}
            <div className="mb-4">
              <label className="text-[12px] font-bold text-zinc-700">{t("fullNameLabel")}</label>
              <div className="relative mt-1">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("fullNamePlaceholder")}
                  className="w-full rounded-xl border border-zinc-200 pl-10 pr-3 py-[12px] text-[14px] outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition-all"
                />
              </div>
            </div>

            {/* Email */}
            <div className="mb-4">
              <label className="text-[12px] font-bold text-zinc-700">{t("emailLabel")}</label>
              <div className="relative mt-1">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("emailPlaceholder")}
                  className="w-full rounded-xl border border-zinc-200 pl-10 pr-3 py-[12px] text-[14px] outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="mb-4">
              <label className="text-[12px] font-bold text-zinc-700">{t("passwordLabel")}</label>
              <div className="relative mt-1">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("passwordPlaceholder")}
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

            {/* Confirm password */}
            <div className="mb-5">
              <label className="text-[12px] font-bold text-zinc-700">{t("confirmPasswordLabel")}</label>
              <div className="relative mt-1">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("confirmPasswordPlaceholder")}
                  className="w-full rounded-xl border border-zinc-200 pl-10 pr-10 py-[12px] text-[14px] outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-500 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition-all text-white font-bold py-[13px] rounded-xl text-[14px] tracking-wide uppercase shadow-md shadow-red-900/20"
            >
              {loading ? t("creatingAccount") : t("createAccountButton")}
            </button>
          </form>

          <p className="text-center text-[13px] text-zinc-500 mt-6">
            {t("alreadyHaveAccount")}{" "}
            <Link href="/login" className="text-red-600 hover:text-red-700 font-bold">{t("loginLink")}</Link>
          </p>

          <p className="text-center text-[12px] text-zinc-400 mt-3">
            <Link href="/" className="hover:text-zinc-600 underline">{t("continueBrowsing")}</Link>
          </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
