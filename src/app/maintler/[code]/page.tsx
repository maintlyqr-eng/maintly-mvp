"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ShieldCheck, CalendarDays, AlertCircle, LogIn, UserPlus,
  Star, Send, UserCircle2, Share2, Check,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatDateDMY } from "@/lib/date";

// Maintler QR business card — Item 4 of the feature backlog. Every
// mechanic gets a permanent code (see migration 024) that resolves here,
// mirroring how an asset's QR code resolves to /asset/[code]. Facu's own
// framing for why this exists: "lo que buscamos es crear identidad,
// sentido de pertenencia, comunidad, y que todo eso hará parte de la
// historia de nuestras máquinas también" — this is the *person* half of
// that idea, the same way an asset already has its own public passport
// page.
//
// Deliberately public/view-only for anyone, logged in or not — same as
// the asset page. Save and Message are the only two actions gated behind
// login, since both require the visitor to actually be a Maintler
// themselves (this app has no other kind of account).

type PublicProfile = {
  id: string;
  name: string;
  workshop_name: string | null;
  photo_url: string | null;
  verified: boolean | null;
  profession: string | null;
  created_at: string;
  maintler_code: string;
};

function displayName(p: PublicProfile) {
  return p.workshop_name || p.name;
}

function initialsOf(name: string) {
  return name.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "M";
}

export default function MaintlerPublicPage() {
  const params = useParams();
  const router = useRouter();
  const code = params?.code as string;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [profile, setProfile] = useState<PublicProfile | null>(null);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);

  const [saved, setSaved] = useState(false);
  const [savedRowId, setSavedRowId] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (!code) { setNotFound(true); setLoading(false); return; }

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsLoggedIn(true);
        setViewerId(session.user.id);
      }

      const { data: row } = await supabase
        .from("mechanic_public_profile")
        .select("id, name, workshop_name, photo_url, verified, profession, created_at, maintler_code")
        .eq("maintler_code", code)
        .single();

      if (!row) { setNotFound(true); setLoading(false); return; }
      setProfile(row as PublicProfile);

      if (session && session.user.id !== row.id) {
        const { data: savedRow } = await supabase
          .from("maintler_saved_contacts")
          .select("id")
          .eq("owner_id", session.user.id)
          .eq("saved_id", row.id)
          .maybeSingle();
        if (savedRow) { setSaved(true); setSavedRowId(savedRow.id); }
      }

      setLoading(false);
    }

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  async function toggleSave() {
    if (!profile) return;
    if (!isLoggedIn) { router.push(`/login?redirect=/maintler/${code}`); return; }
    setSaveError("");
    setSaveBusy(true);

    if (saved) {
      if (savedRowId) await supabase.from("maintler_saved_contacts").delete().eq("id", savedRowId);
      setSaved(false);
      setSavedRowId(null);
    } else {
      const { data, error: err } = await supabase
        .from("maintler_saved_contacts")
        .insert({ owner_id: viewerId, saved_id: profile.id })
        .select("id")
        .single();
      if (err || !data) {
        setSaveError("Couldn't save this Maintler. Try again.");
      } else {
        setSaved(true);
        setSavedRowId(data.id);
      }
    }
    setSaveBusy(false);
  }

  function handleMessage() {
    if (!profile) return;
    if (!isLoggedIn) { router.push(`/login?redirect=/maintler/${code}`); return; }
    router.push(`/dashboard/team-chat?with=${profile.id}`);
  }

  async function handleShare() {
    const url = `${window.location.origin}/maintler/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Clipboard API can be unavailable (very old browsers, insecure
      // context) — nothing to fall back to here that isn't more
      // disruptive than just not copying, so this fails silently.
    }
  }

  // ── LOADING ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-400 text-[14px]">Loading Maintler profile...</p>
      </div>
    );
  }

  // ── NOT FOUND ────────────────────────────────────────────────────────
  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mb-4">
          <AlertCircle size={28} className="text-red-500" />
        </div>
        <h1 className="text-[20px] font-black text-zinc-900 mb-2">Maintler Not Found</h1>
        <p className="text-[14px] text-zinc-500 max-w-xs">This QR code doesn&apos;t match any Maintler in our system.</p>
        <div className="mt-8 flex items-center gap-0">
          <Image src="/images/maintly-logo-full.png" alt="MaintlyQR" width={217} height={64} className="object-contain mt-2" />
        </div>
      </div>
    );
  }

  const isSelf = !!viewerId && viewerId === profile.id;
  const name = displayName(profile);

  return (
    <div className="min-h-screen bg-zinc-50 pb-32">

      {/* ── HEADER ── */}
      <div className="bg-white border-b border-zinc-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <a href="/" className="flex items-center">
          <Image src="/images/maintly-logo-full.png" alt="MaintlyQR" width={217} height={64} className="object-contain mt-2" />
        </a>
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 hover:text-zinc-800 border border-zinc-200 hover:bg-zinc-50 px-2.5 py-1.5 rounded-lg transition-colors"
        >
          {linkCopied ? <><Check size={13} className="text-emerald-500" /> Copied</> : <><Share2 size={13} /> Share</>}
        </button>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* ── PROFILE CARD ── */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 px-5 py-6 flex items-center gap-4">
            {profile.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.photo_url} alt={name} className="w-16 h-16 rounded-2xl object-cover shrink-0 border border-white/20" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 text-white font-black text-[20px]">
                {initialsOf(name)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-zinc-400 tracking-[0.15em] uppercase mb-0.5">Maintler</p>
              <h1 className="text-[20px] font-black text-white leading-tight truncate">{name}</h1>
              {profile.workshop_name && profile.name !== profile.workshop_name && (
                <p className="text-[12px] text-zinc-400 mt-0.5 truncate">{profile.name}</p>
              )}
            </div>
          </div>

          <div className="px-5 py-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${profile.verified ? "bg-emerald-50" : "bg-zinc-50"}`}>
                <ShieldCheck size={15} className={profile.verified ? "text-emerald-500" : "text-zinc-400"} />
              </div>
              <div>
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide">Status</p>
                <p className="text-[12.5px] font-semibold text-zinc-700">
                  {profile.verified && profile.profession ? `${profile.profession} Maintler` : profile.verified ? "Verified Maintler" : "Maintler"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-zinc-50 flex items-center justify-center shrink-0">
                <CalendarDays size={15} className="text-zinc-500" />
              </div>
              <div>
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide">Member since</p>
                <p className="text-[12.5px] font-semibold text-zinc-700">{formatDateDMY(profile.created_at)}</p>
              </div>
            </div>
          </div>
        </div>

        {saveError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
            <AlertCircle size={14} className="text-red-500 shrink-0" />
            <p className="text-[12px] text-red-600">{saveError}</p>
          </div>
        )}

        {isSelf && (
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm px-5 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              <UserCircle2 size={16} className="text-red-500" />
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-zinc-800">This is your own Maintler card.</p>
              <p className="text-[11px] text-zinc-400">Share this QR or link so other Maintlers can save and message you directly.</p>
            </div>
          </div>
        )}

        {/* ── FOOTER ── */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm px-5 py-4 flex items-center gap-3">
          <ShieldCheck size={18} className="text-red-500 shrink-0" />
          <div>
            <p className="text-[12px] font-bold text-zinc-800">Verified by Maintly</p>
            <p className="text-[11px] text-zinc-400">Part of the MaintlyQR World — a global community of Maintlers.</p>
          </div>
        </div>

        <p className="text-center text-[10px] text-zinc-400 pb-4">
          Powered by <span className="font-bold text-zinc-600">Maintly</span> · Maintenance. Tracked.
        </p>
      </div>

      {/* ══ STICKY ACTION BAR ══════════════════════════════════════════════════ */}
      {!isSelf && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-zinc-200 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}>

          {isLoggedIn ? (
            <div className="max-w-lg mx-auto px-4 pt-3 pb-1 flex gap-3">
              <button
                onClick={toggleSave}
                disabled={saveBusy}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-[13px] transition-all active:scale-[0.97] ${
                  saved
                    ? "bg-amber-50 border border-amber-200 text-amber-700"
                    : "bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm"
                }`}
              >
                {saveBusy
                  ? <div className="w-4 h-4 rounded-full border-2 border-current/30 border-t-current animate-spin" />
                  : <><Star size={15} className={saved ? "fill-current" : ""} /> {saved ? "Saved" : "Save Maintler"}</>
                }
              </button>
              <button
                onClick={handleMessage}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-[13px] bg-red-600 hover:bg-red-500 text-white shadow-sm transition-all active:scale-[0.97]"
              >
                <Send size={15} /> Message
              </button>
            </div>
          ) : (
            <div className="max-w-lg mx-auto px-4 pt-3 pb-1 space-y-2">
              <p className="text-[11px] text-zinc-400 text-center">Log in as a Maintler to save or message {name}.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/login?redirect=/maintler/${code}`)}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-[13px] bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm transition-all active:scale-[0.97]"
                >
                  <LogIn size={15} /> Log in
                </button>
                <button
                  onClick={() => router.push("/register")}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-[13px] border border-zinc-200 hover:bg-zinc-50 text-zinc-700 bg-white transition-all active:scale-[0.97]"
                >
                  <UserPlus size={15} /> Sign up
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
