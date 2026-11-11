"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Download,
  Image as ImageIcon,
  Calendar,
  Plus,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  ArrowRight,
} from "lucide-react";
import { EventItem, ParticipantItem, DownloadItem } from "@/types";
import { getEvents, getParticipants, getDownloads, supabase } from "@/lib/supabase";
import { downloadExcelTemplate } from "@/lib/excel";

export default function DashboardPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [participants, setParticipants] = useState<ParticipantItem[]>([]);
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [evList, pList, dlList] = await Promise.all([
          getEvents(),
          getParticipants(),
          getDownloads(),
        ]);
        setEvents(evList);
        setParticipants(pList);
        setDownloads(dlList);
      } finally {
        setLoading(false);
      }
    }
    loadData();

    const channel = supabase
      .channel("realtime-dashboard-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "participants" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "downloads" }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const totalParticipants = participants.length;
  const totalDownloads = participants.reduce(
    (sum, p) => sum + (p.download_count || 0),
    0
  );
  const eventsCount = events.length;
  const activeEvent = events[0] || null;
  const hasActiveTemplate = !!activeEvent?.template_url;

  return (
    <div className="space-y-8">
      {/* Quick Action Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs sm:text-sm font-bold text-slate-800">
          Aksi Cepat:
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/events"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-navy hover:bg-brand-navy-hover text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Buat Acara Baru</span>
          </Link>
          <Link
            href="/admin/import"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Import Excel Peserta</span>
          </Link>
          <button
            onClick={() => downloadExcelTemplate()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Unduh Template Excel</span>
          </button>
          <Link
            href="/admin/events"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors"
          >
            <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
            <span>Atur Template Sertifikat</span>
          </Link>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Peserta */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-brand-navy flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">
              {loading ? "..." : totalParticipants}
            </div>
            <span className="text-xs font-medium text-slate-500">
              Total Peserta Terdaftar
            </span>
          </div>
        </div>

        {/* Total Diunduh */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Download className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">
              {loading ? "..." : totalDownloads}
            </div>
            <span className="text-xs font-medium text-slate-500">
              Total Sertifikat Diunduh
            </span>
          </div>
        </div>

        {/* Status Template */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ImageIcon className="w-6 h-6" />
          </div>
          <div>
            <div className="text-base font-bold text-slate-900">
              {loading
                ? "..."
                : hasActiveTemplate
                ? "HD Siap ✓"
                : "Belum Diatur"}
            </div>
            <span className="text-xs font-medium text-slate-500">
              Status Template Acara
            </span>
          </div>
        </div>

        {/* Total Acara */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">
              {loading ? "..." : eventsCount}
            </div>
            <span className="text-xs font-medium text-slate-500">
              Total Acara Terdaftar
            </span>
          </div>
        </div>
      </div>

      {/* Daftar Acara & Kesiapan Template */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Daftar Acara &amp; Kesiapan Template
            </h3>
            <p className="text-xs text-slate-500">
              Kelola template, import peserta, atau pantau status sertifikat untuk masing-masing acara.
            </p>
          </div>
          <Link
            href="/admin/events"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-navy text-white text-xs font-semibold hover:bg-brand-navy-hover transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Acara</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
          {events.map((ev) => {
            const pCount = participants.filter((p) => p.event_id === ev.id).length;
            const hasTpl = !!ev.template_url;

            return (
              <div
                key={ev.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                        hasTpl
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }`}
                    >
                      {hasTpl ? "✓ Template HD Siap" : "Belum Ada Template"}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {pCount} Peserta
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">{ev.name}</h4>
                  {ev.date && (
                    <span className="text-xs text-slate-500 block mt-1">
                      {new Date(ev.date).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </span>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between">
                  <Link
                    href={`/admin/events?eventId=${ev.id}`}
                    className="text-xs font-bold text-brand-navy hover:underline"
                  >
                    Atur Template &rarr;
                  </Link>
                  <Link
                    href={`/admin/import?eventId=${ev.id}`}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Import Peserta
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Riwayat Unduhan Terkini */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
          <h3 className="text-base font-bold text-slate-900">
            Riwayat Unduhan Terkini (5 Terakhir)
          </h3>
          <Link
            href="/admin/history"
            className="text-xs font-semibold text-brand-navy hover:underline flex items-center gap-1"
          >
            <span>Lihat Semua Riwayat</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 uppercase text-[11px] font-bold">
                <th className="py-2.5 px-3">Nama &amp; Acara Peserta</th>
                <th className="py-2.5 px-3">Peran</th>
                <th className="py-2.5 px-3 text-right">Waktu Pengunduhan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {downloads.slice(0, 5).map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/80">
                  <td className="py-3 px-3">
                    <span className="font-bold text-slate-800 block">
                      {d.participant_name}
                    </span>
                    <span className="text-xs text-slate-500">{d.event_name}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="inline-block text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {d.peran}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right text-xs text-slate-500">
                    {d.download_date
                      ? new Date(d.download_date).toLocaleString("id-ID")
                      : "-"}
                  </td>
                </tr>
              ))}
              {downloads.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-xs text-slate-400">
                    Belum ada aktivitas pengunduhan yang tercatat.
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

