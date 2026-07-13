"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { X, Flag, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

// Localized twin of ReportIssueModal.tsx — same reasoning as the other
// "*Intl" components (see DashboardSidebarIntl.tsx): this is shared between
// the migrated src/app/[locale]/asset/[code]/page.tsx and the not-yet-
// deleted legacy src/app/asset/[code]/page.tsx, so it can't call
// useTranslations() directly without breaking the legacy page (which
// renders outside any NextIntlClientProvider).
//
// Public "Reportar un problema" form — item 6 del pedido de Facu
// ("Reportes y moderación"). Insert goes straight to content_reports
// (migration 032) via the anon-key client, same pattern already used by
// the "contact the Maintler" form on this same page (insert into
// `messages`) — the table's RLS allows anyone to INSERT but nobody to
// SELECT back, so there's no risk in doing this client-side rather than
// through a dedicated API route.
const REPORT_TYPES = [
  "incorrect_info", "fake_record", "inappropriate_content", "wrong_asset",
  "qr_issue", "technical_issue", "deletion_request", "general_inquiry",
] as const;

const REPORT_TYPE_KEYS: Record<string, string> = {
  incorrect_info: "incorrectInfo",
  fake_record: "fakeRecord",
  inappropriate_content: "inappropriateContent",
  wrong_asset: "wrongAsset",
  qr_issue: "qrIssue",
  technical_issue: "technicalIssue",
  deletion_request: "deletionRequest",
  general_inquiry: "generalInquiry",
};

export default function ReportIssueModalIntl({
  open,
  onClose,
  assetId,
  mechanicId,
  qrCode,
}: {
  open: boolean;
  onClose: () => void;
  assetId: string | null;
  mechanicId: string | null;
  qrCode: string;
}) {
  const t = useTranslations("ReportIssueModal");
  const [reportType, setReportType] = useState<(typeof REPORT_TYPES)[number]>("incorrect_info");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReportType("incorrect_info");
    setMessage("");
    setName("");
    setContact("");
    setError("");
    setSent(false);
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    if (!message.trim()) {
      setError(t("errorRequired"));
      return;
    }

    setSending(true);
    setError("");
    const { error: insertError } = await supabase.from("content_reports").insert({
      report_type: reportType,
      asset_id: assetId,
      mechanic_id: mechanicId,
      qr_code: qrCode,
      reporter_name: name.trim() || null,
      reporter_contact: contact.trim() || null,
      message: message.trim(),
    });
    setSending(false);

    if (insertError) {
      setError(t("errorSaving"));
      return;
    }
    setSent(true);
  }

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
          <h3 className="text-[16px] font-black text-zinc-900 flex items-center gap-2">
            <Flag size={16} className="text-red-500" /> {t("title")}
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
        </div>

        {sent ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-green-600" />
            </div>
            <h4 className="text-[18px] font-black text-zinc-900 mb-1">{t("successTitle")}</h4>
            <p className="text-[13px] text-zinc-500 mb-6">{t("successDesc")}</p>
            <button onClick={onClose} className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-3 rounded-xl text-[13px] transition-colors">
              {t("done")}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <p className="text-[13px] text-zinc-500">{t("intro")}</p>

            <div>
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">{t("typeLabel")}</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as (typeof REPORT_TYPES)[number])}
                className="w-full bg-zinc-50 border border-zinc-200 focus:border-red-400 focus:bg-white rounded-xl px-4 py-3 text-[14px] text-zinc-900 outline-none transition-all"
              >
                {REPORT_TYPES.map((rt) => (
                  <option key={rt} value={rt}>{t(`types.${REPORT_TYPE_KEYS[rt]}`)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">{t("messageLabel")}</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder={t("messagePlaceholder")}
                className="w-full bg-zinc-50 border border-zinc-200 focus:border-red-400 focus:bg-white rounded-xl px-4 py-3 text-[14px] text-zinc-900 placeholder-zinc-400 outline-none transition-all resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">{t("nameLabel")}</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("namePlaceholder")}
                  className="w-full bg-zinc-50 border border-zinc-200 focus:border-red-400 focus:bg-white rounded-xl px-4 py-3 text-[14px] text-zinc-900 placeholder-zinc-400 outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">{t("contactLabel")}</label>
                <input
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder={t("contactPlaceholder")}
                  className="w-full bg-zinc-50 border border-zinc-200 focus:border-red-400 focus:bg-white rounded-xl px-4 py-3 text-[14px] text-zinc-900 placeholder-zinc-400 outline-none transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                <AlertCircle size={14} className="text-red-500 shrink-0" />
                <p className="text-[12px] text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={sending}
              className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-black py-3.5 rounded-2xl text-[14px] transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-2"
            >
              {sending
                ? <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> {t("sendingButton")}</>
                : <><Send size={15} /> {t("submitButton")}</>
              }
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
