"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutGrid, FileText, Box, QrCode, Users, BarChart3, Calendar as CalendarIcon,
  Mail, FolderOpen, Settings as SettingsIcon, Bell, X, LogOut, Crown, Menu,
  ShieldCheck, Wrench, CalendarDays, KeyRound, AlertCircle, CheckCircle2, Camera,
  Image as ImageIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useUnreadMessagesCount } from "@/lib/useUnreadMessages";
import { formatDateDMY } from "@/lib/date";
import AvatarCropModal from "@/components/AvatarCropModal";
import HoverAvatar from "@/components/HoverAvatar";
import ContactSupportWidget from "@/components/ContactSupportWidget";

const navItems = [
  { icon: LayoutGrid, label: "Dashboard", href: "/dashboard" },
  { icon: FileText, label: "My Services", href: "/dashboard/services" },
  { icon: Bell, label: "Scheduled Services", href: "/dashboard/scheduled" },
  { icon: Box, label: "Assets", href: "/dashboard/assets" },
  { icon: QrCode, label: "QR Codes", href: "/dashboard/assets" },
  { icon: Users, label: "Customers", href: "#" },
  { icon: BarChart3, label: "Reports", href: "/dashboard/reports" },
  { icon: CalendarIcon, label: "Calendar", href: "/dashboard/calendar" },
  { icon: Mail, label: "Messages", href: "/dashboard/messages" },
  { icon: FolderOpen, label: "Document Library", href: "#" },
  { icon: SettingsIcon, label: "Settings", href: "/dashboard/settings" },
];

export default function SettingsPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mechanicId, setMechanicId] = useState("");
  const unreadMessages = useUnreadMessagesCount(mechanicId);
  const [email, setEmail] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [isMechanic, setIsMechanic] = useState(false);
  const [verified, setVerified] = useState(false);

  // Profile form
  const [name, setName] = useState("");
  const [workshopName, setWorkshopName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Profile photo
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [showSourceMenu, setShowSourceMenu] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password form
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    let active = true;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/login"); return; }
      if (!active) return;

      setMechanicId(session.user.id);
      setEmail(session.user.email ?? "");

      const { data: mechanic } = await supabase
        .from("mechanics")
        .select("name, workshop_name, created_at, is_mechanic, verified, photo_url")
        .eq("id", session.user.id)
        .single();

      if (active && mechanic) {
        setName(mechanic.name ?? "");
        setWorkshopName(mechanic.workshop_name ?? "");
        setCreatedAt(mechanic.created_at ?? "");
        setIsMechanic(!!mechanic.is_mechanic);
        setVerified(!!mechanic.verified);
        setPhotoUrl(mechanic.photo_url ?? "");
      }

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

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again later
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setCropImageSrc(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function uploadPhoto(file: File) {
    if (!mechanicId) return;

    setPhotoMsg(null);
    setPhotoUploading(true);

    const path = `${mechanicId}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("mechanic-photos")
      .upload(path, file, { upsert: true, contentType: "image/jpeg" });

    if (uploadError) {
      setPhotoUploading(false);
      setPhotoMsg({ text: uploadError.message, ok: false });
      return;
    }

    const { data } = supabase.storage.from("mechanic-photos").getPublicUrl(path);
    const publicUrl = `${data.publicUrl}?v=${Date.now()}`; // bust CDN/browser cache after upsert

    const { data: updated, error: dbError } = await supabase
      .from("mechanics")
      .update({ photo_url: publicUrl })
      .eq("id", mechanicId)
      .select("id");

    setPhotoUploading(false);

    if (dbError || !updated || updated.length === 0) {
      setPhotoMsg({ text: dbError?.message || "Uploaded, but couldn't save it to your profile.", ok: false });
      return;
    }

    setPhotoUrl(publicUrl);
    setPhotoMsg({ text: "Profile photo updated.", ok: true });
  }

  async function handleCropSave(file: File) {
    await uploadPhoto(file);
    setCropImageSrc(null);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg(null);

    if (!name.trim()) {
      setProfileMsg({ text: "Name can't be empty.", ok: false });
      return;
    }

    setProfileSaving(true);
    const { data, error } = await supabase
      .from("mechanics")
      .update({ name: name.trim(), workshop_name: workshopName.trim() || null })
      .eq("id", mechanicId)
      .select("id");
    setProfileSaving(false);

    if (error) { setProfileMsg({ text: error.message, ok: false }); return; }
    if (!data || data.length === 0) { setProfileMsg({ text: "Couldn't save — please try again.", ok: false }); return; }

    setProfileMsg({ text: "Profile updated.", ok: true });
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword.length < 6) {
      setPasswordMsg({ text: "Password must be at least 6 characters.", ok: false });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: "Passwords do not match.", ok: false });
      return;
    }

    setPasswordSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPasswordSaving(false);

    if (error) { setPasswordMsg({ text: error.message, ok: false }); return; }

    setNewPassword("");
    setConfirmPassword("");
    setPasswordMsg({ text: "Password updated.", ok: true });
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <p className="text-zinc-400 text-[13px]">Loading...</p>
      </div>
    );
  }

  const initials = name.split(" ").filter(Boolean).map(p => p[0]).join("").slice(0, 2).toUpperCase() || "ME";

  return (
    <div className="min-h-screen bg-zinc-50 flex relative">

      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-black/40 z-30" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ════ SIDEBAR ════ */}
      <aside className={`fixed md:static inset-y-0 left-0 z-40 w-[230px] bg-white border-r border-zinc-200 flex flex-col shrink-0 transform transition-transform duration-200 md:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-4 py-2">
          <Link href="/" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/qr-gear.png" alt="Maintly" style={{width: 72, height: 72, objectFit: "contain"}} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/Maintly.png" alt="" style={{width: 152, objectFit: "contain", marginLeft: -18}} />
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-zinc-400 hover:text-zinc-700 mr-2">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 -mt-4 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-[9px] rounded-lg mb-1 text-[13px] font-medium transition-colors ${
                item.label === "Settings"
                  ? "bg-red-50 text-red-600 border-l-[3px] border-red-600 -ml-[1px]"
                  : "text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              <item.icon size={16} />
              {item.label}
              {item.label === "Messages" && unreadMessages > 0 && (
                <span className="ml-auto bg-red-600 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">{unreadMessages}</span>
              )}
            </Link>
          ))}
        </nav>

        <div className="border-t border-zinc-100 py-2">
          <ContactSupportWidget mechanicId={mechanicId} />
        </div>

        <div className="mx-3 mb-3 p-4 rounded-xl bg-gradient-to-br from-zinc-50 to-zinc-100 border border-zinc-200">
          <div className="flex items-center gap-1.5 text-amber-500 mb-1">
            <Crown size={14} />
            <span className="text-[12px] font-bold text-zinc-800">Go Premium</span>
          </div>
          <p className="text-[10px] text-zinc-500 leading-relaxed mb-3">Unlock advanced reports, custom branding and more.</p>
          <button className="w-full bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] font-bold py-2 rounded-lg transition-colors">Upgrade Now</button>
        </div>

        <div className="flex items-center gap-2.5 px-4 py-3 border-t border-zinc-200">
          {photoUrl ? (
            <HoverAvatar src={photoUrl} size={32} className="shrink-0" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-[12px] shrink-0">{initials}</div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-zinc-800 leading-tight truncate">{name || email}</p>
            <p className="text-[10px] text-zinc-400 leading-tight">Maintly Mechanic</p>
          </div>
        </div>
      </aside>

      {/* ════ MAIN ════ */}
      <div className="flex-1 flex flex-col min-w-0">

        <header className="flex items-center justify-between gap-3 px-4 md:px-7 py-4 bg-white border-b border-zinc-200">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden shrink-0 text-zinc-600 hover:text-zinc-900">
              <Menu size={22} />
            </button>
            <div className="min-w-0">
              <h1 className="text-[17px] md:text-[20px] font-black text-zinc-900 truncate">Settings</h1>
              <p className="hidden sm:block text-[12px] text-zinc-400 truncate">Manage your account and profile.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <button className="relative text-zinc-500 hover:text-zinc-800 transition-colors"><Bell size={19} /></button>
            <div className="flex items-center gap-3 md:pl-3 md:border-l border-zinc-200">
              <div className="flex items-center gap-2.5">
                {photoUrl ? (
                  <HoverAvatar src={photoUrl} size={36} className="shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-[13px] shrink-0">{initials}</div>
                )}
                <div className="hidden sm:block text-left">
                  <p className="text-[12px] font-bold text-zinc-800 leading-tight">{name || email}</p>
                  <p className="text-[10px] text-zinc-400 leading-tight">Mechanic</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-zinc-500 hover:text-red-600 hover:bg-red-50 border border-zinc-200 hover:border-red-200 px-3 py-2 rounded-xl transition-all"
              >
                <LogOut size={13} />
                <span className="hidden md:inline">Log out</span>
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-7 max-w-2xl">

          {/* ── ACCOUNT STATUS ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-zinc-50 flex items-center justify-center shrink-0"><CalendarDays size={16} className="text-zinc-500" /></div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Member since</p>
                <p className="text-[13px] font-bold text-zinc-800">{createdAt ? formatDateDMY(createdAt) : "—"}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isMechanic ? "bg-blue-50" : "bg-zinc-50"}`}>
                <Wrench size={16} className={isMechanic ? "text-blue-500" : "text-zinc-400"} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Mechanic</p>
                <p className="text-[13px] font-bold text-zinc-800">{isMechanic ? "Active" : "Not activated"}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-zinc-200 p-4 shadow-sm flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${verified ? "bg-emerald-50" : "bg-zinc-50"}`}>
                <ShieldCheck size={16} className={verified ? "text-emerald-500" : "text-zinc-400"} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Verification</p>
                <p className="text-[13px] font-bold text-zinc-800">{verified ? "Verified Mechanic" : isMechanic ? "Community Mechanic" : "—"}</p>
              </div>
            </div>
          </div>

          {/* ── PROFILE ── */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 mb-6">
            <h2 className="text-[14px] font-black text-zinc-900 mb-1">Profile</h2>
            <p className="text-[12px] text-zinc-400 mb-5">This is what customers see when you log a service on their asset.</p>

            <div className="flex items-center gap-4 mb-6">
              <div className="relative shrink-0">
                {photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoUrl} alt="" className="w-16 h-16 rounded-full object-cover border border-zinc-200" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-[20px]">{initials}</div>
                )}
                <button
                  type="button"
                  onClick={() => setShowSourceMenu(true)}
                  disabled={photoUploading}
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-zinc-900 hover:bg-zinc-800 flex items-center justify-center cursor-pointer border-2 border-white transition-colors disabled:opacity-50"
                  title="Change photo"
                >
                  <Camera size={12} className="text-white" />
                </button>

                {showSourceMenu && (
                  <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setShowSourceMenu(false)} />
                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-[61] bg-white rounded-xl border border-zinc-200 shadow-lg py-1.5 w-48">
                      <button
                        type="button"
                        onClick={() => { setShowSourceMenu(false); cameraInputRef.current?.click(); }}
                        className="w-full text-left px-3 py-2 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
                      >
                        <Camera size={13} /> Take a photo
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowSourceMenu(false); fileInputRef.current?.click(); }}
                        className="w-full text-left px-3 py-2 text-[12px] font-semibold text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
                      >
                        <ImageIcon size={13} /> Choose from files
                      </button>
                    </div>
                  </>
                )}

                <input
                  ref={cameraInputRef} type="file" accept="image/*" capture="user" className="hidden"
                  onChange={handleFileSelected}
                />
                <input
                  ref={fileInputRef} type="file" accept="image/*" className="hidden"
                  onChange={handleFileSelected}
                />
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setShowSourceMenu(true)}
                  disabled={photoUploading}
                  className="inline-block text-[12px] font-bold text-zinc-700 hover:text-red-600 cursor-pointer transition-colors disabled:opacity-50"
                >
                  {photoUploading ? "Uploading…" : "Change profile photo"}
                </button>
                <p className="text-[11px] text-zinc-400 mt-0.5">JPG or PNG, shown to customers on your services.</p>
                {photoMsg && (
                  <p className={`text-[11px] font-semibold mt-1 ${photoMsg.ok ? "text-emerald-600" : "text-red-600"}`}>{photoMsg.text}</p>
                )}
              </div>
            </div>

            {cropImageSrc && (
              <AvatarCropModal
                imageSrc={cropImageSrc}
                onCancel={() => setCropImageSrc(null)}
                onSave={handleCropSave}
              />
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="text-[12px] font-bold text-zinc-700">Full name</label>
                <input
                  value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="text-[12px] font-bold text-zinc-700">Workshop name <span className="text-zinc-300 font-normal">(optional)</span></label>
                <input
                  value={workshopName} onChange={(e) => setWorkshopName(e.target.value)} placeholder="e.g. Ledesma Motors"
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="text-[12px] font-bold text-zinc-700">Email</label>
                <input
                  value={email} disabled
                  className="w-full mt-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-[10px] text-[13px] text-zinc-400 outline-none cursor-not-allowed"
                />
                <p className="text-[11px] text-zinc-400 mt-1">To change the email on your account, contact support@maintlyqr.com.</p>
              </div>

              {profileMsg && (
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] ${profileMsg.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
                  {profileMsg.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                  {profileMsg.text}
                </div>
              )}

              <button type="submit" disabled={profileSaving}
                className="bg-red-600 hover:bg-red-500 disabled:opacity-60 transition-all text-white font-bold py-[11px] px-6 rounded-xl text-[13px]">
                {profileSaving ? "Saving..." : "Save changes"}
              </button>
            </form>
          </div>

          {/* ── PASSWORD ── */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 mb-6">
            <h2 className="text-[14px] font-black text-zinc-900 mb-1 flex items-center gap-2"><KeyRound size={15} className="text-zinc-400" /> Password</h2>
            <p className="text-[12px] text-zinc-400 mb-5">Choose a new password for your account.</p>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="text-[12px] font-bold text-zinc-700">New password</label>
                <input
                  type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 6 characters"
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="text-[12px] font-bold text-zinc-700">Confirm new password</label>
                <input
                  type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full mt-1 rounded-xl border border-zinc-200 px-3 py-[10px] text-[13px] outline-none focus:border-red-500"
                />
              </div>

              {passwordMsg && (
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] ${passwordMsg.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
                  {passwordMsg.ok ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                  {passwordMsg.text}
                </div>
              )}

              <button type="submit" disabled={passwordSaving}
                className="bg-zinc-900 hover:bg-zinc-800 disabled:opacity-60 transition-all text-white font-bold py-[11px] px-6 rounded-xl text-[13px]">
                {passwordSaving ? "Updating..." : "Update password"}
              </button>
            </form>
          </div>

          <p className="text-center text-[11px] text-zinc-400 mt-8">© 2026 Maintly. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
