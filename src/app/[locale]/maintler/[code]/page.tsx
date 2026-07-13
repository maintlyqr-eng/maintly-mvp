"use client";

import Image from "next/image";
import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ShieldCheck, CalendarDays, AlertCircle, LogIn, UserPlus,
  Star, Send, UserCircle2, Share2, Check, Wrench, Box, Users, Download,
  Phone, Mail, Globe, Printer, MapPin,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatDateDMY } from "@/lib/date";
import MaintlerCardCanvas, { type MaintlerCardCanvasHandle } from "@/components/MaintlerCardCanvas";
import { yearsSince, computeScore, computeBadges, type MaintlerStats } from "@/lib/maintlerScore";
import { isSafeHref } from "@/lib/contactValidation";

// Localized copy of src/app/maintler/[code]/page.tsx — see that file's
// header comment for the full feature history (Item 4 of the backlog).
// This is Item 5 (i18n) rollout page #3, after Home and the public
// Asset/QR page. Same conventions as those: next/navigation's own
// useParams/useRouter (NOT @/i18n/navigation) since /login, /register and
// /dashboard/team-chat aren't migrated yet — those links stay plain and
// unprefixed on purpose.
//
// The "{profession} Maintler" / badge-label translation follows the same
// enum-key pattern used on the Asset and Report pages. The one new piece
// here is computeBadges() in @/lib/maintlerScore.ts, which used to return
// hardcoded English badge text — it now takes an optional translated
// `labels` override (see that file's comment) so this page can localize
// badges without touching the still-English Settings call site.

const assetTypeImg: Record<string, string> = {
  automotive: "/images/car.png",
  motorcycle: "/images/moto.png",
  generator: "/images/generador.png",
  machinery: "/images/excavator.png",
  marine: "/images/barco.png",
  aviation: "/images/avion.png",
};

// Deliberately its own key set, not the shared AssetTypes namespace used by
// the Asset/Report pages — the original English here used plural forms for
// some specialties ("Motorcycles", "Generators") since it reads as a
// specialty category, not a single asset's type. Keeping that distinction
// instead of silently flattening it to the singular AssetTypes wording.
const SPECIALTY_TYPE_KEYS: Record<string, string> = {
  automotive: "automotive", motorcycle: "motorcycle", generator: "generator",
  machinery: "machinery", marine: "marine", aviation: "aviation",
};

// Mirrors MAINTLER_ROLE_KEYS in src/app/[locale]/asset/[code]/page.tsx
const MAINTLER_ROLE_KEYS: Record<string, string> = {
  "Owner": "owner", "Mechanic": "mechanic", "Electrician": "electrician",
  "HVAC Technician": "hvacTechnician", "Fleet Manager": "fleetManager",
  "Business": "business", "Inspector": "inspector",
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
  location: string | null;
};

type SpecialtyRow = { asset_type: string; services_count: number };

function displayName(p: PublicProfile) {
  return p.workshop_name || p.name;
}

function initialsOf(name: string) {
  return name.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "M";
}

function MaintlerPublicPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = params?.code as string;
  const autoPrint = searchParams.get("print") === "1";

  const t = useTranslations("MaintlerPage");
  const tSpecialtyTypes = useTranslations("MaintlerPage.specialtyTypes");
  const tMaintlerRoles = useTranslations("MaintlerRoles");

  function maintlerRoleLabel(value: string) {
    const key = MAINTLER_ROLE_KEYS[value];
    return key ? tMaintlerRoles(key) : value;
  }
  function specialtyLabel(value: string) {
    const key = SPECIALTY_TYPE_KEYS[value];
    return key ? tSpecialtyTypes(key) : value;
  }

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
        .select("id, name, workshop_name, photo_url, verified, profession, created_at, maintler_code, phone, contact_email, instagram_url, facebook_url, website_url, location")
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
      const { error: err } = savedRowId
        ? await supabase.from("maintler_saved_contacts").delete().eq("id", savedRowId)
        : { error: null };
      if (err) {
        setSaveError(t("removeError"));
      } else {
        setSaved(false);
        setSavedRowId(null);
      }
    } else {
      const { data, error: err } = await supabase
        .from("maintler_saved_contacts")
        .insert({ owner_id: viewerId, saved_id: profile.id })
        .select("id")
        .single();
      if (err || !data) {
        setSaveError(t("saveError"));
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
        <p className="text-zinc-400 text-[14px]">{t("loading")}</p>
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
        <h1 className="text-[20px] font-black text-zinc-900 mb-2">{t("notFoundTitle")}</h1>
        <p className="text-[14px] text-zinc-500 max-w-xs">{t("notFoundDesc")}</p>
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
  const score = stats ? computeScore(profile.verified, stats, specialties.length, years) : null;
  const badges = stats ? computeBadges(profile.verified, stats, specialties.length, years, {
    verified: t("badgeVerified"),
    services100: t("badge100Services"),
    services25: t("badge25Services"),
    yearsActive: (y) => t("badgeYearsActive", { years: y }),
    multiAssetSpecialist: t("badgeMultiAssetSpecialist"),
  }) : [];
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
            title={t("printTitle")}
          >
            <Printer size={13} /> <span className="hidden sm:inline">{t("printButton")}</span>
          </button>
          <button
            onClick={handleSaveContact}
            className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 hover:text-zinc-800 border border-zinc-200 hover:bg-zinc-50 px-2.5 py-1.5 rounded-lg transition-colors"
            title={t("saveContactTitle")}
          >
            <Download size={13} /> <span className="hidden sm:inline">{t("saveContactButton")}</span>
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 hover:text-zinc-800 border border-zinc-200 hover:bg-zinc-50 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            {linkCopied ? <><Check size={13} className="text-emerald-500" /> {t("copiedLabel")}</> : <><Share2 size={13} /> {t("shareButton")}</>}
          </button>
        </div>
      </div>

      <div className="maintler-doc max-w-lg lg:max-w-6xl mx-auto px-4 py-6">

        {/* ── ONE DOCUMENT, THIN DIVIDERS INSTEAD OF ~9 SEPARATE BOXED
               CARDS ── report-style density, same idea as the asset's
               printable service report: one bounded card, sections
               separated by a hairline instead of their own
               padding+border+shadow apiece. On mobile this stacks top to
               bottom exactly like before; at the `lg:` breakpoint it
               splits into a fixed identity sidebar + a wider content
               column, per Facu looking at this on a desktop screen: "ves
               q no entra en la pagina?... tenes toda la pagina para
               armar una buena tarjeta... esto es la compu asi q podemos
               usar todo el espacio." Mobile layout is untouched —
               revisiting that is a separate pass by his own call
               ("despues vemos el diseño en el celu"). */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="lg:grid lg:grid-cols-[320px_1fr] lg:divide-x lg:divide-zinc-100">

            {/* ── LEFT (identity): photo, status, score, badges — a fixed
                   sidebar on desktop, the normal top block on mobile ── */}
            <div className="divide-y divide-zinc-100 border-b border-zinc-100 lg:border-b-0">
              <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 px-5 py-5 flex items-center gap-4 lg:flex-col lg:text-center lg:py-9 lg:px-6">
                {profile.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.photo_url} alt={name} className="w-16 h-16 lg:w-24 lg:h-24 rounded-2xl object-cover shrink-0 border border-white/20" />
                ) : (
                  <div className="w-16 h-16 lg:w-24 lg:h-24 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 text-white font-black text-[20px] lg:text-[28px]">
                    {initialsOf(name)}
                  </div>
                )}
                <div className="min-w-0 lg:mt-4 lg:w-full">
                  <p className="text-[11px] font-bold text-zinc-400 tracking-[0.15em] uppercase mb-0.5">{t("maintlerLabel")}</p>
                  <h1 className="text-[20px] font-black text-white leading-tight truncate">{name}</h1>
                  {profile.workshop_name && profile.name !== profile.workshop_name && (
                    <p className="text-[12px] text-zinc-400 mt-0.5 truncate">{profile.name}</p>
                  )}
                </div>
              </div>

              {/* Status + member since */}
              <div className="px-5 py-3 flex items-center gap-5 text-[12px] lg:flex-col lg:items-start lg:gap-2 lg:py-4">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck size={14} className={profile.verified ? "text-emerald-500" : "text-zinc-400"} />
                  <span className="font-semibold text-zinc-700">
                    {profile.verified && profile.profession
                      ? t("professionMaintler", { profession: maintlerRoleLabel(profile.profession) })
                      : profile.verified ? t("verifiedMaintlerFallback") : t("maintlerLabel")}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <CalendarDays size={14} />
                  <span>{t("sinceLine", { date: formatDateDMY(profile.created_at) })}</span>
                </div>
                {profile.location && (
                  <div className="flex items-center gap-1.5 text-zinc-400">
                    <MapPin size={14} />
                    <span>{profile.location}</span>
                  </div>
                )}
              </div>

              {/* Maintly Score */}
              {stats && (
                <div className="px-5 py-4">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-1">{t("maintlyScoreLabel")}</p>
                  <div className="flex items-center gap-0.5 lg:justify-start">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} size={14} className={i < (score ?? 0) ? "text-amber-400 fill-amber-400" : "text-zinc-200"} />
                    ))}
                  </div>
                  <p className="text-[9.5px] text-zinc-400 leading-tight mt-1.5">
                    {t("maintlyScoreDesc")}
                  </p>
                </div>
              )}

              {/* Badges */}
              {badges.length > 0 && (
                <div className="px-5 py-3 flex flex-wrap gap-1.5 lg:justify-start">
                  {badges.map((b) => (
                    <span key={b.label} className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border ${b.className}`}>
                      <b.icon size={11} /> {b.label}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* ── RIGHT (details): activity stats, specialties, contact,
                   own-card actions — the wide column that actually uses
                   the extra room on desktop ── */}
            <div className="divide-y divide-zinc-100">

              {/* Activity — a real stat strip now that there's room for
                  it, instead of squeezing 4 tiles into a narrow column */}
              {stats && (
                <div className="px-5 py-4 lg:px-7 lg:py-5">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-3">{t("activityLabel")}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4">
                    {[
                      { value: stats.services_count, label: t("servicesLoggedLabel"), icon: Wrench, color: "text-blue-500", bg: "bg-blue-50" },
                      { value: stats.assets_count, label: t("assetsMaintainedLabel"), icon: Box, color: "text-red-500", bg: "bg-red-50" },
                      { value: stats.customers_count, label: t("customersServedLabel"), icon: Users, color: "text-purple-500", bg: "bg-purple-50" },
                      { value: stats.repeat_customers_count, label: t("repeatCustomersLabel"), icon: Star, color: "text-emerald-500", bg: "bg-emerald-50" },
                    ].map(({ value, label, icon: Icon, color, bg }) => (
                      <div key={label} className="flex items-center gap-3 bg-zinc-50 lg:bg-transparent lg:border lg:border-zinc-100 rounded-xl px-3 py-3">
                        <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}><Icon size={16} className={color} /></div>
                        <div className="min-w-0">
                          <p className="text-[17px] font-black text-zinc-900 leading-tight">{value}</p>
                          <p className="text-[9.5px] text-zinc-400 font-bold uppercase tracking-wide leading-tight truncate">{label}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Specialties + Experience & Skills */}
              {specialties.length > 0 && (
                <div className="px-5 py-4 lg:px-7 lg:py-5">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-2.5">{t("specialtiesLabel")}</p>
                  <div className="lg:grid lg:grid-cols-2 lg:gap-8">
                    <div className="flex flex-wrap gap-2 mb-3 lg:mb-0 lg:content-start">
                      {specialties.map((s) => (
                        <div key={s.asset_type} className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-100 rounded-lg pl-1.5 pr-2.5 py-1">
                          <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center overflow-hidden shrink-0">
                            <Image src={assetTypeImg[s.asset_type] ?? "/images/car.png"} alt={s.asset_type} width={16} height={16} className="object-contain" />
                          </div>
                          <span className="text-[10.5px] font-semibold text-zinc-600">{specialtyLabel(s.asset_type)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {specialties.map((s) => {
                        const pct = totalSpecialtyServices > 0 ? Math.round((s.services_count / totalSpecialtyServices) * 100) : 0;
                        return (
                          <div key={s.asset_type}>
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-[11px] font-semibold text-zinc-700">{specialtyLabel(s.asset_type)}</span>
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
                </div>
              )}

              {/* Contact */}
              {hasContact && (
                <div className="px-5 py-3 lg:px-7 lg:py-4">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide mb-2">{t("contactLabel")}</p>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-1.5">
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
                    {isSafeHref(profile.instagram_url) && (
                      <a href={profile.instagram_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11.5px] font-semibold text-zinc-700 hover:text-red-600 transition-colors truncate">
                        <Globe size={12} className="text-zinc-400 shrink-0" /> Instagram
                      </a>
                    )}
                    {isSafeHref(profile.facebook_url) && (
                      <a href={profile.facebook_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11.5px] font-semibold text-zinc-700 hover:text-red-600 transition-colors truncate">
                        <Globe size={12} className="text-zinc-400 shrink-0" /> Facebook
                      </a>
                    )}
                    {isSafeHref(profile.website_url) && (
                      <a href={profile.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[11.5px] font-semibold text-zinc-700 hover:text-red-600 transition-colors truncate col-span-2 lg:col-span-1">
                        <Globe size={12} className="text-zinc-400 shrink-0" /> <span className="truncate">{profile.website_url.replace(/^https?:\/\//, "")}</span>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {isSelf && (
                <div className="maintler-noprint px-5 py-4 lg:px-7 lg:py-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                      <UserCircle2 size={16} className="text-red-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-zinc-800">{t("ownCardTitle")}</p>
                      <p className="text-[11px] text-zinc-400">{t("ownCardDesc")}</p>
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
                        <Download size={13} /> {t("downloadButton")}
                      </button>
                      <button
                        onClick={() => ownCardRef.current?.share(`maintlyqr-${name}`)}
                        className="flex items-center gap-1.5 text-[11.5px] font-bold text-zinc-600 hover:text-red-600 border border-zinc-200 hover:bg-zinc-50 px-3.5 py-2.5 rounded-xl transition-colors"
                      >
                        <Share2 size={13} /> {t("sendButton")}
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
              <div className="px-5 py-3 lg:px-7 bg-zinc-50 flex items-center gap-2.5">
                <ShieldCheck size={15} className="text-red-500 shrink-0" />
                <p className="text-[10.5px] text-zinc-500">
                  <span className="font-bold text-zinc-700">{t("verifiedByMaintlyLabel")}</span> · {t("partOfWorldLabel")}
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-[10px] text-zinc-400 pt-3">
          {t("poweredByPrefix")} <span className="font-bold text-zinc-600">Maintly</span> · {t("poweredByTagline")}
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
                  : <><Star size={15} className={saved ? "fill-current" : ""} /> {saved ? t("savedLabel") : t("saveMaintlerButton")}</>
                }
              </button>
              <button
                onClick={handleMessage}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-[13px] bg-red-600 hover:bg-red-500 text-white shadow-sm transition-all active:scale-[0.97]"
              >
                <Send size={15} /> {t("messageButton")}
              </button>
            </div>
          ) : (
            <div className="max-w-lg mx-auto px-4 pt-3 pb-1 space-y-2">
              <p className="text-[11px] text-zinc-400 text-center">{t("loginPrompt", { name })}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/login?redirect=/maintler/${code}`)}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-[13px] bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm transition-all active:scale-[0.97]"
                >
                  <LogIn size={15} /> {t("loginButton")}
                </button>
                <button
                  onClick={() => router.push("/register")}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-[13px] border border-zinc-200 hover:bg-zinc-50 text-zinc-700 bg-white transition-all active:scale-[0.97]"
                >
                  <UserPlus size={15} /> {t("signupButton")}
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
