"use client";

import Image from "next/image";
import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ShieldCheck, CalendarDays, AlertCircle, LogIn, UserPlus,
  Star, Send, UserCircle2, Share2, Check, Wrench, Box, Users, Download,
  Phone, Mail, Globe, Printer,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatDateDMY } from "@/lib/date";
import MaintlerCardCanvas, { type MaintlerCardCanvasHandle } from "@/components/MaintlerCardCanvas";

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
//
// Round 2 (same day): Facu shared a fuller card concept — a stats panel,
// specialty icons, "Experience & Skills" bars, badges, and a "Maintly
// Score." Every number below is computed from real logged activity via
// get_maintler_stats()/get_maintler_specialty_breakdown() (migration
// 025), NOT typed in by the mechanic — deliberately, to keep this
// consistent with the "verified, tamper-proof" positioning the rest of
// the app already has.
//
// Round 4 (same day) — "para mi re podes hacer q se parezcan" /
// "cuando toco print me muestra esto pero no tiene datos de nada" /
// "no me gusta tener q escrolear... quisiera q sea del estilo del
// reporte." Answered via a clarifying question: unify this into ONE
// dense, report-style layout (like the asset's printable service
// report at /asset/[code]/report) instead of ~9 separately-boxed cards
// stacked with their own padding/border/shadow — and make Print output
// THIS page (real data: stats, badges, specialties, contact), not just
// the small photo+QR ID card. Applied the report page's own techniques:
// one bounded document instead of many boxed sections, a horizontal
// stat strip instead of a 2x2 grid of individually-boxed tiles, thin
// dividers between zones instead of full card chrome per zone.

const assetTypeImg: Record<string, string> = {
  automotive: "/images/car.png",
  motorcycle: "/images/moto.png",
  generator: "/images/generador.png",
  machinery: "/images/excavator.png",
  marine: "/images/barco.png",
  aviation: "/images/avion.png",
};

const assetTypeLabel: Record<string, string> = {
  automotive: "Automotive",
  motorcycle: "Motorcycles",
  generator: "Generators",
  machinery: "Machinery",
  marine: "Marine",
  aviation: "Aviation",
};

type PublicProfile = {
  id: string;
  name: string;
  workshop_name: string | null;
  photo_url: string | null;
  verified: boolean | null;
  profession: string | null;
  created_at: string;
  maintler_code: string;
  phone: string | null;
  contact_email: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  website_url: string | null;
};

type MaintlerStats = {
  services_count: number;
  assets_count: number;
  customers_count: number;
  repeat_customers_count: number;
};

type SpecialtyRow = { asset_type: string; services_count: number };

function displayName(p: PublicProfile) {
  return p.workshop_name || p.name;
}

function initialsOf(name: string) {
  return name.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "M";
}

function yearsSince(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (365.25 * 24 * 3600 * 1000)));
}

// A transparent, formula-driven score instead of an unexplained star
// rating — every input is a number already shown elsewhere on this same
// page, so nothing here is a hidden or "trust me" figure. Capped at 5.
function computeScore(profile: PublicProfile, stats: MaintlerStats, specialtyCount: number, years: number) {
  let score = 1;
  if (profile.verified) score += 1;
  if (stats.services_count >= 25) score += 1;
  if (stats.services_count >= 100) score += 1;
  if (years >= 2) score += 1;
  if (specialtyCount >= 2) score += 1;
  return Math.min(5, score);
}

type Badge = { label: string; icon: typeof ShieldCheck; className: string };

function computeBadges(profile: PublicProfile, stats: MaintlerStats, specialtyCount: number, years: number): Badge[] {
  const badges: Badge[] = [];
  if (profile.verified) badges.push({ label: "Verified", icon: ShieldCheck, className: "bg-emerald-50 text-emerald-700 border-emerald-200" });
  if (stats.services_count >= 100) badges.push({ label: "100+ Services", icon: Wrench, className: "bg-blue-50 text-blue-700 border-blue-200" });
  else if (stats.services_count >= 25) badges.push({ label: "25+ Services", icon: Wrench, className: "bg-blue-50 text-blue-700 border-blue-200" });
  if (years >= 5) badges.push({ label: `${years}+ Years Active`, icon: CalendarDays, className: "bg-amber-50 text-amber-700 border-amber-200" });
  if (specialtyCount >= 3) badges.push({ label: "Multi-Asset Specialist", icon: Box, className: "bg-purple-50 text-purple-700 border-purple-200" });
  return badges;
}

function MaintlerPublicPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = params?.code as string;
  const autoPrint = searchParams.get("print") === "1";

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [stats, setStats] = useState<MaintlerStats | null>(null);
  const [specialties, setSpecialties] = useState<SpecialtyRow[]>([]);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);

  const [saved, setSaved] = useState(false);
  const [savedRowId, setSavedRowId] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [linkCopied, setLinkCopied] = useState(false);
  const ownCardRef = useRef<MaintlerCardCanvasHandle>(null);
  const printedRef = useRef(false);

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
        .select("id, name, workshop_name, photo_url, verified, profession, created_at, maintler_code, phone, contact_email, instagram_url, facebook_url, website_url")
        .eq("maintler_code", code)
        .single();

      if (!row) { setNotFound(true); setLoading(false); return; }
      setProfile(row as PublicProfile);

      const [statsRes, specialtiesRes] = await Promise.all([
        supabase.rpc("get_maintler_stats", { target_mechanic_id: row.id }),
        supabase.rpc("get_maintler_specialty_breakdown", { target_mechanic_id: row.id }),
      ]);
      const statsRow = Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data;
      if (statsRow) setStats(statsRow as MaintlerStats);
      if (Array.isArray(specialtiesRes.data)) setSpecialties(specialtiesRes.data as SpecialtyRow[]);

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

  // Deep-linked print — Settings' "Print" button (and the small ID card's
  // own print action, previously the only print path) now opens this page
  // with ?print=1 instead of rasterizing just the photo+QR card, per
  // Facu's "cuando toco print me muestra esto pero no tiene datos de
  // nada": the real, data-rich page is what should come out of Print.
  useEffect(() => {
    if (autoPrint && !loading && profile && !printedRef.current) {
      printedRef.current = true;
      // Let the just-rendered DOM (photo image, QR canvas) settle a beat
      // before handing off to the browser's print pipeline.
      setTimeout(() => window.print(), 300);
    }
  }, [autoPrint, loading, profile]);

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

  function handlePrint() {
    window.print();
  }

  // Deliberately no phone/email on this vCard — the vCard is a phone
  // contact-book entry, not the public page itself, and a name +
  // organization + link back to the live profile (where any contact info
  // the Maintler chose to publish already lives) is enough for that.
  function handleSaveContact() {
    if (!profile) return;
    const url = `${window.location.origin}/maintler/${code}`;
    const lines = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${name}`,
      profile.workshop_name ? `ORG:${profile.workshop_name}` : null,
      `URL:${url}`,
      "NOTE:Maintler on MaintlyQR",
      "END:VCARD",
    ].filter(Boolean) as string[];
    const blob = new Blob([lines.join("\n")], { type: "text/vcard" });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `${name.replace(/\s+/g, "_")}.vcf`;
    a.click();
    URL.revokeObjectURL(blobUrl);
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
  const years = yearsSince(profile.created_at);
  const totalSpecialtyServices = specialties.reduce((sum, s) => sum + s.services_count, 0);
  const score = stats ? computeScore(profile, stats, specialties.length, years) : null;
  const badges = stats ? computeBadges(profile, stats, specialties.length, years) : [];
  const hasContact = !!(profile.phone || profile.contact_email || profile.instagram_url || profile.facebook_url || profile.website_url);

  return (
    <div className="min-h-screen bg-zinc-50 pb-32 print:pb-0 print:bg-white">

      {/* Print-only formatting: hide chrome that makes no sense on paper
          (top nav, sticky bottom action bar, save/share buttons), and let
          the one document card fill the page instead of sitting in a
          narrow centered column. Same "let the browser handle print
          layout" spirit as the QR Codes page's own Print Sheet and the
          asset service report. */}
      <style jsx global>{`
        @media print {
          .maintler-noprint { display: none !important; }
          .maintler-doc { max-width: 100% !important; box-shadow: none !important; border: none !important; }
          body { background: #fff !important; }
        }
      `}</style>

      {/* ── HEADER ── */}
      <div className="maintler-noprint bg-white border-b border-zinc-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <a href="/" className="flex items-center">
          <Image src="/images/maintly-logo-full.png" alt="MaintlyQR" width={217} height={64} className="object-contain mt-2" />
        </a>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 hover:text-zinc-800 border border-zinc-200 hover:bg-zinc-50 px-2.5 py-1.5 rounded-lg transition-colors"
            title="Print this profile"
          >
            <Printer size={13} /> <span className="hidden sm:inline">Print</span>
          </button>
          <button
            onClick={handleSaveContact}
            className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 hover:text-zinc-800 border border-zinc-200 hover:bg-zinc-50 px-2.5 py-1.5 rounded-lg transition-colors"
            title="Save as a phone contact"
          >
            <Download size={13} /> <span className="hidden sm:inline">Save Contact</span>
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 hover:text-zinc-800 border border-zinc-200 hover:bg-zinc-50 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            {linkCopied ? <><Check size={13} className="text-emerald-500" /> Copied</> : <><Share2 size={13} /> Share</>}
          </button>
        </div>
      </div>

      <div className="maintler-doc max-w-lg mx-auto px-4 py-6">

        {/* ── ONE DOCUMENT, THIN DIVIDERS INSTEAD OF ~9 SEPARATE BOXED
               CARDS ── report-style density, same idea as the asset's
               printable service report: one bounded card, sections
               separated by a hairline instead of their own
               padding+border+shadow apiece. This is what shrinks the page
               enough to need little or no scrolling, and it's exactly
               what Print now outputs. */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">

          {/* Header strip: photo, name, workshop */}
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 px-5 py-5 flex items-center gap-4">
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

          {/* Status + member since — one thin row, no boxed tiles */}
          <div className="px-5 py-3 border-b border-zinc-100 flex items-center gap-5 text-[12px]">
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={14} className={profile.verified ? "text-emerald-500" : "text-zinc-400"} />
              <span className="font-semibold text-zinc-700">
                {profile.verified && profile.profession ? `${profile.profession} Maintler` : profile.verified ? "Verified Maintler" : "Maintler"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-zinc-400">
              <CalendarDays size={14} />
              <span>Since {formatDateDMY(profile.created_at)}</span>
            </div>
          </div>

          {/* Maintly Score + a horizontal stat strip (report style)
              instead of a 2x2 grid of individually-boxed tiles */}
          {stats && (
            <div className="px-5 py-4 border-b border-zinc-100">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-1">Maintly Score</p>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} size={14} className={i < (score ?? 0) ? "text-amber-400 fill-amber-400" : "text-zinc-200"} />
                    ))}
                  </div>
                </div>
                <p className="text-[9.5px] text-zinc-400 text-right max-w-[130px] leading-tight">
                  Based on verification, activity, and logged experience — not reviews.
                </p>
              </div>
              <div className="flex divide-x divide-zinc-100 -mx-5 px-5 pt-3 border-t border-zinc-100">
                {[
                  { value: stats.services_count, label: "Services", icon: Wrench, color: "text-blue-500" },
                  { value: stats.assets_count, label: "Assets", icon: Box, color: "text-red-500" },
                  { value: stats.customers_count, label: "Customers", icon: Users, color: "text-purple-500" },
                  { value: stats.repeat_customers_count, label: "Repeat", icon: Star, color: "text-emerald-500" },
                ].map(({ value, label, icon: Icon, color }) => (
                  <div key={label} className="flex-1 flex flex-col items-center text-center px-1">
                    <Icon size={14} className={`${color} mb-1`} />
                    <p className="text-[15px] font-black text-zinc-900 leading-tight">{value}</p>
                    <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-wide leading-tight">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Badges — compact chip row, no separate card */}
          {badges.length > 0 && (
            <div className="px-5 py-3 border-b border-zinc-100 flex flex-wrap gap-1.5">
              {badges.map((b) => (
                <span key={b.label} className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border ${b.className}`}>
                  <b.icon size={11} /> {b.label}
                </span>
              ))}
            </div>
          )}

          {/* Specialties + Experience & Skills merged into one block */}
          {specialties.length > 0 && (
            <div className="px-5 py-4 border-b border-zinc-100">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-2.5">Specialties & Experience</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {specialties.map((s) => (
                  <div key={s.asset_type} className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-100 rounded-lg pl-1.5 pr-2.5 py-1">
                    <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center overflow-hidden shrink-0">
                      <Image src={assetTypeImg[s.asset_type] ?? "/images/car.png"} alt={s.asset_type} width={16} height={16} className="object-contain" />
                    </div>
                    <span className="text-[10.5px] font-semibold text-zinc-600">{assetTypeLabel[s.asset_type] ?? s.asset_type}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {specialties.map((s) => {
                  const pct = totalSpecialtyServices > 0 ? Math.round((s.services_count / totalSpecialtyServices) * 100) : 0;
                  return (
                    <div key={s.asset_type}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] font-semibold text-zinc-700">{assetTypeLabel[s.asset_type] ?? s.asset_type}</span>
                        <span className="text-[10px] text-zinc-400">{pct}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-zinc-100 overflow-hidden">
                        <div className="h-full bg-red-600 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Contact — 2-column grid instead of one-per-line */}
          {hasContact && (
            <div className="px-5 py-3 border-b border-zinc-100">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-2">Contact</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {profile.phone && (
                  <a href={`tel:${profile.phone}`} className="flex items-center gap-1.5 text-[11.5px] font-semibold text-zinc-700 hover:text-red-600 transition-colors truncate">
                    <Phone size={12} className="text-zinc-400 shrink-0" /> <span className="truncate">{profile.phone}</span>
                  </a>
                )}
                {profile.contact_email && (
                  <a href={`mailto:${profile.contact_email}`} className="flex items-center gap-1.5 text-[11.5px] font-semibold text-zinc-700 hover:text-red-600 transition-colors truncate">
                    <Mail size={12} className="text-zinc-400 shrink-0" /> <span className="truncate">{profile.contact_email}</span>
                  </a>
                )}
                {profile.instagram_url && (
                  <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11.5px] font-semibold text-zinc-700 hover:text-red-600 transition-colors truncate">
                    <Globe size={12} className="text-zinc-400 shrink-0" /> Instagram
                  </a>
                )}
                {profile.facebook_url && (
                  <a href={profile.facebook_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11.5px] font-semibold text-zinc-700 hover:text-red-600 transition-colors truncate">
                    <Globe size={12} className="text-zinc-400 shrink-0" /> Facebook
                  </a>
                )}
                {profile.website_url && (
                  <a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11.5px] font-semibold text-zinc-700 hover:text-red-600 transition-colors truncate col-span-2">
                    <Globe size={12} className="text-zinc-400 shrink-0" /> <span className="truncate">{profile.website_url.replace(/^https?:\/\//, "")}</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {isSelf && (
            <div className="maintler-noprint px-5 py-4 border-b border-zinc-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                  <UserCircle2 size={16} className="text-red-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-bold text-zinc-800">This is your own Maintler card.</p>
                  <p className="text-[11px] text-zinc-400">Download or send the printable ID card below — the full editable version also lives in Settings.</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <MaintlerCardCanvas
                  ref={ownCardRef}
                  code={code}
                  name={name}
                  workshopName={profile.workshop_name}
                  photoUrl={profile.photo_url}
                  verified={profile.verified}
                  profession={profile.verified ? profile.profession : null}
                  previewWidth={110}
                />
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => ownCardRef.current?.download(`maintlyqr-${name}`)}
                    className="flex items-center gap-1.5 text-[11.5px] font-bold text-white bg-zinc-900 hover:bg-zinc-800 px-3.5 py-2.5 rounded-xl transition-colors"
                  >
                    <Download size={13} /> Download
                  </button>
                  <button
                    onClick={() => ownCardRef.current?.share(`maintlyqr-${name}`)}
                    className="flex items-center gap-1.5 text-[11.5px] font-bold text-zinc-600 hover:text-red-600 border border-zinc-200 hover:bg-zinc-50 px-3.5 py-2.5 rounded-xl transition-colors"
                  >
                    <Share2 size={13} /> Send
                  </button>
                </div>
              </div>
            </div>
          )}

          {saveError && (
            <div className="maintler-noprint mx-5 my-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <AlertCircle size={14} className="text-red-500 shrink-0" />
              <p className="text-[12px] text-red-600">{saveError}</p>
            </div>
          )}

          {/* Footer strip */}
          <div className="px-5 py-3 bg-zinc-50 flex items-center gap-2.5">
            <ShieldCheck size={15} className="text-red-500 shrink-0" />
            <p className="text-[10.5px] text-zinc-500">
              <span className="font-bold text-zinc-700">Verified by Maintly</span> · Part of the MaintlyQR World.
            </p>
          </div>
        </div>

        <p className="text-center text-[10px] text-zinc-400 pt-3">
          Powered by <span className="font-bold text-zinc-600">Maintly</span> · Maintenance. Tracked.
        </p>
      </div>

      {/* ══ STICKY ACTION BAR ══════════════════════════════════════════════════ */}
      {!isSelf && (
        <div className="maintler-noprint fixed bottom-0 inset-x-0 z-40 bg-white border-t border-zinc-200 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]"
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

export default function MaintlerPublicPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <MaintlerPublicPageContent />
    </Suspense>
  );
}
