"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, FileText, Menu, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function Navbar() {
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const clickCountRef = useRef(0);
  const lastClickTimeRef = useRef(0);

  const handleLogoClick = async () => {
    const now = Date.now();
    if (now - lastClickTimeRef.current < 600) {
      clickCountRef.current += 1;
    } else {
      clickCountRef.current = 1;
    }
    lastClickTimeRef.current = now;

    if (clickCountRef.current >= 3) {
      clickCountRef.current = 0;
      // Pintu rahasia admin: cek sesi autentikasi Supabase
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          router.push("/admin/dashboard");
        } else {
          router.push("/login");
        }
      } catch {
        router.push("/login");
      }
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <img
            src="/assets/LogoHima.svg"
            alt="Logo HIMASI UBSI Karawang"
            className="h-10 sm:h-12 w-auto cursor-pointer select-none transition-transform hover:scale-105 active:scale-95"
            onClick={handleLogoClick}
            draggable={false}
            title="Klik 3x cepat untuk masuk panel admin"
          />
          <div className="flex flex-col">
            <span className="font-extrabold text-brand-navy text-sm sm:text-base leading-tight tracking-tight">
              HIMASI UBSI Karawang
            </span>
            <span className="text-[11px] sm:text-xs text-slate-500 font-medium leading-tight">
              Himpunan Mahasiswa Sistem Informasi
            </span>
          </div>
        </div>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-6">
          <Link
            href="#hero-search"
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-brand-navy transition-colors"
          >
            <Search className="w-4 h-4 text-slate-400" />
            <span>Cari Sertifikat</span>
          </Link>
          <Link
            href="#section-alur"
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-brand-navy transition-colors"
          >
            <FileText className="w-4 h-4 text-slate-400" />
            <span>Panduan Ringkas</span>
          </Link>
        </nav>

        {/* Mobile Menu Button */}
        <div className="md:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-600 hover:text-brand-navy hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-2 animate-in slide-in-from-top-2 duration-200">
          <Link
            href="#hero-search"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-brand-navy"
          >
            <Search className="w-4 h-4 text-slate-400" />
            <span>Cari Sertifikat</span>
          </Link>
          <Link
            href="#section-alur"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-brand-navy"
          >
            <FileText className="w-4 h-4 text-slate-400" />
            <span>Panduan Ringkas</span>
          </Link>
        </div>
      )}
    </header>
  );
}

