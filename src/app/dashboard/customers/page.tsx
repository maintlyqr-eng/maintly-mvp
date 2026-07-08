"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutGrid, FileText, Box, QrCode, Users, BarChart3, Calendar as CalendarIcon,
  Mail, FolderOpen, Settings, Bell, Plus, X, LogOut, Crown, Menu,
  Search, Trash2, UserCircle2,
  MessageCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useUnreadMessagesCount } from "@/lib/useUnreadMessages";
import { useUnreadMechanicMessages } from "@/lib/useUnreadMechanicMessages";
import HoverAvatar from "@/components/HoverAvatar";
import ContactSupportWidget from "@/components/ContactSupportWidget";
import { formatDateDMY } from "@/lib/date";

const navItems = [
  { icon: LayoutGrid, label: "Dashboard", href: "/dashboard" },
  { icon: FileText, label: "My Services", href: "/dashboard/services" },
  { icon: Bell, label: "Scheduled Services", href: "/dashboard/scheduled" },
  { icon: Box, label: "Assets", href: "/dashboard/assets" },
  { icon: QrCode, label: "QR Codes", href: "/dashboard/qr-codes" },
  { icon: Users, label: "Customers", href: "/dashboard/customers" },
  { icon: BarChart3, label: "Reports", href: "/dashboard/reports" },
  { icon: CalendarIcon, label: "Calendar", href: "/dashboard/calendar" },
  { icon: Mail, label: "Messages", href: "/dashboard/messages" },
  { icon: MessageCircle, label: "Team Chat", href: "/dashboard/team-chat" },
  { icon: FolderOpen, label: "Document Library", href: "/dashboard/documents" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
];

const assetTypeImg: Record<string, string> = {
  automotive: "/images/car.png",
  motorcycle: "/images/moto.png",
  generator: "/images/generador.png",
  machinery: "/images/excavator.png",
  marine: "/images/barco.png",
  aviation: "/images/avion.png",
};

const typeColors: Record<string, string> = {
  "Oil Change": "bg-amber-100 text-amber-700",
  Service: "bg-blue-100 text-blue-700",
  Repair: "bg-red-100 text-red-700",
  Inspection: "bg-purple-100 text-purple-700",
  "Filter Change": "bg-green-100 text-green-700",
  "Tire Change": "bg-cyan-100 text-cyan-700",
  "Brake Service": "bg-orange-100 text-orange-700",
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

function assetLabel(a: AssetLite) {
  return a.nickname || [a.brand, a.model].filter(Boolean).join(" ") || "Unnamed asset";
}

function getInitials(name: string) {
  return name.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "?";
}

export default function CustomersPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mechanicId, setMechanicId] = useState("");
  const unreadMessages = useUnreadMessagesCount(mechanicId);
  const unreadMechanicMessages = useUnreadMechanicMessages(mechanicId);
  const [mechanicName, setMechanicName] = useState("");
  const [mechanicPhoto, setMechanicPhoto] = useState("");
  const [mechanicEmail, setMechanicEmail] = useState("");
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

  async function loadAll(uid: string) {
    setLoading(true);
    const [{ data: customerRows }, { data: assetRows }, { data: serviceRows }] = await Promise.all([
      supabase.from("customers").select("id, name, phone, email, notes, created_at").eq("mechanic_id", uid).order("name", { ascending: true }),
      supabase.from("assets").select("id, nickname, brand, model, asset_type, customer_id").eq("created_by", uid),
      supabase.from("service_records").select("id, service_type, service_date, customer_id, asset_id").eq("mechanic_id", uid).order("service_date", { ascending: false }),
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
        .from("mechanics").select("name, photo_url").eq("id", session.user.id).single();
      if (active && mechanic) { setMechanicName(mechanic.name); setMechanicPhoto(mechanic.photo_url ?? ""); }

      await loadAll(session.user.id);
      if (active) setCheckingAuth(false);
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });

    return () => { active = false; listener.subscription.unsubscribe(); };
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
    if (error || !data) { setAddError("Couldn't add the customer. Try again."); return; }
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
    if (error || !data || data.length === 0) { setDetailMsg({ text: "Couldn't save changes.", ok: false }); return; }
    setCustomers((prev) => prev.map((c) => (c.id === detail.id ? { ...c, ...patch } : c)).sort((a, b) => a.name.localeCompare(b.name)));
    setDetail((prev) => (prev ? { ...prev, ...patch } : prev));
    setDetailMsg({ text: "Saved.", ok: true });
  }

  async function handleDeleteCustomer() {
    if (!detail) return;
    await supabase.from("customers").delete().eq("id", detail.id);
    setCustomers((prev) => prev.filter((c) => c.id !== detail.id));
    setAssets((prev) => prev.map((a) => (a.customer_id === detail.id ? { ...a, customer_id: null } : a)));
    setServices((prev) => prev.map((s) => (s.customer_id === detail.id ? { ...s, customer_id: null } : s)));
    setDetail(null);
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-zinc-400 text-[13px]">Loading...</p>
      </div>
    );
  }

  const initials = mechanicName.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "ME";
  const q = search.trim().toLowerCase();
  const filtered = q
    ? customers.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q) || (c.email ?? "").toLowerCase().includes(q))
    : customers;

  return (
    <div className="min-h-screen bg-zinc-50 flex relative">

      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-30" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ════ SIDEBAR ════ */}
      <aside className={`fixed md:static inset-y-0 left-0 z-40 w-[230px] bg-white border-r border-zinc-200 flex flex-col shrink-0 transform transition-transform duration-200 md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-4 py-2">
          <Link href="/" className="flex items-center">
            <Image src="/images/maintly-logo-full.png" alt="MaintlyQR" width={244} height={72} priority style={{ objectFit: "contain" }} />
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-zinc-400 hover:text-zinc-700 mr-2">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-[9px] rounded-lg mb-1 text-[13px] font-medium transition-colors ${
                item.label === "Customers"
                  ? "bg-red-50 text-red-600 border-l-[3px] border-red-600 -ml-[1px]"
                  : "text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              <item.icon size={16} />
              {item.label}
              {item.label === "Messages" && unreadMessages > 0 && (
                <span className="ml-auto bg-red-600 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">{unreadMessages}</span>
              )}
              {item.label === "Team Chat" && unreadMechanicMessages > 0 && (
                <span className="ml-auto bg-red-600 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">{unreadMechanicMessages}</span>
              )}
            </Link>
          ))}
        </nav>

        <ContactSupportWidget mechanicId={mechanicId} />

        <div className="mx-3 mb-3 p-4 rounded-xl bg-gradient-to-br from-zinc-50 to-zinc-100 border border-zinc-200">
          <div className="flex items-center gap-1.5 text-amber-500 mb-1">
            <Crown size={14} />
            <span className="text-[12px] font-bold text-zinc-800">Go Premium</span>
          </div>
          <p className="text-[10px] text-zinc-500 leading-relaxed mb-3">Unlock advanced reports, custom branding and more.</p>
          <button className="w-full bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] font-bold py-2 rounded-lg transition-colors">Upgrade Now</button>
        </div>

        <div className="flex items-center gap-2.5 px-4 py-3 border-t border-zinc-200">
          <Link href="/dashboard/settings" className="shrink-0">
            {mechanicPhoto ? (
              <HoverAvatar src={mechanicPhoto} size={32} />
            ) : (
              <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-[12px]">{initials}</div>
            )}
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-zinc-800 leading-tight truncate">{mechanicName || mechanicEmail}</p>
            <p className="text-[10px] text-zinc-400 leading-tight">Maintly Maintler</p>
          </div>
        </div>
      </aside>

      {/* ════ MAIN ════ */}
      <div className="flex-1 flex flex-col min-w-0">

        <header className="flex items-center justify-between gap-3 px-4 md:px-7 py-4 bg-white border-b border-zinc-200">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden shrink-0 text-zinc-600 hover:text-zinc-900">
              <Menu size={22} />
            </button>
            <div className="min-w-0">
              <h1 className="text-[17px] md:text-[20px] font-black text-zinc-900 truncate">Customers</h1>
              <p className="hidden sm:block text-[12px] text-zinc-400 truncate">Whoever's responsible for the upkeep of each piece of equipment.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <button className="relative text-zinc-500 hover:text-zinc-800 transition-colors"><Bell size={19} /></button>
            <div className="flex items-center gap-3 md:pl-3 md:border-l border-zinc-200">
              <div className="flex items-center gap-2.5">
                <Link href="/dashboard/settings" className="shrink-0">
                  {mechanicPhoto ? (
                    <HoverAvatar src={mechanicPhoto} size={36} />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-[13px]">{initials}</div>
                  )}
                </Link>
                <div className="hidden sm:block text-left">
                  <p className="text-[12px] font-bold text-zinc-800 leading-tight">{mechanicName || mechanicEmail}</p>
                  <p className="text-[10px] text-zinc-400 leading-tight">Maintler</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-zinc-500 hover:text-red-600 hover:bg-red-50 border border-zinc-200 hover:border-red-200 px-3 py-2 rounded-xl transition-all"
              >
                <LogOut size={13} />
                <span className="hidden md:inline">Log out</span>
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-7">

          {/* Toolbar */}
          <div className="flex items-center justify-between mb-5 -mt-2 gap-3 flex-wrap">
            <div className="relative min-w-[220px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, phone or email..."
                className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-[9px] text-[12px] outline-none focus:border-red-400"
              />
            </div>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all text-white text-[13px] font-bold px-4 py-[10px] rounded-xl shadow-sm"
            >
              <Plus size={15} /> New Customer
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm">
            {loading ? (
              <p className="text-[13px] text-zinc-400 text-center py-12">Loading customers...</p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-red-100 bg-red-50 mb-3">
                  <Users size={20} className="text-red-500" />
                </div>
                <p className="text-[13px] text-zinc-400 mb-3">{customers.length === 0 ? "No customers yet." : "No customers match your search."}</p>
                {customers.length === 0 && (
                  <button onClick={openAddModal} className="text-[12px] font-bold text-red-600 hover:text-red-700">
                    Add your first customer →
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px]">
                  <thead>
                    <tr className="text-left text-[10px] text-zinc-400 font-bold uppercase border-b border-zinc-100">
                      <th className="px-5 py-3 font-bold">Name</th>
                      <th className="px-3 py-3 font-bold">Contact</th>
                      <th className="px-3 py-3 font-bold">Equipment</th>
                      <th className="px-3 py-3 font-bold">Services</th>
                      <th className="px-3 py-3 font-bold">Last Service</th>
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

          <p className="text-center text-[11px] text-zinc-400 mt-8">© 2026 Maintly. All rights reserved.</p>
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
                <h2 className="text-[16px] font-black text-zinc-900">New Customer</h2>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
            </div>
            <form onSubmit={handleAddCustomer} className="px-6 py-5 space-y-4">
              <div>
                <label className="text-[12px] font-bold text-zinc-700">Name *</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} required autoFocus
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
              </div>
              <div>
                <label className="text-[12px] font-bold text-zinc-700">Phone (optional)</label>
                <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
              </div>
              <div>
                <label className="text-[12px] font-bold text-zinc-700">Email (optional)</label>
                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500" />
              </div>
              <div>
                <label className="text-[12px] font-bold text-zinc-700">Notes (optional)</label>
                <textarea rows={3} value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Anything worth remembering for follow-up..."
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500 resize-none" />
              </div>
              {addError && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">{addError}</div>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-[11px] rounded-xl text-[13px] hover:bg-zinc-50">Cancel</button>
                <button type="submit" disabled={addSaving || !newName.trim()} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 transition-all text-white font-bold py-[11px] rounded-xl text-[13px]">
                  {addSaving ? "Saving..." : "Add Customer"}
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
                  <p className="text-[11px] text-zinc-400">Customer since {formatDateDMY(detail.created_at)}</p>
                </div>
              </div>
              <button onClick={() => setDetail(null)} className="text-zinc-400 hover:text-zinc-700 shrink-0"><X size={18} /></button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-50 rounded-xl p-3 text-center">
                  <p className="text-[18px] font-black text-zinc-900">{assetsFor(detail.id).length}</p>
                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide mt-0.5">Equipment</p>
                </div>
                <div className="bg-zinc-50 rounded-xl p-3 text-center">
                  <p className="text-[18px] font-black text-zinc-900">{servicesFor(detail.id).length}</p>
                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wide mt-0.5">Services</p>
                </div>
              </div>

              {/* Editable fields */}
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-zinc-600">Name</label>
                  <input value={detailName} onChange={(e) => setDetailName(e.target.value)}
                    className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-red-400" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-zinc-600">Phone</label>
                    <input value={detailPhone} onChange={(e) => setDetailPhone(e.target.value)} placeholder="Not set"
                      className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-red-400" />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-zinc-600">Email</label>
                    <input value={detailEmail} onChange={(e) => setDetailEmail(e.target.value)} placeholder="Not set"
                      className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-red-400" />
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-zinc-600">Notes</label>
                  <textarea rows={2} value={detailNotes} onChange={(e) => setDetailNotes(e.target.value)} placeholder="Nothing noted yet"
                    className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-red-400 resize-none" />
                </div>
                {detailMsg && <p className={`text-[12px] ${detailMsg.ok ? "text-emerald-600" : "text-red-600"}`}>{detailMsg.text}</p>}
                <button onClick={handleSaveDetail} disabled={detailSaving || !detailName.trim()}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 disabled:opacity-60 text-white font-bold py-2.5 rounded-xl text-[13px] transition-all">
                  {detailSaving ? "Saving…" : "Save changes"}
                </button>
              </div>

              {/* Equipment */}
              <div className="border-t border-zinc-100 pt-4 space-y-2">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Equipment</p>
                {assetsFor(detail.id).length === 0 ? (
                  <p className="text-[12px] text-zinc-300">No equipment currently linked to this customer.</p>
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
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Service history</p>
                {servicesFor(detail.id).length === 0 ? (
                  <p className="text-[12px] text-zinc-300">No services logged for this customer yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto">
                    {servicesFor(detail.id).map((s) => {
                      const asset = assets.find((a) => a.id === s.asset_id);
                      return (
                        <div key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-zinc-50">
                          <div className="min-w-0">
                            <p className="text-[12px] font-semibold text-zinc-700 truncate">{asset ? assetLabel(asset) : "Unknown asset"}</p>
                            <span className={`inline-block mt-0.5 text-[9.5px] font-bold px-1.5 py-[1px] rounded-full ${typeColors[s.service_type] ?? "bg-zinc-100 text-zinc-600"}`}>{s.service_type}</span>
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
                    <span className="text-[11px] text-red-700 font-medium">Delete this customer? Their equipment and service history stay, just unlinked.</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={handleDeleteCustomer} className="text-[11px] font-bold text-white bg-red-600 hover:bg-red-500 px-2.5 py-1.5 rounded-lg transition-colors">Confirm</button>
                      <button onClick={() => setConfirmDelete(false)} className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-700 px-1.5">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-2 text-[12px] font-semibold text-zinc-400 hover:text-red-600 transition-colors">
                    <Trash2 size={13} /> Delete customer
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
