"use client";

// Services isn't migrated yet — keep this one plain next/link.
import Link from "next/link";
import { useEffect, useState } from "react";
// Login is migrated and every router.push()/replace() call on this page
// targets it — safe to use next-intl's locale-aware router.
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  Plus, X,
  Search, Trash2, UserCircle2, Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import DashboardSidebarIntl from "@/components/DashboardSidebarIntl";
import DashboardHeaderIntl from "@/components/DashboardHeaderIntl";
import { useUnreadMessagesCount } from "@/lib/useUnreadMessages";
import { useUnreadMechanicMessages } from "@/lib/useUnreadMechanicMessages";
import { formatDateDMY } from "@/lib/date";

const assetTypeImg: Record<string, string> = {
  automotive: "/images/car.png",
  motorcycle: "/images/moto.png",
  generator: "/images/generador.png",
  machinery: "/images/excavator.png",
  marine: "/images/barco.png",
  aviation: "/images/avion.png",
};

// Purely visual, color only — no text — so it stays keyed by the raw
// English DB enum value regardless of locale.
const typeColors: Record<string, string> = {
  "Oil Change": "bg-amber-100 text-amber-700",
  Service: "bg-blue-100 text-blue-700",
  Repair: "bg-red-100 text-red-700",
  Inspection: "bg-purple-100 text-purple-700",
  "Filter Change": "bg-green-100 text-green-700",
  "Tire Change": "bg-cyan-100 text-cyan-700",
  "Brake Service": "bg-orange-100 text-orange-700",
};

// Service type is a DB-stored English enum also read by other, not-yet-
// migrated pages — same enum-translation-key pattern used elsewhere.
const SERVICE_TYPE_KEYS: Record<string, string> = {
  "Oil Change": "oilChange", "Service": "service", "Repair": "repair",
  "Inspection": "inspection", "Filter Change": "filterChange",
  "Tire Change": "tireChange", "Brake Service": "brakeService", "Other": "other",
};

type CustomerRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  created_at: string;
};

type AssetLite = {
  id: string;
  nickname: string | null;
  brand: string | null;
  model: string | null;
  asset_type: string;
  customer_id: string | null;
};

type ServiceLite = {
  id: string;
  service_type: string;
  service_date: string;
  customer_id: string | null;
  asset_id: string;
};

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";
}

export default function CustomersPage() {
  const t = useTranslations("DashboardCustomersPage");
  const tServiceTypes = useTranslations("ServiceTypes");
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mechanicId, setMechanicId] = useState("");
  const unreadMessages = useUnreadMessagesCount(mechanicId);
  const unreadMechanicMessages = useUnreadMechanicMessages(mechanicId);
  const [mechanicName, setMechanicName] = useState("");
  const [mechanicPhoto, setMechanicPhoto] = useState("");
  const [mechanicEmail, setMechanicEmail] = useState("");
  const [maintlerCode, setMaintlerCode] = useState("");
  const [loading, setLoading] = useState(true);

  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [assets, setAssets] = useState<AssetLite[]>([]);
  const [services, setServices] = useState<ServiceLite[]>([]);
  const [search, setSearch] = useState("");

  // Add customer modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");

  // Detail modal
  const [detail, setDetail] = useState<CustomerRow | null>(null);
  const [detailName, setDetailName] = useState("");
  const [detailPhone, setDetailPhone] = useState("");
  const [detailEmail, setDetailEmail] = useState("");
  const [detailNotes, setDetailNotes] = useState("");
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailMsg, setDetailMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function assetLabel(a: AssetLite) {
    return a.nickname || [a.brand, a.model].filter(Boolean).join(" ") || t("unnamedAsset");
  }

  async function loadAll(uid: string) {
    setLoading(true);
    const [{ data: customerRows }, { data: assetRows }, { data: serviceRows }] = await Promise.all([
      supabase.from("customers").select("id, name, phone, email, notes, created_at").eq("mechanic_id", uid).order("name", { ascending: true }),
      supabase.from("assets").select("id, nickname, brand, model, asset_type, customer_id").eq("created_by", uid).is("deleted_at", null),
      supabase.from("service_records").select("id, service_type, service_date, customer_id, asset_id").eq("mechanic_id", uid).is("deleted_at", null).order("service_date", { ascending: false }),
    ]);
    setCustomers((customerRows as CustomerRow[]) ?? []);
    setAssets((assetRows as AssetLite[]) ?? []);
    setServices((serviceRows as ServiceLite[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    let active = true;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      if (!active) return;

      setMechanicId(session.user.id);
      setMechanicEmail(session.user.email ?? "");

      const { data: mechanic } = await supabase
        .from("mechanics").select("name, photo_url, maintler_code").eq("id", session.user.id).single();
      if (active && mechanic) { setMechanicName(mechanic.name); setMechanicPhoto(mechanic.photo_url ?? ""); setMaintlerCode(mechanic.maintler_code ?? ""); }

      await loadAll(session.user.id);
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

  function assetsFor(customerId: string) {
    return assets.filter((a) => a.customer_id === customerId);
  }
  function servicesFor(customerId: string) {
    return services.filter((s) => s.customer_id === customerId);
  }
  function lastServiceDateFor(customerId: string) {
    const rows = servicesFor(customerId);
    return rows.length > 0 ? rows[0].service_date : null;
  }

  function openAddModal() {
    setNewName(""); setNewPhone(""); setNewEmail(""); setNewNotes(""); setAddError("");
    setShowAddModal(true);
  }

  async function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAddSaving(true);
    setAddError("");
    const { data, error } = await supabase
      .from("customers")
      .insert({ mechanic_id: mechanicId, name: newName.trim(), phone: newPhone.trim() || null, email: newEmail.trim() || null, notes: newNotes.trim() || null })
      .select("id, name, phone, email, notes, created_at")
      .single();
    setAddSaving(false);
    if (error || !data) { setAddError(t("addCustomerFailed")); return; }
    setCustomers((prev) => [...prev, data as CustomerRow].sort((a, b) => a.name.localeCompare(b.name)));
    setShowAddModal(false);
  }

  function openDetail(c: CustomerRow) {
    setDetail(c);
    setDetailName(c.name);
    setDetailPhone(c.phone ?? "");
    setDetailEmail(c.email ?? "");
    setDetailNotes(c.notes ?? "");
    setDetailMsg(null);
    setConfirmDelete(false);
  }

  async function handleSaveDetail() {
    if (!detail || !detailName.trim()) return;
    setDetailSaving(true);
    setDetailMsg(null);
    const patch = { name: detailName.trim(), phone: detailPhone.trim() || null, email: detailEmail.trim() || null, notes: detailNotes.trim() || null };
    const { data, error } = await supabase.from("customers").update(patch).eq("id", detail.id).select("id");
    setDetailSaving(false);
    if (error || !data || data.length === 0) { setDetailMsg({ text: t("saveChangesFailed"), ok: false }); return; }
    setCustomers((prev) => prev.map((c) => (c.id === detail.id ? { ...c, ...patch } : c)).sort((a, b) => a.name.localeCompare(b.name)));
    setDetail((prev) => (prev ? { ...prev, ...patch } : prev));
    setDetailMsg({ text: t("saved"), ok: true });
  }

  async function handleDeleteCustomer() {
    if (!detail) return;
    setDetailMsg(null);
    const { error } = await supabase.from("customers").delete().eq("id", detail.id);
    if (error) {
      setDetailMsg({ text: t("deleteCustomerFailed"), ok: false });
      return;
    }
    setCustomers((prev) => prev.filter((c) => c.id !== detail.id));
    setAssets((prev) => prev.map((a) => (a.customer_id === detail.id ? { ...a, customer_id: null } : a)));
    setServices((prev) => prev.map((s) => (s.customer_id === detail.id ? { ...s, customer_id: null } : s)));
    setDetail(null);
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-zinc-400 text-[13px]">{t("loadingAuth")}</p>
      </div>
    );
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? customers.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q) || (c.email ?? "").toLowerCase().includes(q))
    : customers;

  return (
    <div className="h-dvh bg-zinc-50 flex relative overflow-hidden">

      <DashboardSidebarIntl
        activeHref="/dashboard/customers"
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
        mechanicId={mechanicId}
        unreadMessages={unreadMessages}
        unreadMechanicMessages={unreadMechanicMessages}
        photoUrl={mechanicPhoto}
        name={mechanicName}
        email={mechanicEmail}
      />

      {/* ════ MAIN ════ */}
      <div className="flex-1 flex flex-col min-w-0">

        <DashboardHeaderIntl
          title={t("title")}
          subtitle={t("subtitle")}
          onOpenSidebar={() => setSidebarOpen(true)}
          mechanicId={mechanicId}
          unreadMessages={unreadMessages}
          unreadMechanicMessages={unreadMechanicMessages}
          photoUrl={mechanicPhoto}
          name={mechanicName}
          email={mechanicEmail}
          maintlerCode={maintlerCode}
          onLogout={handleLogout}
        />

        <div className="flex-1 overflow-y-auto px-3 md:px-4 pt-1.5 md:pt-2 pb-3 md:pb-4">

          {/* Toolbar */}
          <div className="flex items-center justify-between mb-5 -mt-2 gap-3 flex-wrap">
            <div className="relative min-w-[220px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-[9px] text-[12px] outline-none focus:border-red-400"
              />
            </div>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all text-white text-[13px] font-bold px-4 py-[10px] rounded-xl shadow-sm"
            >
              <Plus size={15} /> {t("newCustomer")}
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm">
            {loading ? (
              <p className="text-[13px] text-zinc-400 text-center py-12">{t("loadingCustomers")}</p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-red-100 bg-red-50 mb-3">
                  <Users size={20} className="text-red-500" />
                </div>
                <p className="text-[13px] text-zinc-400 mb-3">{customers.length === 0 ? t("noCustomersYet") : t("noCustomersMatch")}</p>
                {customers.length === 0 && (
                  <button onClick={openAddModal} className="text-[12px] font-bold text-red-600 hover:text-red-700">
                    {t("addFirstCustomer")}
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto overscroll-x-contain">
                <table className="w-full min-w-[680px]">
                  <thead>
                    <tr className="text-left text-[10px] text-zinc-400 font-bold uppercase border-b border-zinc-100">
                      <th className="px-5 py-3 font-bold">{t("columnName")}</th>
                      <th className="px-3 py-3 font-bold">{t("columnContact")}</th>
                      <th className="px-3 py-3 font-bold">{t("columnEquipment")}</th>
                      <th className="px-3 py-3 font-bold">{t("columnServices")}</th>
                      <th className="px-3 py-3 font-bold">{t("columnLastService")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => {
                      const eqCount = assetsFor(c.id).length;
                      const svcCount = servicesFor(c.id).length;
                      const lastDate = lastServiceDateFor(c.id);
                      return (
                        <tr key={c.id} className="border-t border-zinc-100 hover:bg-zinc-50/50 transition-colors cursor-pointer" onClick={() => openDetail(c)}>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-[12px] shrink-0">
                                {getInitials(c.name)}
                              </div>
                              <p className="text-[12.5px] font-bold text-zinc-800">{c.name}</p>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-[12px] text-zinc-500">
                            {c.phone && <p>{c.phone}</p>}
                            {c.email && <p className="text-zinc-400">{c.email}</p>}
                            {!c.phone && !c.email && "—"}
                          </td>
                          <td className="px-3 py-3 text-[12px] text-zinc-700 font-medium">{eqCount}</td>
                          <td className="px-3 py-3 text-[12px] text-zinc-700 font-medium">{svcCount}</td>
                          <td className="px-3 py-3 text-[12px] text-zinc-400">{lastDate ? formatDateDMY(lastDate) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="text-center text-[11px] text-zinc-400 mt-8">{t("copyright")}</p>
        </div>
      </div>

      {/* ════ NEW CUSTOMER MODAL ════ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
                  <UserCircle2 size={15} className="text-red-600" />
                </div>
                <h2 className="text-[16px] font-black text-zinc-900">{t("modalNewCustomerTitle")}</h2>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
            </div>
            <form onSubmit={handleAddCustomer} className="px-6 py-5 space-y-4">
              <div>
                <label className="text-[12px] font-bold text-zinc-700">{t("nameLabel")}</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} required autoFocus
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
              </div>
              <div>
                <label className="text-[12px] font-bold text-zinc-700">{t("phoneLabel")}</label>
                <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
              </div>
              <div>
                <label className="text-[12px] font-bold text-zinc-700">{t("emailLabel")}</label>
                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
              </div>
              <div>
                <label className="text-[12px] font-bold text-zinc-700">{t("notesLabel")}</label>
                <textarea rows={3} value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder={t("notesPlaceholder")}
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500 resize-none" />
              </div>
              {addError && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">{addError}</div>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-[11px] rounded-xl text-[13px] hover:bg-zinc-50">{t("cancel")}</button>
                <button type="submit" disabled={addSaving || !newName.trim()} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 transition-all text-white font-bold py-[11px] rounded-xl text-[13px]">
                  {addSaving ? t("saving") : t("addCustomer")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════ CUSTOMER DETAIL MODAL ════ */}
      {detail && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-black text-[13px] shrink-0">
                  {getInitials(detail.name)}
                </div>
                <div className="min-w-0">
                  <h2 className="text-[15px] font-black text-zinc-900 truncate">{detail.name}</h2>
                  <p className="text-[11px] text-zinc-400">{t("customerSince", { date: formatDateDMY(detail.created_at) })}</p>
                </div>
              </div>
              <button onClick={() => setDetail(null)} className="text-zinc-400 hover:text-zinc-700 shrink-0"><X size={18} /></button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-50 rounded-xl p-3 text-center">
                  <p className="text-[18px] font-black text-zinc-900">{assetsFor(detail.id).length}</p>
                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide mt-0.5">{t("equipment")}</p>
                </div>
                <div className="bg-zinc-50 rounded-xl p-3 text-center">
                  <p className="text-[18px] font-black text-zinc-900">{servicesFor(detail.id).length}</p>
                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide mt-0.5">{t("services")}</p>
                </div>
              </div>

              {/* Editable fields */}
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-zinc-600">{t("detailNameLabel")}</label>
                  <input value={detailName} onChange={(e) => setDetailName(e.target.value)}
                    className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-red-400" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-zinc-600">{t("detailPhoneLabel")}</label>
                    <input value={detailPhone} onChange={(e) => setDetailPhone(e.target.value)} placeholder={t("detailPhonePlaceholder")}
                      className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-red-400" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-zinc-600">{t("detailEmailLabel")}</label>
                    <input value={detailEmail} onChange={(e) => setDetailEmail(e.target.value)} placeholder={t("detailEmailPlaceholder")}
                      className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-red-400" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-zinc-600">{t("detailNotesLabel")}</label>
                  <textarea rows={2} value={detailNotes} onChange={(e) => setDetailNotes(e.target.value)} placeholder={t("detailNotesPlaceholder")}
                    className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-red-400 resize-none" />
                </div>
                {detailMsg && <p className={`text-[12px] ${detailMsg.ok ? "text-emerald-600" : "text-red-600"}`}>{detailMsg.text}</p>}
                <button onClick={handleSaveDetail} disabled={detailSaving || !detailName.trim()}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-[13px] transition-all">
                  {detailSaving ? t("savingEllipsis") : t("saveChanges")}
                </button>
              </div>

              {/* Equipment */}
              <div className="border-t border-zinc-100 pt-4 space-y-2">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{t("equipment")}</p>
                {assetsFor(detail.id).length === 0 ? (
                  <p className="text-[12px] text-zinc-300">{t("noEquipmentLinked")}</p>
                ) : (
                  assetsFor(detail.id).map((a) => (
                    <Link key={a.id} href={`/dashboard/services?asset=${a.id}`}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-zinc-50 border border-zinc-100 flex items-center justify-center shrink-0 overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={assetTypeImg[a.asset_type] ?? "/images/car.png"} alt="" className="w-[20px] h-[20px] object-contain" />
                      </div>
                      <p className="text-[12.5px] font-bold text-zinc-800 truncate">{assetLabel(a)}</p>
                    </Link>
                  ))
                )}
              </div>

              {/* Service history */}
              <div className="border-t border-zinc-100 pt-4 space-y-2">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{t("serviceHistory")}</p>
                {servicesFor(detail.id).length === 0 ? (
                  <p className="text-[12px] text-zinc-300">{t("noServicesLogged")}</p>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {servicesFor(detail.id).map((s) => {
                      const asset = assets.find((a) => a.id === s.asset_id);
                      return (
                        <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-zinc-50">
                          <div className="min-w-0">
                            <p className="text-[12px] font-semibold text-zinc-700 truncate">{asset ? assetLabel(asset) : t("unknownAsset")}</p>
                            <span className={`inline-block mt-0.5 text-[9.5px] font-bold px-1.5 py-[1px] rounded-full ${typeColors[s.service_type] ?? "bg-zinc-100 text-zinc-600"}`}>
                              {tServiceTypes(SERVICE_TYPE_KEYS[s.service_type] ?? "other")}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 shrink-0">{formatDateDMY(s.service_date)}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Delete */}
              <div className="border-t border-zinc-100 pt-4">
                {confirmDelete ? (
                  <div className="flex items-center justify-between gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                    <span className="text-[11px] text-red-700 font-medium">{t("deleteCustomerConfirm")}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={handleDeleteCustomer} className="text-[11px] font-bold text-white bg-red-600 hover:bg-red-500 px-2.5 py-1.5 rounded-lg transition-colors">{t("confirm")}</button>
                      <button onClick={() => setConfirmDelete(false)} className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-700 px-1.5">{t("cancel")}</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-2 text-[12px] font-semibold text-zinc-400 hover:text-red-600 transition-colors">
                    <Trash2 size={13} /> {t("deleteCustomer")}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
