"use client";

import { useEffect, useRef, useState } from "react";
import { X, Camera } from "lucide-react";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabase";
import { authedFetch } from "@/lib/apiAuth";
import { validateImageFile } from "@/lib/imageValidation";
import { uploadAssetPhoto, genAssetQrCode } from "@/lib/uploadAssetPhoto";
import { assetTypeOptions, fuelTypeOptions } from "@/lib/assetTypes";
import CustomerPickerIntl, { CustomerOption } from "@/components/CustomerPickerIntl";

// Localized twin of src/components/NewAssetModal.tsx. Every dashboard page
// is migrated now, but the plain (non-Intl) NewAssetModal is deliberately
// kept alive and untouched — it's still imported by
// src/app/[locale]/asset/[code]/page.tsx (a migrated Phase 1 page that
// intentionally reuses it as-is, same precedent as MaintlerCardCanvas /
// QRScannerModal) and by the un-migrated src/app/asset/[code]/page.tsx.
// This Intl copy is what every migrated dashboard page uses instead. Asset-
// type and fuel-type option labels reuse the existing "AssetTypes"
// namespace (whose keys already match the DB enum values) and a small
// "FuelTypes" namespace, same enum-translation-key pattern used elsewhere.
const FUEL_TYPE_KEYS: Record<string, string> = {
  Gasoline: "gasoline", Diesel: "diesel", Electric: "electric", Hybrid: "hybrid", Other: "other",
};

export default function NewAssetModalIntl({
  open,
  onClose,
  mechanicId,
  onCreated,
  existingCode,
}: {
  open: boolean;
  onClose: () => void;
  mechanicId: string;
  onCreated: (assetId: string) => void;
  existingCode?: string;
}) {
  const t = useTranslations("NewAssetModal");
  const tAssetTypes = useTranslations("AssetTypes");
  const tFuelTypes = useTranslations("FuelTypes");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [assetType, setAssetType] = useState("automotive");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [nickname, setNickname] = useState("");
  const [vin, setVin] = useState("");
  const [year, setYear] = useState("");
  const [plate, setPlate] = useState("");
  const [fuelType, setFuelType] = useState("");
  const [location, setLocation] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const submitBusyRef = useRef(false);
  const photoPreviewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    submitBusyRef.current = false;
    setSaving(false);
    setFormError("");
    setAssetType("automotive");
    setBrand("");
    setModel("");
    setNickname("");
    setVin("");
    setYear("");
    setPlate("");
    setFuelType("");
    setLocation("");
    setPhotoFile(null);
    if (photoPreviewUrlRef.current) {
      URL.revokeObjectURL(photoPreviewUrlRef.current);
      photoPreviewUrlRef.current = null;
    }
    setPhotoPreview("");
    setCustomerId("");

    supabase
      .from("customers")
      .select("id, name, phone, email")
      .eq("mechanic_id", mechanicId)
      .order("name", { ascending: true })
      .then(({ data }) => setCustomers((data as CustomerOption[]) ?? []));
  }, [open, mechanicId]);

  useEffect(() => {
    return () => {
      if (photoPreviewUrlRef.current) {
        URL.revokeObjectURL(photoPreviewUrlRef.current);
        photoPreviewUrlRef.current = null;
      }
    };
  }, []);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitBusyRef.current) return;
    submitBusyRef.current = true;
    try {
      await doSubmit();
    } finally {
      submitBusyRef.current = false;
    }
  }

  async function doSubmit() {
    setFormError("");

    if (!brand.trim() || !model.trim()) {
      setFormError(t("errorBrandModelRequired"));
      return;
    }

    const currentYear = new Date().getFullYear();
    if (year && parseInt(year, 10) > currentYear) {
      setFormError(t("errorYearFuture", { year: currentYear }));
      return;
    }

    setSaving(true);

    const { data: newAsset, error: assetError } = await supabase
      .from("assets")
      .insert({
        created_by: mechanicId,
        asset_type: assetType,
        brand: brand.trim(),
        model: model.trim(),
        nickname: nickname.trim() || null,
        vin_serial: vin.trim() || null,
        year: year ? parseInt(year, 10) : null,
        plate: plate.trim() || null,
        fuel_type: fuelType || null,
        location: location.trim() || null,
        customer_id: customerId || null,
      })
      .select()
      .single();

    if (assetError || !newAsset) {
      setFormError(assetError?.message ?? t("errorCouldNotCreateAsset"));
      setSaving(false);
      return;
    }

    let photoUploadError: string | null = null;
    if (photoFile) {
      const { url, error } = await uploadAssetPhoto(supabase, photoFile, newAsset.id);
      if (url) {
        await supabase.from("assets").update({ photo_url: url }).eq("id", newAsset.id);
      } else {
        photoUploadError = error ?? t("errorCouldNotUploadPhoto");
      }
    }

    const code = existingCode || genAssetQrCode();
    let qrError: { message: string } | null = null;

    if (existingCode) {
      const res = await authedFetch("/api/qr-codes", {
        method: "POST",
        body: JSON.stringify({ action: "assign", code: existingCode, assetId: newAsset.id }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        qrError = { message: json.error || t("errorCouldNotAssignQr") };
      }
    } else {
      const { error } = await supabase.from("qr_codes").insert({ code, asset_id: newAsset.id, created_by: mechanicId });
      qrError = error;
    }

    if (qrError) {
      setSaving(false);
      setFormError(t("errorAssetCreatedNoQr", { message: qrError.message }));
      onCreated(newAsset.id);
      return;
    }

    await supabase.from("mechanic_assets").upsert(
      { mechanic_id: mechanicId, asset_id: newAsset.id, qr_code: code },
      { onConflict: "mechanic_id,asset_id", ignoreDuplicates: true }
    );

    setSaving(false);

    if (photoUploadError) {
      setFormError(t("errorAssetCreatedNoPhoto", { message: photoUploadError }));
      onCreated(newAsset.id);
      return;
    }

    onCreated(newAsset.id);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
          <h2 className="text-[16px] font-black text-zinc-900">{existingCode ? t("assignTitle") : t("newAssetTitle")}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5">
          <div className="mb-4">
            <label className="text-[12px] font-bold text-zinc-700">{t("assetTypeLabel")}</label>
            <select value={assetType} onChange={(e) => setAssetType(e.target.value)} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500">
              {assetTypeOptions.map((o) => <option key={o.value} value={o.value}>{tAssetTypes(o.value)}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-[12px] font-bold text-zinc-700">{t("brandLabel")}</label>
              <input type="text" required value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={t("brandPlaceholder")} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="text-[12px] font-bold text-zinc-700">{t("modelLabel")}</label>
              <input type="text" required value={model} onChange={(e) => setModel(e.target.value)} placeholder={t("modelPlaceholder")} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
            </div>
          </div>

          <div className="mb-4">
            <label className="text-[12px] font-bold text-zinc-700">{t("nicknameLabel")}</label>
            <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={t("nicknamePlaceholder")} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-[12px] font-bold text-zinc-700">{t("vinLabel")}</label>
              <input type="text" value={vin} onChange={(e) => setVin(e.target.value)} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="text-[12px] font-bold text-zinc-700">{t("yearLabel")}</label>
              <input type="number" max={new Date().getFullYear()} value={year} onChange={(e) => setYear(e.target.value)} placeholder={t("yearPlaceholder")} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-[12px] font-bold text-zinc-700">{t("plateLabel")}</label>
              <input type="text" value={plate} onChange={(e) => setPlate(e.target.value)} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="text-[12px] font-bold text-zinc-700">{t("fuelTypeLabel")}</label>
              <select value={fuelType} onChange={(e) => setFuelType(e.target.value)} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500">
                <option value="">—</option>
                {fuelTypeOptions.map((f) => <option key={f} value={f}>{tFuelTypes(FUEL_TYPE_KEYS[f] ?? "other")}</option>)}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="text-[12px] font-bold text-zinc-700">{t("locationLabel")}</label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("locationPlaceholder")} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
          </div>

          <div className="mb-4">
            <CustomerPickerIntl
              mechanicId={mechanicId}
              customers={customers}
              value={customerId}
              onChange={setCustomerId}
              onCreated={(c) => setCustomers((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)))}
            />
          </div>

          <div className="mb-5">
            <label className="text-[12px] font-bold text-zinc-700">{t("photoLabel")}</label>
            <div className="mt-1 flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer border border-zinc-200 hover:border-red-400 rounded-xl px-4 py-[10px] text-[12px] font-bold text-zinc-600 hover:text-red-600 transition-colors">
                <Camera size={14} />
                {photoFile ? t("changePhoto") : t("uploadPhoto")}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    e.target.value = "";
                    if (f) {
                      const err = validateImageFile(f);
                      if (err) { setFormError(err); return; }
                    }
                    setFormError("");
                    setPhotoFile(f);
                    if (photoPreviewUrlRef.current) {
                      URL.revokeObjectURL(photoPreviewUrlRef.current);
                      photoPreviewUrlRef.current = null;
                    }
                    if (f) {
                      const url = URL.createObjectURL(f);
                      photoPreviewUrlRef.current = url;
                      setPhotoPreview(url);
                    } else {
                      setPhotoPreview("");
                    }
                  }}
                />
              </label>
              {photoPreview && (
                <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-zinc-200 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      if (photoPreviewUrlRef.current) {
                        URL.revokeObjectURL(photoPreviewUrlRef.current);
                        photoPreviewUrlRef.current = null;
                      }
                      setPhotoFile(null);
                      setPhotoPreview("");
                    }}
                    className="absolute top-0.5 right-0.5 w-4 h-4 bg-zinc-900/60 rounded-full flex items-center justify-center text-white"
                  >
                    <X size={9} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {formError && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">{formError}</div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-[11px] rounded-xl text-[13px] hover:bg-zinc-50">{t("cancel")}</button>
            <button type="submit" disabled={saving} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 transition-all text-white font-bold py-[11px] rounded-xl text-[13px]">
              {saving ? t("saving") : existingCode ? t("createAndAssign") : t("createAndGenerateQr")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
