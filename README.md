# CertifyNow — Portal E-Sertifikat HIMASI UBSI Karawang

Platform modern manajemen dan pengunduhan e-sertifikat resmi Himpunan Mahasiswa Sistem Informasi (HIMASI) Universitas BSI Kampus Karawang. Dibangun menggunakan **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS**, dan **Supabase**.

---

## 🚀 Tech Stack

- **Framework**: [Next.js 16.1.4](https://nextjs.org/) (App Router, Turbopack)
- **Library UI**: [React 19](https://react.dev/)
- **Bahasa**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) dengan palet warna resmi HIMASI
- **Database & Storage**: [Supabase](https://supabase.com/) (PostgreSQL & Object Storage)
- **PDF Generator**: [jsPDF](https://github.com/parallax/jsPDF) (Resolusi HD A4 Landscape)
- **Excel Processor**: [SheetJS (xlsx)](https://sheetjs.com/) (Import massal multi-acara & ekspor data)
- **Icons**: [Lucide React](https://lucide.dev/)

---

## 📋 Fitur Utama

### 1. Portal Publik (Peserta)
- **Pencarian Nama Cepat**: Menggunakan query matching dengan proteksi terhadap SQL Injection dan XSS.
- **Dukungan Multi-Kegiatan**: Jika peserta memiliki sertifikat di lebih dari 1 acara, muncul pemilih acara yang intuitif.
- **Unduh PDF HD Langsung**: Sertifikat di-render langsung di sisi browser dengan presisi milimeter sesuai template tiap acara.
- **Pintu Rahasia Panitia**: Klik logo HIMASI pada navbar sebanyak **3 kali dengan cepat** (<600ms) untuk langsung menuju halaman login/dashboard admin.

### 2. Panel Admin
- **Dashboard**: Statistik total peserta, total unduhan, kesiapan template HD, dan tabel 5 riwayat unduhan terkini.
- **Acara & Template**:
  - Buat dan kelola acara kegiatan.
  - Unggah latar sertifikat resolusi tinggi (PNG/JPG) langsung ke Supabase Storage.
  - **Interactive Drag-and-Drop Canvas**: Geser posisi teks nama dan peran secara visual (*pointer events*).
  - Kontrol ukuran font dan palet warna teks.
  - Cetak dummy PDF dan uji unduh sertifikat untuk peserta tertentu.
- **Upload Peserta (Excel Import)**:
  - Import massal dari file `.xlsx`, `.xls`, atau `.csv`.
  - Mendukung format multi-peran dan multi-acara dipisah koma (contoh: peran `PDD, Acara` di kegiatan `Pengabdian, WorkshopUiUX`).
  - Tabel pratinjau validasi data sebelum dikonfirmasi ke database.
- **Data Peserta**:
  - Filter berdasarkan acara dan peran (Peserta, Panitia, Narasumber, Moderator).
  - Tambah manual, edit, dan hapus peserta.
  - Hapus massal (semua peserta atau per acara).
  - Ekspor seluruh data terfilter ke format Excel `.xlsx`.
- **Riwayat Unduhan**:
  - Pemantauan real-time aktivitas unduhan sertifikat beserta persentase partisipasi.
  - Ekspor riwayat ke file Excel.

---

## 🛠️ Panduan Konfigurasi Supabase (Manual)

### Langkah 1: Eksekusi Skrip SQL
Buka project Anda di [Supabase Dashboard](https://supabase.com/dashboard) -> pilih menu **SQL Editor** -> jalankan query yang ada di dalam berkas [`supabase/schema.sql`](supabase/schema.sql).

Query tersebut akan membuat:
- Tabel `public.events`
- Tabel `public.participants`
- Tabel `public.downloads`
- Fungsi atomik `increment_download(row_id uuid)`
- Seluruh index performa dan Row Level Security (RLS) policies

### Langkah 2: Buat Storage Bucket
1. Buka menu **Storage** di dashboard Supabase.
2. Klik tombol **New Bucket**.
3. Beri nama: `certificates` (huruf kecil).
4. Aktifkan toggle **Public Bucket** agar gambar template dapat diakses langsung oleh browser.
5. Klik **Save**.

### Langkah 3: Konfigurasi File Environment
Pastikan file `.env.local` terisi dengan URL dan Anon Key proyek Supabase Anda:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

### Langkah 4: Buat Akun Admin Panitia di Supabase
Kredensial admin disimpan secara aman dan terenkripsi menggunakan **Supabase Auth** (`auth.users`):
1. Buka menu **Authentication** -> **Users** di dashboard Supabase.
2. Klik tombol **Add user** -> pilih **Create user**.
3. Masukkan Email (misal: `admin@gmail.com`) dan Kata Sandi.
4. Pastikan opsi **Auto Confirm User?** dicentang / aktif.
5. Klik **Create user**. Akun admin siap digunakan untuk login di portal.

---

## 💻 Menjalankan Aplikasi di Komputer Lokal

1. **Install dependensi**:
   ```bash
   npm install
   ```

2. **Jalankan development server**:
   ```bash
   npm run dev
   ```
   Aplikasi akan aktif di [http://localhost:3000](http://localhost:3000).

3. **Cek tipe TypeScript**:
   ```bash
   npx tsc --noEmit
   ```

4. **Uji mandiri logika keamanan & parser**:
   ```bash
   node tests/self_check.mjs
   ```

5. **Build produksi**:
   ```bash
   npm run build
   npm start
   ```

---

## 📁 Struktur Direktori

```
CertifyHimasi/
├── .env.example                   # Template variabel lingkungan publik
├── .env.local                     # Supabase URL & Anon Key (diabaikan oleh git)
├── .gitignore                     # Proteksi privasi & aturan berkas produksi
├── package.json                   # Dependencies: Next.js 16, React 19, Supabase, jsPDF, XLSX
├── tsconfig.json                  # Konfigurasi TypeScript ketat
├── tailwind.config.ts             # Palet warna resmi HIMASI UBSI Karawang
├── postcss.config.mjs             # PostCSS Tailwind
├── next.config.ts                 # Konfigurasi Next.js 16 (Turbopack)
├── public/
│   └── assets/
│       └── LogoHima.svg           # Logo resmi HIMASI
├── supabase/
│   └── schema.sql                 # DDL SQL, RPC atomik, dan RLS Supabase
├── tests/
│   └── self_check.mjs             # Assertion test mandiri (prinsip ponytail)
└── src/
    ├── types/
    │   └── index.ts               # TypeScript Interfaces (Event, Participant, Download)
    ├── lib/
    │   ├── supabase.ts            # Supabase client & query helpers
    │   ├── pdf.ts                 # jsPDF generator Landscape A4 HD
    │   ├── excel.ts               # Parser & exporter Excel multi-acara & multi-peran
    │   └── security.ts            # Sanitasi input & filter anti-SQLi / XSS
    ├── components/
    │   ├── Navbar.tsx             # Navbar + Secret 3-click trigger ke dashboard
    │   ├── Footer.tsx             # Footer resmi HIMASI UBSI Karawang
    │   ├── CertificateCanvas.tsx  # Interactive drag-and-drop text placement
    │   └── AdminSidebar.tsx       # Sidebar navigasi panel admin
    └── app/
        ├── layout.tsx             # Root layout & font Plus Jakarta Sans
        ├── globals.css            # Tailwind directives & styles
        ├── page.tsx               # Halaman Publik Pencarian & Unduh E-Sertifikat
        ├── login/page.tsx         # Login admin terintegrasi Supabase Auth
        └── admin/
            ├── layout.tsx         # Route guard autentikasi & sidebar layout
            ├── dashboard/page.tsx # Ringkasan statistik & kartu acara
            ├── events/page.tsx    # Kelola acara, upload template HD & editor canvas
            ├── import/page.tsx    # Upload Excel massal dengan validasi instan
            ├── participants/page.tsx # CRUD data peserta, filter peran & ekspor Excel
            └── history/page.tsx   # Riwayat unduhan & statistik persentase partisipasi
```

---

## 🔐 Manajemen Kredensial Admin

Autentikasi admin dikelola langsung melalui **Supabase Auth** (`auth.users`):
- Password dienkripsi dengan standar **bcrypt** di level database PostgreSQL.
- Tambah atau cabut akses panitia kapan saja melalui **Supabase Dashboard > Authentication > Users**.
- Tidak ada kata sandi admin yang tersimpan di kode sumber maupun file `.env` yang dapat terekspos ke publik.

---

&copy; 2026 Himpunan Mahasiswa Sistem Informasi (HIMASI) Universitas BSI Kampus Karawang.

