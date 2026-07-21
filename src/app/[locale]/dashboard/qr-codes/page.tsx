"use client";

import { useEffect, useMemo, useRef, useState } from "react";
// Login is migrated and every router.push()/replace() call on this page
// targets it — safe to use next-intl's locale-aware router.
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  QrCode, Plus, X,
  Search, Download, Printer, Sparkles, ScanLine, Tag, Wrench,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { authedFetch } from "@/lib/apiAuth";
import { useUnreadMessagesCount } from "@/lib/useUnreadMessages";
import { useUnreadMechanicMessages } from "@/lib/useUnreadMechanicMessages";
import DashboardSidebarIntl from "@/components/DashboardSidebarIntl";
import DashboardHeaderIntl from "@/components/DashboardHeaderIntl";
import QrCodeCanvas, { type QrCodeCanvasHandle } from "@/components/QrCodeCanvas";
import QrThemePicker from "@/components/QrThemePicker";
import NewAssetModalIntl from "@/components/NewAssetModalIntl";
import { DEFAULT_QR_THEME } from "@/lib/qrThemes";
import { formatDateDMY } from "@/lib/date";

type QrAsset = { id: string; asset_type: string; brand: string | null; model: string | null; nickname: string | null };
type QrCodeRow = {
  code: string;
  theme: string;
  label: string | null;
  createdAt: string;
  asset: QrAsset | null;
  scanCount: number;
  lastScanned: string | null;
};

const BATCH_PRESETS = [6, 12, 24];

export default function QrCodesPage() {
  const t = useTranslations("DashboardQrCodesPage");
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

  const [codes, setCodes] = useState<QrCodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "assigned" | "unassigned">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pageMsg, setPageMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const canvasRefs = useRef<Record<string, QrCodeCanvasHandle | null>>({});

  // Generate blank codes modal
  const [showGenerate, setShowGenerate] = useState(false);
  const [genCount, setGenCount] = useState(12);
  const [genTheme, setGenTheme] = useState(DEFAULT_QR_THEME);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  // Personalize modal
  const [personalizeCode, setPersonalizeCode] = useState<QrCodeRow | null>(null);
  const [pTheme, setPTheme] = useState(DEFAULT_QR_THEME);
  const [pLabel, setPLabel] = useState("");
  const [personalizing, setPersonalizing] = useState(false);
  const [pError, setPError] = useState("");

  // Assign-to-new-equipment (for a blank code, from this page)
  const [assignCode, setAssignCode] = useState<string | null>(null);

  const [printCodes, setPrintCodes] = useState<string[] | null>(null);
  const [printSize, setPrintSize] = useState(180);
  const PRINT_SIZE_PRESETS: { label: string; value: number }[] = [
    { label: "S", value: 120 },
    { label: "M", value: 180 },
    { label: "L", value: 260 },
    { label: "XL", value: 340 },
  ];
  const PRINT_SIZE_MIN = 80;
  const PRINT_SIZE_MAX = 400;
  const [printSizeOverrides, setPrintSizeOverrides] = useState<Record<string, number>>({});

  function assetLabel(a: QrAsset) {
    return a.nickname || [a.brand, a.model].filter(Boolean).join(" ") || t("unnamedEquipment");
  }

  function sizeForPrint(code: string) {
    return printSizeOverrides[code] ?? printSize;
  }

  function nudgeCodeSize(code: string, delta: number) {
    setPrintSizeOverrides((prev) => {
      const current = prev[code] ?? printSize;
      const next = Math.min(PRINT_SIZE_MAX, Math.max(PRINT_SIZE_MIN, current + delta));
      return { ...prev, [code]: next };
    });
  }

  function applyGlobalPrintSize(value: number) {
    setPrintSize(value);
    setPrintSizeOverrides({});
  }

  async function loadCodes() {
    setLoading(true);
    setLoadError("");
    const res = await authedFetch("/api/qr-codes");
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoadError(json.error || t("errorLoad"));
      setLoading(false);
      return;
    }
    setCodes(json.codes ?? []);
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

      await loadCodes();
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return codes.filter((c) => {
      if (filter === "assigned" && !c.asset) return false;
      if (filter === "unassigned" && c.asset) return false;
      if (!q) return true;
      const haystack = [c.code, c.label, c.asset ? assetLabel(c.asset) : ""].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codes, search, filter]);

  const stats = useMemo(() => ({
    total: codes.length,
    assigned: codes.filter((c) => c.asset).length,
    unassigned: codes.filter((c) => !c.asset).length,
    scans: codes.reduce((sum, c) => sum + c.scanCount, 0),
  }), [codes]);

  function toggleSelect(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenError("");
    const res = await authedFetch("/api/qr-codes", {
      method: "POST",
      body: JSON.stringify({ action: "generate_blank", count: genCount, theme: genTheme }),
    });
    const json = await res.json().catch(() => ({}));
    setGenerating(false);
    if (!res.ok) { setGenError(json.error || t("errorGenerate")); return; }

    const newRows: QrCodeRow[] = (json.codes ?? []).map((c: any) => ({
      code: c.code, theme: c.theme, label: null, createdAt: c.created_at, asset: null, scanCount: 0, lastScanned: null,
    }));
    setCodes((prev) => [...newRows, ...prev]);
    setSelected(new Set(newRows.map((r) => r.code)));
    setShowGenerate(false);
    setPageMsg({
      text: t(newRows.length === 1 ? "generatedOne" : "generatedMany", { count: newRows.length }),
      ok: true,
    });
  }

  function openPersonalize(row: QrCodeRow) {
    setPersonalizeCode(row);
    setPTheme(row.theme || DEFAULT_QR_THEME);
    setPLabel(row.label || "");
    setPError("");
  }

  async function handleSavePersonalize() {
    if (!personalizeCode) return;
    setPersonalizing(true);
    setPError("");
    const res = await authedFetch("/api/qr-codes", {
      method: "POST",
      body: JSON.stringify({ action: "personalize", code: personalizeCode.code, theme: pTheme, label: pLabel.trim() || null }),
    });
    const json = await res.json().catch(() => ({}));
    setPersonalizing(false);
    if (!res.ok) { setPError(json.error || t("errorSaveChanges")); return; }

    setCodes((prev) => prev.map((c) => c.code === personalizeCode.code ? { ...c, theme: pTheme, label: pLabel.trim() || null } : c));
    setPersonalizeCode(null);
  }

  function handleDownload(row: QrCodeRow) {
    canvasRefs.current[row.code]?.download(row.label || row.code);
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-zinc-400 text-[13px]">{t("loadingAuth")}</p>
      </div>
    );
  }

  const printRows = printCodes ? codes.filter((c) => printCodes.includes(c.code)) : [];

  return (
    <div className="h-dvh bg-zinc-50 flex relative overflow-hidden">

      <DashboardSidebarIntl
        activeHref="/dashboard/qr-codes"
        sidebarOpen={sidebarOpen}
        onCloseSidebar={() => setSidebarOpen(false)}
        mechanicId={mechanicId}
        unreadMessages={unreadMessages}
        unreadMechanicMessages={unreadMechanicMessages}
        photoUrl={mechanicPhoto}
        name={mechanicName}
        email={mechanicEmail}
        className="no-print"
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
          className="no-print"
        />

        <div className="no-print flex-1 overflow-y-auto px-3 md:px-4 pt-1.5 md:pt-2 pb-3 md:pb-4">

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: t("statTotalCodes"), value: stats.total, color: "#18181b" },
              { label: t("statAssigned"), value: stats.assigned, color: "#16a34a" },
              { label: t("statUnassigned"), value: stats.unassigned, color: "#dc2626" },
              { label: t("statTotalScans"), value: stats.scans, color: "#2563eb" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-2xl border border-zinc-200 p-4">
                <p className="text-[10px] font-bold text-zinc-400 tracking-wide mb-1">{s.label}</p>
                <p className="text-[22px] font-black" style={{ color: s.color }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative min-w-[200px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("searchPlaceholder")}
                  className="w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 py-[9px] text-[12px] outline-none focus:border-red-400"
                />
              </div>
              <select
                value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-[9px] text-[12px] outline-none focus:border-red-400"
              >
                <option value="all">{t("filterAll")}</option>
                <option value="assigned">{t("filterAssigned")}</option>
                <option value="unassigned">{t("filterUnassigned")}</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              {selected.size > 0 && (
                <button
                  onClick={() => setPrintCodes(Array.from(selected))}
                  className="flex items-center gap-2 border border-zinc-200 hover:border-zinc-300 bg-white text-zinc-700 text-[13px] font-bold px-4 py-[10px] rounded-xl transition-all"
                >
                  <Printer size={15} /> {t("printSheetCount", { count: selected.size })}
                </button>
              )}
              <button
                onClick={() => { setGenError(""); setShowGenerate(true); }}
                className="flex items-center gap-2 bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all text-white text-[13px] font-bold px-4 py-[10px] rounded-xl shadow-sm"
              >
                <Plus size={15} /> {t("generateBlankCodes")}
              </button>
            </div>
          </div>

          {pageMsg && (
            <div className={`mb-4 rounded-xl border px-3.5 py-2.5 text-[12px] ${pageMsg.ok ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}>
              {pageMsg.text}
            </div>
          )}
          {loadError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-[12px] text-red-700">{loadError}</div>
          )}

          {/* Grid */}
          {loading ? (
            <p className="text-[13px] text-zinc-400 text-center py-12">{t("loadingCodes")}</p>
          ) : filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-zinc-200 text-center py-16">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-red-100 bg-red-50 mb-3">
                <QrCode size={20} className="text-red-500" />
              </div>
              <p className="text-[13px] text-zinc-400 mb-3">
                {codes.length === 0 ? t("noCodesYet") : t("noCodesMatch")}
              </p>
              {codes.length === 0 && (
                <button onClick={() => setShowGenerate(true)} className="text-[12px] font-bold text-red-600 hover:text-red-700">
                  {t("generateFirstBatch")}
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map((row) => (
                <div key={row.code} className="bg-white rounded-2xl border border-zinc-200 p-4 flex flex-col items-center text-center relative">
                  <input
                    type="checkbox"
                    checked={selected.has(row.code)}
                    onChange={() => toggleSelect(row.code)}
                    className="absolute top-3 left-3 w-4 h-4 accent-red-600"
                  />
                  <div className="mt-2 mb-2">
                    <QrCodeCanvas ref={(el) => { canvasRefs.current[row.code] = el; }} code={row.code} theme={row.theme} size={110} />
                  </div>
                  <p className="text-[12px] font-mono font-bold text-zinc-800">{row.code}</p>
                  {row.label && <p className="text-[11px] text-zinc-500 mt-0.5">{row.label}</p>}

                  <div className="mt-2">
                    {row.asset ? (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        <Wrench size={10} /> {assetLabel(row.asset)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-zinc-500 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-full">
                        {t("unassignedReadyToPrint")}
                      </span>
                    )}
                  </div>

                  <p className="text-[10.5px] text-zinc-400 mt-2 flex items-center gap-1">
                    <ScanLine size={11} /> {t(row.scanCount === 1 ? "scanCountOne" : "scanCountMany", { count: row.scanCount })}
                    {row.lastScanned && ` · ${t("lastScanned", { date: formatDateDMY(row.lastScanned) })}`}
                  </p>

                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-100 w-full justify-center flex-wrap">
                    <button onClick={() => openPersonalize(row)} className="flex items-center gap-1 text-[11px] font-bold text-zinc-600 hover:text-red-600 transition-colors" title={t("personalize")}>
                      <Sparkles size={12} /> {t("personalize")}
                    </button>
                    <button onClick={() => handleDownload(row)} className="flex items-center gap-1 text-[11px] font-bold text-zinc-600 hover:text-red-600 transition-colors" title={t("downloadPng")}>
                      <Download size={12} /> {t("download")}
                    </button>
                    <button onClick={() => setPrintCodes([row.code])} className="flex items-center gap-1 text-[11px] font-bold text-zinc-600 hover:text-red-600 transition-colors" title={t("printJustThisCode")}>
                      <Printer size={12} /> {t("print")}
                    </button>
                    {!row.asset && (
                      <button onClick={() => setAssignCode(row.code)} className="flex items-center gap-1 text-[11px] font-bold text-zinc-600 hover:text-red-600 transition-colors" title={t("assignToNewAsset")}>
                        <Tag size={12} /> {t("assign")}
                      </button>
                    )}
                  </div>
                  {row.asset && (
                    <p className="text-[9.5px] text-zinc-300 mt-1.5">{t("stickerLostHint")}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <p className="text-center text-[11px] text-zinc-400 mt-8">{t("copyright")}</p>
        </div>
      </div>

      {/* ════ GENERATE BLANK CODES MODAL ════ */}
      {showGenerate && (
        <div className="no-print fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4" onClick={() => setShowGenerate(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
              <h2 className="text-[16px] font-black text-zinc-900">{t("generateModalTitle")}</h2>
              <button onClick={() => setShowGenerate(false)} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
            </div>
            <div className="px-6 py-5">
              <label className="text-[12px] font-bold text-zinc-700">{t("howMany")}</label>
              <div className="flex items-center gap-2 mt-1.5 mb-4 flex-wrap">
                {BATCH_PRESETS.map((n) => (
                  <button
                    key={n} type="button" onClick={() => setGenCount(n)}
                    className={`px-4 py-2 rounded-xl text-[13px] font-bold border-2 transition-all ${genCount === n ? "border-red-500 bg-red-50 text-red-600" : "border-zinc-200 text-zinc-600 hover:border-zinc-300"}`}
                  >
                    {n}
                  </button>
                ))}
                <input
                  type="number" min={1} max={60} value={genCount}
                  onChange={(e) => setGenCount(Math.min(60, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-20 rounded-xl border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-red-500"
                />
              </div>

              <label className="text-[12px] font-bold text-zinc-700 mb-1.5 block">{t("defaultLookHint")}</label>
              <QrThemePicker value={genTheme} onChange={setGenTheme} />

              {genError && <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">{genError}</div>}

              <div className="flex gap-3 pt-5">
                <button type="button" onClick={() => setShowGenerate(false)} className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-[11px] rounded-xl text-[13px] hover:bg-zinc-50">{t("cancel")}</button>
                <button type="button" disabled={generating} onClick={handleGenerate} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 transition-all text-white font-bold py-[11px] rounded-xl text-[13px]">
                  {generating ? t("generating") : t(genCount === 1 ? "generateCountOne" : "generateCountMany", { count: genCount })}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════ PERSONALIZE MODAL ════ */}
      {personalizeCode && (
        <div className="no-print fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4" onClick={() => setPersonalizeCode(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
              <h2 className="text-[16px] font-black text-zinc-900">{t("personalizeModalTitle")}</h2>
              <button onClick={() => setPersonalizeCode(null)} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
            </div>
            <div className="px-6 py-5">
              <div className="flex justify-center mb-4">
                <QrCodeCanvas code={personalizeCode.code} theme={pTheme} size={140} />
              </div>

              <label className="text-[12px] font-bold text-zinc-700">{t("labelOptional")}</label>
              <input
                value={pLabel} onChange={(e) => setPLabel(e.target.value)}
                placeholder={t("labelPlaceholder")}
                className="w-full mt-1 mb-4 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500"
              />

              <label className="text-[12px] font-bold text-zinc-700 mb-1.5 block">{t("look")}</label>
              <QrThemePicker value={pTheme} onChange={setPTheme} previewCode={personalizeCode.code} />

              {pError && <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">{pError}</div>}

              <div className="flex gap-3 pt-5">
                <button type="button" onClick={() => setPersonalizeCode(null)} className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-[11px] rounded-xl text-[13px] hover:bg-zinc-50">{t("cancel")}</button>
                <button type="button" disabled={personalizing} onClick={handleSavePersonalize} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 transition-all text-white font-bold py-[11px] rounded-xl text-[13px]">
                  {personalizing ? t("saving") : t("save")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════ ASSIGN TO NEW EQUIPMENT ════ */}
      <NewAssetModalIntl
        open={!!assignCode}
        onClose={() => setAssignCode(null)}
        mechanicId={mechanicId}
        existingCode={assignCode || undefined}
        onCreated={() => { setAssignCode(null); loadCodes(); }}
      />

      {/* ════ PRINT SHEET ════ */}
      {printCodes && (
        <div id="qr-print-sheet" className="fixed inset-0 z-50 bg-white overflow-y-auto">
          <div className="no-print sticky top-0 bg-white z-10 border-b border-zinc-200">
            <div className="flex items-center justify-between px-6 py-4">
              <h2 className="text-[16px] font-black text-zinc-900">{t("printSheetTitle", { count: printRows.length })}</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => window.print()} className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-[13px] font-bold px-4 py-2 rounded-xl">
                  <Printer size={14} /> {t("print")}
                </button>
                <button onClick={() => setPrintCodes(null)} className="text-zinc-400 hover:text-zinc-700 px-2"><X size={20} /></button>
              </div>
            </div>
            <div className="flex items-center gap-3 px-6 pb-2 flex-wrap">
              <span className="text-[11px] font-bold text-zinc-500">{t("sizeAll")}</span>
              {PRINT_SIZE_PRESETS.map((p) => (
                <button
                  key={p.label} type="button" onClick={() => applyGlobalPrintSize(p.value)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold border-2 transition-all ${printSize === p.value ? "border-red-500 bg-red-50 text-red-600" : "border-zinc-200 text-zinc-600 hover:border-zinc-300"}`}
                >
                  {p.label}
                </button>
              ))}
              <input
                type="range" min={PRINT_SIZE_MIN} max={PRINT_SIZE_MAX} step={10} value={printSize}
                onChange={(e) => applyGlobalPrintSize(Number(e.target.value))}
                className="w-40 accent-red-600"
              />
              <span className="text-[11px] text-zinc-400 tabular-nums">{printSize}px</span>
            </div>
            <p className="px-6 pb-3 text-[10.5px] text-zinc-400">
              {t("perCodeSizeHint")}
            </p>
          </div>
          <div className="p-8 flex flex-wrap justify-center gap-8 max-w-4xl mx-auto">
            {printRows.map((row) => {
              const codeSize = sizeForPrint(row.code);
              const isOverridden = printSizeOverrides[row.code] !== undefined;
              return (
                <div key={row.code} style={{ width: Math.max(codeSize + 50, 130) }} className="flex flex-col items-center text-center gap-1.5 break-inside-avoid">
                  <QrCodeCanvas code={row.code} theme={row.theme} size={codeSize} />
                  <p className="text-[11px] font-mono font-bold text-zinc-800">{row.code}</p>
                  {row.label && <p className="text-[10px] text-zinc-500">{row.label}</p>}
                  <div className="no-print flex items-center gap-1.5 mt-0.5">
                    <button
                      type="button" onClick={() => nudgeCodeSize(row.code, -20)}
                      className="w-5 h-5 flex items-center justify-center rounded border border-zinc-200 text-zinc-500 hover:border-red-300 hover:text-red-600 text-[12px] font-bold leading-none"
                      title={t("smaller")}
                    >
                      −
                    </button>
                    <span className={`text-[10px] tabular-nums ${isOverridden ? "text-red-600 font-bold" : "text-zinc-400"}`}>{codeSize}px</span>
                    <button
                      type="button" onClick={() => nudgeCodeSize(row.code, 20)}
                      className="w-5 h-5 flex items-center justify-center rounded border border-zinc-200 text-zinc-500 hover:border-red-300 hover:text-red-600 text-[12px] font-bold leading-none"
                      title={t("bigger")}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #qr-print-sheet, #qr-print-sheet * { visibility: visible; }
          #qr-print-sheet {
            position: absolute;
            top: 0;
            left: 0;
            right: auto;
            bottom: auto;
            width: 100%;
            height: auto;
            overflow: visible;
          }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
