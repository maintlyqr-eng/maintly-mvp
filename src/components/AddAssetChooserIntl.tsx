"use client";

import { useTranslations } from "next-intl";
import { Plus, QrCode } from "lucide-react";

// Localized twin of AddAssetChooser.tsx — see DashboardSidebarIntl.tsx for
// why these "*Intl" components exist as separate files during the i18n
// rollout instead of being edited in place. This component is shared by the
// dashboard home page AND the Assets page; it can only become the single
// source of truth (replacing the original) once BOTH consumers are migrated
// to [locale] routes.
export default function AddAssetChooserIntl({
  open,
  onClose,
  onChooseNew,
  onChooseExisting,
}: {
  open: boolean;
  onClose: () => void;
  onChooseNew: () => void;
  onChooseExisting: () => void;
}) {
  const t = useTranslations("AddAssetChooser");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
          <h3 className="text-[16px] font-black text-zinc-900">{t("title")}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-[22px] leading-none transition-colors">×</button>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={onChooseNew}
            className="flex flex-col items-center gap-3 p-5 border-2 border-zinc-200 hover:border-red-300 hover:bg-red-50 rounded-2xl transition-all text-center group"
          >
            <div className="w-14 h-14 rounded-2xl bg-red-50 group-hover:bg-red-100 flex items-center justify-center transition-colors">
              <Plus size={26} className="text-red-600" />
            </div>
            <div>
              <p className="text-[14px] font-black text-zinc-900">{t("newTitle")}</p>
              <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{t("newDesc")}</p>
            </div>
          </button>

          <button
            onClick={onChooseExisting}
            className="flex flex-col items-center gap-3 p-5 border-2 border-zinc-200 hover:border-blue-300 hover:bg-blue-50 rounded-2xl transition-all text-center group"
          >
            <div className="w-14 h-14 rounded-2xl bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
              <QrCode size={26} className="text-blue-600" />
            </div>
            <div>
              <p className="text-[14px] font-black text-zinc-900">{t("existingTitle")}</p>
              <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">{t("existingDesc")}</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
