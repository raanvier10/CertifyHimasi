import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CertifyNow — Portal E-Sertifikat HIMASI UBSI Karawang",
  description:
    "Portal unduh dan verifikasi e-sertifikat resmi Himpunan Mahasiswa Sistem Informasi (HIMASI) Universitas BSI Kampus Karawang.",
  icons: {
    icon: "/assets/LogoHima.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="scroll-smooth">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-800 antialiased">
        {children}
      </body>
    </html>
  );
}

