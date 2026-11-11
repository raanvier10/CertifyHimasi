"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Award,
  Upload,
  Users,
  BarChart3,
  ExternalLink,
  LogOut,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/events", label: "Acara & Template", icon: Award },
  { href: "/admin/import", label: "Upload Peserta", icon: Upload },
  { href: "/admin/participants", label: "Data Peserta", icon: Users },
  { href: "/admin/history", label: "Riwayat Unduhan", icon: BarChart3 },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("SignOut exception:", e);
    }
    router.push("/");
  };

  return (
    <aside className="w-64 bg-brand-navy text-white flex flex-col min-h-screen border-r border-slate-800 shrink-0">
      {/* Brand Header */}
      <div className="p-6 border-b border-slate-800/80 flex items-center gap-3">
        <img
          src="/assets/LogoHima.svg"
          alt="HIMASI Logo"
          className="h-9 w-auto brightness-0 invert"
        />
        <div>
          <h2 className="font-extrabold text-base tracking-tight text-white leading-tight">
            CertifyNow
          </h2>
          <span className="text-xs text-amber-400 font-semibold uppercase tracking-wider">
            Panel Admin HIMASI
          </span>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm font-semibold"
                  : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-slate-400"}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Nav / Logout */}
      <div className="p-4 border-t border-slate-800/80 space-y-1">
        <Link
          href="/"
          className="flex items-center gap-3 px-3.5 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800/60 hover:text-white transition-colors"
        >
          <ExternalLink className="w-4 h-4 text-slate-400" />
          <span>Lihat Portal Publik</span>
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3.5 py-2 rounded-lg text-sm text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition-colors text-left"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  );
}

