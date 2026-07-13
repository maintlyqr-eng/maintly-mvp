import {
  LayoutGrid, FileText, Bell, Box, QrCode, Users, BarChart3,
  Calendar as CalendarIcon, Mail, MessageCircle, FolderOpen, Settings as SettingsIcon,
} from "lucide-react";

// Single source of truth for the dashboard sidebar's nav items — previously
// this exact array (icon, label, href) was hand-copy-pasted at the top of
// all 12 dashboard pages, which is exactly why it could drift (one page
// missing an item another had, badges wired up inconsistently). Any future
// change to the nav — add a page, rename a label, reorder — now happens
// once, here, instead of in 12 files by hand.
//
// i18n note: `key` was added alongside `label` (not replacing it) so the
// not-yet-migrated sidebar (src/components/DashboardSidebar.tsx, still
// English-only, still consumed by not-yet-migrated dashboard pages) keeps
// working off `label` completely unchanged, while the new localized sidebar
// (src/components/DashboardSidebarIntl.tsx) looks up the translated label
// via `key` against the "DashboardNav" message namespace instead. Once every
// dashboard page + admin is migrated, the old sidebar and the `label` field
// can both be retired (see MAINTLYQR_FEATURE_BACKLOG.md cleanup step).
export const navItems = [
  { key: "dashboard", icon: LayoutGrid, label: "Dashboard", href: "/dashboard" },
  { key: "myServices", icon: FileText, label: "My Services", href: "/dashboard/services" },
  { key: "scheduledServices", icon: Bell, label: "Scheduled Services", href: "/dashboard/scheduled" },
  { key: "assets", icon: Box, label: "Assets", href: "/dashboard/assets" },
  { key: "qrCodes", icon: QrCode, label: "QR Codes", href: "/dashboard/qr-codes" },
  { key: "customers", icon: Users, label: "Customers", href: "/dashboard/customers" },
  { key: "reports", icon: BarChart3, label: "Reports", href: "/dashboard/reports" },
  { key: "calendar", icon: CalendarIcon, label: "Calendar", href: "/dashboard/calendar" },
  { key: "messages", icon: Mail, label: "Messages", href: "/dashboard/messages" },
  { key: "teamChat", icon: MessageCircle, label: "Team Chat", href: "/dashboard/team-chat" },
  { key: "documentLibrary", icon: FolderOpen, label: "Document Library", href: "/dashboard/documents" },
  { key: "settings", icon: SettingsIcon, label: "Settings", href: "/dashboard/settings" },
];
