"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ShieldCheck, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import ProfessionVerificationFormIntl, { PROFESSION_KEYS } from "@/components/ProfessionVerificationFormIntl";

// Localized copy of src/app/register/profession/page.tsx. This screen shows
// right after signup (email/password or Google) — Facu reported it was
// still opening in English even for a Spanish session, since it hadn't been
// migrated under [locale] yet like Login/Register already were. Same
// convention as those pages: the plain original stays in place as dead code
// (see login/page.tsx's top comment for why), and every redirect that
// TARGETS this page ("/register/profession", from login/page.tsx,
// register/page.tsx and Home's Google safety-net listener) already used a
// plain, un-prefixed string on purpose — next-intl's middleware rewrites
// that to the visitor's actual locale using the "NEXT_LOCALE" cookie, same
// as it already does for "/dashboard" and "/login". No caller needed to
// change for this migration; only middleware.ts got the new route pair.
export default function RegisterProfessionPage() {
  const router = useRouter();
  const t = useTranslations("RegisterProfessionPage");
  const tProfessionTypes = useTranslations("ProfessionTypes");
  const [checking, setChecking] = useState(true);
  const [mechanicId, setMechanicId] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);

  function professionLabel(p: string) {
    return tProfessionTypes(PROFESSION_KEYS[p] ?? "owner");
  }

  useEffect(() => {
    let active = true;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      if (!active) return;

      setMechanicId(session.user.id);

      // If this account already went through this step (or was updated
      // elsewhere), skip straight to the dashboard instead of re-showing it.
      const { data: mechanic } = await supabase
        .from("mechanics")
        .select("verification_status")
        .eq("id", session.user.id)
        .single();

      if (active && mechanic && mechanic.verification_status && mechanic.verification_status !== "none") {
        router.replace("/dashboard");
        return;
      }

      if (active) setChecking(false);
    }

    init();
    return () => { active = false; };
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-zinc-400 text-[13px]">{t("loading")}</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 flex items-center justify-center px-4 py-10">
      <div className="max-w-md w-full bg-white border border-zinc-200 rounded-2xl shadow-sm p-8">

        {submitted ? (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full border border-emerald-100 bg-emerald-50 mb-4">
              <CheckCircle2 size={24} className="text-emerald-600" />
            </div>
            <h2 className="text-[20px] font-black text-zinc-900 mb-2">{t("submittedTitle")}</h2>
            <p className="text-[13px] text-zinc-500 mb-6">
              {t("submittedDesc", { profession: professionLabel(submitted) })}
            </p>
            <button
              onClick={() => router.push("/dashboard")}
              className="inline-block w-full bg-red-600 hover:bg-red-500 transition-all text-white font-bold py-[12px] rounded-xl text-[14px] tracking-wide uppercase"
            >
              {t("goToDashboard")}
            </button>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full border border-red-100 bg-red-50 mb-4">
                <ShieldCheck size={24} className="text-red-600" />
              </div>
              <h2 className="text-[22px] font-black text-zinc-900">{t("pageTitle")}</h2>
              <p className="text-[13px] text-zinc-500 mt-1.5">
                {t("pageSubtitle")}
              </p>
            </div>

            <ProfessionVerificationFormIntl
              mechanicId={mechanicId}
              onSkip={() => router.push("/dashboard")}
              onSubmitted={(profession, status) => {
                // Owner has nothing pending review (no certificate was
                // uploaded) -- go straight to the dashboard instead of
                // showing the "we'll review your certificate" screen above,
                // which wouldn't make sense without one.
                if (status === "none") { router.push("/dashboard"); return; }
                setSubmitted(profession);
              }}
            />
          </>
        )}
      </div>
    </main>
  );
}
