"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus,
  Trash2,
  Upload,
  Save,
  RotateCcw,
  FileText,
  Download,
  AlertCircle,
  CheckCircle2,
  Award,
} from "lucide-react";
import { EventItem, ParticipantItem, PositionsConfig } from "@/types";
import { getEvents, getParticipants, supabase } from "@/lib/supabase";
import { generateCertificatePDF } from "@/lib/pdf";
import { isValidUUID } from "@/lib/security";
import CertificateCanvas from "@/components/CertificateCanvas";

export default function EventsPage() {
  const searchParams = useSearchParams();
  const urlEventId = searchParams.get("eventId");

  const [events, setEvents] = useState<EventItem[]>([]);
  const [participants, setParticipants] = useState<ParticipantItem[]>([]);
  const [activeEventId, setActiveEventId] = useState<string>("");
  const [eventName, setEventName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [positions, setPositions] = useState<PositionsConfig>({
    name: { x: 148, y: 105, size: 32 },
    role: { x: 148, y: 132, size: 18 },
    color: "#1E255E",
  });
  const [templateUrl, setTemplateUrl] = useState<string | null>(null);

  // Modals & States
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [newEventDate, setNewEventDate] = useState(new Date().toISOString().split("T")[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState("");

  const loadData = async () => {
    const [evList, pList] = await Promise.all([getEvents(), getParticipants()]);
    setEvents(evList);
    setParticipants(pList);

    const initialId = urlEventId && evList.some((e) => e.id === urlEventId)
      ? urlEventId
      : evList[0]?.id || "";

    if (initialId) {
      switchEvent(initialId, evList);
    }
  };

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel("realtime-events-page")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [urlEventId]);

  const switchEvent = (id: string, list: EventItem[] = events) => {
    const ev = list.find((e) => e.id === id);
    if (!ev) return;

    setActiveEventId(ev.id);
    setEventName(ev.name || "");
    setEventDate(ev.date || "");
    setTemplateUrl(ev.template_url || null);
    setPositions(
      ev.positions || {
        name: { x: 148, y: 105, size: 32 },
        role: { x: 148, y: 132, size: 18 },
        color: "#1E255E",
      }
    );
    setSelectedParticipantId("");
  };

  const handleCreateEvent = async () => {
    if (!newEventName.trim()) {
      alert("Nama kegiatan tidak boleh kosong.");
      return;
    }

    try {
      setIsSaving(true);
      const initialPos: PositionsConfig = {
        name: { x: 148, y: 105, size: 32 },
        role: { x: 148, y: 132, size: 18 },
        color: "#1E255E",
      };

      const { data, error } = await supabase
        .from("events")
        .insert({
          name: newEventName.trim(),
          date: newEventDate || null,
          positions: initialPos,
        })
        .select();

      if (error) {
        console.warn("[Supabase Insert Error]:", error);
        alert("Gagal menyimpan ke database Supabase: " + (error.message || JSON.stringify(error)));
        return;
      }

      if (data && data.length > 0) {
        const created = data[0];
        setShowAddModal(false);
        setNewEventName("");
        await loadData();
        switchEvent(created.id);
        setSuccessMsg(`Acara "${created.name}" berhasil dibuat dan tersimpan di database!`);
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err: any) {
      console.warn("Gagal membuat acara:", err);
      alert("Terjadi kendala saat menghubungi Supabase: " + (err?.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEvent = async () => {
    const activeEv = events.find((e) => e.id === activeEventId);
    if (!activeEv) return;

    if (!confirm(`Apakah Anda yakin ingin menghapus acara "${activeEv.name}" beserta seluruh data pesertanya?`)) {
      return;
    }

    try {
      setIsSaving(true);
      if (isValidUUID(activeEv.id)) {
        const { error } = await supabase.from("events").delete().eq("id", activeEv.id);
        if (error) {
          console.warn("[Supabase Delete Error]:", error);
          alert("Gagal menghapus acara dari database: " + error.message);
          return;
        }
      }

      await loadData();
      setSuccessMsg("Acara berhasil dihapus dari database.");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.warn("Gagal menghapus acara:", err);
      alert("Gagal menghapus acara: " + (err?.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveInfo = async () => {
    if (!activeEventId) return;
    try {
      setIsSaving(true);
      if (isValidUUID(activeEventId)) {
        const { error } = await supabase
          .from("events")
          .update({
            name: eventName.trim(),
            date: eventDate || null,
          })
          .eq("id", activeEventId);

        if (error) {
          console.warn("[Supabase] Gagal update info acara:", error.message || error);
        }
      }

      setEvents((prev) =>
        prev.map((e) =>
          e.id === activeEventId
            ? { ...e, name: eventName.trim(), date: eventDate || null }
            : e
        )
      );
      setSuccessMsg("Informasi acara berhasil diperbarui!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.warn("Gagal memperbarui info acara:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleUploadTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeEventId) return;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["png", "jpg", "jpeg"].includes(ext || "")) {
      alert("Hanya menerima berkas gambar format PNG atau JPG.");
      return;
    }

    try {
      setIsUploading(true);
      const safeId = isValidUUID(activeEventId) ? activeEventId : "default";
      const fileName = `template_${safeId}_${Date.now()}.${ext}`;

      let publicUrl: string | null = null;

      try {
        const { error: uploadError } = await supabase.storage
          .from("certificates")
          .upload(fileName, file, { cacheControl: "3600", upsert: true });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("certificates")
            .getPublicUrl(fileName);
          publicUrl = urlData.publicUrl;
        } else {
          console.warn("[Storage] Gagal unggah storage:", uploadError.message || uploadError);
        }
      } catch (storageErr) {
        console.warn("[Storage] Storage exception:", storageErr);
      }

      // Fallback instan: jika storage belum bisa, gunakan DataURL lokal agar kanvas langsung terisi
      if (!publicUrl) {
        publicUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target?.result as string);
          reader.readAsDataURL(file);
        });
      }

      // Simpan URL ke database jika activeEventId adalah UUID yang valid
      if (isValidUUID(activeEventId) && publicUrl.startsWith("http")) {
        try {
          const { error: updateError } = await supabase
            .from("events")
            .update({ template_url: publicUrl })
            .eq("id", activeEventId);

          if (updateError) {
            console.warn("[Database] Gagal update template_url:", updateError.message || updateError);
          }
        } catch (dbErr) {
          console.warn("[Database] Exception update template_url:", dbErr);
        }
      }

      setTemplateUrl(publicUrl);
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === activeEventId ? { ...ev, template_url: publicUrl } : ev
        )
      );
      setSuccessMsg("Template sertifikat HD berhasil diterapkan ke kanvas!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.warn("Gagal memproses gambar template:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSavePositions = async () => {
    if (!activeEventId) return;
    try {
      setIsSaving(true);
      if (isValidUUID(activeEventId)) {
        const { error } = await supabase
          .from("events")
          .update({ positions })
          .eq("id", activeEventId);

        if (error) {
          console.warn("[Database] Gagal menyimpan posisi:", error.message || error);
        }
      }

      setEvents((prev) =>
        prev.map((e) => (e.id === activeEventId ? { ...e, positions } : e))
      );
      setSuccessMsg("Tata letak teks acara ini berhasil disimpan!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      console.warn("Gagal menyimpan posisi:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPositions = () => {
    setPositions({
      name: { x: 148, y: 105, size: positions.name.size },
      role: { x: 148, y: 132, size: positions.role.size },
      color: positions.color || "#1E255E",
    });
  };

  const handlePreviewDummyPDF = async () => {
    const activeEv = events.find((e) => e.id === activeEventId);
    if (!activeEv) return;

    const dummyParticipant: ParticipantItem = {
      id: "dummy",
      nama: "ACHMAD FAUZI NUGRAHA",
      peran: "Peserta Resmi",
      event_id: activeEv.id,
      event_name: activeEv.name,
      download_count: 0,
    };

    const tempEvent: EventItem = {
      ...activeEv,
      positions,
      template_url: templateUrl,
    };

    await generateCertificatePDF(dummyParticipant, tempEvent);
  };

  const handleDownloadParticipantCert = async () => {
    if (!selectedParticipantId) {
      alert("Pilih salah satu peserta terlebih dahulu.");
      return;
    }
    const p = participants.find((x) => x.id === selectedParticipantId);
    const activeEv = events.find((e) => e.id === activeEventId);
    if (!p || !activeEv) return;

    const tempEvent: EventItem = {
      ...activeEv,
      positions,
      template_url: templateUrl,
    };

    await generateCertificatePDF(p, tempEvent);
  };

  const eventParticipants = participants.filter((p) => p.event_id === activeEventId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">
            Kelola Acara &amp; Template E-Sertifikat
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Setiap acara memiliki latar gambar HD dan posisi teks masing-masing.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-navy hover:bg-brand-navy-hover text-white text-xs sm:text-sm font-bold shadow-md transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Acara Baru</span>
        </button>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm flex items-center gap-2 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {events.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-blue-50 text-brand-navy flex items-center justify-center mx-auto mb-4">
            <Award className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800">Belum Ada Acara Kegiatan</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6 leading-relaxed">
            Belum ada acara yang terdaftar di database. Silakan klik tombol di bawah untuk membuat acara pertama Anda.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-navy text-white text-xs sm:text-sm font-bold shadow-md hover:bg-brand-navy-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Acara Pertama</span>
          </button>
        </div>
      ) : (
        <>
          {/* Event Selector Horizontal Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {events.map((ev) => {
              const isActive = ev.id === activeEventId;
              const count = participants.filter((p) => p.event_id === ev.id).length;
              return (
                <button
                  key={ev.id}
                  onClick={() => switchEvent(ev.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold shrink-0 transition-all border ${
                    isActive
                      ? "bg-brand-navy text-white border-brand-navy shadow-md"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span>{ev.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {count}
                  </span>
                  {ev.template_url && <span title="Template Siap">🖼️</span>}
                </button>
              );
            })}
          </div>

          {/* Active Event Settings Form */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4 mb-5">
              <div className="flex-1 max-w-sm">
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Acara yang Sedang Dikelola:
                </label>
                <select
                  value={activeEventId}
                  onChange={(e) => switchEvent(e.target.value)}
                  className="w-full text-sm font-bold text-brand-navy bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-brand-navy"
                >
                  {events.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} {e.template_url ? "✓ (Template Ada)" : "(Tanpa Template)"}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleDeleteEvent}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Acara Ini</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Nama Kegiatan
                </label>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="Contoh: Workshop UI/UX Design"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 outline-none focus:bg-white focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Tanggal Kegiatan
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 outline-none focus:bg-white focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20"
                />
              </div>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={handleSaveInfo}
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-navy hover:bg-brand-navy-hover text-white text-xs sm:text-sm font-bold shadow-sm transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Perubahan Info Acara</span>
              </button>
            </div>
          </div>

          {/* Editor Visual Template Sertifikat */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Kanvas */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">
                  Kanvas Tata Letak Sertifikat
                </h3>
                <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5 text-blue-600" />
                  <span>{isUploading ? "Mengunggah..." : "Unggah Latar HD (PNG/JPG)"}</span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    onChange={handleUploadTemplate}
                    className="hidden"
                    disabled={isUploading}
                  />
                </label>
              </div>

              <CertificateCanvas
                templateUrl={templateUrl}
                positions={positions}
                onPositionChange={setPositions}
              />

              <p className="text-xs text-slate-500">
                * <strong>Panduan:</strong> Geser (drag) kotak teks nama dan peran di atas untuk menyesuaikan letak cetak pada template acara ini.
              </p>
            </div>

            {/* Panel Typography & Actions */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-5 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100 mb-4">
                  Pengaturan Teks
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Ukuran Teks Nama (px)
                    </label>
                    <input
                      type="number"
                      value={positions.name.size}
                      onChange={(e) =>
                        setPositions({
                          ...positions,
                          name: { ...positions.name, size: Number(e.target.value) || 32 },
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Ukuran Teks Peran (px)
                    </label>
                    <input
                      type="number"
                      value={positions.role.size}
                      onChange={(e) =>
                        setPositions({
                          ...positions,
                          role: { ...positions.role, size: Number(e.target.value) || 18 },
                        })
                      }
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Warna Teks Utama
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={positions.color || "#1E255E"}
                        onChange={(e) =>
                          setPositions({
                            ...positions,
                            color: e.target.value,
                          })
                        }
                        className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer p-0.5"
                      />
                      <span className="text-xs font-mono font-bold text-slate-700">
                        {positions.color || "#1E255E"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 mt-6">
                  <button
                    onClick={handleSavePositions}
                    disabled={isSaving}
                    className="w-full py-2.5 px-4 rounded-xl bg-brand-navy hover:bg-brand-navy-hover text-white text-xs sm:text-sm font-bold shadow-md transition-colors flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    <span>Simpan Tata Letak Acara Ini</span>
                  </button>

                  <button
                    onClick={handleResetPositions}
                    className="w-full py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4 text-slate-500" />
                    <span>Reset Posisi ke Tengah</span>
                  </button>

                  <button
                    onClick={handlePreviewDummyPDF}
                    className="w-full py-2.5 px-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4 text-amber-700" />
                    <span>Coba Cetak PDF Dummy</span>
                  </button>
                </div>
              </div>

              {/* Unduh Sertifikat Peserta Terpilih */}
              <div className="pt-5 border-t border-slate-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Unduh Sertifikat Acara Ini:
                </h4>
                <select
                  value={selectedParticipantId}
                  onChange={(e) => setSelectedParticipantId(e.target.value)}
                  className="w-full text-xs font-medium text-slate-800 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 mb-2"
                >
                  <option value="">-- Pilih Peserta ({eventParticipants.length} Peserta) --</option>
                  {eventParticipants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nama} ({p.peran})
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleDownloadParticipantCert}
                  disabled={!selectedParticipantId}
                  className="w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh Sertifikat Peserta</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal Buat Acara Baru */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-lg font-black text-slate-900 mb-1">
              Buat Acara Baru
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Tambahkan kegiatan baru. Setiap acara memiliki template latar gambar dan tata letak teks masing-masing.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Nama Kegiatan / Acara *
                </label>
                <input
                  type="text"
                  value={newEventName}
                  onChange={(e) => setNewEventName(e.target.value)}
                  placeholder="Contoh: Seminar Nasional AI & Cloud"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 outline-none focus:bg-white focus:border-brand-navy"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Tanggal Kegiatan
                </label>
                <input
                  type="date"
                  value={newEventDate}
                  onChange={(e) => setNewEventDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-800 outline-none focus:bg-white focus:border-brand-navy"
                />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={handleCreateEvent}
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-brand-navy text-white text-xs font-bold hover:bg-brand-navy-hover disabled:opacity-50"
              >
                {isSaving ? "Menyimpan..." : "Buat Acara"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

