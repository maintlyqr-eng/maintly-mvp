"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { X, GitMerge, CheckCircle2, AlertTriangle, ArrowLeftRight, Wrench, QrCode } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { assetTypeImg } from "@/lib/assetTypes";

// Fusión de historiales (21/10/2026). Planteo de Facu: el mismo auto puede
// terminar con dos QR -- uno cargado a mano sin VIN, otro cargado por VIN
// en un taller -- y cuando el dueño del primero le escanea el VIN, la app
// tiene que ofrecer combinar los dos historiales en uno. Este modal se abre
// desde el aviso "Ya hay un equipo cargado con este VIN" del form de
// edición (dashboard/assets/page.tsx).
//
// La fusión en sí la hace la función SQL merge_assets (migración 046) en
// una sola transacción: mueve servicios, QR, tareas, documentos, mensajes
// y vínculos al activo principal, completa los campos vacíos del principal
// con los del duplicado, manda el duplicado a la Papelera con merged_into,
// deja registro en asset_merges (reversible desde el panel Admin) y avisa
// por mensaje in-app a los otros mecánicos vinculados.
//
// Regla fija, deliberadamente simple: "el principal gana, lo vacío se
// completa". Por defecto el principal es el activo que YA tenía el VIN
// guardado (suele ser el más completo); un botón permite invertirlo.

type Side = {
  id: string;
  name: string;
  assetType: string;
  qrCode: string | null;
};

type SideDetails = {
  brand: string | null;
  model: string | null;
  year: number | null;
  createdAt: string | null;
  vinSerial: string | null;
  services: number;
  qrCodes: number;
};

export default function MergeAssetsModal({
  open,
  onClose,
  vin,
  mine,
  other,
  onMerged,
}: {
  open: boolean;
  onClose: () => void;
  vin: string;
  /** El activo que la persona está editando (todavía sin este VIN guardado). */
  mine: Side | null;
  /** El activo que ya tiene este VIN (encontrado por findAssetByVin). */
  other: Side | null;
  onMerged: (primaryId: string) => void;
}) {
  const t = useTranslations("MergeAssetsModal");
  const [details, setDetails] = useState<Record<string, SideDetails>>({});
  const [loading, setLoading] = useState(false);
  // true = "other" es el principal (default); false = "mine" es el principal.
  const [otherIsPrimary, setOtherIsPrimary] = useState(true);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);

  const mineId = mine?.id ?? null;
  const otherId = other?.id ?? null;

  useEffect(() => {
    if (!open || !mineId || !otherId) return;
    setOtherIsPrimary(true);
    setMerging(false);
    setError("");
    setDone(null);
    setLoading(true);

    (async () => {
      const ids = [mineId, otherId];
      const [assetsRes, svcRes, qrRes] = await Promise.all([
        supabase.from("assets").select("id, brand, model, year, created_at, vin_serial").in("id", ids),
        supabase.from("service_records").select("asset_id").in("asset_id", ids).is("deleted_at", null),
        supabase.from("qr_codes").select("asset_id").in("asset_id", ids),
      ]);
      const next: Record<string, SideDetails> = {};
      for (const id of ids) {
        const a = (assetsRes.data ?? []).find((r) => r.id === id);
        next[id] = {
          brand: (a?.brand as string | null) ?? null,
          model: (a?.model as string | null) ?? null,
          year: (a?.year as number | null) ?? null,
          createdAt: (a?.created_at as string | null) ?? null,
          vinSerial: (a?.vin_serial as string | null) ?? null,
          services: (svcRes.data ?? []).filter((r) => r.asset_id === id).length,
          qrCodes: (qrRes.data ?? []).filter((r) => r.asset_id === id).length,
        };
      }
      setDetails(next);
      setLoading(false);
    })();
    // Depende de los ids, no de los objetos: la página los arma inline en
    // cada render y con los objetos como deps esto recargaría en loop.
  }, [open, mineId, otherId]);

  if (!open || !mine || !other) return null;

  const primary = otherIsPrimary ? other : mine;
  const duplicate = otherIsPrimary ? mine : other;

  async function handleMerge() {
    if (!primary || !duplicate) return;
    setMerging(true);
    setError("");
    const { error: rpcError } = await supabase.rpc("merge_assets", {
      p_primary: primary.id,
      p_duplicate: duplicate.id,
      p_vin: vin,
    });
    setMerging(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setDone(primary.id);
  }

  function renderSide(side: Side, role: "primary" | "duplicate") {
    const d = details[side.id];
    const isPrimary = role === "primary";
    return (
      <div className={`flex-1 rounded-xl border p-3 ${isPrimary ? "border-red-300 bg-red-50/40" : "border-zinc-200 bg-zinc-50"}`}>
        <div className={`text-[10px] font-black uppercase tracking-wide mb-2 ${isPrimary ? "text-red-600" : "text-zinc-400"}`}>
          {isPrimary ? t("primaryLabel") : t("duplicateLabel")}
        </div>
        <div className="flex items-center gap-2 mb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={assetTypeImg[side.assetType] ?? "/images/car.png"} alt="" className="w-9 h-9 object-contain shrink-0" />
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-zinc-900 truncate">{side.name}</div>
            <div className="text-[11px] text-zinc-500 truncate">
              {d ? [d.brand, d.model, d.year].filter(Boolean).join(" ") || "—" : "…"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-zinc-600">
          <span className="inline-flex items-center gap-1"><Wrench size={11} /> {d ? d.services : "…"} {t("servicesShort")}</span>
          <span className="inline-flex items-center gap-1"><QrCode size={11} /> {d ? d.qrCodes : "…"} QR</span>
        </div>
        {d?.createdAt && (
          <div className="text-[10px] text-zinc-400 mt-1">{t("createdOn", { date: new Date(d.createdAt).toLocaleDateString() })}</div>
        )}
        {/* Caso Cachirula (Facu, 21/10/2026): el duplicado tenía un valor
            cualquiera en el campo VIN. Se avisa que ese valor se reemplaza
            por el VIN de la fusión (queda en el snapshot para deshacer). */}
        {!isPrimary && d?.vinSerial && d.vinSerial.replace(/[^A-Za-z0-9]/g, "").toUpperCase() !== vin && (
          <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 mt-1.5">
            {t("oldVinReplaced", { oldVin: d.vinSerial })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-zinc-900/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
          <h3 className="text-[16px] font-black text-zinc-900 inline-flex items-center gap-2"><GitMerge size={18} className="text-red-600" /> {t("title")}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
        </div>

        {done ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-green-600" />
            </div>
            <h4 className="text-[18px] font-black text-zinc-900 mb-1">{t("doneTitle")}</h4>
            <p className="text-[13px] text-zinc-500 mb-6">{t("doneDesc")}</p>
            <button onClick={() => onMerged(done)} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl text-[13px] transition-colors">
              {t("doneButton")}
            </button>
          </div>
        ) : (
          <div className="p-6">
            <p className="text-[13px] text-zinc-600 mb-4">
              {t.rich("intro", { vin, b: (chunks) => <span className="font-mono font-bold text-zinc-900">{chunks}</span> })}
            </p>

            <div className="flex items-stretch gap-2 mb-2">
              {renderSide(primary, "primary")}
              {renderSide(duplicate, "duplicate")}
            </div>
            <button
              type="button"
              onClick={() => setOtherIsPrimary((v) => !v)}
              disabled={loading || merging}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-zinc-500 hover:text-red-600 mb-4 transition-colors disabled:opacity-50"
            >
              <ArrowLeftRight size={12} /> {t("swap")}
            </button>

            <ul className="text-[12px] text-zinc-600 space-y-1.5 mb-4 list-disc pl-5">
              <li>{t("bullet1")}</li>
              <li>{t("bullet2")}</li>
              <li>{t("bullet3")}</li>
              <li>{t("bullet4")}</li>
            </ul>

            <div className="flex items-start gap-1.5 mb-4 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-800 leading-snug">{t("notice")}</p>
            </div>

            {error && (
              <p className="text-[12px] text-red-600 mb-3">{t("errorPrefix")} {error}</p>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={onClose} disabled={merging} className="flex-1 border border-zinc-200 text-zinc-700 font-bold py-[11px] rounded-xl text-[13px] hover:bg-zinc-50 disabled:opacity-60">
                {t("cancel")}
              </button>
              <button type="button" onClick={handleMerge} disabled={loading || merging} className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-bold py-[11px] rounded-xl text-[13px] transition-colors inline-flex items-center justify-center gap-1.5">
                <GitMerge size={14} /> {merging ? t("merging") : t("confirm")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
