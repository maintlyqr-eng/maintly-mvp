"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  FileText, Box, Users, Calendar as CalendarIcon,
  Mail, KeyRound, AlertCircle, CheckCircle2, Camera,
  Image as ImageIcon,
  Copy, Check, Printer, Phone, Globe, ShieldCheck, CalendarDays,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useUnreadMessagesCount } from "@/lib/useUnreadMessages";
import { useUnreadMechanicMessages } from "@/lib/useUnreadMechanicMessages";
import { formatDateDMY } from "@/lib/date";
import AvatarCropModal from "@/components/AvatarCropModal";
import ProfessionVerificationFormIntl, { VerificationStatusCardIntl } from "@/components/ProfessionVerificationFormIntl";
import { validateImageFile } from "@/lib/imageValidation";
import MaintlerCardCanvas, { type MaintlerCardCanvasHandle } from "@/components/MaintlerCardCanvas";
import { yearsSince, computeScore, type MaintlerStats } from "@/lib/maintlerScore";
import { normalizeContactUrl, isValidPhone, isValidEmail, isSafeHref, type ContactUrlErrorCode } from "@/lib/contactValidation";
import DashboardSidebarIntl from "@/components/DashboardSidebarIntl";
import DashboardHeaderIntl from "@/components/DashboardHeaderIntl";
import { getInitials } from "@/lib/initials";

// NOTE: MaintlerCardCanvas is used here UNCHANGED (no Intl variant) — it's
// already used unmigrated, with its original hardcoded canvas-drawn English
// text, by two already-migrated Phase 1 pages (src/app/[locale]/maintler/
// [code]/page.tsx and src/app/[locale]/asset/[code]/page.tsx). This mirrors
// that existing, already-shipped precedent rather than introducing a new
// canvas-text-localization effort as part of this page.
//
// This page's router stays on plain next/navigation's useRouter (not
// @/i18n/navigation) is NOT actually required here — every router target on
// this page is "/login", which is migrated — but it's left as plain
// next/navigation anyway since nothing on this page needs locale-aware
// linking beyond what plain Link already provides for its two external
// targets (/maintler/:code, both already migrated).

const PROFESSION_KEYS: Record<string, string> = {
  "Owner": "owner",
  "Mechanic": "mechanic",
  "Electrician": "electrician",
  "HVAC Technician": "hvacTechnician",
  "Fleet Manager": "fleetManager",
  "Business": "business",
  "Inspector": "inspector",
};

type SpecialtyRow = { asset_type: string; services_count: number };

export default function SettingsPage() {
  const router = useRouter();
  const t = useTranslations("DashboardSettingsPage");
  const tProfessionTypes = useTranslations("ProfessionTypes");
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mechanicId, setMechanicId] = useState("");
  const unreadMessages = useUnreadMessagesCount(mechanicId);
  const unreadMechanicMessages = useUnreadMechanicMessages(mechanicId);
  const [email, setEmail] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [isMechanic, setIsMechanic] = useState(false);
  const [verified, setVerified] = useState(false);

  // Profession & verification
  const [profession, setProfession] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<"none" | "pending" | "verified" | "rejected">("none");
  const [verificationNote, setVerificationNote] = useState<string | null>(null);
  const [showVerificationForm, setShowVerificationForm] = useState(false);

  // Profile form
  const [name, setName] = useState("");
  const [workshopName, setWorkshopName] = useState("");
  const [location, setLocation] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Maintly Stats (round 6) — same real, computed figures as the public
  // card (get_maintler_stats/get_maintler_specialty_breakdown RPCs,
  // migration 025), shown again here so a Maintler can see their own
  // stats without leaving Settings. Never self-reported.
  const [stats, setStats] = useState<MaintlerStats | null>(null);
  const [specialties, setSpecialties] = useState<SpecialtyRow[]>([]);

  // Public contact info (migration 026) — shown on the public Maintler
  // card. Facu's feedback: "no veo datos de contacto." Answered via a
  // clarifying question: he wants email/phone/socials always visible,
  // no per-field privacy toggle — so these are separate, optional fields
  // a mechanic fills in here and that then show up for anyone who visits
  // /maintler/<code>. contact_email is intentionally its own column, not
  // the account login email, since a mechanic may want to publish a
  // different (e.g. shop) address.
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [facebookUrl, setFacebookUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [contactSaving, setContactSaving] = useState(false);
  const [contactMsg, setContactMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Profile photo
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Maintler QR business card (see migration 024) — every mechanic gets a
  // permanent maintler_code, generated automatically at signup (or
  // backfilled for existing accounts by that same migration), that
  // resolves to a public profile at /maintler/<code>.
  const [maintlerCode, setMaintlerCode] = useState("");
  const [cardLinkCopied, setCardLinkCopied] = useState(false);
  const cardCanvasRef = useRef<MaintlerCardCanvasHandle>(null);

  // Round 7 — the physical credit-card-style Maintler card's back side
  // shows a "Documents Uploaded" stat. This is a real, owner-scoped count
  // (RLS already lets a mechanic read their own documents rows directly,
  // same as the Document Library page itself), so it's fetched here as a
  // plain query rather than needing a new public RPC — this card is only
  // ever rendered for the logged-in mechanic viewing their own Settings.
  const [documentsCount, setDocumentsCount] = useState(0);

  // Synchronous in-flight guards for the three forms below — `disabled`
  // on the submit button is a React state update, so it doesn't take
  // effect until the next render; a fast double-click/double-Enter before
  // that re-render can still fire the handler twice (e.g. two "Profile
  // updated" writes, or two password-change requests back to back).
  // These refs are checked synchronously at the very top of each handler.
  const profileBusyRef = useRef(false);
  const contactBusyRef = useRef(false);
  const passwordBusyRef = useRef(false);

  // Password form
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const CONTACT_URL_ERROR_MESSAGES: Record<ContactUrlErrorCode, string> = {
    invalidUrl: t("errorInvalidUrl"),
    invalidScheme: t("errorInvalidScheme"),
  };

  function professionLabel(p: string | null) {
    if (!p) return "";
    return tProfessionTypes(PROFESSION_KEYS[p] ?? "owner");
  }

  useEffect(() => {
    let active = true;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      if (!active) return;

      setMechanicId(session.user.id);
      setEmail(session.user.email ?? "");

      const { data: mechanic } = await supabase
        .from("mechanics")
        .select("name, workshop_name, location, created_at, is_mechanic, verified, photo_url, profession, verification_status, verification_note, maintler_code, phone, contact_email, instagram_url, facebook_url, website_url")
        .eq("id", session.user.id)
        .single();

      if (active && mechanic) {
        setName(mechanic.name ?? "");
        setWorkshopName(mechanic.workshop_name ?? "");
        setLocation(mechanic.location ?? "");
        setCreatedAt(mechanic.created_at ?? "");
        setIsMechanic(!!mechanic.is_mechanic);
        setVerified(!!mechanic.verified);
        setPhotoUrl(mechanic.photo_url ?? "");
        setProfession(mechanic.profession ?? null);
        setVerificationStatus((mechanic.verification_status as "none" | "pending" | "verified" | "rejected") ?? "none");
        setVerificationNote(mechanic.verification_note ?? null);
        setMaintlerCode(mechanic.maintler_code ?? "");
        setContactPhone(mechanic.phone ?? "");
        setContactEmail(mechanic.contact_email ?? "");
        setInstagramUrl(mechanic.instagram_url ?? "");
        setFacebookUrl(mechanic.facebook_url ?? "");
        setWebsiteUrl(mechanic.website_url ?? "");

        const [statsRes, specialtiesRes, documentsRes] = await Promise.all([
          supabase.rpc("get_maintler_stats", { target_mechanic_id: session.user.id }),
          supabase.rpc("get_maintler_specialty_breakdown", { target_mechanic_id: session.user.id }),
          supabase.from("documents").select("*", { count: "exact", head: true }).eq("mechanic_id", session.user.id),
        ]);
        if (active) {
          const statsRow = Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data;
          if (statsRow) setStats(statsRow as MaintlerStats);
          if (Array.isArray(specialtiesRes.data)) setSpecialties(specialtiesRes.data as SpecialtyRow[]);
          setDocumentsCount(documentsRes.count ?? 0);
        }
      }

      if (active) setCheckingAuth(false);
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });

    return () => { active = false; listener.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function handleCopyCardLink() {
    if (!maintlerCode) return;
    const url = `${window.location.origin}/maintler/${maintlerCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCardLinkCopied(true);
      setTimeout(() => setCardLinkCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — nothing more useful to fall back to.
    }
  }

  function handlePrintCard() {
    // Print opens the real public profile (stats, badges, specialties,
    // contact — not just the small photo+QR ID card) and auto-triggers the
    // browser's print dialog there via ?print=1. Facu: "cuando toco print
    // me muestra esto pero no tiene datos de nada" — the small ID card
    // alone read as empty compared to what he expected Print to produce.
    // This is intentionally the ONLY standalone button left in this panel
    // (round 8, "no me gustan tantos botones") — every physical-card action
    // (download/share/print the card itself) now lives behind tapping the
    // card, which opens MaintlerCardCanvas's own view modal.
    if (!maintlerCode) return;
    window.open(`/maintler/${maintlerCode}?print=1`, "_blank");
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again later
    if (!file) return;

    const err = validateImageFile(file);
    if (err) { setPhotoMsg({ text: err, ok: false }); return; }

    const reader = new FileReader();
    reader.onload = () => setCropImageSrc(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function uploadPhoto(file: File) {
    if (!mechanicId) return;

    const validationError = validateImageFile(file);
    if (validationError) { setPhotoMsg({ text: validationError, ok: false }); return; }

    setPhotoMsg(null);
    setPhotoUploading(true);

    const path = `${mechanicId}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("mechanic-photos")
      .upload(path, file, { upsert: true, contentType: "image/jpeg" });

    if (uploadError) {
      setPhotoUploading(false);
      setPhotoMsg({ text: uploadError.message, ok: false });
      return;
    }

    const { data } = supabase.storage.from("mechanic-photos").getPublicUrl(path);
    const publicUrl = `${data.publicUrl}?v=${Date.now()}`; // bust CDN/browser cache after upsert

    const { data: updated, error: dbError } = await supabase
      .from("mechanics")
      .update({ photo_url: publicUrl })
      .eq("id", mechanicId)
      .select("id");

    setPhotoUploading(false);

    if (dbError || !updated || updated.length === 0) {
      setPhotoMsg({ text: dbError?.message || t("errorPhotoSavedButNotProfile"), ok: false });
      return;
    }

    setPhotoUrl(publicUrl);
    setPhotoMsg({ text: t("successPhotoUpdated"), ok: true });
  }

  async function handleCropSave(file: File) {
    await uploadPhoto(file);
    setCropImageSrc(null);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (profileBusyRef.current) return;
    profileBusyRef.current = true;
    setProfileMsg(null);

    if (!name.trim()) {
      profileBusyRef.current = false;
      setProfileMsg({ text: t("errorNameEmpty"), ok: false });
      return;
    }

    setProfileSaving(true);
    const { data, error } = await supabase
      .from("mechanics")
      .update({ name: name.trim(), workshop_name: workshopName.trim() || null, location: location.trim() || null })
      .eq("id", mechanicId)
      .select("id");
    setProfileSaving(false);
    profileBusyRef.current = false;

    if (error) { setProfileMsg({ text: error.message, ok: false }); return; }
    if (!data || data.length === 0) { setProfileMsg({ text: t("errorSaveFailed"), ok: false }); return; }

    setProfileMsg({ text: t("successProfileUpdated"), ok: true });
  }

  async function handleSaveContactInfo(e: React.FormEvent) {
    e.preventDefault();
    if (contactBusyRef.current) return;
    contactBusyRef.current = true;
    setContactMsg(null);

    // Validate + normalize every field before this ever reaches the
    // database — these values get rendered as clickable links on the
    // public /maintler/[code] card (and again as quick-contact icons in
    // this same page), so nothing that isn't a real http(s) link, a
    // phone-shaped string, or an email-shaped string is allowed through.
    // See src/lib/contactValidation.ts for the rationale.
    const errors: string[] = [];

    if (!isValidPhone(contactPhone)) errors.push(t("errorPhoneInvalid"));
    if (!isValidEmail(contactEmail)) errors.push(t("errorEmailInvalid"));

    const instagram = normalizeContactUrl(instagramUrl);
    if (instagram.error) errors.push(t("fieldError", { field: t("instagram"), error: CONTACT_URL_ERROR_MESSAGES[instagram.error] }));
    const facebook = normalizeContactUrl(facebookUrl);
    if (facebook.error) errors.push(t("fieldError", { field: t("facebook"), error: CONTACT_URL_ERROR_MESSAGES[facebook.error] }));
    const website = normalizeContactUrl(websiteUrl);
    if (website.error) errors.push(t("fieldError", { field: t("website"), error: CONTACT_URL_ERROR_MESSAGES[website.error] }));

    if (errors.length > 0) {
      contactBusyRef.current = false;
      setContactMsg({ text: errors.join(" "), ok: false });
      return;
    }

    setContactSaving(true);
    const { data, error } = await supabase
      .from("mechanics")
      .update({
        phone: contactPhone.trim() || null,
        contact_email: contactEmail.trim() || null,
        instagram_url: instagram.value,
        facebook_url: facebook.value,
        website_url: website.value,
      })
      .eq("id", mechanicId)
      .select("id");
    setContactSaving(false);
    contactBusyRef.current = false;

    if (error) { setContactMsg({ text: error.message, ok: false }); return; }
    if (!data || data.length === 0) { setContactMsg({ text: t("errorSaveFailed"), ok: false }); return; }

    // Reflect the normalized (scheme-added) values back into the form so
    // what's shown matches exactly what's now stored/live on the public card.
    setInstagramUrl(instagram.value ?? "");
    setFacebookUrl(facebook.value ?? "");
    setWebsiteUrl(website.value ?? "");

    setContactMsg({ text: t("successContactUpdated"), ok: true });
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (passwordBusyRef.current) return;
    passwordBusyRef.current = true;
    setPasswordMsg(null);

    if (newPassword.length < 6) {
      passwordBusyRef.current = false;
      setPasswordMsg({ text: t("errorPasswordTooShort"), ok: false });
      return;
    }
    if (newPassword !== confirmPassword) {
      passwordBusyRef.current = false;
      setPasswordMsg({ text: t("errorPasswordMismatch"), ok: false });
      return;
    }

    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);
    passwordBusyRef.current = false;

    if (error) { setPasswordMsg({ text: error.message, ok: false }); return; }

    setNewPassword("");
    setConfirmPassword("");
    setPasswordMsg({ text: t("successPasswordUpdated"), ok: true });
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-zinc-400 text-[13px]">{t("loadingAuth")}</p>
      </div>
    );
  }

  const initials = getInitials(name);
  const yearsActive = createdAt ? yearsSince(createdAt) : 0;
  const maintlyScore = stats ? computeScore(verified, stats, specialties.length, yearsActive) : null;

  return (
    <div className="min-h-screen bg-zinc-50 flex relative">

      <DashboardSidebarIntl
        activeHref="/dashboard/settings"
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
        mechanicId={mechanicId}
        unreadMessages={unreadMessages}
        unreadMechanicMessages={unreadMechanicMessages}
        photoUrl={photoUrl}
        name={name}
        email={email}
      />

      {/* ════ MAIN ════ */}
      <div className="flex-1 flex flex-col min-w-0">

        <DashboardHeaderIntl
          title={t("headerTitle")}
          subtitle={t("headerSubtitle")}
          onOpenSidebar={() => setSidebarOpen(true)}
          mechanicId={mechanicId}
          unreadMessages={unreadMessages}
          unreadMechanicMessages={unreadMechanicMessages}
          photoUrl={photoUrl}
          name={name}
          email={email}
          maintlerCode={maintlerCode}
          onLogout={handleLogout}
        />

        <div className="flex-1 overflow-y-auto p-4 md:p-7 max-w-2xl lg:max-w-5xl">

          {/* ── ACCOUNT STATUS ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-zinc-50 flex items-center justify-center shrink-0"><CalendarDays size={16} className="text-zinc-500" /></div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">{t("memberSince")}</p>
                <p className="text-[13px] font-bold text-zinc-800">{createdAt ? formatDateDMY(createdAt) : "—"}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${verified ? "bg-emerald-50" : "bg-zinc-50"}`}>
                <ShieldCheck size={16} className={verified ? "text-emerald-500" : "text-zinc-400"} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">{t("statusLabel")}</p>
                <p className="text-[13px] font-bold text-zinc-800">
                  {verified && profession ? t("statusProfessionMaintler", { profession: professionLabel(profession) }) : verified ? t("statusVerifiedMaintler") : t("statusMaintler")}
                </p>
              </div>
            </div>
          </div>

          {/* ── MY MAINTLER CARD ──
              Round 6 — Facu sent a full desktop mockup of this exact
              section ("algo asi te muestro de ejemplo para la web"): a
              wide landscape card on the left with the card's own
              download/share actions plus a row of quick contact-method
              icons to the right, instead of the previous narrow
              portrait-card + stacked-buttons layout. Rebuilt around
              that — on desktop the card and the action panel now sit
              side by side using the extra width, same as his mockup;
              they still stack on mobile. */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 mb-6">
            <h2 className="text-[14px] font-black text-zinc-900 mb-1">{t("myMaintlerCard")}</h2>
            <p className="text-[12px] text-zinc-400 mb-5">
              {t("myMaintlerCardDesc")}
            </p>

            {maintlerCode ? (
              <div className="lg:flex lg:items-stretch lg:gap-6">
                <div className="lg:w-[520px] lg:shrink-0">
                  <MaintlerCardCanvas
                    ref={cardCanvasRef}
                    code={maintlerCode}
                    name={name || email}
                    workshopName={workshopName}
                    photoUrl={photoUrl}
                    verified={verified}
                    profession={verified ? profession : null}
                    location={location || null}
                    createdAt={createdAt || null}
                    stats={stats}
                    documentsCount={documentsCount}
                    specialties={specialties}
                    contactEmail={contactEmail || null}
                    contactPhone={contactPhone || null}
                    websiteUrl={isSafeHref(websiteUrl) ? websiteUrl : null}
                    previewWidth={520}
                    clickToView
                  />
                </div>
                <div className="mt-4 lg:mt-0 lg:flex-1 lg:min-w-0 space-y-4 flex flex-col lg:justify-center">
                  <div>
                    <Link
                      href={`/maintler/${maintlerCode}`}
                      target="_blank"
                      className="text-[13px] font-bold text-zinc-800 hover:text-red-600 transition-colors"
                    >
                      {t("scanToView")} <span className="text-red-600">{t("maintlerProfile")}</span>
                    </Link>
                  </div>
                  {/* Round 8 ("no me gustan tantos botones"): download, share,
                      view, and print-the-physical-card all collapsed into a
                      single interaction — tap the card itself, which opens
                      MaintlerCardCanvas's own modal (both sides, plus its own
                      Download/Print Card/Share actions). "Print" here is a
                      genuinely separate feature (the full public report page,
                      not this card), so it keeps its own button. */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handlePrintCard}
                      className="flex items-center gap-1.5 text-[11.5px] font-bold text-zinc-600 hover:text-red-600 border border-zinc-200 hover:bg-zinc-50 px-3.5 py-2.5 rounded-xl transition-colors"
                    >
                      <Printer size={13} /> {t("print")}
                    </button>
                  </div>

                  {/* Quick contact-method icons — only the ones actually
                      filled in below show up, same real fields as the
                      public card's Contact section (migration 026), not
                      a fixed WhatsApp/LinkedIn set that may not apply to
                      every Maintler. */}
                  {(contactEmail || contactPhone || instagramUrl || facebookUrl || websiteUrl) && (
                    <div className="flex items-center gap-2">
                      {contactEmail && (
                        <a href={`mailto:${contactEmail}`} title={contactEmail} className="w-9 h-9 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-500 hover:text-red-600 hover:border-red-200 transition-colors">
                          <Mail size={15} />
                        </a>
                      )}
                      {contactPhone && (
                        <a href={`tel:${contactPhone}`} title={contactPhone} className="w-9 h-9 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-500 hover:text-red-600 hover:border-red-200 transition-colors">
                          <Phone size={15} />
                        </a>
                      )}
                      {isSafeHref(instagramUrl) && (
                        <a href={instagramUrl} target="_blank" rel="noopener noreferrer" title="Instagram" className="w-9 h-9 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-500 hover:text-red-600 hover:border-red-200 transition-colors">
                          <Globe size={15} />
                        </a>
                      )}
                      {isSafeHref(facebookUrl) && (
                        <a href={facebookUrl} target="_blank" rel="noopener noreferrer" title="Facebook" className="w-9 h-9 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-500 hover:text-red-600 hover:border-red-200 transition-colors">
                          <Globe size={15} />
                        </a>
                      )}
                      {isSafeHref(websiteUrl) && (
                        <a href={websiteUrl} target="_blank" rel="noopener noreferrer" title={websiteUrl} className="w-9 h-9 rounded-full border border-zinc-200 flex items-center justify-center text-zinc-500 hover:text-red-600 hover:border-red-200 transition-colors">
                          <Globe size={15} />
                        </a>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={`maintlyqr.com/maintler/${maintlerCode}`}
                      className="flex-1 min-w-0 bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-[12.5px] text-zinc-600 font-mono truncate"
                    />
                    <button
                      onClick={handleCopyCardLink}
                      className="shrink-0 flex items-center gap-1.5 text-[11.5px] font-bold text-zinc-600 hover:text-zinc-900 border border-zinc-200 hover:bg-zinc-50 px-3 py-2.5 rounded-xl transition-colors"
                    >
                      {cardLinkCopied ? <><Check size={13} className="text-emerald-500" /> {t("copied")}</> : <><Copy size={13} /> {t("copy")}</>}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[12px] text-zinc-300">{t("loadingCard")}</p>
            )}
          </div>

          {/* ── PROFESSION & VERIFICATION + MAINTLY STATS ──
              Side by side on desktop (round 6 mockup), stacked on
              mobile. */}
          <div className="lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start mb-6">
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 mb-6 lg:mb-0">
            <h2 className="text-[14px] font-black text-zinc-900 mb-1">{t("professionVerification")}</h2>
            <p className="text-[12px] text-zinc-400 mb-5">
              {t("professionVerificationDesc")}
            </p>

            {verificationStatus !== "none" && !showVerificationForm && (
              <div className="space-y-3">
                <VerificationStatusCardIntl status={verificationStatus} profession={profession} note={verificationNote} />
                <button
                  type="button"
                  onClick={() => setShowVerificationForm(true)}
                  className="text-[12px] font-bold text-zinc-500 hover:text-red-600 transition-colors"
                >
                  {verificationStatus === "verified" ? t("updateProfessionOrCertificate") : t("editAndResubmit")}
                </button>
              </div>
            )}

            {/* Owner has verificationStatus "none" (no certificate to review),
                same as someone who never touched this section at all -- this
                banner is what tells those two states apart, so picking Owner
                doesn't just silently dump the user back on the same form
                with no confirmation that anything was saved. */}
            {verificationStatus === "none" && profession === "Owner" && !showVerificationForm && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3.5">
                  <ShieldCheck size={18} className="text-zinc-400 shrink-0" />
                  <div>
                    <p className="text-[13px] font-bold text-zinc-700">{t("ownerNoVerificationLabel")}</p>
                    <p className="text-[11px] text-zinc-400">{t("ownerNoVerificationDesc")}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowVerificationForm(true)}
                  className="text-[12px] font-bold text-zinc-500 hover:text-red-600 transition-colors"
                >
                  {t("changeProfession")}
                </button>
              </div>
            )}

            {((verificationStatus === "none" && profession !== "Owner") || showVerificationForm) && (
              <ProfessionVerificationFormIntl
                mechanicId={mechanicId}
                initialProfession={profession}
                onSubmitted={(p, status) => {
                  // "status" is exactly what got written to the DB by the
                  // form: "none" for Owner (no certificate, nothing to
                  // review), "pending" for every other role -- mirroring it
                  // here instead of hardcoding "pending" is what avoids a
                  // wrong "pending review" card with no certificate behind
                  // it once an Owner saves.
                  setProfession(p);
                  setVerificationStatus(status);
                  setVerificationNote(null);
                  setVerified(false);
                  setShowVerificationForm(false);
                }}
              />
            )}
          </div>

          {/* ── MAINTLY STATS ──
              Real numbers only — the same get_maintler_stats() RPC and
              formula-driven Maintly Score the public card already uses
              (migration 025, src/lib/maintlerScore.ts), not a
              self-reported "average rating" or a metric (like "reports
              uploaded") this app doesn't actually track. Facu's mockup
              had 6 tiles; these are the 6 real ones available. */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 mb-6 lg:mb-0">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[14px] font-black text-zinc-900">{t("maintlyStats")}</h2>
              {maintlerCode && (
                <Link href={`/maintler/${maintlerCode}`} target="_blank" className="text-[11.5px] font-bold text-zinc-500 hover:text-red-600 transition-colors">
                  {t("viewAll")}
                </Link>
              )}
            </div>
            {stats ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { value: stats.services_count, label: t("statServicesLogged"), icon: FileText, color: "text-blue-500", bg: "bg-blue-50" },
                  { value: stats.assets_count, label: t("statAssetsMaintained"), icon: Box, color: "text-red-500", bg: "bg-red-50" },
                  { value: stats.customers_count, label: t("statCustomersServed"), icon: Users, color: "text-purple-500", bg: "bg-purple-50" },
                  { value: stats.repeat_customers_count, label: t("statRepeatCustomers"), icon: Users, color: "text-amber-500", bg: "bg-amber-50" },
                  { value: yearsActive, label: t("statYearsActive"), icon: CalendarDays, color: "text-emerald-500", bg: "bg-emerald-50" },
                  { value: `${maintlyScore ?? "—"}/5`, label: t("statMaintlyScore"), icon: ShieldCheck, color: "text-zinc-700", bg: "bg-zinc-100" },
                ].map(({ value, label, icon: Icon, color, bg }) => (
                  <div key={label} className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}><Icon size={15} className={color} /></div>
                    <div className="min-w-0">
                      <p className="text-[15px] font-black text-zinc-900 leading-tight">{value}</p>
                      <p className="text-[9.5px] text-zinc-400 font-bold uppercase tracking-wide leading-tight">{label}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] text-zinc-300">{t("loadingStats")}</p>
            )}
          </div>
          </div>

          {/* ── PROFILE ── */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 mb-6">
            <h2 className="text-[14px] font-black text-zinc-900 mb-1">{t("profile")}</h2>
            <p className="text-[12px] text-zinc-400 mb-5">{t("profileDesc")}</p>

            <div className="flex items-center gap-4 mb-6">
              <div className="relative shrink-0">
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt="" className="w-16 h-16 rounded-full object-cover border border-zinc-200" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-[20px]">{initials}</div>
                )}
                <button
                  type="button"
                  onClick={() => setShowSourceMenu(true)}
                  disabled={photoUploading}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center cursor-pointer border-2 border-white transition-colors disabled:opacity-50"
                  title={t("changePhotoTitle")}
                >
                  <Camera size={12} className="text-white" />
                </button>

                {showSourceMenu && (
                  <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setShowSourceMenu(false)} />
                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-[61] bg-white rounded-xl border border-zinc-200 shadow-lg py-1.5 w-48">
                      <button
                        type="button"
                        onClick={() => { setShowSourceMenu(false); cameraInputRef.current?.click(); }}
                        className="w-full text-left px-3 py-2 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
                      >
                        <Camera size={13} /> {t("takeAPhoto")}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowSourceMenu(false); fileInputRef.current?.click(); }}
                        className="w-full text-left px-3 py-2 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
                      >
                        <ImageIcon size={13} /> {t("chooseFromFiles")}
                      </button>
                    </div>
                  </>
                )}

                <input
                  ref={cameraInputRef} type="file" accept="image/*" capture="user" className="hidden"
                  onChange={handleFileSelected}
                />
                <input
                  ref={fileInputRef} type="file" accept="image/*" className="hidden"
                  onChange={handleFileSelected}
                />
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setShowSourceMenu(true)}
                  disabled={photoUploading}
                  className="inline-block text-[12px] font-bold text-zinc-700 hover:text-red-600 cursor-pointer transition-colors disabled:opacity-50"
                >
                  {photoUploading ? t("uploadingPhoto") : t("changeProfilePhoto")}
                </button>
                <p className="text-[11px] text-zinc-400 mt-0.5">{t("photoHint")}</p>
                {photoMsg && (
                  <p className={`text-[11px] font-semibold mt-1 ${photoMsg.ok ? "text-emerald-600" : "text-red-600"}`}>{photoMsg.text}</p>
                )}
              </div>
            </div>

            {cropImageSrc && (
              <AvatarCropModal
                imageSrc={cropImageSrc}
                onCancel={() => setCropImageSrc(null)}
                onSave={handleCropSave}
              />
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="text-[12px] font-bold text-zinc-700">{t("fullName")}</label>
                <input
                  value={name} onChange={(e) => { setName(e.target.value); if (profileMsg) setProfileMsg(null); }}
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="text-[12px] font-bold text-zinc-700">{t("workshopName")} <span className="text-zinc-300 font-normal">{t("optional")}</span></label>
                <input
                  value={workshopName} onChange={(e) => { setWorkshopName(e.target.value); if (profileMsg) setProfileMsg(null); }} placeholder={t("workshopNamePlaceholder")}
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="text-[12px] font-bold text-zinc-700">{t("location")} <span className="text-zinc-300 font-normal">{t("optional")}</span></label>
                <input
                  value={location} onChange={(e) => { setLocation(e.target.value); if (profileMsg) setProfileMsg(null); }} placeholder={t("locationPlaceholder")}
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500"
                />
                <p className="text-[11px] text-zinc-400 mt-1">{t("locationHint")}</p>
              </div>
              <div>
                <label className="text-[12px] font-bold text-zinc-700">{t("email")}</label>
                <input
                  value={email} disabled
                  className="w-full mt-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-[10px] text-[13px] text-zinc-400 outline-none cursor-not-allowed"
                />
                <p className="text-[11px] text-zinc-400 mt-1">{t("emailHint")}</p>
              </div>

              {profileMsg && (
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] ${profileMsg.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
                  {profileMsg.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                  {profileMsg.text}
                </div>
              )}

              <button type="submit" disabled={profileSaving}
                className="bg-red-600 hover:bg-red-500 disabled:opacity-60 transition-all text-white font-bold py-[11px] px-6 rounded-xl text-[13px]">
                {profileSaving ? t("saving") : t("saveChanges")}
              </button>
            </form>
          </div>

          {/* ── CONTACT INFO ──
              Facu's feedback on the public card: "no veo datos de
              contacto." All optional, and — per his answer when asked —
              always shown publicly once filled in, no per-field toggle.
              contact_email is separate from the account login email on
              purpose (a mechanic may want to publish a shop email
              instead of their personal one). */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 mb-6">
            <h2 className="text-[14px] font-black text-zinc-900 mb-1">{t("contactInfo")}</h2>
            <p className="text-[12px] text-zinc-400 mb-5">
              {t("contactInfoDesc")}
            </p>

            <form onSubmit={handleSaveContactInfo} className="space-y-4">
              <div>
                <label className="text-[12px] font-bold text-zinc-700">{t("phoneWhatsapp")}</label>
                <input
                  value={contactPhone} onChange={(e) => { setContactPhone(e.target.value); if (contactMsg) setContactMsg(null); }} placeholder={t("phonePlaceholder")}
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="text-[12px] font-bold text-zinc-700">{t("publicEmail")} <span className="text-zinc-300 font-normal">{t("publicEmailHint")}</span></label>
                <input
                  value={contactEmail} onChange={(e) => { setContactEmail(e.target.value); if (contactMsg) setContactMsg(null); }} placeholder={t("publicEmailPlaceholder")}
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="text-[12px] font-bold text-zinc-700">{t("instagram")}</label>
                <input
                  value={instagramUrl} onChange={(e) => { setInstagramUrl(e.target.value); if (contactMsg) setContactMsg(null); }} placeholder={t("instagramPlaceholder")}
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="text-[12px] font-bold text-zinc-700">{t("facebook")}</label>
                <input
                  value={facebookUrl} onChange={(e) => { setFacebookUrl(e.target.value); if (contactMsg) setContactMsg(null); }} placeholder={t("facebookPlaceholder")}
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="text-[12px] font-bold text-zinc-700">{t("website")}</label>
                <input
                  value={websiteUrl} onChange={(e) => { setWebsiteUrl(e.target.value); if (contactMsg) setContactMsg(null); }} placeholder={t("websitePlaceholder")}
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500"
                />
              </div>

              {contactMsg && (
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] ${contactMsg.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
                  {contactMsg.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                  {contactMsg.text}
                </div>
              )}

              <button type="submit" disabled={contactSaving}
                className="bg-red-600 hover:bg-red-500 disabled:opacity-60 transition-all text-white font-bold py-[11px] px-6 rounded-xl text-[13px]">
                {contactSaving ? t("saving") : t("saveChanges")}
              </button>
            </form>
          </div>

          {/* ── PASSWORD ── */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 mb-6">
            <h2 className="text-[14px] font-black text-zinc-900 mb-1 flex items-center gap-2"><KeyRound size={15} className="text-zinc-400" /> {t("password")}</h2>
            <p className="text-[12px] text-zinc-400 mb-5">{t("passwordDesc")}</p>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="text-[12px] font-bold text-zinc-700">{t("newPassword")}</label>
                <input
                  type="password" value={newPassword} onChange={(e) => { setNewPassword(e.target.value); if (passwordMsg) setPasswordMsg(null); }} placeholder={t("newPasswordPlaceholder")}
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="text-[12px] font-bold text-zinc-700">{t("confirmNewPassword")}</label>
                <input
                  type="password" value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); if (passwordMsg) setPasswordMsg(null); }}
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500"
                />
              </div>

              {passwordMsg && (
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] ${passwordMsg.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
                  {passwordMsg.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                  {passwordMsg.text}
                </div>
              )}

              <button type="submit" disabled={passwordSaving}
                className="bg-zinc-900 hover:bg-zinc-800 disabled:opacity-60 transition-all text-white font-bold py-[11px] px-6 rounded-xl text-[13px]">
                {passwordSaving ? t("updating") : t("updatePassword")}
              </button>
            </form>
          </div>

          <p className="text-center text-[11px] text-zinc-400 mt-8">{t("copyright")}</p>
        </div>
      </div>
    </div>
  );
}
