"use client";

import { useEffect, useState } from "react";
import { X, Camera } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { validateImageFile } from "@/lib/imageValidation";
import { uploadAssetPhoto, genAssetQrCode } from "@/lib/uploadAssetPhoto";
import { assetTypeOptions, fuelTypeOptions } from "@/lib/assetTypes";
import CustomerPicker, { CustomerOption } from "@/components/CustomerPicker";

// The ONE "create a new asset" form used everywhere in the app — the Assets
// page and the dashboard's "Add Equipment" flow both render this same
// component now, instead of each having their own (and, in the dashboard's
// case, a broken) copy. Creating an asset here always does the full job:
// insert the asset row, generate its QR code, and link it into the current
// mechanic's workshop — never just one or two of those three steps.
export default function NewAssetModal({
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
  // When set, this asset gets attached to an already-issued QR code
  // (created blank via the QR Codes page, or scanned off a physical
  // sticker that hadn't been assigned yet) instead of generating a brand
  // new one — see the "MaintlyQR World" blank-QR flow on the public
  // /asset/[code] page and the "Assign" action on /dashboard/qr-codes.
  existingCode?: string;
}) {
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

  useEffect(() => {
    if (!open) return;
    // Fresh form every time it's opened.
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
    setPhotoPreview("");
    setCustomerId("");

    supabase
      .from("customers")
      .select("id, name, phone, email")
      .eq("mechanic_id", mechanicId)
      .order("name", { ascending: true })
      .then(({ data }) => setCustomers((data as CustomerOption[]) ?? []));
  }, [open, mechanicId]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    if (!brand.trim() || !model.trim()) {
      setFormError("Brand and model are required.");
      return;
    }

    const currentYear = new Date().getFullYear();
    if (year && parseInt(year, 10) > currentYear) {
      setFormError(`Year can't be in the future (max ${currentYear}).`);
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
      setFormError(assetError?.message ?? "Could not create the asset.");
      setSaving(false);
      return;
    }

    let photoUploadError: string | null = null;
    if (photoFile) {
      const { url, error } = await uploadAssetPhoto(supabase, photoFile, newAsset.id);
      if (url) {
        await supabase.from("assets").update({ photo_url: url }).eq("id", newAsset.id);
      } else {
        photoUploadError = error ?? "Could not upload the photo.";
      }
    }

    const code = existingCode || genAssetQrCode();
    const { error: qrError } = existingCode
      ? await supabase.from("qr_codes").update({ asset_id: newAsset.id, created_by: mechanicId }).eq("code", existingCode)
      : await supabase.from("qr_codes").insert({ code, asset_id: newAsset.id, created_by: mechanicId });

    if (qrError) {
      setSaving(false);
      setFormError("Asset created, but QR could not be generated: " + qrError.message);
      onCreated(newAsset.id);
      return;
    }

    // Every new asset is automatically part of the creator's workshop.
    await supabase.from("mechanic_assets").upsert(
      { mechanic_id: mechanicId, asset_id: newAsset.id, qr_code: code },
      { onConflict: "mechanic_id,asset_id", ignoreDuplicates: true }
    );

    setSaving(false);

    if (photoUploadError) {
      setFormError(`Asset created, but the photo could not be uploaded: ${photoUploadError}. You can try again from Edit Asset.`);
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
          <h2 className="text-[16px] font-black text-zinc-900">{existingCode ? "Assign Equipment to this QR" : "New Asset"}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5">
          <div className="mb-4">
            <label className="text-[12px] font-bold text-zinc-700">Asset type</label>
            <select value={assetType} onChange={(e) => setAssetType(e.target.value)} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500">
              {assetTypeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-[12px] font-bold text-zinc-700">Brand *</label>
              <input type="text" required value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Ford" className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="text-[12px] font-bold text-zinc-700">Model *</label>
              <input type="text" required value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. Ranger XLT" className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
            </div>
          </div>

          <div className="mb-4">
            <label className="text-[12px] font-bold text-zinc-700">Nickname (optional)</label>
            <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="e.g. Work Truck #2" className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-[12px] font-bold text-zinc-700">VIN / Serial</label>
              <input type="text" value={vin} onChange={(e) => setVin(e.target.value)} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="text-[12px] font-bold text-zinc-700">Year</label>
              <input type="number" max={new Date().getFullYear()} value={year} onChange={(e) => setYear(e.target.value)} placeholder="2024" className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-[12px] font-bold text-zinc-700">Plate</label>
              <input type="text" value={plate} onChange={(e) => setPlate(e.target.value)} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
            </div>
            <div>
              <label className="text-[12px] font-bold text-zinc-700">Fuel type</label>
              <select value={fuelType} onChange={(e) => setFuelType(e.target.value)} className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500">
                <option value="">—</option>
                {fuelTypeOptions.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="text-[12px] font-bold text-zinc-700">Location (optional)</label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Main shop" className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
          </div>

          <div className="mb-4">
            <CustomerPicker
              mechanicId={mechanicId}
              customers={customers}
              value={customerId}
              onChange={setCustomerId}
              onCreated={(c) => setCustomers((prev) => [...prev, c].sort((a, b) => a.name.localeCompare(b.name)))}
            />
          </div>

          <div className="mb-5">
            <label className="text-[12px] font-bold text-zinc-700">Photo (optional)</label>
            <div className="mt-1 flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer border border-zinc-200 hover:border-red-400 rounded-xl px-4 py-[10px] text-[12px] font-bold text-zinc-600 hover:text-red-600 transition-colors">
                <Camera size={14} />
                {photoFile ? "Change photo" : "Upload photo"}
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
                    if (f) setPhotoPreview(URL.createObjectURL(f));
                    else setPhotoPreview("");
                  }}
                />
              </label>
              {photoPreview && (
                <div className="relative w-14 h-14 rounded-xl overflow-hidden border border-zinc-200 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => { setPhotoFile(null); setPhotoPreview(""); }}
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
            <button type="button" onClick={onClose} className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-[11px] rounded-xl text-[13px] hover:bg-zinc-50">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 transition-all text-white font-bold py-[11px] rounded-xl text-[13px]">
              {saving ? "Saving..." : existingCode ? "Create & Assign" : "Create & Generate QR"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
