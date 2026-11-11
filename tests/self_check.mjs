import assert from "node:assert";

// 1. Uji Regex SQL Injection & XSS Guard
const SQLI_PATTERN = /('|--|;|\/\*|\*\/|union\s+select|select\s+.*from|drop\s+table|insert\s+into|delete\s+from|update\s+.*set|or\s+1\s*=\s*1|and\s+1\s*=\s*1|exec\s*\(|benchmark\(|sleep\()/i;
const XSS_PATTERN = /<[^>]*>|javascript:|onerror\s*=|onload\s*=|eval\s*\(|alert\s*\(/i;

function validate(query) {
  const trimmed = (query || "").trim();
  if (!trimmed) return { isValid: false };
  if (trimmed.length > 60) return { isValid: false, reason: "too_long" };
  if (SQLI_PATTERN.test(trimmed) || XSS_PATTERN.test(trimmed)) return { isValid: false, reason: "security_violation" };
  const sanitized = trimmed.replace(/[\x00-\x1F\x7F]/g, "").normalize("NFKD");
  if (sanitized.length < 3) return { isValid: false, reason: "too_short" };
  return { isValid: true, sanitized };
}

// Uji kueri valid
assert.strictEqual(validate("Ahmad Fauzi").isValid, true);
assert.strictEqual(validate("Dian Pratama").sanitized, "Dian Pratama");

// Uji pencegahan SQL Injection
assert.strictEqual(validate("' OR 1=1 --").isValid, false);
assert.strictEqual(validate("' OR 1=1 --").reason, "security_violation");
assert.strictEqual(validate("UNION SELECT * FROM participants").isValid, false);

// Uji pencegahan XSS
assert.strictEqual(validate("<script>alert(1)</script>").isValid, false);
assert.strictEqual(validate("javascript:void(0)").isValid, false);

// Uji batasan panjang
assert.strictEqual(validate("ab").isValid, false);
assert.strictEqual(validate("ab").reason, "too_short");
assert.strictEqual(validate("a".repeat(61)).isValid, false);
assert.strictEqual(validate("a".repeat(61)).reason, "too_long");

// 2. Uji Normalisasi Event
function normalizeEventName(name) {
  if (!name) return "";
  return String(name).toLowerCase().replace(/[^a-z0-9]/g, "");
}
assert.strictEqual(normalizeEventName("Workshop UI/UX Design 2026"), "workshopuiuxdesign2026");
assert.strictEqual(normalizeEventName("WorkshopUiUX"), "workshopuiux");

// 3. Uji Multi-Role & Multi-Event Split
function parseMulti(rolesStr, eventsStr, defaultEvent) {
  const roles = rolesStr ? rolesStr.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean) : ["Peserta"];
  const events = eventsStr ? eventsStr.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean) : [defaultEvent];
  const maxLen = Math.max(roles.length, events.length);
  const out = [];
  for (let i = 0; i < maxLen; i++) {
    out.push({
      role: roles[i] || roles[roles.length - 1] || "Peserta",
      event: events[i] || events[events.length - 1] || defaultEvent
    });
  }
  return out;
}

const res = parseMulti("PDD, Acara", "Pengabdian, WorkshopUiUX", "DefaultEvent");
assert.strictEqual(res.length, 2);
assert.strictEqual(res[0].role, "PDD");
assert.strictEqual(res[0].event, "Pengabdian");
assert.strictEqual(res[1].role, "Acara");
assert.strictEqual(res[1].event, "WorkshopUiUX");

// 4. Uji Logika Deduplikasi Cerdas (Anti-Duplikasi & Upsert)
function classifyParticipant(existingList, candidate, targetEventName) {
  const cleanNama = candidate.nama.trim().replace(/\s+/g, " ");
  const cleanPeran = candidate.peran.trim().replace(/\s+/g, " ");
  const normEvent = normalizeEventName(targetEventName);

  const found = existingList.find(
    (p) =>
      p.nama.trim().toLowerCase() === cleanNama.toLowerCase() &&
      normalizeEventName(p.event_name) === normEvent
  );

  if (!found) return { action: "new", nama: cleanNama, peran: cleanPeran };
  if (found.peran.trim().toLowerCase() !== cleanPeran.toLowerCase()) {
    return { action: "update", id: found.id, peran: cleanPeran };
  }
  return { action: "skip", id: found.id };
}

const mockDb = [
  { id: "1", nama: "Ahmad Fauzi", peran: "Peserta", event_name: "Workshop Web" },
  { id: "2", nama: "Budi Santoso", peran: "Panitia", event_name: "Workshop Web" },
];

// Test 1: Peserta baru
const t1 = classifyParticipant(mockDb, { nama: "Siti Rahma", peran: "Peserta" }, "Workshop Web");
assert.strictEqual(t1.action, "new");

// Test 2: Peserta sudah ada dengan peran sama persis (dilewati / no duplicate)
const t2 = classifyParticipant(mockDb, { nama: "  ahmad   fauzi ", peran: "Peserta" }, "Workshop Web ");
assert.strictEqual(t2.action, "skip");

// Test 3: Peserta sudah ada tetapi peran diubah (diperbarui / update)
const t3 = classifyParticipant(mockDb, { nama: "Budi Santoso", peran: "Ketua Pelaksana" }, "Workshop Web");
assert.strictEqual(t3.action, "update");
assert.strictEqual(t3.peran, "Ketua Pelaksana");

// 5. Uji Kategorisasi Peran & Filter Dropdown (Rule: Bukan Peserta, Moderator, Narasumber -> Panitia)
function getRoleCategory(role) {
  if (!role) return "Peserta";
  const r = role.trim().toLowerCase();
  if (!r) return "Peserta";

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

  if (r.includes("peserta")) {
    return "Peserta";
  }

  if (r.includes("moderator") || r.includes("mc") || r.includes("host")) {
    return "Moderator";
  }

  if (
    r.includes("narasumber") ||
    r.includes("pemateri") ||
    r.includes("speaker") ||
    r.includes("keynote")
  ) {
    return "Narasumber";
  }

  return "Panitia";
}

function isRoleMatchingFilter(rolesStr, filterRole) {
  if (!filterRole) return true;
  const cleanFilter = filterRole.trim();
  if (!cleanFilter) return true;

  if (!rolesStr) {
    return cleanFilter.toLowerCase() === "peserta";
  }

  const roles = rolesStr
    .split(/[,;\n]+/)
    .map((r) => r.trim())
    .filter(Boolean);

  if (roles.length === 0) {
    return cleanFilter.toLowerCase() === "peserta";
  }

  const targetCategory = cleanFilter.toLowerCase();
  return roles.some((r) => getRoleCategory(r).toLowerCase() === targetCategory);
}

// Uji getRoleCategory
assert.strictEqual(getRoleCategory("Peserta"), "Peserta");
assert.strictEqual(getRoleCategory("peserta resmi"), "Peserta");
assert.strictEqual(getRoleCategory("Peserta Workshop Web"), "Peserta");
assert.strictEqual(getRoleCategory("Moderator"), "Moderator");
assert.strictEqual(getRoleCategory("Master of Ceremony (MC)"), "Moderator");
assert.strictEqual(getRoleCategory("Narasumber"), "Narasumber");
assert.strictEqual(getRoleCategory("Pemateri Utama"), "Narasumber");
assert.strictEqual(getRoleCategory("Keynote Speaker"), "Narasumber");
assert.strictEqual(getRoleCategory("Panitia"), "Panitia");
assert.strictEqual(getRoleCategory("Ketua Pelaksana"), "Panitia");
assert.strictEqual(getRoleCategory("Divisi Humas"), "Panitia");
assert.strictEqual(getRoleCategory("Sie Konsumsi"), "Panitia");
assert.strictEqual(getRoleCategory("Dokumentasi & PDD"), "Panitia");
assert.strictEqual(getRoleCategory("Staff Lapangan"), "Panitia");
assert.strictEqual(getRoleCategory("Volunteer Logistik"), "Panitia");

// Uji isRoleMatchingFilter
assert.strictEqual(isRoleMatchingFilter("Ketua Pelaksana", "Panitia"), true);
assert.strictEqual(isRoleMatchingFilter("Ketua Pelaksana", "Peserta"), false);
assert.strictEqual(isRoleMatchingFilter("Sie Konsumsi", "Panitia"), true);
assert.strictEqual(isRoleMatchingFilter("Sie Konsumsi", "Moderator"), false);
assert.strictEqual(isRoleMatchingFilter("Peserta, Ketua Pelaksana", "Peserta"), true);
assert.strictEqual(isRoleMatchingFilter("Peserta, Ketua Pelaksana", "Panitia"), true);
assert.strictEqual(isRoleMatchingFilter("Peserta, Ketua Pelaksana", "Moderator"), false);
assert.strictEqual(isRoleMatchingFilter("Moderator", "Moderator"), true);
assert.strictEqual(isRoleMatchingFilter("Moderator", "Panitia"), false);
assert.strictEqual(isRoleMatchingFilter("Narasumber", "Narasumber"), true);
assert.strictEqual(isRoleMatchingFilter("Narasumber", "Panitia"), false);
assert.strictEqual(isRoleMatchingFilter("Staff Acara", "Panitia"), true);

console.log("✓ Semua pengujian assert mandiri berhasil tanpa kesalahan!");

