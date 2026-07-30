"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { X, MessageCircle, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

// "Hablemos" — botón de contacto genérico en el Home (Incremento 26, Facu:
// "cuando entro al home no veo como a simple vista la posibilidad de
// contactar a alguien de maintlyqr... quiero un boton simple q me lleve a
// consultar q onda esto"). A diferencia de ContactSupportWidgetIntl (chat
// en tiempo real, requiere mechanicId — solo para Maintlers ya logueados),
// este es para cualquier visitante anónimo (una empresa o taller que recién
// está mirando la página): deja un mensaje + su contacto, y el equipo de
// MaintlyQR lo contacta desde afuera, no al revés.
//
// Reutiliza content_reports (migración 032) con report_type:"general_inquiry"
// en vez de crear una tabla nueva -- esa tabla ya existía justo para esto
// ("consulta general", sin asset/mechanic asociado) y el admin ya tiene una
// sección de Reports que filtra por tipo, así que estos mensajes ya
// aparecen ahí sin tocar nada del panel. Mismo patrón de inserción anónima
// que ReportIssueModalIntl: la RLS de content_reports permite INSERT a
// cualquiera pero ningún SELECT con la anon key, así que insertar
// directamente desde acá (sin pasar por una ruta /api) es seguro.
//
// A diferencia de ReportIssueModal, acá el contacto NO es opcional -- todo
// el sentido de este formulario es que el equipo de soporte pueda
// responderle a la persona, así que sin un email o teléfono el mensaje no
// sirve de nada.
export default function ContactUsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("ContactUsModal");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMessage("");
    setName("");
    setContact("");
    setError("");
    setSent(false);
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    if (!contact.trim()) {
      setError(t("errorContactRequired"));
      return;
    }
    if (!message.trim()) {
      setError(t("errorMessageRequired"));
      return;
    }

    setSending(true);
    setError("");
    const { error: insertError } = await supabase.from("content_reports").insert({
      report_type: "general_inquiry",
      reporter_name: name.trim() || null,
      reporter_contact: contact.trim(),
      message: message.trim(),
    });
    setSending(false);

    if (insertError) {
      setError(t("errorSaving"));
      return;
    }
    setSent(true);
  }

  return (
    <div className="fixed inset-0 z-[60] bg-zinc-900/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
          <h3 className="text-[16px] font-black text-zinc-900 flex items-center gap-2">
            <MessageCircle size={16} className="text-red-500" /> {t("title")}
          </h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
        </div>

        {sent ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-green-600" />
            </div>
            <h4 className="text-[18px] font-black text-zinc-900 mb-1">{t("successTitle")}</h4>
            <p className="text-[13px] text-zinc-500 mb-6">{t("successDesc")}</p>
            <button onClick={onClose} className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-3 rounded-xl text-[13px] transition-colors">
              {t("done")}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <p className="text-[13px] text-zinc-500">{t("intro")}</p>

            <div>
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">{t("nameLabel")}</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
                className="w-full bg-zinc-50 border border-zinc-200 focus:border-red-400 focus:bg-white rounded-xl px-4 py-3 text-[14px] text-zinc-900 placeholder-zinc-400 outline-none transition-all"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">{t("contactLabel")}</label>
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder={t("contactPlaceholder")}
                className="w-full bg-zinc-50 border border-zinc-200 focus:border-red-400 focus:bg-white rounded-xl px-4 py-3 text-[14px] text-zinc-900 placeholder-zinc-400 outline-none transition-all"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 block">{t("messageLabel")}</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder={t("messagePlaceholder")}
                className="w-full bg-zinc-50 border border-zinc-200 focus:border-red-400 focus:bg-white rounded-xl px-4 py-3 text-[14px] text-zinc-900 placeholder-zinc-400 outline-none transition-all resize-none"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                <AlertCircle size={14} className="text-red-500 shrink-0" />
                <p className="text-[12px] text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={sending}
              className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white font-black py-3.5 rounded-2xl text-[14px] transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-2"
            >
              {sending
                ? <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> {t("sendingButton")}</>
                : <><Send size={15} /> {t("submitButton")}</>
              }
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
