"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { X, Copy, Check, Download, Printer, FileText, QrCode, Palette, ChevronDown, ChevronUp } from "lucide-react";
import QrCodeCanvas, { type QrCodeCanvasHandle } from "@/components/QrCodeCanvas";
import QrThemePicker from "@/components/QrThemePicker";
import { authedFetch } from "@/lib/apiAuth";

// Pedido de Facu (21/10/2026): "cuando toco QR me abre [un QR chiquito con
// el link], pero me gustaría que me deje ver el QR y poder personalizarlo
// desde ahí sin tener que ir al sector Códigos QR". Este modal se abre
// desde el botón "QR" de la tarjeta del activo (dashboard/assets) y
// concentra todo lo que antes vivía solo en /dashboard/qr-codes: el QR
// grande con su diseño real, cambiar diseño y etiqueta (misma API
// "personalize"), descargar PNG, imprimir solo este código, copiar el link
// y abrir el reporte.
//
// De paso reemplaza la imagen que generaba api.qrserver.com (un servicio
// externo que ignoraba el diseño elegido y recibía el link del activo):
// ahora todo se dibuja con QrCodeCanvas, el mismo motor del resto de la app.

export default function AssetQrModal({
  open,
  onClose,
  code,
  assetName,
  theme,
  label,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  code: string | null;
  assetName: string;
  theme: string;
  label: string | null;
  onSaved: (code: string, theme: string, label: string | null) => void;
}) {
  const t = useTranslations("AssetQrModal");
  const canvasRef = useRef<QrCodeCanvasHandle>(null);
  const [draftTheme, setDraftTheme] = useState(theme);
  const [draftLabel, setDraftLabel] = useState(label ?? "");
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraftTheme(theme);
    setDraftLabel(label ?? "");
    setShowPicker(false);
    setSaving(false);
    setError("");
    setCopied(false);
  }, [open, theme, label, code]);

  if (!open || !code) return null;

  const dirty = draftTheme !== theme || (draftLabel.trim() || null) !== (label ?? null);
  const publicUrl = typeof window !== "undefined" ? `${window.location.origin}/asset/${code}` : `/asset/${code}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  async function handleSave() {
    if (!code) return;
    setSaving(true);
    setError("");
    const res = await authedFetch("/api/qr-codes", {
      method: "POST",
      body: JSON.stringify({ action: "personalize", code, theme: draftTheme, label: draftLabel.trim() || null }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(json.error || t("errorSave")); return; }
    onSaved(code, draftTheme, draftLabel.trim() || null);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 no-print">
          <div className="min-w-0">
            <h3 className="text-[16px] font-black text-zinc-900 inline-flex items-center gap-2"><QrCode size={18} className="text-red-600" /> {t("title")}</h3>
            <p className="text-[11px] text-zinc-500 truncate">{assetName}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
        </div>

        <div className="overflow-y-auto px-6 py-5 no-print">
          {/* QR grande con el diseño elegido (vista previa en vivo) */}
          <div className="flex flex-col items-center">
            <div className="rounded-2xl border border-zinc-200 bg-white p-3">
              <QrCodeCanvas ref={canvasRef} code={code} theme={draftTheme} size={220} />
            </div>
            <p className="text-[12px] font-mono font-bold text-zinc-800 mt-2">{code}</p>
            {draftLabel.trim() && <p className="text-[11px] text-zinc-500">{draftLabel.trim()}</p>}
          </div>

          {/* Acciones rápidas */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <button onClick={handleCopy} className="flex flex-col items-center gap-1 border border-zinc-200 hover:bg-zinc-50 rounded-xl py-2.5 text-[11px] font-bold text-zinc-700 transition-colors">
              {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
              {copied ? t("copied") : t("copyLink")}
            </button>
            <button onClick={() => canvasRef.current?.download(draftLabel.trim() || code)} className="flex flex-col items-center gap-1 border border-zinc-200 hover:bg-zinc-50 rounded-xl py-2.5 text-[11px] font-bold text-zinc-700 transition-colors">
              <Download size={16} /> {t("download")}
            </button>
            <button onClick={handlePrint} className="flex flex-col items-center gap-1 border border-zinc-200 hover:bg-zinc-50 rounded-xl py-2.5 text-[11px] font-bold text-zinc-700 transition-colors">
              <Printer size={16} /> {t("print")}
            </button>
          </div>
          <a
            href={`/asset/${code}/report`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-zinc-500 hover:text-zinc-800 mt-3"
          >
            <FileText size={12} /> {t("viewReport")}
          </a>

          {/* Personalización */}
          <div className="mt-5 pt-4 border-t border-zinc-100">
            <label className="text-[12px] font-bold text-zinc-700">{t("labelOptional")}</label>
            <input
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              placeholder={t("labelPlaceholder")}
              maxLength={40}
              className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500"
            />

            <button
              type="button"
              onClick={() => setShowPicker((v) => !v)}
              className="w-full flex items-center justify-between mt-4 text-[12px] font-bold text-zinc-700 hover:text-red-600 transition-colors"
            >
              <span className="inline-flex items-center gap-1.5"><Palette size={14} /> {t("look")}</span>
              {showPicker ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {showPicker && (
              <div className="mt-3">
                <QrThemePicker value={draftTheme} onChange={setDraftTheme} previewCode={code} />
              </div>
            )}

            {error && <div className="mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">{error}</div>}

            {dirty && (
              <div className="flex gap-2 mt-4">
                <button type="button" onClick={() => { setDraftTheme(theme); setDraftLabel(label ?? ""); }} disabled={saving} className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-[10px] rounded-xl text-[13px] hover:bg-zinc-50 disabled:opacity-60">
                  {t("discard")}
                </button>
                <button type="button" onClick={handleSave} disabled={saving} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold py-[10px] rounded-xl text-[13px] transition-colors">
                  {saving ? t("saving") : t("save")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hoja de impresión de este único código: solo visible al imprimir */}
      <div id="qr-print-sheet" className="hidden print:block">
        <div className="flex flex-col items-center text-center gap-2 p-8">
          <QrCodeCanvas code={code} theme={draftTheme} size={300} />
          <p className="text-[13px] font-mono font-bold text-zinc-800">{code}</p>
          {draftLabel.trim() && <p className="text-[12px] text-zinc-500">{draftLabel.trim()}</p>}
          <p className="text-[11px] text-zinc-400 mt-2">{assetName}</p>
        </div>
      </div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #qr-print-sheet, #qr-print-sheet * { visibility: visible; }
          #qr-print-sheet { position: absolute; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
