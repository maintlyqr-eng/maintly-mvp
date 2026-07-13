"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabase";

// Localized twin of src/components/CustomerPicker.tsx. All dashboard pages
// are migrated now, but the plain (non-Intl) CustomerPicker is still kept
// alive as a dependency of the plain NewAssetModal, which is itself still
// used by src/app/[locale]/asset/[code]/page.tsx and the un-migrated
// src/app/asset/[code]/page.tsx / src/app/register/profession/page.tsx —
// see NewAssetModalIntl.tsx for the full reasoning. This Intl copy is what
// every migrated dashboard page uses instead.
export type CustomerOption = { id: string; name: string; phone: string | null; email: string | null };

export default function CustomerPickerIntl({
  mechanicId,
  customers,
  value,
  onChange,
  onCreated,
  label,
}: {
  mechanicId: string;
  customers: CustomerOption[];
  value: string;
  onChange: (customerId: string) => void;
  onCreated: (customer: CustomerOption) => void;
  label?: string;
}) {
  const t = useTranslations("CustomerPicker");
  const [mode, setMode] = useState<"select" | "new">("select");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function cancelNew() {
    setMode("select");
    setNewName("");
    setNewPhone("");
    setNewEmail("");
    setError("");
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setSaving(true);
    setError("");
    const { data, error: err } = await supabase
      .from("customers")
      .insert({ mechanic_id: mechanicId, name: newName.trim(), phone: newPhone.trim() || null, email: newEmail.trim() || null })
      .select("id, name, phone, email")
      .single();
    setSaving(false);
    if (err || !data) {
      setError(t("addCustomerFailed"));
      return;
    }
    onCreated(data as CustomerOption);
    onChange(data.id);
    cancelNew();
  }

  return (
    <div>
      <label className="text-[12px] font-bold text-zinc-700">{label ?? t("customerOptional")}</label>
      {mode === "select" ? (
        <select
          value={value}
          onChange={(e) => {
            if (e.target.value === "__new__") setMode("new");
            else onChange(e.target.value);
          }}
          className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500"
        >
          <option value="">{t("noCustomerSet")}</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          <option value="__new__">{t("newCustomerOption")}</option>
        </select>
      ) : (
        <div className="mt-1 rounded-xl border border-zinc-200 bg-zinc-50 p-3 space-y-2">
          <input
            value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder={t("customerNamePlaceholder")} autoFocus
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-red-500"
          />
          <input
            value={newPhone} onChange={(e) => setNewPhone(e.target.value)}
            placeholder={t("phoneOptional")}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-red-500"
          />
          <input
            value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
            placeholder={t("emailOptional")}
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-red-500"
          />
          {error && <p className="text-[11px] text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={cancelNew} className="flex-1 border border-zinc-200 bg-white text-zinc-600 font-bold py-2 rounded-lg text-[12px] hover:bg-zinc-100">
              {t("cancel")}
            </button>
            <button
              type="button" onClick={handleCreate} disabled={saving || !newName.trim()}
              className="flex-1 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white font-bold py-2 rounded-lg text-[12px] transition-all"
            >
              {saving ? t("adding") : t("addCustomer")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
