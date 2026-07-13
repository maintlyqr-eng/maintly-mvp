"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { X, QrCode, ScanLine, AlertCircle, CheckCircle2, Camera } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { assetTypeImg } from "@/lib/assetTypes";
import QRScannerModal from "@/components/QRScannerModal";

type FoundAsset = { name: string; id: string; assetId: string; type: string };

// Localized twin of LinkExistingAssetModal.tsx — see DashboardSidebarIntl.tsx
// for why these "*Intl" components exist as separate files during the i18n
// rollout instead of being edited in place. Shared by the dashboard home
// page AND the Assets page.
//
// NOTE: QRScannerModal itself keeps its original hardcoded English text
// (it's not wrapped in an Intl variant here) — this mirrors the existing,
// already-shipped behavior of src/app/[locale]/page.tsx from Phase 1, which
// also imports the plain QRScannerModal unmodified. Not introduced by this
// migration; left consistent with that precedent.
export default function LinkExistingAssetModalIntl({
  open,
  onClose,
  mechanicId,
  onLinked,
}: {
  open: boolean;
  onClose: () => void;
  mechanicId: string;
  onLinked: (assetId: string) => void;
}) {
  const t = useTranslations("LinkExistingAssetModal");
  const [qrInput, setQrInput] = useState("");
  const [foundAsset, setFoundAsset] = useState<FoundAsset | null>(null);
  const [searchError, setSearchError] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  // Guards against the manual-search and camera-scan paths racing each
  // other: whichever one's async lookup resolves LAST should win, not
  // whichever one was started last. Incremented at the start of every
  // search attempt from either path; a resolving call only commits its
  // result to state if it's still the most recent attempt.
  const searchRequestIdRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    setQrInput("");
    setFoundAsset(null);
    setSearchError("");
    setSearchLoading(false);
    setAddSuccess(false);
    setShowScanner(false);
  }, [open]);

  if (!open) return null;

  async function handleSearch(codeOverride?: string) {
    const code = (codeOverride ?? qrInput).trim();
    if (!code) return;
    const requestId = ++searchRequestIdRef.current;
    setSearchError("");
    setFoundAsset(null);
    setSearchLoading(true);

    // 1. Look up by QR code (e.g. "MTLY-AB12-CD34")
    const { data: qrData } = await supabase
      .from("qr_codes")
      .select("asset_id, code")
      .ilike("code", code)
      .maybeSingle();

    if (qrData?.asset_id) {
      const { data: asset, error: assetErr } = await supabase
        .from("assets")
        .select("id, brand, model, nickname, asset_type, vin_serial")
        .eq("id", qrData.asset_id)
        .is("deleted_at", null)
        .single();

      if (requestId !== searchRequestIdRef.current) return;
      setSearchLoading(false);

      if (assetErr || !asset) {
        setSearchError(t("errorNotLinked"));
        return;
      }

      setFoundAsset({
        name: asset.nickname || [asset.brand, asset.model].filter(Boolean).join(" ") || t("unknownAsset"),
        id: qrData.code,
        assetId: asset.id,
        type: asset.asset_type,
      });
      return;
    }

    // 2. Fallback: the code might be the asset's own UUID
    const { data: directAsset } = await supabase
      .from("assets")
      .select("id, brand, model, nickname, asset_type, vin_serial")
      .eq("id", code)
      .is("deleted_at", null)
      .maybeSingle();

    if (requestId !== searchRequestIdRef.current) return;
    setSearchLoading(false);

    if (!directAsset) {
      setSearchError(t("errorNotFound"));
      return;
    }

    setFoundAsset({
      name: directAsset.nickname || [directAsset.brand, directAsset.model].filter(Boolean).join(" ") || t("unknownAsset"),
      id: directAsset.vin_serial || directAsset.id,
      assetId: directAsset.id,
      type: directAsset.asset_type,
    });
  }

  async function handleAddToWorkshop() {
    if (!foundAsset) return;

    const { error } = await supabase
      .from("mechanic_assets")
      .upsert(
        { mechanic_id: mechanicId, asset_id: foundAsset.assetId, qr_code: foundAsset.id },
        { onConflict: "mechanic_id,asset_id", ignoreDuplicates: true }
      );

    if (error) {
      setSearchError(t("errorSaving", { message: error.message }));
      return;
    }

    setAddSuccess(true);
    onLinked(foundAsset.assetId);
  }

  function handleScanDetect(code: string) {
    setShowScanner(false);
    setQrInput(code.toUpperCase());
    handleSearch(code);
  }

  if (showScanner) {
    return (
      <QRScannerModal
        onDetect={handleScanDetect}
        onClose={() => setShowScanner(false)}
        instructions={t("scannerInstructions")}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
          <h3 className="text-[16px] font-black text-zinc-900">{t("title")}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
        </div>

        {!addSuccess ? (
          <div className="p-6">
            <p className="text-[13px] text-zinc-500 mb-5">{t("intro")}</p>

            <button
              onClick={() => setShowScanner(true)}
              className="w-full mb-4 flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 active:scale-[0.98] text-white font-bold py-3 rounded-xl text-[13px] transition-all"
            >
              <Camera size={16} /> {t("scanWithCamera")}
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="h-px bg-zinc-200 flex-1" />
              <span className="text-[10px] font-bold text-zinc-400 uppercase">{t("orTypeIt")}</span>
              <div className="h-px bg-zinc-200 flex-1" />
            </div>

            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <QrCode size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder={t("codePlaceholder")}
                  value={qrInput}
                  onChange={(e) => { setQrInput(e.target.value.toUpperCase()); setSearchError(""); setFoundAsset(null); }}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="w-full rounded-xl border border-zinc-200 pl-9 pr-4 py-2.5 text-[13px] font-mono outline-none focus:border-blue-400 transition-colors"
                />
              </div>
              <button
                onClick={() => handleSearch()}
                disabled={searchLoading || !qrInput.trim()}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-4 py-2.5 rounded-xl text-[13px] transition-colors shrink-0"
              >
                {searchLoading ? "..." : t("search")}
              </button>
            </div>

            {searchError && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 mb-4">
                <AlertCircle size={14} className="shrink-0" />
                <p className="text-[12px]">{searchError}</p>
              </div>
            )}

            {foundAsset && (
              <div className="mb-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white border border-green-100 flex items-center justify-center shrink-0">
                    <Image src={assetTypeImg[foundAsset.type] ?? "/images/car.png"} alt={foundAsset.name} width={36} height={36} className="object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-green-700 tracking-wide">{t("assetFound")}</p>
                    <p className="text-[15px] font-black text-zinc-900 truncate">{foundAsset.name}</p>
                    <p className="text-[11px] text-zinc-400 font-mono">{foundAsset.id}</p>
                  </div>
                </div>
                <button
                  onClick={handleAddToWorkshop}
                  className="w-full mt-3 bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white font-bold py-3 rounded-xl text-[13px] transition-all shadow-sm"
                >
                  {t("addToWorkshop")}
                </button>
              </div>
            )}

            <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-xl p-3">
              <ScanLine size={14} className="text-zinc-400 shrink-0" />
              <p className="text-[11px] text-zinc-500">{t("codeHintPrefix")} <span className="font-mono font-semibold">MTLY-AB12-CD34</span>.</p>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-green-600" />
            </div>
            <h4 className="text-[18px] font-black text-zinc-900 mb-1">{t("successTitle")}</h4>
            <p className="text-[13px] text-zinc-500 mb-6">
              {t.rich("successDesc", {
                name: foundAsset?.name ?? "",
                b: (chunks) => <span className="font-semibold text-zinc-700">{chunks}</span>,
              })}
            </p>
            <button onClick={onClose} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl text-[13px] transition-colors">
              {t("done")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
