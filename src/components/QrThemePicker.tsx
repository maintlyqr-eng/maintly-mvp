"use client";

import { qrThemes, QR_THEME_CATEGORIES } from "@/lib/qrThemes";
import QrCodeCanvas from "@/components/QrCodeCanvas";

// A visual theme gallery, grouped by category, used both when generating a
// batch of blank codes (pick a default look) and when personalizing one
// existing code. Renders a small live swatch per theme instead of just a
// name — "Bloom" vs "Sunburst" vs "Classic" is much easier to judge by eye.
export default function QrThemePicker({
  value,
  onChange,
  previewCode = "maintlyqr01",
}: {
  value: string;
  onChange: (themeId: string) => void;
  previewCode?: string;
}) {
  return (
    <div className="space-y-4">
      {QR_THEME_CATEGORIES.map((cat) => (
        <div key={cat.id}>
          <p className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide mb-2">{cat.label}</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {qrThemes.filter((t) => t.category === cat.id).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onChange(t.id)}
                title={t.description}
                className={`flex flex-col items-center justify-center gap-1.5 p-2 h-[112px] rounded-xl border-2 transition-all ${
                  value === t.id ? "border-red-500 bg-red-50" : "border-zinc-200 hover:border-zinc-300"
                }`}
              >
                <QrCodeCanvas code={previewCode} theme={t.id} size={44} />
                <span className="text-[10px] font-bold text-zinc-700 text-center leading-tight">{t.name}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
