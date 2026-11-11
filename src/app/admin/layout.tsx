"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AdminSidebar from "@/components/AdminSidebar";
import { ExternalLink, User } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [adminEmail, setAdminEmail] = useState("Panitia HIMASI");

  useEffect(() => {
    async function checkSession() {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          setAuthorized(true);
          setAdminEmail(data.session.user.email || "Panitia HIMASI");
          return;
        }
      } catch (err) {
        console.warn("Session check exception:", err);
      }

      router.replace("/4dm1nH1m4s1");
    }

    checkSession();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.replace("/4dm1nH1m4s1");
      } else {
        setAuthorized(true);
        setAdminEmail(session.user.email || "Panitia HIMASI");
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [router]);

  if (!authorized) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-brand-navy border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-semibold text-slate-600">
            Memeriksa sesi login panitia...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-slate-50 overflow-hidden">
      {/* Sidebar: Fixed & Sticky on Left */}
      <AdminSidebar />

      {/* Main Container: Independent Scroll Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* Top Header: Sticky at Top */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 z-20">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Admin HIMASI UBSI Karawang
            </span>
            <h1 className="text-base font-extrabold text-slate-900 leading-tight">
              Panel Pengelolaan E-Sertifikat
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              <span>Lihat Portal Publik</span>
            </Link>

            <div className="flex items-center gap-2.5 pl-4 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-brand-navy text-white font-bold text-xs flex items-center justify-center">
                {adminEmail ? adminEmail[0].toUpperCase() : "H"}
              </div>
              <span className="text-xs font-bold text-slate-700 hidden sm:inline-block max-w-[180px] truncate" title={adminEmail}>
                {adminEmail}
              </span>
            </div>
          </div>
        </header>

        {/* Dynamic Content: Full-width scroll area (scrollbar di paling pojok kanan layar) */}
        <div className="flex-1 overflow-y-auto w-full">
          <main className="max-w-7xl w-full mx-auto p-6 sm:p-8">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

