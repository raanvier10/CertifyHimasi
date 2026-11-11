import { RoleBadgeInfo } from "@/types";

// Deteksi Pola SQL Injection & Script Injection (XSS)
const SQLI_PATTERN = /('|--|;|\/\*|\*\/|union\s+select|select\s+.*from|drop\s+table|insert\s+into|delete\s+from|update\s+.*set|or\s+1\s*=\s*1|and\s+1\s*=\s*1|exec\s*\(|benchmark\(|sleep\()/i;
const XSS_PATTERN = /<[^>]*>|javascript:|onerror\s*=|onload\s*=|eval\s*\(|alert\s*\(/i;

export function validateSearchQuery(query: string): { isValid: boolean; error?: string; sanitized: string } {
  const trimmed = (query || "").trim();
  if (!trimmed) {
    return { isValid: false, sanitized: "" };
  }

  if (trimmed.length > 60) {
    return {
      isValid: false,
      error: "Panjang nama maksimal adalah 60 karakter. Masukkan nama lengkap yang valid.",
      sanitized: trimmed,
    };
  }

  if (SQLI_PATTERN.test(trimmed) || XSS_PATTERN.test(trimmed)) {
    return {
      isValid: false,
      error: "Karakter khusus dan format kueri yang Anda masukkan tidak diizinkan demi keamanan data peserta.",
      sanitized: trimmed,
    };
  }

  const sanitized = trimmed.replace(/[\x00-\x1F\x7F]/g, "").normalize("NFKD");

  if (sanitized.length < 3) {
    return {
      isValid: false,
      error: "Silakan ketik minimal 3 huruf nama Anda agar pencarian data sertifikat lebih akurat.",
      sanitized,
    };
  }

  return { isValid: true, sanitized };
}

export function isValidUUID(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

export function normalizeEventName(name?: string | null): string {
  if (!name) return "";
  return String(name).toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function formatRoleBadge(role?: string | null): RoleBadgeInfo {
  if (!role) return { label: "Peserta Resmi", className: "bg-blue-50 text-blue-700 border-blue-200" };
  const r = String(role).trim();
  if (!r) return { label: "Peserta Resmi", className: "bg-blue-50 text-blue-700 border-blue-200" };
  const rLower = r.toLowerCase();

  if (rLower === "peserta") {
    return { label: "Peserta Resmi", className: "bg-blue-50 text-blue-700 border-blue-200" };
  }
  if (rLower.includes("panitia") || rLower.includes("organizer") || rLower.includes("pdd") || rLower.includes("divisi") || rLower.includes("sie")) {
    return { label: r, className: "bg-purple-50 text-purple-700 border-purple-200" };
  }
  if (rLower.includes("narasumber") || rLower.includes("pemateri") || rLower.includes("speaker") || rLower.includes("keynote")) {
    return { label: r, className: "bg-amber-50 text-amber-800 border-amber-300" };
  }
  if (rLower.includes("moderator") || rLower.includes("mc") || rLower.includes("host")) {
    return { label: r, className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }
  if (rLower.includes("juara") || rLower.includes("pemenang") || rLower.includes("terbaik")) {
    return { label: r, className: "bg-amber-50 text-amber-800 border-amber-300" };
  }

  return { label: r, className: "bg-slate-100 text-slate-700 border-slate-300" };
}

