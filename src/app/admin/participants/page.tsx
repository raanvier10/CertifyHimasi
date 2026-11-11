"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  Filter,
  Download,
  Plus,
  Trash2,
  Edit2,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { EventItem, ParticipantItem } from "@/types";
import { getEvents, getParticipants, supabase } from "@/lib/supabase";
import { exportParticipantsToExcel } from "@/lib/excel";
import { formatRoleBadge } from "@/lib/security";
import { generateCertificatePDF } from "@/lib/pdf";

export default function ParticipantsPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [participants, setParticipants] = useState<ParticipantItem[]>([]);
  const [search, setSearch] = useState("");
  const [filterEvent, setFilterEvent] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [loading, setLoading] = useState(true);

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<ParticipantItem | null>(null);
  const [nama, setNama] = useState("");
  const [peran, setPeran] = useState("Peserta");
  const [eventId, setEventId] = useState("");

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ParticipantItem | null>(null);

  const [deleteAllModalOpen, setDeleteAllModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [evList, pList] = await Promise.all([getEvents(), getParticipants()]);
      setEvents(evList);
      setParticipants(pList);
      if (evList.length > 0 && !eventId) {
        setEventId(evList[0].id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel("realtime-participants-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "participants" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => loadData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const openAddModal = () => {
    setEditItem(null);
    setNama("");
    setPeran("Peserta");
    setEventId(events[0]?.id || "");
    setModalOpen(true);
  };

  const openEditModal = (p: ParticipantItem) => {
    setEditItem(p);
    setNama(p.nama);
    setPeran(p.peran);
    setEventId(p.event_id || events[0]?.id || "");
    setModalOpen(true);
  };

  const handleSaveParticipant = async () => {
    if (!nama.trim() || !peran.trim()) {
      alert("Nama dan peran wajib diisi.");
      return;
    }

    const selectedEv = events.find((e) => e.id === eventId);
    const eventName = selectedEv?.name || "Kegiatan HIMASI";

    try {
      setIsSaving(true);
      if (editItem) {
        // Edit existing
        const { error } = await supabase
          .from("participants")
          .update({
            nama: nama.trim(),
            peran: peran.trim(),
            event_id: eventId || null,
            event_name: eventName,
          })
          .eq("id", editItem.id);

        if (error) throw error;
        setSuccessMsg("Data peserta berhasil diperbarui!");
      } else {
        // Add new
        const { error } = await supabase.from("participants").insert({
          nama: nama.trim(),
          peran: peran.trim(),
          event_id: eventId || null,
          event_name: eventName,
          download_count: 0,
        });

        if (error) throw error;
        setSuccessMsg("Peserta baru berhasil ditambahkan!");
      }

      setModalOpen(false);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error("Gagal menyimpan peserta:", err);
      alert("Gagal menyimpan: " + (err.message || ""));
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from("participants")
        .delete()
        .eq("id", itemToDelete.id);

      if (error) throw error;

      setDeleteModalOpen(false);
      setItemToDelete(null);
      await loadData();
      setSuccessMsg("Data peserta berhasil dihapus.");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error("Gagal menghapus:", err);
      alert("Gagal menghapus: " + (err.message || ""));
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDeleteAll = async () => {
    try {
      setIsDeleting(true);
      if (filterEvent) {
        // Hapus hanya peserta pada event terfilter
        const { error } = await supabase
          .from("participants")
          .delete()
          .eq("event_id", filterEvent);
        if (error) throw error;
      } else {
        // Hapus semua peserta
        const { error } = await supabase
          .from("participants")
          .delete()
          .neq("id", "00000000-0000-0000-0000-000000000000");
        if (error) throw error;
      }

      setDeleteAllModalOpen(false);
      await loadData();
      setSuccessMsg("Data peserta berhasil dibersihkan.");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error("Gagal menghapus massal:", err);
      alert("Gagal menghapus massal: " + (err.message || ""));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDownloadSingle = async (p: ParticipantItem) => {
    const ev = events.find((e) => e.id === p.event_id) || events[0];
    if (!ev) return;
    await generateCertificatePDF(p, ev);
  };

  // Filter Data
  const filteredParticipants = participants.filter((p) => {
    const q = search.toLowerCase();
    const matchQ =
      !q ||
      p.nama.toLowerCase().includes(q) ||
      (p.event_name && p.event_name.toLowerCase().includes(q));

    const matchEvent = !filterEvent || p.event_id === filterEvent;
    const matchRole =
      !filterRole || p.peran.toLowerCase().includes(filterRole.toLowerCase());

    return matchQ && matchEvent && matchRole;
  });

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Data Peserta &amp; Kepanitiaan
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Kelola, perbarui, filter, dan unduh data peserta sertifikat.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => exportParticipantsToExcel(filteredParticipants, events)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition-colors shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={() => setDeleteAllModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>Hapus Semua</span>
          </button>

          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-navy hover:bg-brand-navy-hover text-white text-xs font-bold transition-colors shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Peserta</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama peserta atau acara..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-800 outline-none focus:bg-white focus:border-brand-navy"
          />
        </div>

        <select
          value={filterEvent}
          onChange={(e) => setFilterEvent(e.target.value)}
          className="w-full md:w-56 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 outline-none focus:bg-white focus:border-brand-navy"
        >
          <option value="">Semua Acara</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>

        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="w-full md:w-44 text-xs sm:text-sm font-semibold text-slate-700 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 outline-none focus:bg-white focus:border-brand-navy"
        >
          <option value="">Semua Peran</option>
          <option value="Peserta">Peserta</option>
          <option value="Panitia">Panitia</option>
          <option value="Narasumber">Narasumber</option>
          <option value="Moderator">Moderator</option>
        </select>
      </div>

      <div className="text-xs text-slate-500 font-semibold px-1">
        Menampilkan {filteredParticipants.length} dari {participants.length} data peserta
      </div>

      {/* Participants Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                <th className="py-3 px-4 w-12">#</th>
                <th className="py-3 px-4">Nama Lengkap</th>
                <th className="py-3 px-4">Peran</th>
                <th className="py-3 px-4">Kegiatan / Acara</th>
                <th className="py-3 px-4 text-center">Unduh</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredParticipants.map((p, idx) => {
                const roleBadge = formatRoleBadge(p.peran);
                const ev = events.find((e) => e.id === p.event_id);
                const evName = p.event_name || ev?.name || "-";

                return (
                  <tr key={p.id} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-4 text-slate-400 font-mono text-xs">
                      {idx + 1}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {p.nama}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${roleBadge.className}`}
                      >
                        {roleBadge.label}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{evName}</td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleDownloadSingle(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 hover:bg-slate-50 text-[11px] font-semibold text-slate-700 transition-colors"
                        title="Unduh Sertifikat Peserta Ini"
                      >
                        <Download className="w-3.5 h-3.5 text-amber-600" />
                        <span>PDF</span>
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(p)}
                          className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                          title="Edit Peserta"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setItemToDelete(p);
                            setDeleteModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                          title="Hapus Peserta"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredParticipants.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                    Belum ada data peserta yang cocok dengan filter pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah / Edit Peserta */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-black text-slate-900 mb-1">
              {editItem ? "Edit Data Peserta" : "Tambah Peserta Manual"}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Masukkan informasi peserta dan pilih kegiatan yang diikuti.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Nama Lengkap *
                </label>
                <input
                  type="text"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  placeholder="Contoh: Muhammad Adam"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 outline-none focus:bg-white focus:border-brand-navy"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Peran / Jabatan *
                </label>
                <input
                  type="text"
                  value={peran}
                  onChange={(e) => setPeran(e.target.value)}
                  placeholder="Contoh: Peserta / Panitia / Moderator"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 outline-none focus:bg-white focus:border-brand-navy"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Pilih Acara *
                </label>
                <select
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-brand-navy outline-none"
                >
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={handleSaveParticipant}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-brand-navy text-white text-xs font-bold hover:bg-brand-navy-hover disabled:opacity-50"
              >
                {isSaving ? "Menyimpan..." : "Simpan Data"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hapus Tunggal */}
      {deleteModalOpen && itemToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              Konfirmasi Hapus
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mb-5 leading-relaxed">
              Apakah Anda yakin ingin menghapus data peserta{" "}
              <strong>{itemToDelete.nama}</strong>? Data yang dihapus tidak dapat dipulihkan.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-50"
              >
                {isDeleting ? "Menghapus..." : "Hapus Peserta"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Hapus Semua */}
      {deleteAllModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center gap-3 mb-3 text-rose-600">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-base font-black text-slate-900">
                Hapus Massal Data Peserta
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 mb-5 leading-relaxed">
              {filterEvent ? (
                <>
                  Tindakan ini akan menghapus <strong>seluruh data peserta</strong> pada acara yang sedang Anda pilih.
                </>
              ) : (
                <>
                  Tindakan ini akan menghapus <strong>seluruh data peserta di semua acara</strong>.
                </>
              )}
              <br />
              Data yang dihapus tidak dapat dikembalikan lagi. Lanjutkan?
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteAllModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={confirmDeleteAll}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-50"
              >
                {isDeleting ? "Menghapus..." : "Ya, Hapus Semua"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

