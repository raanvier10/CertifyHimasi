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

export type RoleCategory = "Peserta" | "Panitia" | "Narasumber" | "Moderator";

/**
 * Mengkategorikan peran ke dalam 4 kategori utama:
 * 1. Peserta / Peserta Resmi
 * 2. Moderator (MC, Host, Moderator)
 * 3. Narasumber (Pemateri, Speaker, Keynote)
 * 4. Panitia (Peran selain peserta/peserta resmi, moderator, dan narasumber otomatis masuk kategori Panitia)
 */
export function getRoleCategory(role?: string | null): RoleCategory {
  if (!role) return "Peserta";
  const r = role.trim().toLowerCase();
  if (!r) return "Peserta";

  // Prioritas panitia eksplisit (divisi, kepanitiaan, kepengurusan)
  if (
    r.includes("panitia") ||
    r.includes("koordinator") ||
    r.includes("divisi") ||
    r.includes("sie") ||
    r.includes("ketua") ||
    r.includes("sekretaris") ||
    r.includes("bendahara") ||
    r.includes("humas") ||
    r.includes("pdd") ||
    r.includes("konsumsi") ||
    r.includes("logistik") ||
    r.includes("acara")
  ) {
    return "Panitia";
  }

  // 1. Kategori Peserta / Peserta Resmi
  if (r.includes("peserta")) {
    return "Peserta";
  }

  // 2. Kategori Moderator
  if (r.includes("moderator") || r.includes("mc") || r.includes("host")) {
    return "Moderator";
  }

  // 3. Kategori Narasumber
  if (
    r.includes("narasumber") ||
    r.includes("pemateri") ||
    r.includes("speaker") ||
    r.includes("keynote")
  ) {
    return "Narasumber";
  }

  // 4. Jika bukan peserta / peserta resmi, moderator, dan narasumber -> Panitia
  return "Panitia";
}

/**
 * Memeriksa apakah suatu string peran (bisa multi-peran) cocok dengan opsi filter peran yang dipilih di dropdown
 */
export function isRoleMatchingFilter(rolesStr?: string | null, filterRole?: string | null): boolean {
  if (!filterRole) return true; // "Semua Peran"
  const cleanFilter = filterRole.trim();
  if (!cleanFilter) return true;

  if (!rolesStr) {
    return cleanFilter.toLowerCase() === "peserta";
  }

  // Pisahkan jika ada multi-peran (misal: "Peserta, Panitia")
  const roles = rolesStr
    .split(/[,;\n]+/)
    .map((r) => r.trim())
    .filter(Boolean);

  if (roles.length === 0) {
    return cleanFilter.toLowerCase() === "peserta";
  }

  const targetCategory = cleanFilter.toLowerCase();

  return roles.some((r) => {
    const cat = getRoleCategory(r).toLowerCase();
    return cat === targetCategory;
  });
}

export function formatRoleBadge(role?: string | null): RoleBadgeInfo {
  if (!role) return { label: "Peserta Resmi", className: "bg-blue-50 text-blue-700 border-blue-200" };
  const r = String(role).trim();
  if (!r) return { label: "Peserta Resmi", className: "bg-blue-50 text-blue-700 border-blue-200" };
  const rLower = r.toLowerCase();

  const category = getRoleCategory(r);

  if (category === "Peserta") {
    const label = rLower === "peserta" ? "Peserta Resmi" : r;
    return { label, className: "bg-blue-50 text-blue-700 border-blue-200" };
  }

  if (category === "Moderator") {
    return { label: r, className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }

  if (category === "Narasumber") {
    return { label: r, className: "bg-amber-50 text-amber-800 border-amber-300" };
  }

  // Kategori Panitia (warna ungu khas kepanitiaan)
  return { label: r, className: "bg-purple-50 text-purple-700 border-purple-200" };
}

export interface CertificateEntry {
  eventName: string;
  role: string;
  eventId?: string | null;
}

export function parseParticipantEventsAndRoles(
  eventNamesStr?: string | null,
  rolesStr?: string | null,
  fallbackEventName: string = "Kegiatan HIMASI"
): CertificateEntry[] {
  const events = eventNamesStr
    ? eventNamesStr.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)
    : [fallbackEventName];
  const roles = rolesStr
    ? rolesStr.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)
    : ["Peserta"];

  const maxLen = Math.max(events.length, roles.length);
  const result: CertificateEntry[] = [];

  for (let i = 0; i < maxLen; i++) {
    const ev = events[i] || events[events.length - 1] || fallbackEventName;
    const r = roles[i] || roles[roles.length - 1] || "Peserta";
    result.push({ eventName: ev, role: r });
  }

  return result.length > 0 ? result : [{ eventName: fallbackEventName, role: "Peserta" }];
}

export function mergeParticipantEventAndRole(
  existingEventName: string | null | undefined,
  existingPeran: string | null | undefined,
  newEventName: string,
  newRole: string
): { updatedEventName: string; updatedPeran: string; isChanged: boolean; isAppended: boolean } {
  const events = existingEventName
    ? existingEventName.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)
    : [];
  const roles = existingPeran
    ? existingPeran.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)
    : [];

  const maxLen = Math.max(events.length, roles.length);
  const pairs: { event: string; role: string }[] = [];
  for (let i = 0; i < maxLen; i++) {
    pairs.push({
      event: events[i] || events[events.length - 1] || "Kegiatan",
      role: roles[i] || roles[roles.length - 1] || "Peserta",
    });
  }

  const cleanNewEvent = newEventName.trim();
  const cleanNewRole = newRole.trim();
  const normNewEvent = normalizeEventName(cleanNewEvent);

  const existingPairIndex = pairs.findIndex(
    (p) => normalizeEventName(p.event) === normNewEvent
  );

  if (existingPairIndex !== -1) {
    if (pairs[existingPairIndex].role.toLowerCase() === cleanNewRole.toLowerCase()) {
      return {
        updatedEventName: pairs.map((p) => p.event).join(", "),
        updatedPeran: pairs.map((p) => p.role).join(", "),
        isChanged: false,
        isAppended: false,
      };
    } else {
      pairs[existingPairIndex].role = cleanNewRole;
      return {
        updatedEventName: pairs.map((p) => p.event).join(", "),
        updatedPeran: pairs.map((p) => p.role).join(", "),
        isChanged: true,
        isAppended: false,
      };
    }
  } else {
    pairs.push({ event: cleanNewEvent, role: cleanNewRole });
    return {
      updatedEventName: pairs.map((p) => p.event).join(", "),
      updatedPeran: pairs.map((p) => p.role).join(", "),
      isChanged: true,
      isAppended: true,
    };
  }
}

