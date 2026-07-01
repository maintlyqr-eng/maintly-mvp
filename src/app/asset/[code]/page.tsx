"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ShieldCheck, Calendar, Gauge, Wrench, CheckCircle2, MapPin,
  Hash, Fuel, AlertCircle, ChevronDown, ChevronUp, UserCircle2
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const assetTypeImg: Record<string, string> = {
  automotive: "/images/pickup.png",
  motorcycle: "/images/moto.png",
  generator: "/images/generador.png",
  machinery: "/images/excavator.png",
  marine: "/images/barco.png",
  aviation: "/images/avion.png",
};

const typeColors: Record<string, { bg: string; text: string }> = {
  "Oil Change":    { bg: "bg-amber-100",  text: "text-amber-700" },
  Service:         { bg: "bg-blue-100",   text: "text-blue-700" },
  Repair:          { bg: "bg-red-100",    text: "text-red-700" },
  Inspection:      { bg: "bg-purple-100", text: "text-purple-700" },
  "Filter Change": { bg: "bg-green-100",  text: "text-green-700" },
  "Tire Change":   { bg: "bg-cyan-100",   text: "text-cyan-700" },
  "Brake Service": { bg: "bg-orange-100", text: "text-orange-700" },
};

type AssetData = {
  id: string;
  asset_type: string;
  brand: string | null;
  model: string | null;
  nickname: string | null;
  vin_serial: string | null;
  year: number | null;
  plate: string | null;
  fuel_type: string | null;
  location: string | null;
};

type MechanicInfo = { name: string };

type ServiceRecord = {
  id: string;
  service_date: string;
  service_type: string;
  km_hours: number | null;
  notes: string | null;
  created_at: string;
  mechanics: MechanicInfo | MechanicInfo[] | null;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default function AssetPublicPage() {
  const params = useParams();
  const code = params?.code as string;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [asset, setAsset] = useState<AssetData | null>(null);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!code) { setNotFound(true); setLoading(false); return; }

    async function load() {
      // 1. Find asset via QR code
      const { data: qrRow } = await supabase
        .from("qr_codes")
        .select("asset_id")
        .eq("code", code)
        .single();

      if (!qrRow?.asset_id) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // 2. Load asset data
      const { data: assetData } = await supabase
        .from("assets")
        .select("id, asset_type, brand, model, nickname, vin_serial, year, plate, fuel_type, location")
        .eq("id", qrRow.asset_id)
        .single();

      if (!assetData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setAsset(assetData as AssetData);

      // 3. Load service records
      const { data: serviceRows } = await supabase
        .from("service_records")
        .select("id, service_date, service_type, km_hours, notes, created_at, mechanics(name)")
        .eq("asset_id", qrRow.asset_id)
        .order("service_date", { ascending: false });

      setServices((serviceRows as ServiceRecord[]) ?? []);
      setLoading(false);
    }

    load();
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-zinc-400 text-[14px]">Loading maintenance history...</p>
      </div>
    );
  }

  if (notFound || !asset) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mb-4">
          <AlertCircle size={28} className="text-red-500" />
        </div>
        <h1 className="text-[20px] font-black text-zinc-900 mb-2">QR Code Not Found</h1>
        <p className="text-[14px] text-zinc-500 max-w-xs">This QR code doesn&apos;t match any asset in our system. It may have been removed or is invalid.</p>
        <div className="mt-8 flex items-center gap-0">
          <Image src="/images/qr-gear.png" alt="Maintly" width={64} height={64} className="object-contain mt-2" />
          <Image src="/images/Maintly.png" alt="Maintly" width={140} height={140} className="object-contain w-[140px] h-auto -ml-4 mt-2" />
        </div>
      </div>
    );
  }

  const assetName = asset.nickname || [asset.brand, asset.model].filter(Boolean).join(" ") || "Asset";
  const assetImg = assetTypeImg[asset.asset_type] ?? "/images/pickup.png";
  const color = typeColors;

  return (
    <div className="min-h-screen bg-zinc-50">

      {/* ── HEADER ── */}
      <div className="bg-white border-b border-zinc-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <a href="/" className="flex items-center gap-0">
          <Image src="/images/qr-gear.png" alt="Maintly" width={64} height={64} className="object-contain mt-2" />
          <Image src="/images/Maintly.png" alt="Maintly" width={140} height={140} className="object-contain w-[140px] h-auto -ml-4 mt-2" />
        </a>
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-medium">
          <ShieldCheck size={13} className="text-red-500" />
          Verified Record
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* ── ASSET CARD ── */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 px-5 py-5 flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0 overflow-hidden">
              <Image src={assetImg} alt={assetName} width={44} height={44} className="object-contain" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-zinc-400 tracking-[0.15em] uppercase mb-0.5">
                {asset.asset_type.charAt(0).toUpperCase() + asset.asset_type.slice(1)}
              </p>
              <h1 className="text-[20px] font-black text-white leading-tight truncate">{assetName}</h1>
              {asset.year && (
                <p className="text-[12px] text-zinc-400 mt-0.5">{asset.year}</p>
              )}
            </div>
          </div>

          <div className="px-5 py-4 grid grid-cols-2 gap-3">
            {asset.vin_serial && (
              <div className="flex items-start gap-2">
                <Hash size={13} className="text-zinc-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide">VIN / Serial</p>
                  <p className="text-[12px] font-mono text-zinc-700 font-semibold">{asset.vin_serial}</p>
                </div>
              </div>
            )}
            {asset.plate && (
              <div className="flex items-start gap-2">
                <Hash size={13} className="text-zinc-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide">Plate</p>
                  <p className="text-[12px] font-mono text-zinc-700 font-semibold">{asset.plate}</p>
                </div>
              </div>
            )}
            {asset.fuel_type && (
              <div className="flex items-start gap-2">
                <Fuel size={13} className="text-zinc-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide">Fuel</p>
                  <p className="text-[12px] text-zinc-700 font-semibold">{asset.fuel_type}</p>
                </div>
              </div>
            )}
            {asset.location && (
              <div className="flex items-start gap-2">
                <MapPin size={13} className="text-zinc-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide">Location</p>
                  <p className="text-[12px] text-zinc-700 font-semibold">{asset.location}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── STATS ── */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-3 text-center">
            <p className="text-[22px] font-black text-zinc-900">{services.length}</p>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide mt-0.5">Services</p>
          </div>
          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-3 text-center">
            <p className="text-[22px] font-black text-zinc-900">
              {services.length > 0
                ? new Date(services[services.length - 1].service_date + "T00:00:00").getFullYear()
                : "—"}
            </p>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide mt-0.5">Since</p>
          </div>
          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-3 text-center">
            <p className="text-[22px] font-black text-zinc-900">
              {services[0]?.km_hours != null
                ? services[0].km_hours.toLocaleString()
                : "—"}
            </p>
            <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wide mt-0.5">Last Km/Hrs</p>
          </div>
        </div>

        {/* ── SERVICE HISTORY ── */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
            <h2 className="text-[15px] font-black text-zinc-900">Maintenance History</h2>
            <span className="text-[11px] font-bold text-zinc-400">{services.length} records</span>
          </div>

          {services.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full border border-zinc-100 bg-zinc-50 mb-3">
                <Wrench size={20} className="text-zinc-300" />
              </div>
              <p className="text-[13px] text-zinc-400">No service records yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100">
              {services.map((svc, idx) => {
                const tc = color[svc.service_type] ?? { bg: "bg-zinc-100", text: "text-zinc-700" };
                const isExpanded = expandedId === svc.id;
                const isLatest = idx === 0;
                return (
                  <div key={svc.id} className="px-5 py-4">
                    <button
                      className="w-full text-left"
                      onClick={() => setExpandedId(isExpanded ? null : svc.id)}
                    >
                      <div className="flex items-center gap-3">
                        {/* Timeline dot */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isLatest ? "bg-red-600" : "bg-zinc-100"}`}>
                          {isLatest
                            ? <CheckCircle2 size={15} className="text-white" />
                            : <Wrench size={13} className="text-zinc-400" />
                          }
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[11px] font-bold px-2 py-[2px] rounded-full ${tc.bg} ${tc.text}`}>
                              {svc.service_type}
                            </span>
                            {isLatest && (
                              <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-[2px] rounded-full">Latest</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                              <Calendar size={11} /> {formatDate(svc.service_date)}
                            </span>
                            {svc.km_hours != null && (
                              <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                                <Gauge size={11} /> {svc.km_hours.toLocaleString()} km/hrs
                              </span>
                            )}
                          </div>
                          {(() => {
                            const mech = Array.isArray(svc.mechanics) ? svc.mechanics[0] : svc.mechanics;
                            return mech?.name ? (
                              <div className="flex items-center gap-1 mt-1">
                                <UserCircle2 size={11} className="text-zinc-400 shrink-0" />
                                <span className="text-[11px] text-zinc-400">{mech.name}</span>
                              </div>
                            ) : null;
                          })()}
                        </div>

                        <div className="text-zinc-300 shrink-0">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>
                    </button>

                    {isExpanded && svc.notes && (
                      <div className="mt-3 ml-11 bg-zinc-50 rounded-xl px-4 py-3 border border-zinc-100">
                        <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wide mb-1">Notes</p>
                        <p className="text-[13px] text-zinc-700 leading-relaxed">{svc.notes}</p>
                      </div>
                    )}
                    {isExpanded && !svc.notes && (
                      <div className="mt-3 ml-11">
                        <p className="text-[12px] text-zinc-400 italic">No notes for this service.</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm px-5 py-4 flex items-center gap-3">
          <ShieldCheck size={18} className="text-red-500 shrink-0" />
          <div>
            <p className="text-[12px] font-bold text-zinc-800">Verified by Maintly</p>
            <p className="text-[11px] text-zinc-400">This maintenance record is immutable and tamper-proof.</p>
          </div>
        </div>

        <p className="text-center text-[10px] text-zinc-400 pb-4">
          Powered by <span className="font-bold text-zinc-600">Maintly</span> · Maintenance. Tracked.
        </p>
      </div>
    </div>
  );
}
