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
  PlusCircle,
  RefreshCw,
  MinusCircle,
  Layers,
} from "lucide-react";
import { EventItem, ParticipantItem, PreviewRow } from "@/types";
import { getEvents, getParticipants, supabase } from "@/lib/supabase";
import { downloadExcelTemplate, parseExcelFile } from "@/lib/excel";
import { normalizeEventName, mergeParticipantEventAndRole } from "@/lib/security";

export default function ImportPage() {
  const searchParams = useSearchParams();
  const initialEventId = searchParams.get("eventId");

  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [updateCount, setUpdateCount] = useState(0);
  const [skipCount, setSkipCount] = useState(0);
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
      // Baca baris dari file Excel dan muat data database
      const [res, existingParticipants] = await Promise.all([
        parseExcelFile(file, defaultEventName),
        getParticipants(),
      ]);

      // State pelacakan peserta (1 nama = 1 data, multi-kegiatan & multi-peran)
      const participantState = new Map<
        string,
        { id?: string; nama: string; event_name: string; peran: string; isNew: boolean }
      >();

      existingParticipants.forEach((p) => {
        participantState.set(p.nama.trim().toLowerCase(), {
          id: p.id,
          nama: p.nama,
          event_name: p.event_name || "",
          peran: p.peran || "Peserta",
          isNew: false,
        });
      });

      let calculatedNew = 0;
      let calculatedUpdate = 0;
      let calculatedSkip = 0;
      let calculatedInvalid = 0;

      const processedRows: PreviewRow[] = res.rows.map((row) => {
        if (!row.valid) {
          calculatedInvalid += 1;
          return {
            ...row,
            actionType: "invalid",
            status: "Nama peserta kosong",
          };
        }

        const cleanNama = row.nama.trim().replace(/\s+/g, " ");
        const cleanPeran = row.peran.trim().replace(/\s+/g, " ");
        const key = cleanNama.toLowerCase();

        // Resolusi nama kegiatan: dari kolom Excel atau fallback ke dropdown yang dipilih
        const matched = events.find(
          (e) =>
            e.name.toLowerCase().trim() === row.eventName.toLowerCase().trim() ||
            normalizeEventName(e.name) === normalizeEventName(row.eventName)
        );
        const resolvedEventName = matched
          ? matched.name
          : row.eventName && row.eventName !== "Kegiatan HIMASI"
          ? row.eventName
          : defaultEventName;

        const currentP = participantState.get(key);

        if (currentP) {
          // Peserta dengan nama ini sudah ada di database atau sudah muncul di baris sebelumnya
          const { updatedEventName, updatedPeran, isChanged, isAppended } =
            mergeParticipantEventAndRole(
              currentP.event_name,
              currentP.peran,
              resolvedEventName,
              cleanPeran
            );

          currentP.event_name = updatedEventName;
          currentP.peran = updatedPeran;

          if (currentP.isNew) {
            calculatedNew += 1;
            return {
              nama: cleanNama,
              peran: cleanPeran,
              eventName: resolvedEventName,
              mergedRoles: updatedPeran,
              mergedEvents: updatedEventName,
              valid: true,
              status: `Data baru (digabungkan multi-acara: "${resolvedEventName}")`,
              actionType: "new",
            };
          }

          if (isAppended) {
            calculatedUpdate += 1;
            return {
              nama: cleanNama,
              peran: cleanPeran,
              eventName: resolvedEventName,
              mergedRoles: updatedPeran,
              mergedEvents: updatedEventName,
              valid: true,
              status: `Tambah kegiatan "${resolvedEventName}" (${cleanPeran}) ke peserta ini (tanpa duplikat baris)`,
              actionType: "update",
              existingId: currentP.id,
            };
          } else if (isChanged) {
            calculatedUpdate += 1;
            return {
              nama: cleanNama,
              peran: cleanPeran,
              eventName: resolvedEventName,
              mergedRoles: updatedPeran,
              mergedEvents: updatedEventName,
              valid: true,
              status: `Peran pada "${resolvedEventName}" diperbarui menjadi "${cleanPeran}"`,
              actionType: "update",
              existingId: currentP.id,
            };
          } else {
            calculatedSkip += 1;
            return {
              nama: cleanNama,
              peran: cleanPeran,
              eventName: resolvedEventName,
              valid: true,
              status: "Sudah terdaftar pada kegiatan ini (dilewati tanpa duplikat)",
              actionType: "skip",
              existingId: currentP.id,
            };
          }
        } else {
          // Peserta benar-benar baru
          participantState.set(key, {
            id: undefined,
            nama: cleanNama,
            event_name: resolvedEventName,
            peran: cleanPeran,
            isNew: true,
          });

          calculatedNew += 1;
          return {
            nama: cleanNama,
            peran: cleanPeran,
            eventName: resolvedEventName,
            mergedRoles: cleanPeran,
            mergedEvents: resolvedEventName,
            valid: true,
            status: "Peserta Baru (siap didaftarkan)",
            actionType: "new",
          };
        }
      });

      setPreviewRows(processedRows);
      setNewCount(calculatedNew);
      setUpdateCount(calculatedUpdate);
      setSkipCount(calculatedSkip);
      setInvalidCount(calculatedInvalid);
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
    const toInsert = previewRows.filter((r) => r.actionType === "new" && r.valid);
    const toUpdate = previewRows.filter((r) => r.actionType === "update" && r.valid && r.existingId);

    if (toInsert.length === 0 && toUpdate.length === 0) {
      alert("Semua data pada berkas sudah ada di database. Tidak ada data baru yang perlu diimpor.");
      return;
    }

    try {
      setIsImporting(true);

      // 1. Eksekusi UPDATE (gabungkan kegiatan/peran baru ke baris peserta yang sudah ada)
      const updatesMap = new Map<string, { event_name: string; peran: string; nama: string }>();
      toUpdate.forEach((row) => {
        if (row.existingId && row.mergedEvents && row.mergedRoles) {
          updatesMap.set(row.existingId, {
            event_name: row.mergedEvents,
            peran: row.mergedRoles,
            nama: row.nama,
          });
        }
      });

      for (const [id, updateData] of updatesMap.entries()) {
        const { error } = await supabase
          .from("participants")
          .update({
            event_name: updateData.event_name,
            peran: updateData.peran,
          })
          .eq("id", id);
        if (error) console.warn("Gagal update peran/kegiatan peserta:", error);
      }

      // 2. Eksekusi INSERT untuk peserta yang benar-benar baru (digabungkan 1 nama = 1 baris)
      const insertMap = new Map<
        string,
        { nama: string; roles: string; events: string; eventId?: string | null }
      >();

      toInsert.forEach((row) => {
        const key = row.nama.toLowerCase();
        const finalRoles = row.mergedRoles || row.peran;
        const finalEvents = row.mergedEvents || row.eventName;

        insertMap.set(key, {
          nama: row.nama,
          roles: finalRoles,
          events: finalEvents,
          eventId: selectedEventId,
        });
      });

      const payload = Array.from(insertMap.values()).map((item) => ({
        nama: item.nama,
        peran: item.roles,
        event_name: item.events,
        event_id: item.eventId || selectedEventId,
        download_count: 0,
      }));

      if (payload.length > 0) {
        const chunkSize = 50;
        for (let i = 0; i < payload.length; i += chunkSize) {
          const chunk = payload.slice(i, i + chunkSize);
          const { error } = await supabase.from("participants").insert(chunk);
          if (error) throw error;
        }
      }

      setSuccessMsg(
        `Selesai: ${payload.length} peserta baru didaftarkan, ${updatesMap.size} peserta diperbarui multi-kegiatan, dan ${skipCount} data lama dipertahankan tanpa membuat baris duplikat!`
      );
      setPreviewRows([]);
      setNewCount(0);
      setUpdateCount(0);
      setSkipCount(0);
      setInvalidCount(0);
      setTimeout(() => setSuccessMsg(null), 7000);
    } catch (err: any) {
      console.error("Gagal mengimpor data peserta:", err);
      alert("Gagal mengimpor: " + (err.message || "Periksa koneksi Supabase"));
    } finally {
      setIsImporting(false);
    }
  };

  const actionableCount = newCount + updateCount;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">
          Import Data Peserta via Excel
        </h2>
        <p className="text-xs sm:text-sm text-slate-500">
          Unggah file Excel (.xlsx / .xls / .csv). Jika peserta sudah pernah mengikuti kegiatan lain, kegiatan baru akan digabungkan ke data yang sama tanpa menduplikasi nama.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="font-semibold">{successMsg}</span>
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
            Peserta yang kolom kegiatan di Excel-nya kosong otomatis dimasukkan ke acara default ini.
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
            Format Kolom Excel &amp; Fitur Penggabungan Multi-Kegiatan
          </h3>
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-brand-navy border border-blue-200 flex items-center gap-1">
            <Layers className="w-3 h-3" />
            <span>Multi-Event &amp; Multi-Role Auto Merge</span>
          </span>
        </div>
        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          Kolom <strong>Kegiatan / Acara</strong> pada file Excel bersifat fleksibel: dapat <strong>dikosongkan</strong> (otomatis mengikuti acara tujuan di atas) atau diisi nama kegiatan spesifik. Jika seseorang sudah memiliki sertifikat pada kegiatan sebelumnya, kegiatan baru akan digabungkan ke data yang sama sehingga peserta dapat mengunduh banyak sertifikat tanpa duplikasi baris nama.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] font-bold">
                <th className="py-2 px-3">Nama Lengkap</th>
                <th className="py-2 px-3">Peran</th>
                <th className="py-2 px-3">Kegiatan / Acara</th>
                <th className="py-2 px-3">Keterangan Sistem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-2 px-3 font-bold text-slate-800">Ahmad Fauzi</td>
                <td className="py-2 px-3">Peserta</td>
                <td className="py-2 px-3 text-slate-400 italic">(Dikosongkan)</td>
                <td className="py-2 px-3 text-slate-500">Masuk ke acara tujuan default di atas</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-bold text-slate-800">Ahmad Fauzi</td>
                <td className="py-2 px-3">Panitia</td>
                <td className="py-2 px-3 text-slate-600">Seminar Nasional IT</td>
                <td className="py-2 px-3 text-emerald-600 font-semibold">Digabung: Ahmad Fauzi dapat unduh 2 sertifikat</td>
              </tr>
              <tr>
                <td className="py-2 px-3 font-bold text-slate-800">Budi Santoso</td>
                <td className="py-2 px-3">PDD, Acara</td>
                <td className="py-2 px-3 text-slate-600">Pengabdian, Workshop Web</td>
                <td className="py-2 px-3 text-slate-500">Mendukung multi-peran &amp; multi-acara sekaligus</td>
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
          {isProcessingFile ? "Menganalisis berkas & menyinkronkan multi-kegiatan..." : "Klik atau seret file Excel di sini"}
        </h4>
        <span className="text-xs text-slate-400 mt-1 block">
          Mendukung format .xlsx, .xls, dan .csv
        </span>
      </div>

      {/* Preview Table */}
      {previewRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Pratinjau &amp; Analisis Validasi
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Periksa status data sebelum disimpan ke database.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                Total Baris: {previewRows.length}
              </span>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <PlusCircle className="w-3 h-3" />
                <span>Baru: {newCount}</span>
              </span>
              {updateCount > 0 && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" />
                  <span>Gabung Acara / Update: {updateCount}</span>
                </span>
              )}
              {skipCount > 0 && (
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                  <MinusCircle className="w-3 h-3" />
                  <span>Sudah Ada: {skipCount}</span>
                </span>
              )}
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
                  <th className="py-2.5 px-3 text-right">Status Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {previewRows.map((r, idx) => {
                  let badgeClass = "bg-slate-100 text-slate-700";
                  if (r.actionType === "new") {
                    badgeClass = "bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold";
                  } else if (r.actionType === "update") {
                    badgeClass = "bg-blue-50 text-blue-700 border border-blue-200 font-bold";
                  } else if (r.actionType === "skip") {
                    badgeClass = "bg-slate-100 text-slate-500 italic";
                  } else if (r.actionType === "invalid") {
                    badgeClass = "bg-rose-50 text-rose-700 font-bold";
                  }

                  return (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                      <td className="py-2 px-3 font-bold text-slate-800">{r.nama}</td>
                      <td className="py-2 px-3 text-slate-600">{r.peran}</td>
                      <td className="py-2 px-3 text-slate-600 font-medium">{r.eventName}</td>
                      <td className="py-2 px-3 text-right">
                        <span className={`inline-block px-2.5 py-1 rounded-lg text-[11px] ${badgeClass}`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
            <button
              onClick={handleImport}
              disabled={isImporting || actionableCount === 0}
              className="px-5 py-2.5 rounded-xl bg-brand-navy hover:bg-brand-navy-hover text-white text-xs sm:text-sm font-bold shadow-md transition-colors disabled:opacity-50"
            >
              {isImporting
                ? "Memproses Data..."
                : actionableCount > 0
                ? `Konfirmasi & Simpan (${actionableCount} Data Terproses)`
                : "Semua Data Sudah Terdaftar (Dilewati)"}
            </button>
            <button
              onClick={() => {
                setPreviewRows([]);
                setNewCount(0);
                setUpdateCount(0);
                setSkipCount(0);
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
