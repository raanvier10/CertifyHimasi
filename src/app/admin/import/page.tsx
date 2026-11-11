"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  X,
} from "lucide-react";
import { EventItem, PreviewRow } from "@/types";
import { getEvents, supabase } from "@/lib/supabase";
import { downloadExcelTemplate, parseExcelFile } from "@/lib/excel";

export default function ImportPage() {
  const searchParams = useSearchParams();
  const initialEventId = searchParams.get("eventId");

  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [validCount, setValidCount] = useState(0);
  const [invalidCount, setInvalidCount] = useState(0);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadEvents() {
      const list = await getEvents();
      setEvents(list);
      if (initialEventId && list.some((e) => e.id === initialEventId)) {
        setSelectedEventId(initialEventId);
      } else if (list.length > 0) {
        setSelectedEventId(list[0].id);
      }
    }
    loadEvents();
  }, [initialEventId]);

  const handleFile = async (file: File) => {
    if (!file) return;
    const currentEv = events.find((e) => e.id === selectedEventId);
    const defaultEventName = currentEv?.name || "Kegiatan HIMASI";

    try {
      setIsProcessingFile(true);
      const res = await parseExcelFile(file, defaultEventName);
      setPreviewRows(res.rows);
      setValidCount(res.validCount);
      setInvalidCount(res.invalidCount);
    } catch (err: any) {
      console.error("Gagal membaca file Excel:", err);
      alert("Gagal memproses file Excel: " + (err.message || "Pastikan format file valid"));
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleImport = async () => {
    const validRows = previewRows.filter((r) => r.valid);
    if (validRows.length === 0) {
      alert("Tidak ada data peserta valid yang dapat diimport.");
      return;
    }

    try {
      setIsImporting(true);

      // Siapkan payload batch
      const payload = validRows.map((row) => {
        // Cari event yang sesuai berdasarkan nama
        const matched = events.find(
          (e) => e.name.toLowerCase().trim() === row.eventName.toLowerCase().trim()
        );
        return {
          nama: row.nama,
          peran: row.peran,
          event_id: matched ? matched.id : selectedEventId,
          event_name: row.eventName,
          download_count: 0,
        };
      });

      // Insert dalam chunk 50 baris untuk keamanan memori
      const chunkSize = 50;
      for (let i = 0; i < payload.length; i += chunkSize) {
        const chunk = payload.slice(i, i + chunkSize);
        const { error } = await supabase.from("participants").insert(chunk);
        if (error) throw error;
      }

      setSuccessMsg(`Berhasil mengimpor ${validRows.length} data peserta ke sistem!`);
      setPreviewRows([]);
      setValidCount(0);
      setInvalidCount(0);
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error("Gagal mengimpor data peserta:", err);
      alert("Gagal mengimpor: " + (err.message || "Periksa koneksi Supabase"));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">
          Import Data Peserta via Excel
        </h2>
        <p className="text-xs sm:text-sm text-slate-500">
          Unggah file Excel (.xlsx / .xls / .csv) untuk mendaftarkan peserta secara massal.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Selector Acara Tujuan & Download Format */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex-1 max-w-md">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
            Pilih Acara Tujuan Default:
          </label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full text-sm font-bold text-brand-navy bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-brand-navy"
          >
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-400 mt-1 block">
            Peserta tanpa kolom kegiatan di Excel otomatis dimasukkan ke acara ini.
          </span>
        </div>

        <button
          onClick={() => downloadExcelTemplate()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs sm:text-sm font-bold transition-colors shrink-0 shadow-sm"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          <span>Unduh Format Template Excel (.xlsx)</span>
        </button>
      </div>

      {/* Format Column Guide */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-900">
            Format Kolom Excel yang Didukung
          </h3>
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-brand-navy border border-blue-200">
            Mendukung Multi-Acara &amp; Multi-Peran
          </span>
        </div>
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          Anda dapat mendaftarkan satu peserta ke beberapa acara sekaligus dengan memisahkan perannya dan acaranya menggunakan tanda koma (misal: <code>PDD, Acara</code> &amp; <code>Pengabdian, WorkshopUiUX</code>). Jika kolom kegiatan dikosongkan, data akan masuk ke acara tujuan di atas.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold">
                <th className="py-2 px-3">Nama Lengkap</th>
                <th className="py-2 px-3">Peran</th>
                <th className="py-2 px-3">Kegiatan / Acara (Opsional)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-2 px-3 font-bold text-slate-800">Budi Santoso</td>
                <td className="py-2 px-3">PDD, Acara</td>
                <td className="py-2 px-3 text-slate-600">Pengabdian, WorkshopUiUX</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-bold text-slate-800">Ahmad Fauzi</td>
                <td className="py-2 px-3">Peserta</td>
                <td className="py-2 px-3 text-slate-600">Workshop UI/UX Design</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Drop Zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className="bg-white rounded-2xl border-2 border-dashed border-slate-300 hover:border-brand-navy p-10 text-center cursor-pointer transition-colors"
        onClick={() => document.getElementById("excel-file-input")?.click()}
      >
        <input
          id="excel-file-input"
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => {
            if (e.target.files?.[0]) handleFile(e.target.files[0]);
          }}
          className="hidden"
        />
        <div className="w-12 h-12 rounded-full bg-blue-50 text-brand-navy flex items-center justify-center mx-auto mb-3">
          <Upload className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-bold text-slate-800">
          {isProcessingFile ? "Memproses berkas..." : "Klik atau seret file Excel di sini"}
        </h4>
        <span className="text-xs text-slate-400 mt-1 block">
          Mendukung format .xlsx, .xls, dan .csv
        </span>
      </div>

      {/* Preview Table */}
      {previewRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
            <h3 className="text-sm font-bold text-slate-900">
              Pratinjau Data Sebelum Diimpor
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                Total: {previewRows.length}
              </span>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Valid: {validCount}
              </span>
              {invalidCount > 0 && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                  Tidak Valid: {invalidCount}
                </span>
              )}
            </div>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Nama Lengkap</th>
                  <th className="py-2.5 px-3">Peran</th>
                  <th className="py-2.5 px-3">Kegiatan / Acara</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewRows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                    <td className="py-2 px-3 font-bold text-slate-800">{r.nama}</td>
                    <td className="py-2 px-3 text-slate-600">{r.peran}</td>
                    <td className="py-2 px-3 text-slate-600">{r.eventName}</td>
                    <td className="py-2 px-3 text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                          r.valid
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
            <button
              onClick={handleImport}
              disabled={isImporting || validCount === 0}
              className="px-5 py-2.5 rounded-xl bg-brand-navy hover:bg-brand-navy-hover text-white text-xs sm:text-sm font-bold shadow-md transition-colors disabled:opacity-50"
            >
              {isImporting ? "Mengimpor Data..." : `Konfirmasi & Import (${validCount} Data)`}
            </button>
            <button
              onClick={() => {
                setPreviewRows([]);
                setValidCount(0);
                setInvalidCount(0);
              }}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-semibold transition-colors"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

