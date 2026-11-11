"use client";

import React, { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Search, Download, Award, Calendar, CheckCircle2, AlertTriangle, ShieldCheck, FileText } from "lucide-react";
import { EventItem, ParticipantItem } from "@/types";
import { getEvents, getParticipants, recordDownload } from "@/lib/supabase";
import { validateSearchQuery, formatRoleBadge, normalizeEventName, parseParticipantEventsAndRoles } from "@/lib/security";
import { generateCertificatePDF } from "@/lib/pdf";

export default function HomePage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [participants, setParticipants] = useState<ParticipantItem[]>([]);
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Record<string, ParticipantItem[]>>({});
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectedEventPerGroup, setSelectedEventPerGroup] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadData() {
      const [evList, pList] = await Promise.all([getEvents(), getParticipants()]);
      setEvents(evList);
      setParticipants(pList);
    }
    loadData();
  }, []);

  const handleSearch = () => {
    setSearchError(null);
    const { isValid, error, sanitized } = validateSearchQuery(query);

    if (!query.trim()) {
      setHasSearched(false);
      setSearchResults({});
      return;
    }

    if (!isValid) {
      setSearchError(error || "Kueri pencarian tidak valid.");
      setHasSearched(true);
      setSearchResults({});
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    const qLower = sanitized.toLowerCase();
    const matched = participants.filter((p) =>
      p.nama?.toLowerCase().includes(qLower)
    );

    // Kelompokkan berdasarkan nama peserta
    const grouped: Record<string, ParticipantItem[]> = {};
    const defaultSelected: Record<string, string> = {};

    matched.forEach((p) => {
      const k = p.nama.trim();
      if (!grouped[k]) {
        grouped[k] = [];
      }

      // Pecah multi-kegiatan dan multi-peran dalam 1 data peserta
      const certEntries = parseParticipantEventsAndRoles(p.event_name, p.peran);
      certEntries.forEach((entry, idx) => {
        // Cari event id jika ada
        const matchedEv = events.find(
          (e) => normalizeEventName(e.name) === normalizeEventName(entry.eventName)
        );

        const item: ParticipantItem = {
          id: `${p.id}__cert_${idx}`,
          nama: p.nama,
          peran: entry.role,
          event_name: entry.eventName,
          event_id: matchedEv ? matchedEv.id : p.event_id,
          download_count: p.download_count,
          created_at: p.created_at,
        };

        if (!defaultSelected[k]) {
          defaultSelected[k] = item.id;
        }
        grouped[k].push(item);
      });
    });

    setSearchResults(grouped);
    setSelectedEventPerGroup(defaultSelected);
    setIsSearching(false);
  };

  const handleDownload = async (participant: ParticipantItem) => {
    try {
      setDownloadingId(participant.id);
      // Cari event yang sesuai
      let ev = events.find((e) => e.id === participant.event_id);
      if (!ev && participant.event_name) {
        const normP = normalizeEventName(participant.event_name);
        ev = events.find((e) => normalizeEventName(e.name) === normP);
      }
      if (!ev && events.length > 0) {
        ev = events[0];
      }

      const activeEvent: EventItem = ev || {
        id: "ev_default",
        name: participant.event_name || "Sertifikat HIMASI",
        date: null,
        template_url: null,
        positions: {
          name: { x: 148, y: 105, size: 32 },
          role: { x: 148, y: 132, size: 18 },
          color: "#1E255E",
        },
      };

      const realId = participant.id.includes("__cert_")
        ? participant.id.split("__cert_")[0]
        : participant.id;

      await generateCertificatePDF(participant, activeEvent);
      await recordDownload({ ...participant, id: realId }, activeEvent);

      // Perbarui jumlah unduhan di state lokal
      setParticipants((prev) =>
        prev.map((item) =>
          item.id === realId
            ? { ...item, download_count: (item.download_count || 0) + 1 }
            : item
        )
      );
      // Perbarui search results lokal
      setSearchResults((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((key) => {
          next[key] = next[key].map((item) =>
            item.id === participant.id
              ? { ...item, download_count: (item.download_count || 0) + 1 }
              : item
          );
        });
        return next;
      });
    } catch (err) {
      console.error("Gagal mengunduh sertifikat:", err);
      alert("Terjadi kendala saat memproses berkas PDF sertifikat.");
    } finally {
      setDownloadingId(null);
    }
  };

  const groupKeys = Object.keys(searchResults);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      {/* Hero Section */}
      <section
        id="hero-search"
        className="relative bg-gradient-to-b from-slate-50 via-blue-50/30 to-slate-50 min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-5rem)] flex flex-col justify-center items-center py-12 px-4 sm:px-6 scroll-mt-16 sm:scroll-mt-20"
      >
        <div className="w-full max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100/80 border border-blue-200 text-brand-navy text-xs sm:text-sm font-semibold mb-6">
            <ShieldCheck className="w-4 h-4 text-brand-navy" />
            <span>Sistem Verifikasi &amp; E-Sertifikat Resmi</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mb-4">
            Cari &amp; Unduh <span className="text-brand-navy italic underline decoration-amber-400">E-Sertifikat</span> Kegiatan
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto mb-8">
            Ketik nama lengkap Anda untuk mencari sertifikat seminar, workshop, webinar, dan kepanitiaan resmi HIMASI UBSI Karawang.
          </p>

          {/* Search Box */}
          <div className="max-w-2xl mx-auto bg-white p-2.5 rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-200 flex flex-col sm:flex-row items-center gap-2">
            <div className="flex items-center gap-3 px-3.5 py-2 w-full">
              <Search className="w-5 h-5 text-slate-400 shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (!e.target.value.trim()) {
                    setHasSearched(false);
                    setSearchResults({});
                    setSearchError(null);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
                placeholder="Ketik nama lengkap peserta..."
                maxLength={60}
                className="w-full bg-transparent border-none outline-none text-slate-800 placeholder:text-slate-400 text-sm sm:text-base"
              />
            </div>
            <button
              onClick={handleSearch}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-brand-navy text-white font-semibold text-sm hover:bg-brand-navy-hover transition-colors shadow-md shrink-0 flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" />
              <span>Cari Sertifikat</span>
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Tekan Enter atau klik tombol Cari untuk memeriksa database peserta.
          </p>
        </div>

        {/* Result Area */}
        <div className="w-full max-w-3xl mx-auto mt-10">
          {searchError && (
            <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3 shadow-sm">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold">Pemberitahuan</h4>
                <p className="text-xs sm:text-sm mt-0.5 leading-relaxed">{searchError}</p>
              </div>
            </div>
          )}

          {hasSearched && !searchError && groupKeys.length === 0 && (
            <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center shadow-sm">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                <Search className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-slate-800 text-base">Nama Tidak Ditemukan</h4>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-md mx-auto">
                Pastikan nama yang Anda ketik sesuai dengan ejaan saat pendaftaran. Jika data belum terdaftar, silakan konfirmasi ke panitia HIMASI.
              </p>
            </div>
          )}

          {groupKeys.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between text-xs sm:text-sm text-slate-500 font-medium px-1">
                <span>Ditemukan {groupKeys.length} nama peserta yang cocok</span>
                <span className="text-brand-navy font-semibold">Resmi &amp; Terverifikasi</span>
              </div>

              {groupKeys.map((nameKey) => {
                const items = searchResults[nameKey];
                const selectedId = selectedEventPerGroup[nameKey] || items[0].id;
                const activeParticipant = items.find((p) => p.id === selectedId) || items[0];
                const roleBadge = formatRoleBadge(activeParticipant.peran);

                // Temukan nama event
                let matchedEvent = events.find((e) => e.id === activeParticipant.event_id);
                if (!matchedEvent && activeParticipant.event_name) {
                  const n = normalizeEventName(activeParticipant.event_name);
                  matchedEvent = events.find((e) => normalizeEventName(e.name) === n);
                }
                const eventDisplayName = matchedEvent?.name || activeParticipant.event_name || "Kegiatan HIMASI";
                const eventDate = matchedEvent?.date;

                return (
                  <div
                    key={nameKey}
                    className="bg-white rounded-2xl border border-slate-200/90 shadow-lg p-5 sm:p-7 relative overflow-hidden transition-all hover:border-slate-300"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                      <div>
                        <span className="text-xs uppercase tracking-wider text-slate-400 font-bold">
                          Nama Peserta Terverifikasi
                        </span>
                        <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
                          {nameKey}
                        </h3>
                      </div>

                      {/* Selector jika multi-event */}
                      {items.length > 1 && (
                        <div className="flex flex-col">
                          <label className="text-xs font-semibold text-slate-600 mb-1">
                            Pilih Kegiatan ({items.length} Sertifikat):
                          </label>
                          <select
                            value={selectedId}
                            onChange={(e) =>
                              setSelectedEventPerGroup((prev) => ({
                                ...prev,
                                [nameKey]: e.target.value,
                              }))
                            }
                            className="text-xs sm:text-sm font-semibold text-brand-navy bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-brand-navy"
                          >
                            {items.map((it) => (
                              <option key={it.id} value={it.id}>
                                {it.event_name || "Kegiatan"} ({it.peran})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    <div className="py-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex items-start gap-3">
                        <Award className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-xs text-slate-400 font-medium block">Kegiatan</span>
                          <span className="text-sm font-bold text-slate-800">{eventDisplayName}</span>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <span className="text-xs text-slate-400 font-medium block">Status / Peran</span>
                          <span
                            className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-full border mt-0.5 ${roleBadge.className}`}
                          >
                            {roleBadge.label}
                          </span>
                        </div>
                      </div>

                      {eventDate && (
                        <div className="flex items-start gap-3 sm:col-span-2">
                          <Calendar className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                          <span className="text-xs text-slate-500">
                            Tanggal Kegiatan:{" "}
                            <strong>
                              {new Date(eventDate).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })}
                            </strong>
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <span className="text-xs text-slate-400">
                        Total diunduh: <strong>{activeParticipant.download_count || 0} kali</strong>
                      </span>
                      <button
                        onClick={() => handleDownload(activeParticipant)}
                        disabled={downloadingId === activeParticipant.id}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50"
                      >
                        <Download className="w-4 h-4" />
                        <span>
                          {downloadingId === activeParticipant.id
                            ? "Membuat PDF HD..."
                            : "Unduh Sertifikat Resmi (PDF)"}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* 3 Langkah Mudah Unduh Sertifikat */}
      <section
        id="section-alur"
        className="py-20 min-h-[calc(100dvh-4rem)] sm:min-h-[calc(100dvh-5rem)] flex flex-col justify-center bg-white border-t border-slate-200 scroll-mt-16 sm:scroll-mt-20"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs uppercase font-extrabold tracking-wider text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              Panduan Ringkas
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-3">
              3 Langkah Mudah Unduh Sertifikat
            </h2>
            <p className="text-sm text-slate-500 mt-2">
              Sistem CertifyNow memungkinkan Anda memperoleh sertifikat digital resmi dalam hitungan detik.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 flex flex-col items-start">
              <div className="w-10 h-10 rounded-xl bg-brand-navy text-white font-black text-base flex items-center justify-center mb-4 shadow-sm">
                1
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-2">Ketik Nama Lengkap</h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Masukkan nama lengkap sesuai identitas yang Anda gunakan saat mendaftar kegiatan atau kepanitiaan HIMASI.
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 flex flex-col items-start">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white font-black text-base flex items-center justify-center mb-4 shadow-sm">
                2
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-2">Pilih Sertifikat Acara</h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Jika Anda mengikuti beberapa kegiatan, pilih sertifikat yang diinginkan melalui pemilih kegiatan yang tersedia.
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 flex flex-col items-start">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-black text-base flex items-center justify-center mb-4 shadow-sm">
                3
              </div>
              <h3 className="font-bold text-slate-900 text-base mb-2">Unduh Dokumen PDF HD</h3>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Klik tombol unduh untuk mengunduh dokumen PDF sertifikat beresolusi tinggi yang siap dicetak maupun disimpan.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

