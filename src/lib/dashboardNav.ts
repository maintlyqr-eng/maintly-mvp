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
export const navItems = [
  { icon: LayoutGrid, label: "Dashboard", href: "/dashboard" },
  { icon: FileText, label: "My Services", href: "/dashboard/services" },
  { icon: Bell, label: "Scheduled Services", href: "/dashboard/scheduled" },
  { icon: Box, label: "Assets", href: "/dashboard/assets" },
  { icon: QrCode, label: "QR Codes", href: "/dashboard/qr-codes" },
  { icon: Users, label: "Customers", href: "/dashboard/customers" },
  { icon: BarChart3, label: "Reports", href: "/dashboard/reports" },
  { icon: CalendarIcon, label: "Calendar", href: "/dashboard/calendar" },
  { icon: Mail, label: "Messages", href: "/dashboard/messages" },
  { icon: MessageCircle, label: "Team Chat", href: "/dashboard/team-chat" },
  { icon: FolderOpen, label: "Document Library", href: "/dashboard/documents" },
  { icon: SettingsIcon, label: "Settings", href: "/dashboard/settings" },
];
