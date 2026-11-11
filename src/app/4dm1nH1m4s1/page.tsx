"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock, Mail, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const now = Date.now();
    if (lockoutUntil && now < lockoutUntil) {
      const remainingSecs = Math.ceil((lockoutUntil - now) / 1000);
      setErrorMsg(`Terlalu banyak percobaan gagal. Akses dikunci sementara selama ${remainingSecs} detik.`);
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPass = password.trim();

    if (!trimmedEmail || !trimmedPass) {
      setErrorMsg("Silakan isi email dan kata sandi dengan benar.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Autentikasi aman langsung ke database Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPass,
      });

      if (!authError && authData?.session) {
        router.push("/admin/dashboard");
        return;
      }

      // Jika autentikasi gagal
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      if (newAttempts >= 5) {
        setLockoutUntil(now + 30000);
        setErrorMsg("Terlalu banyak percobaan gagal. Akses ditangguhkan selama 30 detik.");
      } else {
        setErrorMsg(
          authError?.message === "Invalid login credentials"
            ? "Email atau kata sandi panitia tidak cocok dengan database."
            : authError?.message || "Email atau kata sandi tidak valid."
        );
      }
    } catch (err: any) {
      console.warn("Login exception:", err);
      setErrorMsg("Terjadi kendala saat menghubungi database: " + (err?.message || err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-brand-navy mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Portal Publik</span>
        </Link>

        <div className="bg-white rounded-3xl p-8 border border-slate-200/90 shadow-xl shadow-slate-200/50">
          <div className="text-center mb-8">
            <img
              src="/assets/LogoHima.svg"
              alt="HIMASI Logo"
              className="h-14 w-auto mx-auto mb-3"
            />
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Admin CertifyNow
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Masuk untuk mengelola data acara &amp; sertifikat
            </p>
          </div>

          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Email Panitia / Admin
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Masukkan Alamat Email"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 outline-none focus:bg-white focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20 transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Kata Sandi
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan Password"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 outline-none focus:bg-white focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20 transition-all"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 rounded-xl bg-brand-navy hover:bg-brand-navy-hover text-white font-bold text-sm shadow-md transition-all active:scale-[0.98] disabled:opacity-50 mt-2"
            >
              {isSubmitting ? "Memeriksa Autentikasi..." : "Masuk ke Dashboard"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

