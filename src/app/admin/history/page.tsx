"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart3,
  Search,
  Filter,
  Download,
  Trash2,
  FileSpreadsheet,
  Users,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { EventItem, DownloadItem, ParticipantItem } from "@/types";
import { getEvents, getDownloads, getParticipants, supabase } from "@/lib/supabase";
import { exportDownloadsToExcel } from "@/lib/excel";

export default function HistoryPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [participants, setParticipants] = useState<ParticipantItem[]>([]);
  const [search, setSearch] = useState("");
  const [filterEvent, setFilterEvent] = useState("");
  const [loading, setLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [evList, dlList, pList] = await Promise.all([
        getEvents(),
        getDownloads(),
        getParticipants(),
      ]);
      setEvents(evList);
      setDownloads(dlList);
      setParticipants(pList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel("realtime-history-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "downloads" }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleClearHistory = async () => {
    if (!confirm("Apakah Anda yakin ingin menghapus seluruh catatan riwayat unduhan?")) {
      return;
    }
    try {
      setIsClearing(true);
      const { error } = await supabase
        .from("downloads")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (error) throw error;

      setDownloads([]);
      setSuccessMsg("Seluruh riwayat unduhan berhasil dibersihkan.");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error("Gagal menghapus riwayat:", err);
      alert("Gagal menghapus riwayat: " + (err.message || ""));
    } finally {
      setIsClearing(false);
    }
  };

  const totalParticipants = participants.length;
  const totalDownloads = downloads.length;
  const participationRate =
    totalParticipants > 0
      ? Math.min(100, Math.round((totalDownloads / totalParticipants) * 100))
      : 0;

  // Filtered downloads
  const filteredDownloads = downloads.filter((d) => {
    const q = search.toLowerCase();
    const matchQ =
      !q ||
      d.participant_name.toLowerCase().includes(q) ||
      (d.event_name && d.event_name.toLowerCase().includes(q));

    const matchEvent =
      !filterEvent || d.event_id === filterEvent || d.event_name === filterEvent;

    return matchQ && matchEvent;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Riwayat Unduhan Sertifikat
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Pantau aktivitas pengunduhan sertifikat resmi oleh para peserta secara real-time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => exportDownloadsToExcel(filteredDownloads)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Excel Riwayat</span>
          </button>

          <button
            onClick={handleClearHistory}
            disabled={isClearing || downloads.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isClearing ? "Membersihkan..." : "Hapus Riwayat"}</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* 3 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-brand-navy flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{totalParticipants}</div>
            <span className="text-xs font-medium text-slate-500">
              Total Peserta Terdaftar
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Download className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{totalDownloads}</div>
            <span className="text-xs font-medium text-slate-500">
              Total Sertifikat Diunduh
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{participationRate}%</div>
            <span className="text-xs font-medium text-slate-500">
              Persentase Partisipasi
            </span>
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama peserta di riwayat unduhan..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 outline-none focus:bg-white focus:border-brand-navy"
          />
        </div>

        <select
          value={filterEvent}
          onChange={(e) => setFilterEvent(e.target.value)}
          className="w-full sm:w-64 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 outline-none focus:bg-white focus:border-brand-navy"
        >
          <option value="">Semua Acara</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                <th className="py-3 px-4 w-12">#</th>
                <th className="py-3 px-4">Nama Peserta</th>
                <th className="py-3 px-4">Peran</th>
                <th className="py-3 px-4">Kegiatan / Acara</th>
                <th className="py-3 px-4 text-right">Waktu Pengunduhan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDownloads.map((d, idx) => (
                <tr key={d.id} className="hover:bg-slate-50/80">
                  <td className="py-3.5 px-4 text-slate-400 font-mono text-xs">
                    {idx + 1}
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    {d.participant_name}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-block px-2.5 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-semibold">
                      {d.peran}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">{d.event_name || "-"}</td>
                  <td className="py-3.5 px-4 text-right text-xs text-slate-500">
                    {d.download_date
                      ? new Date(d.download_date).toLocaleString("id-ID")
                      : "-"}
                  </td>
                </tr>
              ))}
              {filteredDownloads.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                    Belum ada data pengunduhan yang cocok dengan kriteria pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

