import { jsPDF } from "jspdf";
import { EventItem, ParticipantItem } from "@/types";

export async function generateCertificatePDF(
  participant: ParticipantItem,
  event: EventItem
): Promise<void> {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: false,
  });

  const W = 297;
  const H = 210;
  const cfg = event.positions || {
    name: { x: 148, y: 105, size: 32 },
    role: { x: 148, y: 132, size: 18 },
    color: "#1E255E",
  };

  const tpl = event.template_url;

  if (tpl) {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error("Gagal memuat latar gambar sertifikat"));
        i.src = tpl;
      });

      const isPng = tpl.toLowerCase().includes(".png") || tpl.startsWith("data:image/png");
      const format = isPng ? "PNG" : "JPEG";

      doc.addImage(img, format, 0, 0, W, H, undefined, "SLOW");
    } catch (e) {
      console.error("Gagal memuat latar gambar, menggunakan border default:", e);
      doc.setFillColor(250, 238, 218);
      doc.rect(0, 0, W, H, "F");
      doc.setDrawColor(186, 117, 23);
      doc.setLineWidth(1.5);
      doc.rect(10, 10, W - 20, H - 20, "S");
    }
  } else {
    // Fallback bersih jika belum ada gambar template
    doc.setFillColor(250, 238, 218);
    doc.rect(0, 0, W, H, "F");
    doc.setDrawColor(186, 117, 23);
    doc.setLineWidth(1.5);
    doc.rect(10, 10, W - 20, H - 20, "S");
  }

  doc.setTextColor(cfg.color || "#1E255E");

  // Cetak Nama
  doc.setFont("times", "bolditalic");
  doc.setFontSize(cfg.name?.size || 32);
  doc.text(participant.nama, cfg.name?.x || 148, cfg.name?.y || 105, {
    align: "center",
    baseline: "middle",
  });

  // Cetak Peran
  doc.setFont("times", "bold");
  doc.setFontSize(cfg.role?.size || 18);
  doc.text(participant.peran, cfg.role?.x || 148, cfg.role?.y || 132, {
    align: "center",
    baseline: "middle",
  });

  const eventName = event.name || "Event";
  const safeName = participant.nama.replace(/[^a-zA-Z0-9]/g, "_");
  const safeEvent = eventName.replace(/[^a-zA-Z0-9]/g, "_");

  doc.save(`Sertifikat_${safeName}_${safeEvent}.pdf`);
}

