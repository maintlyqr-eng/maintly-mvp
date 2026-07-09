"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutGrid, FileText, Box, QrCode, Users, BarChart3, Calendar as CalendarIcon,
  Mail, FolderOpen, Settings, Bell, Plus, X, LogOut, Crown, Menu,
  Search, Trash2, Download, File as FileIcon, Image as ImageIcon, FileSpreadsheet,
  MessageCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import NotificationBell from "@/components/NotificationBell";
import { useUnreadMessagesCount } from "@/lib/useUnreadMessages";
import { useUnreadMechanicMessages } from "@/lib/useUnreadMechanicMessages";
import HoverAvatar from "@/components/HoverAvatar";
import ContactSupportWidget from "@/components/ContactSupportWidget";
import { formatDateDMY } from "@/lib/date";
import DashboardSidebar from "@/components/DashboardSidebar";
import DashboardHeader from "@/components/DashboardHeader";
import { getInitials } from "@/lib/initials";

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB — generous for invoices/manuals/photos, cheap to keep sane

type DocumentRow = {
  id: string;
  asset_id: string | null;
  service_record_id: string | null;
  customer_id: string | null;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  notes: string | null;
  created_at: string;
};

type AssetLite = { id: string; nickname: string | null; brand: string | null; model: string | null };
type CustomerLite = { id: string; name: string };

function assetLabel(a: AssetLite) {
  return a.nickname || [a.brand, a.model].filter(Boolean).join(" ") || "Unnamed asset";
}

function formatFileSize(bytes: number | null) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconFor(fileType: string | null, fileName: string) {
  const t = fileType ?? "";
  const n = fileName.toLowerCase();
  if (t.startsWith("image/")) return { Icon: ImageIcon, color: "text-purple-600 bg-purple-50" };
  if (t.includes("sheet") || t.includes("excel") || n.endsWith(".xlsx") || n.endsWith(".csv")) {
    return { Icon: FileSpreadsheet, color: "text-emerald-600 bg-emerald-50" };
  }
  if (t.includes("pdf") || n.endsWith(".pdf")) return { Icon: FileText, color: "text-red-600 bg-red-50" };
  return { Icon: FileIcon, color: "text-zinc-500 bg-zinc-100" };
}

export default function DocumentsPage() {
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

  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [assets, setAssets] = useState<AssetLite[]>([]);
  const [customers, setCustomers] = useState<CustomerLite[]>([]);
  const [search, setSearch] = useState("");
  const [linkFilter, setLinkFilter] = useState<"all" | "asset" | "customer" | "general">("all");

  const [pageMsg, setPageMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Upload modal
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadAssetId, setUploadAssetId] = useState("");
  const [uploadCustomerId, setUploadCustomerId] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function loadAll(uid: string) {
    setLoading(true);
    const [{ data: docRows }, { data: assetRows }, { data: custRows }] = await Promise.all([
      supabase
        .from("documents")
        .select("id, asset_id, service_record_id, customer_id, file_name, file_path, file_type, file_size, notes, created_at")
        .eq("mechanic_id", uid)
        .order("created_at", { ascending: false }),
      supabase.from("assets").select("id, nickname, brand, model").eq("created_by", uid).order("created_at", { ascending: false }),
      supabase.from("customers").select("id, name").eq("mechanic_id", uid).order("name", { ascending: true }),
    ]);
    setDocuments((docRows as DocumentRow[]) ?? []);
    setAssets((assetRows as AssetLite[]) ?? []);
    setCustomers((custRows as CustomerLite[]) ?? []);
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
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function assetNameFor(id: string | null) {
    if (!id) return null;
    return assets.find((a) => a.id === id) ? assetLabel(assets.find((a) => a.id === id)!) : "Unknown asset";
  }
  function customerNameFor(id: string | null) {
    if (!id) return null;
    return customers.find((c) => c.id === id)?.name ?? "Unknown customer";
  }

  function openUploadModal() {
    setUploadFile(null);
    setUploadAssetId("");
    setUploadCustomerId("");
    setUploadNotes("");
    setUploadError("");
    setShowUpload(true);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadFile) { setUploadError("Choose a file first."); return; }
    if (uploadFile.size > MAX_FILE_BYTES) { setUploadError("That file is too large — max 25MB."); return; }

    setUploading(true);
    setUploadError("");

    const ext = uploadFile.name.includes(".") ? uploadFile.name.split(".").pop() : "bin";
    const path = `${mechanicId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadErr } = await supabase.storage.from("documents").upload(path, uploadFile);
    if (uploadErr) {
      setUploading(false);
      setUploadError("Couldn't upload the file. If this keeps happening, the \"documents\" storage bucket may not be set up yet.");
      return;
    }

    const { data, error } = await supabase
      .from("documents")
      .insert({
        mechanic_id: mechanicId,
        asset_id: uploadAssetId || null,
        customer_id: uploadCustomerId || null,
        file_name: uploadFile.name,
        file_path: path,
        file_type: uploadFile.type || null,
        file_size: uploadFile.size,
        notes: uploadNotes.trim() || null,
      })
      .select("id, asset_id, service_record_id, customer_id, file_name, file_path, file_type, file_size, notes, created_at")
      .single();

    setUploading(false);

    if (error || !data) {
      // File made it to storage but the DB row failed — clean up so it's not an orphan.
      await supabase.storage.from("documents").remove([path]);
      setUploadError("Couldn't save the document. Try again.");
      return;
    }

    setDocuments((prev) => [data as DocumentRow, ...prev]);
    setShowUpload(false);
  }

  async function handleDownload(doc: DocumentRow) {
    setPageMsg(null);
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(doc.file_path, 60);
    if (error || !data?.signedUrl) {
      setPageMsg({ text: "Couldn't open that file. Try again in a moment.", ok: false });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function handleDelete(doc: DocumentRow) {
    setPageMsg(null);
    const { error: storageErr } = await supabase.storage.from("documents").remove([doc.file_path]);
    if (storageErr) {
      setPageMsg({ text: "Couldn't delete that file. Try again in a moment.", ok: false });
      return;
    }
    const { error: dbErr } = await supabase.from("documents").delete().eq("id", doc.id);
    if (dbErr) {
      setPageMsg({ text: "Couldn't delete that file. Try again in a moment.", ok: false });
      return;
    }
    setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    setConfirmDeleteId(null);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((d) => {
      if (linkFilter === "asset" && !d.asset_id) return false;
      if (linkFilter === "customer" && !d.customer_id) return false;
      if (linkFilter === "general" && (d.asset_id || d.customer_id)) return false;
      if (!q) return true;
      const haystack = [d.file_name, d.notes, assetNameFor(d.asset_id), customerNameFor(d.customer_id)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    });
  }, [documents, search, linkFilter, assets, customers]);

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-zinc-400 text-[13px]">Loading...</p>
      </div>
    );
  }

  const initials = getInitials(mechanicName);

  return (
    <div className="min-h-screen bg-zinc-50 flex relative">

      <DashboardSidebar
        activeLabel="Document Library"
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

        <DashboardHeader
          title="Document Library"
          subtitle="Invoices, manuals, certificates — private to you, never shown on the public QR page."
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

        <div className="flex-1 overflow-y-auto p-4 md:p-7">

          {/* Toolbar */}
          <div className="flex items-center justify-between mb-5 -mt-2 gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative min-w-[220px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by file name or note..."
                  className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-[9px] text-[12px] outline-none focus:border-red-400"
                />
              </div>
              <select
                value={linkFilter} onChange={(e) => setLinkFilter(e.target.value as typeof linkFilter)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-[9px] text-[12px] outline-none focus:border-red-400"
              >
                <option value="all">All documents</option>
                <option value="asset">Linked to equipment</option>
                <option value="customer">Linked to a customer</option>
                <option value="general">General (unlinked)</option>
              </select>
            </div>
            <button
              onClick={openUploadModal}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all text-white text-[13px] font-bold px-4 py-[10px] rounded-xl shadow-sm"
            >
              <Plus size={15} /> Upload Document
            </button>
          </div>

          {pageMsg && (
            <div className={`mb-4 rounded-xl border px-3.5 py-2.5 text-[12px] ${pageMsg.ok ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}>
              {pageMsg.text}
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm">
            {loading ? (
              <p className="text-[13px] text-zinc-400 text-center py-12">Loading documents...</p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-red-100 bg-red-50 mb-3">
                  <FolderOpen size={20} className="text-red-500" />
                </div>
                <p className="text-[13px] text-zinc-400 mb-3">
                  {documents.length === 0 ? "No documents yet." : "No documents match this search/filter."}
                </p>
                {documents.length === 0 && (
                  <button onClick={openUploadModal} className="text-[12px] font-bold text-red-600 hover:text-red-700">
                    Upload your first document →
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                  <thead>
                    <tr className="text-left text-[10px] text-zinc-400 font-bold uppercase border-b border-zinc-100">
                      <th className="px-5 py-3 font-bold">File</th>
                      <th className="px-3 py-3 font-bold">Linked to</th>
                      <th className="px-3 py-3 font-bold">Size</th>
                      <th className="px-3 py-3 font-bold">Uploaded</th>
                      <th className="px-3 py-3 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((d) => {
                      const { Icon, color } = iconFor(d.file_type, d.file_name);
                      const asset = assetNameFor(d.asset_id);
                      const customer = customerNameFor(d.customer_id);
                      return (
                        <tr key={d.id} className="border-t border-zinc-100 hover:bg-zinc-50/50 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                                <Icon size={16} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[12.5px] font-bold text-zinc-800 truncate max-w-[220px]">{d.file_name}</p>
                                {d.notes && <p className="text-[11px] text-zinc-400 truncate max-w-[220px]">{d.notes}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-[12px] text-zinc-500">
                            {asset && <p>Equipment: {asset}</p>}
                            {customer && <p className={asset ? "text-zinc-400" : ""}>Customer: {customer}</p>}
                            {!asset && !customer && "General"}
                          </td>
                          <td className="px-3 py-3 text-[12px] text-zinc-400">{formatFileSize(d.file_size)}</td>
                          <td className="px-3 py-3 text-[12px] text-zinc-400">{formatDateDMY(d.created_at)}</td>
                          <td className="px-3 py-3">
                            {confirmDeleteId === d.id ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="text-[10px] text-red-600 font-semibold">Delete?</span>
                                <button onClick={() => handleDelete(d)} className="text-[11px] font-bold text-white bg-red-600 hover:bg-red-500 px-2 py-1 rounded-lg transition-colors">Yes</button>
                                <button onClick={() => setConfirmDeleteId(null)} className="text-[11px] font-semibold text-zinc-400 hover:text-zinc-700 px-1">No</button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-3">
                                <button onClick={() => handleDownload(d)} className="text-zinc-400 hover:text-zinc-800 transition-colors" title="Download">
                                  <Download size={15} />
                                </button>
                                <button onClick={() => setConfirmDeleteId(d.id)} className="text-zinc-300 hover:text-red-600 transition-colors" title="Delete">
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            )}
                          </td>
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

      {/* ════ UPLOAD MODAL ════ */}
      {showUpload && (
        <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4" onClick={() => setShowUpload(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
                  <FolderOpen size={15} className="text-red-600" />
                </div>
                <h2 className="text-[16px] font-black text-zinc-900">Upload Document</h2>
              </div>
              <button onClick={() => setShowUpload(false)} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
            </div>
            <form onSubmit={handleUpload} className="px-6 py-5 space-y-4">
              <div>
                <label className="text-[12px] font-bold text-zinc-700">File *</label>
                <input
                  type="file" required
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[12px] outline-none focus:border-red-500 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-[11px] file:font-bold file:text-zinc-700"
                />
                <p className="text-[10.5px] text-zinc-400 mt-1">Max 25MB. Only you can see this — it's never shown on the public QR page.</p>
              </div>
              <div>
                <label className="text-[12px] font-bold text-zinc-700">Link to equipment (optional)</label>
                <select
                  value={uploadAssetId} onChange={(e) => setUploadAssetId(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500"
                >
                  <option value="">No specific equipment</option>
                  {assets.map((a) => <option key={a.id} value={a.id}>{assetLabel(a)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[12px] font-bold text-zinc-700">Link to customer (optional)</label>
                <select
                  value={uploadCustomerId} onChange={(e) => setUploadCustomerId(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500"
                >
                  <option value="">No specific customer</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[12px] font-bold text-zinc-700">Notes (optional)</label>
                <textarea
                  rows={2} value={uploadNotes} onChange={(e) => setUploadNotes(e.target.value)}
                  placeholder="e.g. Invoice #4021, or warranty until 2027"
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500 resize-none"
                />
              </div>
              {uploadError && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">{uploadError}</div>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowUpload(false)} className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-[11px] rounded-xl text-[13px] hover:bg-zinc-50">Cancel</button>
                <button type="submit" disabled={uploading || !uploadFile} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 transition-all text-white font-bold py-[11px] rounded-xl text-[13px]">
                  {uploading ? "Uploading..." : "Upload"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
