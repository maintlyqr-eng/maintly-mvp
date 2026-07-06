"use client";

import Image from "next/image";
import { useState } from "react";
import {
  ShieldCheck, Wrench, Calendar, Plus, Download, User,
  Eye, Globe, Tag, Grid3x3, Zap, MapPin, Clock,
  ChevronDown, Filter, Gauge, LayoutDashboard, ChevronRight
} from "lucide-react";

// ── DATOS DE EJEMPLO ──
const asset = {
  category: "PICKUP TRUCK",
  name: "FORD RANGER XLT",
  description: "4x4 Diesel Crew Cab Pickup",
  status: "ACTIVE",
  serial: "1FTFW1ET5BFA00001",
  assetId: "FORD-RANGER-01",
  plate: "AB 712 CD",
  location: "Buenos Aires, Argentina",
  firstScan: "24 May 2025 · 09:41 am",
  image: "/images/car.png",
  scanId: "MTLY-QR-8F3A7C",
  overview: [
    { icon: Tag, label: "MANUFACTURER", value: "Ford" },
    { icon: Grid3x3, label: "MODEL", value: "Ranger XLT" },
    { icon: Zap, label: "FUEL TYPE", value: "Diesel" },
    { icon: Calendar, label: "YEAR", value: "2021" },
    { icon: MapPin, label: "PLATE", value: "AB 712 CD" },
  ],
  nextService: { date: "11 AUG 2026", type: "OIL CHANGE", daysLeft: 78, currentKm: 42500, targetKm: 45000, maxKm: 50000 },
  mechanics: [
    { name: "Diego Ramírez", role: "TecniMotor Workshop", services: 12, avatarColor: "#dc2626" },
    { name: "Laura Pinto", role: "AutoCheck Pro", services: 4, avatarColor: "#1d4ed8" },
  ],
};

const serviceHistory = [
  {
    id: 1, date: "12", month: "MAY", year: "2026", time: "09:10 am",
    type: "SERVICE", typeColor: "text-red-600",
    title: "Oil Change & Filter Replacement",
    desc: "Used full synthetic 5W-30. Replaced oil filter and air filter. General inspection completed.",
    tags: ["Oil Changed", "Filters Replaced", "Inspection"],
    mechanic: "Diego Ramírez", role: "TecniMotor Workshop",
    km: "42,500 km", current: true,
  },
  {
    id: 2, date: "03", month: "FEB", year: "2026", time: "11:32 am",
    type: "REPAIR", typeColor: "text-orange-600",
    title: "Brake Pads Replacement (Front)",
    desc: "Front pads worn to 2mm. Replaced with OEM pads. Brake fluid checked and topped up.",
    tags: ["Brake Pads", "Fluid Check"],
    mechanic: "Diego Ramírez", role: "TecniMotor Workshop",
    km: "40,200 km", current: false,
  },
  {
    id: 3, date: "18", month: "OCT", year: "2025", time: "08:45 am",
    type: "INSPECTION", typeColor: "text-blue-600",
    title: "General Inspection",
    desc: "All systems checked. Suspension and steering in good condition. No issues found.",
    tags: ["Inspection", "Suspension", "Steering"],
    mechanic: "Laura Pinto", role: "AutoCheck Pro",
    km: "37,800 km", current: false,
  },
  {
    id: 4, date: "22", month: "JUN", year: "2025", time: "02:15 pm",
    type: "SERVICE", typeColor: "text-red-600",
    title: "Tire Rotation",
    desc: "Rotated all 4 tires. Tread depth measured and recorded on all wheels.",
    tags: ["Tire Rotation", "Tread Check"],
    mechanic: "Diego Ramírez", role: "TecniMotor Workshop",
    km: "33,400 km", current: false,
  },
];

const tabs = ["History", "Asset Details", "Documents", "Ownership"];

export default function AssetPage() {
  const [activeTab, setActiveTab] = useState("History");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showWorkshopModal, setShowWorkshopModal] = useState(false);

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900">

      {/* ════ TOP BAR ════ */}
      <header className="bg-white border-b border-zinc-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Image src="/images/qr-gear-real.png" alt="Maintly" width={32} height={32} className="object-contain" />
            <div>
              <span className="text-[16px] font-black tracking-tight leading-none">
                <span className="text-zinc-900">MAIN</span><span className="text-red-600">TLY</span>
              </span>
              <p className="text-[6.5px] tracking-[0.15em] text-zinc-400 font-semibold leading-none mt-[1px]">MAINTENANCE. TRACKED.</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 pl-6 border-l border-zinc-200">
            <Globe size={14} className="text-red-500" />
            <div>
              <p className="text-[11px] font-bold text-zinc-800 leading-tight">PUBLIC ASSET RECORD</p>
              <p className="text-[9px] text-zinc-400 leading-tight">Anyone can view. Only verified mechanics can add services.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 border border-zinc-200 hover:bg-zinc-50 transition-colors text-zinc-700 text-[12px] font-semibold px-3 py-2 rounded-lg">
            <Download size={13} /> Export PDF
          </button>
          <button
            onClick={() => setShowWorkshopModal(true)}
            className="flex items-center gap-2 border border-red-200 bg-red-50 hover:bg-red-100 active:scale-[0.98] transition-all text-red-600 text-[12px] font-bold px-3 py-2 rounded-lg"
          >
            <LayoutDashboard size={13} /> Add to My Workshop
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all text-white text-[12px] font-bold px-4 py-2 rounded-lg shadow-sm"
          >
            <Plus size={14} /> Add Service
          </button>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 py-6">

        {/* ════ HERO ROW: imagen + datos + QR ════ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">

          {/* Imagen + info principal */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5 flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-[280px] h-[200px] bg-zinc-50 rounded-xl flex items-center justify-center shrink-0">
              <Image src={asset.image} alt={asset.name} width={240} height={180} className="object-contain" />
            </div>

            <div className="flex-1">
              <p className="text-[11px] font-bold text-red-600 tracking-wider">{asset.category}</p>
              <h1 className="text-[30px] font-black text-zinc-900 leading-tight mt-1">{asset.name}</h1>
              <span className="inline-flex items-center gap-1 bg-green-50 border border-green-200 text-green-700 text-[10px] font-bold px-2 py-[3px] rounded-full mt-2">
                <span className="w-[6px] h-[6px] rounded-full bg-green-500" /> {asset.status}
              </span>
              <p className="text-[13px] text-zinc-500 mt-2">{asset.description}</p>

              <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-4">
                <div className="flex items-center gap-2">
                  <Tag size={13} className="text-zinc-400 shrink-0" />
                  <div>
                    <p className="text-[9px] text-zinc-400 font-semibold uppercase">Serial Number</p>
                    <p className="text-[12px] text-zinc-800 font-mono font-medium">{asset.serial}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Grid3x3 size={13} className="text-zinc-400 shrink-0" />
                  <div>
                    <p className="text-[9px] text-zinc-400 font-semibold uppercase">Asset ID</p>
                    <p className="text-[12px] text-zinc-800 font-medium">{asset.assetId}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={13} className="text-zinc-400 shrink-0" />
                  <div>
                    <p className="text-[9px] text-zinc-400 font-semibold uppercase">Location</p>
                    <p className="text-[12px] text-zinc-800 font-medium">{asset.location}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={13} className="text-zinc-400 shrink-0" />
                  <div>
                    <p className="text-[9px] text-zinc-400 font-semibold uppercase">First Scan</p>
                    <p className="text-[12px] text-zinc-800 font-medium">{asset.firstScan}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* QR Card */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5 flex flex-col items-center">
            <div className="flex items-center gap-2 self-start">
              <ShieldCheck size={16} className="text-green-600" />
              <span className="text-[12px] font-bold text-green-700">VERIFIED ASSET</span>
            </div>
            <p className="text-[10px] text-zinc-400 self-start mt-1 leading-relaxed">This QR code is linked to a verified asset record.</p>

            <div className="mt-4 p-3 border-2 border-red-200 rounded-xl">
              <Image src="/images/qr-gear-real.png" alt="QR Code" width={140} height={140} className="object-contain" />
            </div>
            <p className="text-[9px] text-zinc-400 mt-3 font-mono">SCAN ID: {asset.scanId}</p>
          </div>
        </div>

        {/* ════ TABS + MAIN GRID ════ */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 mt-4">

          {/* COLUMNA IZQUIERDA: Tabs + Timeline */}
          <div>
            {/* Tabs */}
            <div className="flex items-center gap-6 border-b border-zinc-200 px-1">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`text-[13px] font-semibold pb-3 border-b-2 transition-colors ${
                    activeTab === tab ? "border-red-600 text-red-600" : "border-transparent text-zinc-500 hover:text-zinc-700"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Service History */}
            {activeTab === "History" && (
              <div className="bg-white rounded-b-2xl rounded-tr-2xl border border-t-0 border-zinc-200 shadow-sm p-5">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-[16px] font-black text-zinc-900">Service History</h2>
                  <button className="flex items-center gap-2 border border-zinc-200 hover:bg-zinc-50 transition-colors text-zinc-600 text-[11px] font-semibold px-3 py-[6px] rounded-lg">
                    <Filter size={12} /> All Services <ChevronDown size={12} />
                  </button>
                </div>
                <p className="text-[12px] text-zinc-400 mb-5">Complete maintenance and service records in chronological order.</p>

                {/* Timeline */}
                <div className="relative pl-[72px]">
                  <div className="absolute left-[60px] top-2 bottom-2 w-[2px] bg-zinc-200" />

                  {serviceHistory.map((s) => (
                    <div key={s.id} className="relative mb-6 last:mb-0">
                      {/* Fecha */}
                      <div className="absolute left-[-72px] top-0 w-[56px] text-right">
                        <p className="text-[20px] font-black text-zinc-900 leading-none">{s.date}</p>
                        <p className="text-[10px] font-bold text-zinc-500 tracking-wide">{s.month}</p>
                        <p className="text-[9px] text-zinc-400">{s.year}</p>
                      </div>

                      {/* Punto */}
                      <div className={`absolute left-[-44px] top-[6px] w-[14px] h-[14px] rounded-full border-[3px] border-white shadow-sm ${s.current ? "bg-red-600" : "bg-zinc-300"}`} />

                      <div className="bg-zinc-50 rounded-xl border border-zinc-200 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[9px] text-zinc-400">{s.time}</p>
                            <p className={`text-[9px] font-bold tracking-wide ${s.typeColor}`}>{s.type}</p>
                            <h3 className="text-[14px] font-bold text-zinc-900 mt-[2px]">{s.title}</h3>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[9px] text-zinc-400">ODOMETER</p>
                            <p className="text-[12px] font-bold text-zinc-700">{s.km}</p>
                          </div>
                        </div>

                        <p className="text-[12px] text-zinc-600 mt-2 leading-relaxed">{s.desc}</p>

                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {s.tags.map((tag) => (
                            <span key={tag} className="bg-white border border-zinc-200 text-zinc-600 text-[10px] px-2 py-[3px] rounded-full">{tag}</span>
                          ))}
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-200">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-zinc-200 flex items-center justify-center text-[9px] font-bold text-zinc-600">
                              {s.mechanic.split(" ").map(n=>n[0]).join("")}
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold text-zinc-700 leading-tight">{s.mechanic}</p>
                              <p className="text-[10px] text-zinc-400 leading-tight">{s.role}</p>
                            </div>
                          </div>
                          <button className="w-7 h-7 rounded-full border border-zinc-200 hover:bg-white flex items-center justify-center text-zinc-400 transition-colors">
                            <Eye size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button className="w-full mt-2 py-3 border border-zinc-200 rounded-xl text-[12px] font-semibold text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-2">
                  Load More History <ChevronDown size={14} />
                </button>
              </div>
            )}

            {activeTab !== "History" && (
              <div className="bg-white rounded-b-2xl rounded-tr-2xl border border-t-0 border-zinc-200 shadow-sm p-10 text-center text-zinc-400 text-[13px]">
                {activeTab} section coming soon.
              </div>
            )}
          </div>

          {/* COLUMNA DERECHA: Overview + Next Service + Mechanics */}
          <div className="space-y-4">

            {/* Asset Overview */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5">
              <h3 className="text-[12px] font-black text-zinc-900 tracking-wide mb-3">ASSET OVERVIEW</h3>
              <div className="space-y-2.5">
                {asset.overview.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center justify-between pb-2.5 border-b border-zinc-100 last:border-0 last:pb-0">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Icon size={13} />
                      <span className="text-[10px] font-semibold uppercase">{label}</span>
                    </div>
                    <span className="text-[12px] font-semibold text-zinc-800">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Next Service Due */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={14} className="text-red-500" />
                <h3 className="text-[12px] font-black text-zinc-900 tracking-wide">NEXT SERVICE DUE</h3>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[18px] font-black text-zinc-900">{asset.nextService.date}</p>
                <span className="bg-red-50 text-red-600 text-[9px] font-bold px-2 py-[3px] rounded-full">{asset.nextService.type}</span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-1">In {asset.nextService.daysLeft} days · Estimated at {asset.nextService.targetKm.toLocaleString()} km</p>

              <div className="mt-3">
                <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-600 rounded-full"
                    style={{ width: `${(asset.nextService.currentKm / asset.nextService.maxKm) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-zinc-400 mt-1">
                  <span>{asset.nextService.currentKm.toLocaleString()} km</span>
                  <span>{asset.nextService.targetKm.toLocaleString()} km</span>
                  <span>{asset.nextService.maxKm.toLocaleString()} km</span>
                </div>
              </div>
            </div>

            {/* Verified Mechanics */}
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5">
              <h3 className="text-[12px] font-black text-zinc-900 tracking-wide mb-3">VERIFIED MECHANICS</h3>
              <div className="space-y-3">
                {asset.mechanics.map((m) => (
                  <div key={m.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                        style={{ background: m.avatarColor }}
                      >
                        {m.name.split(" ").map(n=>n[0]).join("")}
                      </div>
                      <div>
                        <p className="text-[12px] font-semibold text-zinc-800 leading-tight">{m.name}</p>
                        <p className="text-[10px] text-zinc-400 leading-tight">{m.role}</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-zinc-500">{m.services} Services</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-zinc-100 text-zinc-400">
                <ShieldCheck size={12} />
                <span className="text-[10px]">All services are verified and time-stamped.</span>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ════ MODAL: ADD SERVICE ════ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-5 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-black text-zinc-900">Add Service Record</h3>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-zinc-700 text-[20px]">×</button>
            </div>
            <div className="space-y-3">
              <input type="text" placeholder="Service title (e.g. Oil Change)" className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-red-500" />
              <div className="grid grid-cols-2 gap-3">
                <input type="date" className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-red-500" />
                <input type="text" placeholder="Odometer (km)" className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-red-500" />
              </div>
              <textarea placeholder="Describe what was done..." rows={3} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-[13px] outline-none focus:border-red-500 resize-none" />
              <button className="w-full bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all text-white font-bold py-3 rounded-lg text-[13px] shadow-sm">
                Save Service Record
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ MODAL: ADD TO MY WORKSHOP ════ */}
      {showWorkshopModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">

            {/* Header oscuro */}
            <div className="bg-zinc-900 px-6 py-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center shrink-0">
                    <LayoutDashboard size={18} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-black text-white">Add to My Workshop</h3>
                    <p className="text-[11px] text-zinc-400 truncate max-w-[220px]">{asset.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowWorkshopModal(false)}
                  className="text-zinc-500 hover:text-zinc-300 text-[24px] leading-none transition-colors"
                >×</button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6">
              <p className="text-[13px] text-zinc-500 text-center mb-6">
                Log in or create a free account to track this asset and add service records.
              </p>

              <div className="space-y-3">
                {/* Login option */}
                <a
                  href="/login"
                  className="flex items-center gap-4 p-4 border-2 border-red-100 bg-red-50 hover:bg-red-100 rounded-xl transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center shrink-0">
                    <User size={16} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-zinc-900">Log in to my account</p>
                    <p className="text-[11px] text-zinc-500">Already a Maintly mechanic? Log in and track this asset.</p>
                  </div>
                  <ChevronRight size={16} className="text-zinc-400 group-hover:text-red-600 shrink-0 transition-colors" />
                </a>

                {/* Register option */}
                <a
                  href="/register"
                  className="flex items-center gap-4 p-4 border border-zinc-200 hover:bg-zinc-50 rounded-xl transition-colors group"
                >
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 group-hover:bg-zinc-200 flex items-center justify-center shrink-0 transition-colors">
                    <Plus size={16} className="text-zinc-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-zinc-900">Create a free account</p>
                    <p className="text-[11px] text-zinc-500">Register as a Maintly mechanic — free, takes 30 seconds.</p>
                  </div>
                  <ChevronRight size={16} className="text-zinc-400 group-hover:text-zinc-700 shrink-0 transition-colors" />
                </a>
              </div>

              <div className="mt-5 pt-4 border-t border-zinc-100 text-center">
                <p className="text-[10px] text-zinc-400">
                  Asset QR ID: <span className="font-mono font-semibold text-zinc-600">{asset.scanId}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
