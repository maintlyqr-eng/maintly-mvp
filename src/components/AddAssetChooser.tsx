"use client";

import { Plus, QrCode } from "lucide-react";

// The first step of "Add Equipment": pick between registering a brand new
// asset or linking one that already exists (e.g. another Maintler's, or one
// bought secondhand with a sticker already on it). Shared by the dashboard
// and the Assets page so both offer the exact same two options — previously
// the Assets page skipped straight to "new" with no way to link an existing
// one, and the dashboard's own copy of this choice led to a broken "new"
// form.
export default function AddAssetChooser({
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
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
          <h3 className="text-[16px] font-black text-zinc-900">Add Equipment</h3>
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
              <p className="text-[14px] font-black text-zinc-900">New Equipment</p>
              <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">Register a new machine and generate a unique QR code</p>
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
              <p className="text-[14px] font-black text-zinc-900">Existing Equipment</p>
              <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">Scan or enter a QR code to link an asset to your workshop</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
