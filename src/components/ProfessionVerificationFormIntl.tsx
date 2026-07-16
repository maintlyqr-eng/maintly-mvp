"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ShieldCheck, Upload, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchPlatformSettings } from "@/lib/platformSettings";

// Localized twin of ProfessionVerificationForm.tsx. The Settings page and
// the localized src/app/[locale]/register/profession/page.tsx both use this
// Intl copy; the plain (non-Intl) original is kept alive and untouched only
// because the OLD, un-migrated src/app/register/profession/page.tsx (dead
// code, unreachable now that "/register/profession" is in middleware.ts's
// matcher — same fate as the old plain login/register pages) still
// references it.
//
// MAINTLER_ROLES stays as the raw English enum values written to the
// `profession` DB column (unchanged, still exported for that page to use)
// — PROFESSION_KEYS below maps each one to a ProfessionTypes translation
// key, same enum-translation-key pattern as SERVICE_TYPE_KEYS elsewhere.
export const MAINTLER_ROLES = [
  "Owner",
  "Mechanic",
  "Electrician",
  "HVAC Technician",
  "Fleet Manager",
  "Business",
  "Inspector",
];

// Exported so other pages that need to show a translated profession label
// outside this form (e.g. the localized register/profession page's
// "submitted for review" screen) can reuse the exact same mapping instead
// of re-declaring it and risking it drifting out of sync.
export const PROFESSION_KEYS: Record<string, string> = {
  "Owner": "owner",
  "Mechanic": "mechanic",
  "Electrician": "electrician",
  "HVAC Technician": "hvacTechnician",
  "Fleet Manager": "fleetManager",
  "Business": "business",
  "Inspector": "inspector",
};

// Default/fallback until the configurable limit (incremento 17 de Item 6,
// `platform_settings.max_certificate_mb`) loads — same value this
// constant always had before this incremento.
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
let currentMaxFileBytes = MAX_FILE_BYTES;
fetchPlatformSettings().then((settings) => {
  currentMaxFileBytes = settings.maxCertificateMb * 1024 * 1024;
});

type Props = {
  mechanicId: string;
  initialProfession?: string | null;
  /** Shown next to the submit button; when provided, renders a "Skip for now" link. */
  onSkip?: () => void;
  /**
   * `status` mirrors exactly what got written to `verification_status` for
   * this submission ("none" for Owner, which needs no document/review;
   * "pending" for every other role) — callers use it to decide whether to
   * show a "your certificate is under review" state or just move on.
   */
  onSubmitted: (profession: string, status: "none" | "pending") => void;
};

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-80);
}

export default function ProfessionVerificationFormIntl({ mechanicId, initialProfession, onSkip, onSubmitted }: Props) {
  const t = useTranslations("ProfessionVerificationForm");
  const tProfessionTypes = useTranslations("ProfessionTypes");
  const [profession, setProfession] = useState(initialProfession || "");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Facu: an "Owner" is just tracking their own equipment, not claiming a
  // professional trade or a business -- asking them for a certificate never
  // made sense (there's nothing to certify). Every other role still needs
  // proof, same as before.
  const isOwner = profession === "Owner";

  function professionLabel(p: string) {
    return tProfessionTypes(PROFESSION_KEYS[p] ?? "owner");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setFileError("");
    if (!f) { setFile(null); return; }

    const isImage = f.type.startsWith("image/");
    const isPdf = f.type === "application/pdf";
    if (!isImage && !isPdf) {
      setFileError(t("errorInvalidFileType"));
      setFile(null);
      return;
    }
    if (f.size > currentMaxFileBytes) {
      setFileError(t("errorFileTooLarge"));
      setFile(null);
      return;
    }
    setFile(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!profession) { setError(t("errorSelectProfession")); return; }
    if (!isOwner && !file) { setError(t("errorUploadCertificate")); return; }

    setSubmitting(true);

    let path: string | null = null;
    if (!isOwner && file) {
      path = `${mechanicId}/${Date.now()}-${sanitizeFileName(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from("certificates")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) {
        setSubmitting(false);
        setError(
          uploadError.message.includes("Bucket not found")
            ? t("errorUploadsNotSetUp")
            : uploadError.message
        );
        return;
      }
    }

    // Owner: no certificate, so nothing to review -- goes straight to
    // "none" instead of "pending", and clears out any certificate/review
    // fields left over from a previous profession (e.g. someone who first
    // signed up as Mechanic and later switches to Owner here).
    const verificationStatus: "none" | "pending" = isOwner ? "none" : "pending";

    const { error: dbError } = await supabase
      .from("mechanics")
      .update({
        profession,
        certificate_path: path,
        verification_status: verificationStatus,
        verified: false, // any new/updated submission needs a fresh admin review
        verification_requested_at: isOwner ? null : new Date().toISOString(),
        verification_reviewed_at: null,
        verification_note: null,
      })
      .eq("id", mechanicId);

    setSubmitting(false);

    if (dbError) { setError(dbError.message); return; }

    onSubmitted(profession, verificationStatus);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="text-[12px] font-bold text-zinc-700 mb-2 block">{t("yourProfession")}</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {MAINTLER_ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setProfession(r)}
              className={`py-2.5 px-3 rounded-xl text-[12px] font-bold border transition-all text-left ${
                profession === r
                  ? "bg-red-600 text-white border-red-600"
                  : "bg-zinc-50 text-zinc-700 border-zinc-200 hover:border-zinc-300"
              }`}
            >
              {professionLabel(r)}
            </button>
          ))}
        </div>
      </div>

      {!isOwner && (
        <div>
          <label className="text-[12px] font-bold text-zinc-700 mb-2 block">{t("certificateOrProof")}</label>
          <label
            htmlFor="certificate-upload"
            className="flex items-center gap-3 border border-dashed border-zinc-300 hover:border-red-400 rounded-xl px-4 py-4 cursor-pointer transition-colors bg-zinc-50"
          >
            <div className="w-9 h-9 rounded-full bg-white border border-zinc-200 flex items-center justify-center shrink-0">
              {file ? <FileText size={16} className="text-red-600" /> : <Upload size={16} className="text-zinc-400" />}
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-zinc-800 truncate">{file ? file.name : t("chooseFile")}</p>
              <p className="text-[11px] text-zinc-400">{t("fileHint")}</p>
            </div>
          </label>
          <input id="certificate-upload" type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
          {fileError && <p className="text-[11px] font-semibold text-red-600 mt-1.5">{fileError}</p>}
        </div>
      )}

      <p className="text-[11px] text-zinc-400 leading-relaxed">
        {isOwner
          ? t("ownerNoDocumentNotice")
          : t("reviewNotice", {
              profession: profession
                ? t("professionMaintler", { profession: professionLabel(profession) })
                : t("professionalMaintlerFallback"),
            })}
      </p>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="text-[12px] text-red-600">{error}</p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 sm:flex-none bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-black py-3 px-6 rounded-xl text-[13px] transition-all flex items-center justify-center gap-2"
        >
          {submitting
            ? <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> {isOwner ? t("saving") : t("submitting")}</>
            : isOwner
              ? <><ShieldCheck size={15} /> {t("continueButton")}</>
              : <><ShieldCheck size={15} /> {t("submitForVerification")}</>
          }
        </button>
        {onSkip && (
          <button type="button" onClick={onSkip} className="text-[12px] font-bold text-zinc-400 hover:text-zinc-600 transition-colors">
            {t("skipForNow")}
          </button>
        )}
      </div>
    </form>
  );
}

export function VerificationStatusCardIntl({
  status, profession, note,
}: {
  status: "pending" | "verified" | "rejected";
  profession?: string | null;
  note?: string | null;
}) {
  const t = useTranslations("VerificationStatusCard");
  const tProfessionTypes = useTranslations("ProfessionTypes");
  const professionLabel = profession ? tProfessionTypes(PROFESSION_KEYS[profession] ?? "owner") : null;

  if (status === "verified") {
    return (
      <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3.5">
        <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
        <div>
          <p className="text-[13px] font-bold text-emerald-800">{t("verifiedLabel")}{professionLabel ? ` ${professionLabel}` : ""} {t("maintlerLabel")}</p>
          <p className="text-[11px] text-emerald-600/80">{t("verifiedDesc")}</p>
        </div>
      </div>
    );
  }
  if (status === "pending") {
    return (
      <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5">
        <ShieldCheck size={18} className="text-amber-600 shrink-0" />
        <div>
          <p className="text-[13px] font-bold text-amber-800">{t("pendingLabel")}{professionLabel ? ` — ${professionLabel}` : ""}</p>
          <p className="text-[11px] text-amber-600/80">{t("pendingDesc")}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3.5">
      <AlertCircle size={18} className="text-red-500 shrink-0" />
      <div>
        <p className="text-[13px] font-bold text-red-700">{t("declinedLabel")}{professionLabel ? ` — ${professionLabel}` : ""}</p>
        <p className="text-[11px] text-red-500/80">{note || t("declinedDescFallback")}</p>
      </div>
    </div>
  );
}
