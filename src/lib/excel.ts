import * as XLSX from "xlsx";
import { ParticipantItem, DownloadItem, EventItem, PreviewRow } from "@/types";

export function downloadExcelTemplate(): void {
  const wsData = [
    ["Nama Lengkap", "Peran", "Kegiatan / Acara (Opsional)"],
    ["Muhammad Adam", "PDD, Acara", "Pengabdian, WorkshopUiUX"],
    ["Ahmad Fauzi", "Peserta", "Workshop UI/UX Design"],
    ["Dian Pratama", "Panitia Koordinator", ""],
    ["Dr. Hendra Gunawan, M.Kom.", "Narasumber", "Seminar Nasional IT"],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{ wch: 30 }, { wch: 25 }, { wch: 32 }];
  XLSX.utils.book_append_sheet(wb, ws, "Template Peserta");
  XLSX.writeFile(wb, "Template_Import_Peserta_HIMASI.xlsx");
}

export async function parseExcelFile(
  file: File,
  defaultEventName: string
): Promise<{ rows: PreviewRow[]; validCount: number; invalidCount: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const wb = XLSX.read(data, { type: "binary" });
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as (string | number)[][];

        if (!rawData || rawData.length === 0) {
          resolve({ rows: [], validCount: 0, invalidCount: 0 });
          return;
        }

        let headerRow = -1;
        let namaIdx = -1;
        let peranIdx = -1;
        let acaraIdx = -1;

        // Cari header kolom
        for (let r = 0; r < Math.min(10, rawData.length); r++) {
          const row = rawData[r].map((cell) => String(cell || "").toLowerCase().trim());
          const n = row.findIndex((c) => c.includes("nama"));
          const p = row.findIndex((c) => c.includes("peran") || c.includes("jabatan") || c.includes("status") || c.includes("sebagai"));
          const a = row.findIndex((c) => c.includes("kegiatan") || c.includes("acara") || c.includes("event"));

          if (n !== -1) {
            headerRow = r;
            namaIdx = n;
            peranIdx = p;
            acaraIdx = a;
            break;
          }
        }

        if (namaIdx === -1) {
          // Fallback ke kolom 0 dan 1
          headerRow = 0;
          namaIdx = 0;
          peranIdx = 1;
          acaraIdx = 2;
        }

        const previewRows: PreviewRow[] = [];

        for (let r = headerRow + 1; r < rawData.length; r++) {
          const row = rawData[r];
          if (!row || row.length === 0) continue;

          const rawNama = String(row[namaIdx] || "").trim();
          const rawPeran = peranIdx !== -1 ? String(row[peranIdx] || "").trim() : "";
          const rawAcara = acaraIdx !== -1 ? String(row[acaraIdx] || "").trim() : "";

          if (!rawNama && !rawPeran && !rawAcara) continue;

          if (!rawNama) {
            previewRows.push({
              nama: "-",
              peran: rawPeran || "Peserta",
              eventName: rawAcara || defaultEventName,
              valid: false,
              status: "Nama peserta kosong",
            });
            continue;
          }

          // Dukungan multi-peran & multi-acara dipisah koma
          const roles = rawPeran ? rawPeran.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean) : ["Peserta"];
          const events = rawAcara ? rawAcara.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean) : [defaultEventName];

          const maxLen = Math.max(roles.length, events.length);
          for (let i = 0; i < maxLen; i++) {
            const assignedRole = roles[i] || roles[roles.length - 1] || "Peserta";
            const assignedEvent = events[i] || events[events.length - 1] || defaultEventName;

            previewRows.push({
              nama: rawNama,
              peran: assignedRole,
              eventName: assignedEvent,
              valid: true,
              status: "Siap diimport",
            });
          }
        }

        const validCount = previewRows.filter((r) => r.valid).length;
        const invalidCount = previewRows.filter((r) => !r.valid).length;

        resolve({ rows: previewRows, validCount, invalidCount });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
}

export function exportParticipantsToExcel(participants: ParticipantItem[], events: EventItem[]): void {
  const rows = [
    ["No", "Nama Lengkap", "Peran / Jabatan", "Nama Kegiatan / Acara", "Total Unduhan", "Tanggal Dibuat"],
    ...participants.map((p, idx) => {
      const ev = events.find((e) => e.id === p.event_id);
      return [
        idx + 1,
        p.nama,
        p.peran,
        p.event_name || (ev ? ev.name : "-"),
        p.download_count || 0,
        p.created_at ? new Date(p.created_at).toLocaleString("id-ID") : "-",
      ];
    }),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 6 }, { wch: 32 }, { wch: 24 }, { wch: 32 }, { wch: 14 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws, "Data Peserta");
  XLSX.writeFile(wb, `Data_Peserta_HIMASI_${Date.now()}.xlsx`);
}

export function exportDownloadsToExcel(downloads: DownloadItem[]): void {
  const rows = [
    ["No", "Nama Peserta", "Peran", "Kegiatan / Acara", "Waktu Pengunduhan"],
    ...downloads.map((d, idx) => [
      idx + 1,
      d.participant_name,
      d.peran,
      d.event_name || "-",
      d.download_date ? new Date(d.download_date).toLocaleString("id-ID") : "-",
    ]),
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 6 }, { wch: 32 }, { wch: 22 }, { wch: 32 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, ws, "Riwayat Unduhan");
  XLSX.writeFile(wb, `Riwayat_Unduhan_HIMASI_${Date.now()}.xlsx`);
}

