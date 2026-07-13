"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { X, Share2, CheckCircle2, Search, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getInitials } from "@/lib/initials";

// Edited in place (not an "*Intl" duplicate) — its ONLY consumer is
// src/app/[locale]/dashboard/assets/page.tsx (the old un-migrated
// src/app/dashboard/assets/page.tsx it used to also serve has since been
// deleted, see the "Final cleanup" backlog task). See AvatarCropModal.tsx /
// DashboardSidebarIntl.tsx for the general rule and this
// "exactly-once-migrated-together" exception to it.

// "Share" an equipment already in my own workshop with another Maintler,
// so it lands in THEIR workshop too — full access, not a read-only peek.
// Facu's own framing: "es lo mismo que si hubiese escaneado el qr el
// mismo, solo que en este caso otro mecanico se lo envia para que lo
// agregue en su propio sistema" — e.g. they forgot their phone and
// couldn't scan the sticker themselves. Not an ownership transfer: both
// mechanics keep full access afterward, same as if two people had
// independently scanned the same QR.
//
// Restricted to Maintlers already saved in maintler_saved_contacts (see
// migration 029) — the same trust circle already used for messaging —
// since this grants full read+write on the equipment, same as a real
// scan would. Only lists saved contacts rather than a full mechanic
// search, so sharing with a stranger isn't possible from this modal.

type SavedContactInfo = {
  id: string; // mechanic id of the saved contact
  name: string;
  workshop_name: string | null;
  photo_url: string | null;
  profession: string | null;
};

const PROFESSION_KEYS: Record<string, string> = {
  "Owner": "owner",
  "Mechanic": "mechanic",
  "Electrician": "electrician",
  "HVAC Technician": "hvacTechnician",
  "Fleet Manager": "fleetManager",
  "Business": "business",
  "Inspector": "inspector",
};

export default function ShareAssetModal({
  open,
  onClose,
  mechanicId,
  asset,
  onShared,
}: {
  open: boolean;
  onClose: () => void;
  mechanicId: string;
  asset: { id: string; name: string; qrCode: string | null } | null;
  onShared: (recipientName: string) => void;
}) {
  const t = useTranslations("ShareAssetModal");
  const tProfessionTypes = useTranslations("ProfessionTypes");
  const [contacts, setContacts] = useState<SavedContactInfo[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [search, setSearch] = useState("");
  const [sharingId, setSharingId] = useState<string | null>(null);
  // alreadyHad = true means nothing was actually shared (the recipient
  // already had this asset — from a previous share, their own scan,
  // whatever) so no notification was sent. See handleShare.
  const [shareResult, setShareResult] = useState<{ contact: SavedContactInfo; alreadyHad: boolean } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setShareResult(null);
    setError("");
    void loadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function loadContacts() {
    setLoadingContacts(true);
    const { data } = await supabase
      .from("maintler_saved_contacts")
      .select("saved_id")
      .eq("owner_id", mechanicId);

    const ids = (data ?? []).map((r) => r.saved_id as string);
    if (ids.length === 0) {
      setContacts([]);
      setLoadingContacts(false);
      return;
    }

    const { data: mechanicsData } = await supabase
      .from("mechanics")
      .select("id, name, workshop_name, photo_url, profession")
      .in("id", ids)
      .order("name", { ascending: true });

    setContacts((mechanicsData as SavedContactInfo[]) ?? []);
    setLoadingContacts(false);
  }

  if (!open || !asset) return null;

  const filtered = contacts.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return c.name.toLowerCase().includes(q) || (c.workshop_name ?? "").toLowerCase().includes(q);
  });

  async function handleShare(contact: SavedContactInfo) {
    if (!asset) return;
    setSharingId(contact.id);
    setError("");

    // ignoreDuplicates makes this a silent no-op when contact.id already has
    // this asset (from a previous share, their own scan, whoever shared it)
    // — the unique(mechanic_id, asset_id) constraint just skips the insert
    // instead of erroring. That used to look identical to a real share from
    // here, so re-sharing the same equipment kept sending duplicate "shared
    // with you" notifications even though nothing changed for the recipient
    // (Facu: "le puedo mandar 10 veces el mismo equipo... le aparecen 10
    // mensajes... no tiene sentido"). Asking for `.select("id")` back tells
    // us whether a row was actually inserted: RLS lets the sharer see rows
    // they just created (shared_by = auth.uid()), so a real insert always
    // comes back with a row — an empty result means the conflict branch
    // fired, i.e. the recipient already had it, and we skip the notification.
    const { data: upsertData, error: shareErr } = await supabase
      .from("mechanic_assets")
      .upsert(
        { mechanic_id: contact.id, asset_id: asset.id, qr_code: asset.qrCode, shared_by: mechanicId },
        { onConflict: "mechanic_id,asset_id", ignoreDuplicates: true }
      )
      .select("id");

    if (shareErr) {
      setSharingId(null);
      setError(t("errorShareFailed"));
      return;
    }

    const alreadyHad = !upsertData || upsertData.length === 0;

    if (alreadyHad) {
      setSharingId(null);
      setShareResult({ contact, alreadyHad: true });
      return;
    }

    // Best-effort notification through the existing Team Chat inbox — if
    // this fails for any reason the share itself already succeeded, so
    // it's not treated as an error.
    await supabase.from("mechanic_messages").insert({
      sender_id: mechanicId,
      recipient_id: contact.id,
      body: t("notificationBody", { name: asset.name }),
    });

    setSharingId(null);
    setShareResult({ contact, alreadyHad: false });
    onShared(contact.name);
  }

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
          <h3 className="text-[16px] font-black text-zinc-900">{t("title")}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
        </div>

        {shareResult ? (
          <div className="p-8 text-center">
            {shareResult.alreadyHad ? (
              <>
                <div className="w-16 h-16 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle size={32} className="text-zinc-400" />
                </div>
                <h4 className="text-[18px] font-black text-zinc-900 mb-1">{t("alreadySharedTitle")}</h4>
                <p className="text-[13px] text-zinc-500 mb-6">
                  {t.rich("alreadySharedDesc", {
                    name: shareResult.contact.name,
                    asset: asset.name,
                    b1: (chunks) => <span className="font-semibold text-zinc-700">{chunks}</span>,
                    b2: (chunks) => <span className="font-semibold text-zinc-700">{chunks}</span>,
                  })}
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} className="text-green-600" />
                </div>
                <h4 className="text-[18px] font-black text-zinc-900 mb-1">{t("sharedTitle")}</h4>
                <p className="text-[13px] text-zinc-500 mb-6">
                  {t.rich("sharedDesc", {
                    name: shareResult.contact.name,
                    asset: asset.name,
                    b1: (chunks) => <span className="font-semibold text-zinc-700">{chunks}</span>,
                    b2: (chunks) => <span className="font-semibold text-zinc-700">{chunks}</span>,
                  })}
                </p>
              </>
            )}
            <button onClick={onClose} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl text-[13px] transition-colors">
              {t("done")}
            </button>
          </div>
        ) : (
          <div className="p-6">
            <p className="text-[13px] text-zinc-500 mb-4">
              {t.rich("intro", { asset: asset.name, b2: (chunks) => <span className="font-semibold text-zinc-700">{chunks}</span> })}
            </p>

            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder={t("searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 pl-9 pr-4 py-2.5 text-[13px] outline-none focus:border-blue-400 transition-colors"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 mb-3">
                <AlertCircle size={14} className="shrink-0" />
                <p className="text-[12px]">{error}</p>
              </div>
            )}

            <div className="max-h-80 overflow-y-auto -mx-2 px-2">
              {loadingContacts ? (
                <p className="text-[13px] text-zinc-400 text-center py-8">{t("loadingContacts")}</p>
              ) : contacts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[13px] text-zinc-500 mb-1">{t("noContactsTitle")}</p>
                  <p className="text-[12px] text-zinc-400">{t("noContactsDesc")}</p>
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-[13px] text-zinc-400 text-center py-8">{t("noContactsMatch")}</p>
              ) : (
                <div className="space-y-1">
                  {filtered.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleShare(c)}
                      disabled={sharingId === c.id}
                      className="w-full flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-zinc-50 transition-colors text-left disabled:opacity-50"
                    >
                      <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center shrink-0 overflow-hidden text-[12px] font-bold text-zinc-500">
                        {c.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.photo_url} alt={c.name} className="w-full h-full object-cover" />
                        ) : (
                          getInitials(c.name)
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold text-zinc-900 truncate">{c.name}</p>
                        <p className="text-[11px] text-zinc-400 truncate">{c.workshop_name || (c.profession ? tProfessionTypes(PROFESSION_KEYS[c.profession] ?? "owner") : t("maintlerFallback"))}</p>
                      </div>
                      <Share2 size={15} className="text-zinc-300 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
