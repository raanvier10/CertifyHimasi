"use client";

import React, { useState, useEffect } from "react";
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
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/events", label: "Acara & Template", icon: Award },
  { href: "/admin/import", label: "Upload Peserta", icon: Upload },
  { href: "/admin/participants", label: "Data Peserta", icon: Users },
  { href: "/admin/history", label: "Riwayat Unduhan", icon: BarChart3 },
];

interface AdminSidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export default function AdminSidebar({
  isCollapsed: controlledCollapsed,
  onToggle: controlledOnToggle,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [internalCollapsed, setInternalCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("certifynow_sidebar_collapsed");
      if (saved !== null) {
        setInternalCollapsed(saved === "true");
      }
    } catch {
      // LocalStorage fallback
    }
  }, []);

  const isCollapsed =
    controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const handleToggle = () => {
    if (controlledOnToggle) {
      controlledOnToggle();
    } else {
      setInternalCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem("certifynow_sidebar_collapsed", String(next));
        } catch {}
        return next;
      });
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("SignOut exception:", e);
    }
    router.push("/");
  };

  return (
    <aside
      className={`h-screen sticky top-0 bg-brand-navy text-white flex flex-col border-r border-slate-800 shrink-0 z-30 transition-all duration-300 ease-in-out select-none ${
        isCollapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Brand Header */}
      <div
        className={`border-b border-slate-800/80 flex items-center transition-all duration-300 ${
          isCollapsed
            ? "flex-col p-4 gap-3 justify-center text-center"
            : "p-5 justify-between"
        }`}
      >
        <div className={`flex items-center gap-3 min-w-0 ${isCollapsed ? "justify-center" : ""}`}>
          <img
            src="/assets/LogoHima.svg"
            alt="HIMASI Logo"
            className="h-9 w-auto brightness-0 invert shrink-0"
          />
          {!isCollapsed && (
            <div className="min-w-0 overflow-hidden animate-in fade-in duration-200">
              <h2 className="font-extrabold text-base tracking-tight text-white leading-tight truncate">
                CertifyNow
              </h2>
              <span className="text-[11px] text-amber-400 font-semibold uppercase tracking-wider block truncate">
                Panel Admin HIMASI
              </span>
            </div>
          )}
        </div>

        {/* Toggle Collapse/Expand Button */}
        <button
          onClick={handleToggle}
          title={isCollapsed ? "Buka Sidebar" : "Tutup Sidebar"}
          className={`p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 ${
            isCollapsed ? "mt-1 w-full flex justify-center bg-slate-800/40" : ""
          }`}
          aria-label={isCollapsed ? "Buka Sidebar" : "Tutup Sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 text-amber-400" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-slate-400" />
          )}
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto overflow-x-hidden">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? item.label : undefined}
              className={`flex items-center rounded-xl text-sm font-medium transition-all group ${
                isCollapsed
                  ? "justify-center p-3"
                  : "gap-3 px-3.5 py-2.5"
              } ${
                isActive
                  ? "bg-blue-600 text-white shadow-md font-semibold"
                  : "text-slate-300 hover:bg-slate-800/70 hover:text-white"
              }`}
            >
              <Icon
                className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-110 ${
                  isActive ? "text-white" : "text-slate-400 group-hover:text-amber-400"
                }`}
              />
              {!isCollapsed && (
                <span className="truncate animate-in fade-in duration-150">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Nav / Logout */}
      <div className="p-3 border-t border-slate-800/80 space-y-1 shrink-0">
        <Link
          href="/"
          target="_blank"
          title={isCollapsed ? "Lihat Portal Publik" : undefined}
          className={`flex items-center rounded-xl text-sm text-slate-300 hover:bg-slate-800/70 hover:text-white transition-colors group ${
            isCollapsed
              ? "justify-center p-3"
              : "gap-3 px-3.5 py-2"
          }`}
        >
          <ExternalLink className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-white" />
          {!isCollapsed && <span className="truncate">Lihat Portal</span>}
        </Link>
        <button
          onClick={handleLogout}
          title={isCollapsed ? "Keluar dari Akun" : undefined}
          className={`w-full flex items-center rounded-xl text-sm text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition-colors text-left group ${
            isCollapsed
              ? "justify-center p-3"
              : "gap-3 px-3.5 py-2"
          }`}
        >
          <LogOut className="w-4 h-4 shrink-0 text-rose-400 group-hover:scale-110 transition-transform" />
          {!isCollapsed && <span className="truncate">Keluar</span>}
        </button>
      </div>
    </aside>
  );
}
