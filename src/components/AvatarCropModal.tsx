"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { X, Check } from "lucide-react";

// Edited in place (not an "*Intl" duplicate) — its ONLY consumer is
// src/app/[locale]/dashboard/settings/page.tsx (the old un-migrated
// src/app/dashboard/settings/page.tsx it used to also serve has since been
// deleted, see the "Final cleanup" backlog task). See DashboardSidebarIntl.tsx
// for the general "*Intl" duplication rule; this was the
// "exactly-once-migrated-together" exception to it (same as Phase 1's
// MarketingLayout/LegalLayout) — safe because both the component edit and
// its sole consumer's migration shipped together, atomically.

const VIEWPORT = 260; // css px — square box the user drags/zooms inside
const OUTPUT = 512; // output image size in px, always square

type Offset = { x: number; y: number };

type Props = {
  imageSrc: string;
  onCancel: () => void;
  onSave: (file: File) => void | Promise<void>;
};

export default function AvatarCropModal({ imageSrc, onCancel, onSave }: Props) {
  const t = useTranslations("AvatarCropModal");
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const baseScale = natural.w && natural.h ? Math.max(VIEWPORT / natural.w, VIEWPORT / natural.h) : 1;
  const scale = baseScale * zoom;
  const dispW = natural.w * scale;
  const dispH = natural.h * scale;

  function clamp(o: Offset, w: number, h: number): Offset {
    const minX = Math.min(0, VIEWPORT - w);
    const minY = Math.min(0, VIEWPORT - h);
    return {
      x: Math.max(minX, Math.min(0, o.x)),
      y: Math.max(minY, Math.min(0, o.y)),
    };
  }

  function handleImgLoad() {
    const img = imgRef.current;
    if (!img) return;
    const w = img.naturalWidth, h = img.naturalHeight;
    setNatural({ w, h });
    const s = Math.max(VIEWPORT / w, VIEWPORT / h);
    setOffset({ x: (VIEWPORT - w * s) / 2, y: (VIEWPORT - h * s) / 2 });
  }

  function handleZoomChange(z: number) {
    setZoom(z);
    const s = baseScale * z;
    const w = natural.w * s, h = natural.h * s;
    setOffset((prev) => clamp(prev, w, h));
  }

  function handlePointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: offset.x, origY: offset.y };
  }
  function handlePointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset(clamp({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy }, dispW, dispH));
  }
  function handlePointerUp() {
    dragRef.current = null;
  }

  async function handleSave() {
    const img = imgRef.current;
    if (!img || !natural.w) return;
    setSaving(true);

    const srcSize = VIEWPORT / scale;
    const srcX = Math.max(0, Math.min(natural.w - srcSize, -offset.x / scale));
    const srcY = Math.max(0, Math.min(natural.h - srcSize, -offset.y / scale));

    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, OUTPUT, OUTPUT);

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92));
    if (!blob) { setSaving(false); return; }

    await onSave(new File([blob], "avatar.jpg", { type: "image/jpeg" }));
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[14px] font-black text-zinc-900">{t("title")}</h3>
          <button type="button" onClick={onCancel} disabled={saving} className="text-zinc-400 hover:text-zinc-700 disabled:opacity-40">
            <X size={18} />
          </button>
        </div>

        <div
          className="relative mx-auto overflow-hidden rounded-full bg-zinc-100 touch-none select-none cursor-grab active:cursor-grabbing"
          style={{ width: VIEWPORT, height: VIEWPORT }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={imageSrc}
            alt=""
            onLoad={handleImgLoad}
            draggable={false}
            style={{
              position: "absolute",
              left: offset.x,
              top: offset.y,
              width: dispW || undefined,
              height: dispH || undefined,
              maxWidth: "none",
            }}
          />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <span className="text-[11px] text-zinc-400 font-bold shrink-0">{t("zoom")}</span>
          <input
            type="range" min={1} max={3} step={0.01} value={zoom}
            onChange={(e) => handleZoomChange(Number(e.target.value))}
            className="flex-1 accent-red-600"
          />
        </div>
        <p className="text-[11px] text-zinc-400 mt-2">{t("hint")}</p>

        <div className="flex gap-2 mt-5">
          <button
            type="button" onClick={onCancel} disabled={saving}
            className="flex-1 border border-zinc-200 text-zinc-600 hover:bg-zinc-50 text-[13px] font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            {t("cancel")}
          </button>
          <button
            type="button" onClick={handleSave} disabled={saving}
            className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white text-[13px] font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {saving ? t("saving") : (<><Check size={14} /> {t("savePhoto")}</>)}
          </button>
        </div>
      </div>
    </div>
  );
}
