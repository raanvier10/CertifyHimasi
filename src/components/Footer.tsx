import React from "react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-brand-navy text-white mt-auto border-t border-slate-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand Info */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <img
                src="/assets/LogoHima.svg"
                alt="HIMASI UBSI Karawang"
                className="h-9 w-auto brightness-0 invert"
              />
              <span className="font-bold text-base tracking-tight text-white">
                HIMASI UBSI Karawang
              </span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              Himpunan Mahasiswa Sistem Informasi Universitas Bina Sarana Informatika Kampus Karawang.
              Wadah aspirasi, kreativitas, dan pengembangan kompetensi teknologi informasi mahasiswa.
            </p>
          </div>

          {/* Navigation Links */}
          <div>
            <h4 className="text-sm font-semibold tracking-wider uppercase text-amber-400 mb-4">
              Navigasi Portal
            </h4>
            <ul className="space-y-2.5 text-sm text-slate-300">
              <li>
                <Link href="#hero-search" className="hover:text-white transition-colors">
                  Cari Sertifikat
                </Link>
              </li>
              <li>
                <Link href="#section-alur" className="hover:text-white transition-colors">
                  Panduan Ringkas
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-white transition-colors text-xs text-slate-400">
                  Panel Khusus Panitia
                </Link>
              </li>
            </ul>
          </div>

          {/* Secretariat & Contact */}
          <div>
            <h4 className="text-sm font-semibold tracking-wider uppercase text-amber-400 mb-4">
              Sekretariat &amp; Kontak
            </h4>
            <p className="text-sm text-slate-300 leading-relaxed mb-3">
              Universitas BSI Kampus Karawang<br />
              Jl. Banten No. 1, Karangpawitan, Kec. Karawang Barat, Kab. Karawang, Jawa Barat
            </p>
            <div className="text-sm font-medium text-amber-300">
              Instagram: <a href="https://instagram.com/himasiubsikarawang" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">@himasiubsikarawang</a>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-700/60 mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-4">
          <span>&copy; {new Date().getFullYear()} HIMASI UBSI Karawang · Hak Cipta Dilindungi.</span>
          <span>CertifyNow · Production Next.js &amp; Supabase</span>
        </div>
      </div>
    </footer>
  );
}

