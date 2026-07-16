"use client";

import { useState } from "react";
import { ShieldCheck, Upload, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchPlatformSettings } from "@/lib/platformSettings";

export const MAINTLER_ROLES = [
  "Owner",
  "Mechanic",
  "Electrician",
  "HVAC Technician",
  "Fleet Manager",
  "Business",
  "Inspector",
];

// Default/fallback until the configurable limit (incremento 17 de Item 6,
// `platform_settings.max_certificate_mb`) loads.
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
   * show a "your certificate is under review" screen or just move on.
   */
  onSubmitted: (profession: string, status: "none" | "pending") => void;
};

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-80);
}

export default function ProfessionVerificationForm({ mechanicId, initialProfession, onSkip, onSubmitted }: Props) {
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

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setFileError("");
    if (!f) { setFile(null); return; }

    const isImage = f.type.startsWith("image/");
    const isPdf = f.type === "application/pdf";
    if (!isImage && !isPdf) {
      setFileError("Please upload an image (JPG, PNG) or a PDF.");
      setFile(null);
      return;
    }
    if (f.size > currentMaxFileBytes) {
      setFileError(`File is too large. Max size is ${currentMaxFileBytes / (1024 * 1024)}MB.`);
      setFile(null);
      return;
    }
    setFile(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!profession) { setError("Please select a profession."); return; }
    if (!isOwner && !file) { setError("Please upload a certificate or proof of your profession."); return; }

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
            ? "Certificate uploads aren't set up yet. Please try again later."
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
        <label className="text-[12px] font-bold text-zinc-700 mb-2 block">Your profession</label>
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
              {r}
            </button>
          ))}
        </div>
      </div>

      {!isOwner && (
        <div>
          <label className="text-[12px] font-bold text-zinc-700 mb-2 block">Certificate or proof</label>
          <label
            htmlFor="certificate-upload"
            className="flex items-center gap-3 border border-dashed border-zinc-300 hover:border-red-400 rounded-xl px-4 py-4 cursor-pointer transition-colors bg-zinc-50"
          >
            <div className="w-9 h-9 rounded-full bg-white border border-zinc-200 flex items-center justify-center shrink-0">
              {file ? <FileText size={16} className="text-red-600" /> : <Upload size={16} className="text-zinc-400" />}
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-bold text-zinc-800 truncate">{file ? file.name : "Choose a file to upload"}</p>
              <p className="text-[11px] text-zinc-400">JPG, PNG or PDF — max 10MB</p>
            </div>
          </label>
          <input id="certificate-upload" type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
          {fileError && <p className="text-[11px] font-semibold text-red-600 mt-1.5">{fileError}</p>}
        </div>
      )}

      <p className="text-[11px] text-zinc-400 leading-relaxed">
        {isOwner
          ? "No document needed for Owners — just confirm and you're all set."
          : (
            <>
              A Maintly admin will review your submission. Once approved, you&apos;ll be shown as a verified{" "}
              <span className="font-semibold text-zinc-600">{profession ? `${profession} Maintler` : "professional Maintler"}</span> on every service you log.
            </>
          )}
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
            ? <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> {isOwner ? "Saving…" : "Submitting…"}</>
            : isOwner
              ? <><ShieldCheck size={15} /> Continue</>
              : <><ShieldCheck size={15} /> Submit for Verification</>
          }
        </button>
        {onSkip && (
          <button type="button" onClick={onSkip} className="text-[12px] font-bold text-zinc-400 hover:text-zinc-600 transition-colors">
            Skip for now
          </button>
        )}
      </div>
    </form>
  );
}

export function VerificationStatusCard({
  status, profession, note,
}: {
  status: "pending" | "verified" | "rejected";
  profession?: string | null;
  note?: string | null;
}) {
  if (status === "verified") {
    return (
      <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3.5">
        <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
        <div>
          <p className="text-[13px] font-bold text-emerald-800">Verified{profession ? ` ${profession}` : ""} Maintler</p>
          <p className="text-[11px] text-emerald-600/80">Your services now show this verified badge.</p>
        </div>
      </div>
    );
  }
  if (status === "pending") {
    return (
      <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3.5">
        <ShieldCheck size={18} className="text-amber-600 shrink-0" />
        <div>
          <p className="text-[13px] font-bold text-amber-800">Verification pending review{profession ? ` — ${profession}` : ""}</p>
          <p className="text-[11px] text-amber-600/80">A Maintly admin is reviewing your submission.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3.5">
      <AlertCircle size={18} className="text-red-500 shrink-0" />
      <div>
        <p className="text-[13px] font-bold text-red-700">Verification request declined{profession ? ` — ${profession}` : ""}</p>
        <p className="text-[11px] text-red-500/80">{note || "You can review your details and submit again below."}</p>
      </div>
    </div>
  );
}
