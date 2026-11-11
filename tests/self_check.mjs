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

console.log("✓ Semua pengujian assert mandiri berhasil tanpa kesalahan!");

