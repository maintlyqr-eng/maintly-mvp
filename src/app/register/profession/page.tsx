"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import ProfessionVerificationForm from "@/components/ProfessionVerificationForm";

export default function RegisterProfessionPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [mechanicId, setMechanicId] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);

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
        <p className="text-zinc-400 text-[13px]">Loading...</p>
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
            <h2 className="text-[20px] font-black text-zinc-900 mb-2">Submitted for review</h2>
            <p className="text-[13px] text-zinc-500 mb-6">
              We&apos;ll review your {submitted} certificate and let you know once you&apos;re a verified {submitted} Maintler. You can keep using Maintly in the meantime.
            </p>
            <button
              onClick={() => router.push("/dashboard")}
              className="inline-block w-full bg-red-600 hover:bg-red-500 transition-all text-white font-bold py-[12px] rounded-xl text-[14px] tracking-wide uppercase"
            >
              Go to Dashboard
            </button>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full border border-red-100 bg-red-50 mb-4">
                <ShieldCheck size={24} className="text-red-600" />
              </div>
              <h2 className="text-[22px] font-black text-zinc-900">Want to be a Verified Maintler?</h2>
              <p className="text-[13px] text-zinc-500 mt-1.5">
                Totally optional. Declare your profession and upload a certificate to earn a verified badge on every service you log — or skip and do this later from Settings.
              </p>
            </div>

            <ProfessionVerificationForm
              mechanicId={mechanicId}
              onSkip={() => router.push("/dashboard")}
              onSubmitted={(profession) => setSubmitted(profession)}
            />
          </>
        )}
      </div>
    </main>
  );
}
