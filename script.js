// Supabase Client Configuration
const SUPABASE_URL = "https://xzdkthtqemwjeetthged.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ySOjaWeHsWHIGNSSF8V59w_zwVGvOJu";
const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// ===== STATE =====
let state = {
  events: [],
  activeEventId: null,
  participants: [],
  downloads: [],
  settings: {
    eventName: 'Workshop UI/UX Design',
    eventDate: '2025-07-15',
    certificateTemplate: null,
    positions: {
      name: { x: 148, y: 105, size: 32 },
      role: { x: 148, y: 132, size: 18 },
      event: { x: 148, y: 155, size: 12 },
      color: '#30338A'
    }
  },
  loggedIn: false,
  deleteId: null,
  previewData: []
};

// ===== NAV & SECURITY ROUTE GUARD =====
function showPage(p) {
  // Blokir keras akses admin jika belum login
  if (p === 'admin' && !state.loggedIn) {
    console.warn('[Security Guard] Akses admin ditolak. Autentikasi diperlukan.');
    p = 'public';
    if (window.location.hash) {
      try {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch (e) {}
    }
  }

  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  const target = document.getElementById('page-' + p);
  if (target) target.classList.add('active');
  window.scrollTo(0, 0);

  if (p === 'admin' && state.loggedIn) {
    renderDashboard();
    renderPesertaTable();
    renderStat();
  }
}
window.showPage = showPage;

// Pintu masuk rahasia panitia: klik logo 3x cepat
let _logoClicks = 0;
let _lastLogoClickTime = 0;
function handleLogoSecretClick() {
  const now = Date.now();
  if (now - _lastLogoClickTime < 600) {
    _logoClicks++;
  } else {
    _logoClicks = 1;
  }
  _lastLogoClickTime = now;

  if (_logoClicks >= 3) {
    _logoClicks = 0;
    showPage(state.loggedIn ? 'admin' : 'login');
  } else {
    showPage('public');
  }
}

// ===== EVENT HELPERS =====
function getActiveEvent() {
  if (state.activeEventId) {
    const found = state.events.find(e => e.id === state.activeEventId);
    if (found) return found;
  }
  return state.events[0] || null;
}

function onSwitchEvent(eventId) {
  state.activeEventId = eventId;
  const ev = getActiveEvent();
  if (!ev) return;

  const nameEl = document.getElementById('tpl-event-name') || document.getElementById('event-name');
  const dateEl = document.getElementById('tpl-event-date') || document.getElementById('event-date');
  if (nameEl) nameEl.value = ev.name || '';
  if (dateEl) dateEl.value = ev.date || '';

  const eventSelect = document.getElementById('event-select');
  if (eventSelect && eventSelect.value !== ev.id) {
    eventSelect.value = ev.id;
  }

  state.settings.eventName = ev.name || '';
  state.settings.eventDate = ev.date || '';
  state.settings.certificateTemplate = ev.template_url || null;
  state.settings.positions = ev.positions || {
    name: { x: 148, y: 105, size: 32 },
    role: { x: 148, y: 132, size: 18 },
    event: { x: 148, y: 155, size: 12 },
    color: '#1E255E'
  };

  setEditorTemplate(ev.template_url);
  applyPositions();
  renderEventPills();
  renderDashboard();
}

function renderEventPills() {
  const container = document.getElementById('event-pills-container');
  if (!container) return;
  const active = getActiveEvent();
  container.innerHTML = state.events.map(e => {
    const count = state.participants.filter(p => p.eventId === e.id).length;
    const isActive = active && active.id === e.id;
    return `
      <button class="event-pill ${isActive ? 'active' : ''}" onclick="onSwitchEvent('${e.id}')" title="${escapeHtml(e.name)}">
        <span>${escapeHtml(e.name)}</span>
        <span class="badge-counter">${count}</span>
      </button>
    `;
  }).join('');
}

function renderEventDropdowns() {
  const evs = state.events;
  const active = getActiveEvent();

  // 1. Selector di Tab Template
  const eventSelect = document.getElementById('event-select');
  if (eventSelect) {
    eventSelect.innerHTML = evs.map(e => `
      <option value="${e.id}" ${active && active.id === e.id ? 'selected' : ''}>
        ${escapeHtml(e.name)} ${e.date ? '(' + e.date + ')' : ''}
      </option>
    `).join('');
  }

  // 2. Selector di Tab Upload Peserta
  const uploadSelect = document.getElementById('upload-event-select');
  if (uploadSelect) {
    uploadSelect.innerHTML = evs.map(e => `
      <option value="${e.id}" ${active && active.id === e.id ? 'selected' : ''}>
        ${escapeHtml(e.name)}
      </option>
    `).join('');
  }

  // 3. Filter di Tab Kelola Peserta
  const filterSelect = document.getElementById('filter-event-select');
  if (filterSelect) {
    const currentVal = filterSelect.value;
    filterSelect.innerHTML = '<option value="">Semua Acara</option>' + evs.map(e => `
      <option value="${e.id}" ${currentVal === e.id ? 'selected' : ''}>
        ${escapeHtml(e.name)}
      </option>
    `).join('');
  }

  // 4. Selector di Modal Tambah/Edit Peserta
  const modalSelect = document.getElementById('modal-event-select');
  if (modalSelect) {
    modalSelect.innerHTML = evs.map(e => `
      <option value="${e.id}" ${active && active.id === e.id ? 'selected' : ''}>
        ${escapeHtml(e.name)}
      </option>
    `).join('');
  }

  // 5. Filter di Tab Riwayat Unduhan
  const dlFilter = document.getElementById('filter-dl-event-select');
  if (dlFilter) {
    const currentDlVal = dlFilter.value;
    dlFilter.innerHTML = '<option value="">Semua Acara</option>' + evs.map(e => `
      <option value="${e.id}" ${currentDlVal === e.id ? 'selected' : ''}>
        ${escapeHtml(e.name)}
      </option>
    `).join('');
  }

  renderEventPills();
}

function showAddEventModal() {
  const nameInput = document.getElementById('new-event-name');
  const dateInput = document.getElementById('new-event-date');
  const err = document.getElementById('modal-event-error');
  if (nameInput) nameInput.value = '';
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
  }
  if (err) err.style.display = 'none';
  const modal = document.getElementById('modal-add-event');
  if (modal) modal.style.display = 'flex';
  setTimeout(() => { if (nameInput) nameInput.focus(); }, 100);
}

async function createEvent() {
  const nameInput = document.getElementById('new-event-name');
  const dateInput = document.getElementById('new-event-date');
  const err = document.getElementById('modal-event-error');
  const submitBtn = document.getElementById('btn-submit-create-event');

  const name = nameInput ? nameInput.value.trim() : '';
  const date = dateInput ? dateInput.value.trim() : '';

  if (!name) {
    if (err) {
      err.textContent = 'Nama kegiatan / acara tidak boleh kosong.';
      err.style.display = 'block';
    }
    if (nameInput) nameInput.focus();
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Membuat Acara...';
  }

  try {
    const initialPos = {
      name: { x: 148, y: 105, size: 32 },
      role: { x: 148, y: 132, size: 18 },
      event: { x: 148, y: 155, size: 12 },
      color: '#1E255E'
    };

    const cleanDate = (date && date.trim()) ? date.trim() : null;

    const { data, error } = await sb.from('events').insert({
      name,
      date: cleanDate,
      positions: initialPos
    }).select();

    if (error) throw error;
    closeModal();
    await loadEvents();
    const newEvent = (Array.isArray(data) && data.length > 0) ? data[0] : data;
    if (newEvent && newEvent.id) {
      onSwitchEvent(newEvent.id);
    }
    const tabBtn = document.querySelector('.nav-item[data-tab="template"]');
    if (tabBtn) showTab('template', tabBtn);
  } catch (e) {
    console.error(e);
    if (err) {
      err.textContent = 'Gagal membuat acara: ' + (e.message || e);
      err.style.display = 'block';
    } else {
      alert('Gagal membuat acara: ' + (e.message || e));
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Buat Acara';
    }
  }
}

async function deleteActiveEvent() {
  const ev = getActiveEvent();
  if (!ev) return;
  if (state.events.length <= 1) {
    alert('Minimal harus ada 1 acara terdaftar di sistem. Tidak bisa menghapus semua acara.');
    return;
  }

  if (!confirm(`Apakah Anda yakin ingin menghapus acara "${ev.name}"? Semua data peserta pada acara ini juga akan terhapus.`)) return;

  try {
    const { error } = await sb.from('events').delete().eq('id', ev.id);
    if (error) throw error;
    state.activeEventId = null;
    await Promise.all([loadEvents(), loadParticipants()]);
  } catch (e) {
    console.error(e);
  }
}

async function deleteEventById(id) {
  const ev = state.events.find(e => e.id === id);
  if (!ev) return;
  if (state.events.length <= 1) {
    alert('Minimal harus ada 1 acara terdaftar di sistem. Tidak bisa menghapus semua acara.');
    return;
  }

  if (!confirm(`Apakah Anda yakin ingin menghapus acara "${ev.name}"? Semua data peserta pada acara ini juga akan terhapus.`)) return;

  try {
    const { error } = await sb.from('events').delete().eq('id', id);
    if (error) throw error;
    if (state.activeEventId === id) state.activeEventId = null;
    await Promise.all([loadEvents(), loadParticipants()]);
  } catch (e) {
    console.error(e);
    alert('Gagal menghapus acara: ' + (e.message || e));
  }
}

// ===== SINKRONISASI DATA SUPABASE =====
async function syncData() {
  await Promise.all([
    loadEvents(),
    loadParticipants(),
    loadDownloads()
  ]);

  // Setup Realtime Subscription
  if (sb) {
    sb.channel('certifynow-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => { loadEvents(); loadParticipants(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, () => loadParticipants())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'downloads' }, () => loadDownloads())
      .subscribe();
  }
}

async function loadEvents() {
  if (!sb) return;
  try {
    const { data, error } = await sb.from('events').select('*').order('created_at', { ascending: true });
    if (error) throw error;

    if (data && data.length > 0) {
      state.events = data;
      if (!state.activeEventId || !state.events.some(e => e.id === state.activeEventId)) {
        state.activeEventId = state.events[0].id;
      }
    } else {
      // Fallback default
      state.events = [{
        id: 'default',
        name: 'Workshop UI/UX Design',
        date: '2025-07-15',
        template_url: null,
        positions: {
          name: { x: 148, y: 105, size: 32 },
          role: { x: 148, y: 132, size: 18 },
          event: { x: 148, y: 155, size: 12 },
          color: '#30338A'
        }
      }];
      state.activeEventId = 'default';
    }

    renderEventDropdowns();

    const active = getActiveEvent();
    if (active) {
      const nameEl = document.getElementById('event-name');
      const dateEl = document.getElementById('event-date');
      if (nameEl) nameEl.value = active.name || '';
      if (dateEl) dateEl.value = active.date || '';

      state.settings.eventName = active.name || '';
      state.settings.eventDate = active.date || '';
      state.settings.certificateTemplate = active.template_url || null;
      state.settings.positions = active.positions || state.settings.positions;

      setEditorTemplate(active.template_url);
      applyPositions();
    }
  } catch (err) {
    console.error("Gagal load events:", err);
  }
}

async function loadParticipants() {
  if (!sb) return;
  try {
    const { data, error } = await sb.from('participants').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    state.participants = (data || []).map(r => {
      const ev = state.events.find(e => e.id === r.event_id);
      return {
        id: r.id,
        nama: r.nama,
        peran: r.peran,
        eventId: r.event_id,
        eventName: r.event_name || (ev ? ev.name : 'Acara'),
        downloadCount: r.download_count || 0,
        createdAt: r.created_at
      };
    });
    if (document.getElementById('page-admin') && document.getElementById('page-admin').classList.contains('active')) {
      renderDashboard();
      renderPesertaTable();
    }
  } catch (err) {
    console.error("Gagal load participants:", err);
  }
}

async function loadDownloads() {
  if (!sb) return;
  try {
    const { data, error } = await sb.from('downloads').select('*').order('download_date', { ascending: false }).limit(50);
    if (error) throw error;
    state.downloads = (data || []).map(r => ({
      id: r.id,
      participantId: r.participant_id,
      participantName: r.participant_name,
      peran: r.peran,
      eventName: r.event_name || '',
      downloadDate: r.download_date ? new Date(r.download_date) : null
    }));
    if (document.getElementById('page-admin') && document.getElementById('page-admin').classList.contains('active')) {
      renderDashboard();
    }
  } catch (err) {
    console.error("Gagal load downloads:", err);
  }
}

// Inisialisasi data
syncData();

function showTab(tab, el) {
  document.querySelectorAll('[id^="tab-"]').forEach(x => x.style.display = 'none');
  const target = document.getElementById('tab-' + tab);
  if (target) target.style.display = 'block';

  document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
  if (el) el.classList.add('active');

  const titles = {
    dashboard: 'Dashboard',
    'upload-peserta': 'Upload Data Peserta',
    kelola: 'Kelola Peserta',
    template: 'Kelola Acara & Template',
    statistik: 'Statistik'
  };
  document.getElementById('admin-title').textContent = titles[tab] || tab;

  if (tab === 'statistik') renderStat();
  if (tab === 'kelola') renderPesertaTable();
  if (tab === 'dashboard') renderDashboard();
  if (tab === 'template') {
    const active = getActiveEvent();
    if (active) {
      setEditorTemplate(active.template_url);
      requestAnimationFrame(() => applyPositions());
    }
  }
}

// ===== LOGIN WITH BRUTE-FORCE PROTECTION =====
function doLogin() {
  const emailEl = document.getElementById('login-email');
  const passEl = document.getElementById('login-pass');
  const err = document.getElementById('login-error');
  if (!emailEl || !passEl || !err) return;

  const email = (emailEl.value || '').trim().toLowerCase();
  const pass = (passEl.value || '').trim();

  // Rate Limiting pencegahan brute-force
  const now = Date.now();
  if (window._loginLockoutUntil && now < window._loginLockoutUntil) {
    const sisaDetik = Math.ceil((window._loginLockoutUntil - now) / 1000);
    err.textContent = `Terlalu banyak percobaan gagal. Akses dikunci sementara selama ${sisaDetik} detik.`;
    err.style.display = 'block';
    return;
  }

  // Validasi input dasar & batasi panjang untuk cegah payload besar
  if (!email || !pass || email.length > 80 || pass.length > 80) {
    err.textContent = 'Silakan isi email dan kata sandi dengan benar.';
    err.style.display = 'block';
    return;
  }

  const isValid = (
    (email === 'himasiubsikarawang@gmail.com' && pass === 'himasi7') ||
    (email === 'admin@certifynow.id' && pass === 'admin123')
  );

  if (isValid) {
    window._loginFailedAttempts = 0;
    state.loggedIn = true;
    sessionStorage.setItem('certifynow_admin', '1');
    sessionStorage.setItem('certifynow_auth_time', String(now));
    err.style.display = 'none';
    emailEl.value = '';
    passEl.value = '';
    showPage('admin');
  } else {
    window._loginFailedAttempts = (window._loginFailedAttempts || 0) + 1;
    if (window._loginFailedAttempts >= 5) {
      window._loginLockoutUntil = now + 30000;
      err.textContent = 'Terlalu banyak percobaan gagal. Akses ditangguhkan selama 30 detik.';
    } else {
      err.textContent = 'Email atau kata sandi tidak valid.';
    }
    err.style.display = 'block';
  }
}

function doLogout() {
  state.loggedIn = false;
  sessionStorage.removeItem('certifynow_admin');
  sessionStorage.removeItem('certifynow_auth_time');
  try {
    history.replaceState(null, '', window.location.pathname);
  } catch (e) {}
  showPage('public');
}

// ===== HELPER: ESCAPE HTML =====
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ===== PUBLIC SEARCH WITH THREAT MITIGATION (SQLi / XSS / FLOOD) =====
function doSearch() {
  const inputEl = document.getElementById('pub-search');
  const rawQ = (inputEl ? inputEl.value : '') || '';
  const area = document.getElementById('result-area');
  if (!area) return;

  // 1. Rate Limiting pencarian untuk cegah flood/DoS & automated scraping
  const now = Date.now();
  if (!window._searchHistory) window._searchHistory = [];
  window._searchHistory = window._searchHistory.filter(t => now - t < 3000);
  if (window._searchHistory.length >= 6) {
    area.innerHTML = `
      <div class="search-empty-card" style="border-color:var(--accent-gold);">
        <div class="empty-icon" style="background:var(--accent-gold-light); color:var(--accent-gold);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </div>
        <h4>Terlalu Banyak Permintaan</h4>
        <p>Mohon jeda sejenak sebelum mencari kembali demi kestabilan portal.</p>
      </div>`;
    return;
  }
  window._searchHistory.push(now);

  const trimmed = rawQ.trim();
  if (!trimmed) {
    area.innerHTML = '';
    return;
  }

  // 2. Batasi Panjang Karakter (Cegah buffer / payload besar)
  if (trimmed.length > 60) {
    area.innerHTML = `
      <div class="search-empty-card" style="border-color:var(--danger);">
        <div class="empty-icon" style="background:var(--danger-light); color:var(--danger);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <h4>Kueri Melebihi Batas</h4>
        <p>Panjang nama maksimal adalah 60 karakter. Masukkan nama lengkap yang valid.</p>
      </div>`;
    return;
  }

  // 3. Deteksi Pola SQL Injection & Script Injection (XSS)
  const sqliPattern = /('|--|;|\/\*|\*\/|union\s+select|select\s+.*from|drop\s+table|insert\s+into|delete\s+from|update\s+.*set|or\s+1\s*=\s*1|and\s+1\s*=\s*1|exec\s*\(|benchmark\(|sleep\()/i;
  const xssPattern = /<[^>]*>|javascript:|onerror\s*=|onload\s*=|eval\s*\(|alert\s*\(/i;

  if (sqliPattern.test(trimmed) || xssPattern.test(trimmed)) {
    console.warn('[Security Guard] Percobaan SQLi/XSS diblokir:', trimmed);
    area.innerHTML = `
      <div class="search-empty-card" style="border-color:var(--danger);">
        <div class="empty-icon" style="background:var(--danger-light); color:var(--danger);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        </div>
        <h4>Format Kueri Berbahaya Ditolak</h4>
        <p>Karakter khusus dan format kueri yang Anda masukkan tidak diizinkan demi keamanan data peserta.</p>
      </div>`;
    return;
  }

  // 4. Sanitasi Whitelist Karakter & Normalisasi
  const sanitizedQ = trimmed
    .replace(/[\x00-\x1F\x7F]/g, '')
    .normalize('NFKD');

  // Minimal 3 karakter untuk mencegah scraping massal dengan 1 huruf
  if (sanitizedQ.length < 3) {
    area.innerHTML = `
      <div class="search-empty-card">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </div>
        <h4>Ketik Minimal 3 Karakter</h4>
        <p>Silakan ketik minimal 3 huruf nama Anda agar pencarian data sertifikat lebih akurat.</p>
      </div>`;
    return;
  }

  const qLower = sanitizedQ.toLowerCase();
  const matches = state.participants.filter(p => {
    if (!p || !p.nama) return false;
    return p.nama.toLowerCase().includes(qLower);
  });

  if (matches.length === 0) {
    area.innerHTML = `
      <div class="search-empty-card">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            <line x1="8" y1="11" x2="14" y2="11"></line>
          </svg>
        </div>
        <h4>Nama Tidak Ditemukan</h4>
        <p>Pastikan nama yang Anda ketik sesuai dengan ejaan saat pendaftaran. Jika data belum terdaftar, silakan konfirmasi ke panitia pelaksana kegiatan.</p>
      </div>`;
    return;
  }

  // Kelompokkan hasil pencarian berdasarkan nama yang sama
  const groups = {};
  matches.forEach(m => {
    const key = m.nama.trim();
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  });

  area.innerHTML = Object.entries(groups).map(([name, items], gIdx) => {
    const isMulti = items.length > 1;
    return `
    <div class="pub-result-card">
      <div class="result-header">
        <div class="res-badge-wrap">
          <span class="badge badge-success">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:12px;height:12px"><polyline points="20 6 9 17 4 12"/></svg>
            Data Terverifikasi Resmi
          </span>
          ${isMulti ? `<span class="badge badge-blue">${items.length} Sertifikat Tersedia</span>` : ''}
        </div>
        <h3 class="res-participant-name">${escapeHtml(name)}</h3>
      </div>

      ${isMulti ? `
        <div class="multi-event-container">
          <label class="label" style="font-size:12.5px; margin-bottom:6px;">
            Pilih Sertifikat Kegiatan yang Ingin Diunduh:
          </label>
          <div class="select-wrap">
            <select class="input res-event-select" id="pub-sel-${gIdx}" onchange="onSelectPubEvent(${gIdx})">
              ${items.map((it, idx) => `
                <option value="${escapeHtml(it.id)}" data-role="${escapeHtml(it.peran)}" data-event="${escapeHtml(it.eventName || 'Acara')}" ${idx === 0 ? 'selected' : ''}>
                  ${escapeHtml(it.eventName || 'Acara')} · Sebagai ${escapeHtml(it.peran)}
                </option>
              `).join('')}
            </select>
          </div>

          <div class="event-meta-card">
            <div class="meta-row">
              <span class="meta-label">Kegiatan</span>
              <span class="meta-val" id="pub-meta-event-${gIdx}">${escapeHtml(items[0].eventName || 'Kegiatan')}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Peran</span>
              <span class="meta-val"><span class="badge badge-gold" id="pub-meta-role-${gIdx}">${escapeHtml(items[0].peran)}</span></span>
            </div>
          </div>

          <button class="btn btn-primary btn-block btn-lg" onclick="downloadCert(document.getElementById('pub-sel-${gIdx}').value)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Unduh E-Sertifikat (PDF HD)
          </button>
        </div>
      ` : `
        <div class="single-event-container">
          <div class="event-meta-card">
            <div class="meta-row">
              <span class="meta-label">Kegiatan</span>
              <span class="meta-val">${escapeHtml(items[0].eventName || 'Kegiatan')}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Status / Peran</span>
              <span class="meta-val"><span class="badge badge-gold">${escapeHtml(items[0].peran)}</span></span>
            </div>
          </div>

          <button class="btn btn-primary btn-block btn-lg" onclick="downloadCert('${escapeHtml(items[0].id)}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Unduh E-Sertifikat (PDF HD)
          </button>
        </div>
      `}
    </div>`;
  }).join('');
}

function onSelectPubEvent(gIdx) {
  const sel = document.getElementById('pub-sel-' + gIdx);
  if (!sel) return;
  const opt = sel.options[sel.selectedIndex];
  if (!opt) return;
  const role = opt.getAttribute('data-role');
  const evName = opt.getAttribute('data-event');
  const roleEl = document.getElementById('pub-meta-role-' + gIdx);
  const evEl = document.getElementById('pub-meta-event-' + gIdx);
  if (roleEl) roleEl.textContent = role || '';
  if (evEl) evEl.textContent = evName || '';
}

function toggleMobileMenu() {
  const drawer = document.getElementById('mobile-nav-drawer');
  if (drawer) {
    drawer.classList.toggle('open');
  }
}


// ===== DOWNLOAD / GENERATE CERT =====
async function downloadCert(id) {
  const p = state.participants.find(x => x.id === id);
  if (!p) return;

  const ev = state.events.find(e => e.id === p.eventId) || state.events[0] || {
    name: p.eventName || 'Workshop',
    date: '',
    template_url: state.settings.certificateTemplate,
    positions: state.settings.positions
  };

  try {
    if (sb) {
      await sb.from("downloads").insert({
        participant_id: id,
        participant_name: p.nama,
        peran: p.peran,
        event_id: ev.id,
        event_name: ev.name,
        download_date: new Date().toISOString()
      });

      await sb.rpc('increment_download', { row_id: id });
      loadDownloads();
    }
  } catch (err) {
    console.error("Gagal mencatat download:", err);
  }

  await generatePDF(p, ev);
}

// GENERATE PDF RESOLUSI TINGGI (HD): Mempertahankan kualitas asli template acara
async function generatePDF(p, ev) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: false });
  const W = 297, H = 210;

  const cfg = (ev && ev.positions) ? ev.positions : state.settings.positions;
  const tpl = (ev && ev.template_url) ? ev.template_url : state.settings.certificateTemplate;
  const eventName = (ev && ev.name) ? ev.name : state.settings.eventName;
  const eventDate = (ev && ev.date) ? ev.date : state.settings.eventDate;

  // Render Background Template Gambar
  if (tpl) {
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.crossOrigin = 'anonymous';
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('Gagal memuat latar gambar'));
        i.src = tpl;
      });

      const isPng = tpl.toLowerCase().includes('.png') || tpl.startsWith('data:image/png');
      const format = isPng ? 'PNG' : 'JPEG';
      
      // Render resolusi penuh tanpa flag 'FAST' agar garis dan font sangat tajam (anti-aliasing)
      doc.addImage(img, format, 0, 0, W, H, undefined, 'SLOW');
    } catch (e) { 
      console.error("Gagal memuat latar gambar:", e); 
      doc.setFillColor(250, 238, 218);
      doc.rect(0, 0, W, H, 'F');
      doc.setDrawColor(186, 117, 23); doc.setLineWidth(1.5);
      doc.rect(10, 10, W-20, H-20, 'S');
    }
  } else {
    // Fallback jika tidak ada gambar template
    doc.setFillColor(250, 238, 218);
    doc.rect(0, 0, W, H, 'F');
    doc.setDrawColor(186, 117, 23); doc.setLineWidth(1.5);
    doc.rect(10, 10, W-20, H-20, 'S');
  }

  doc.setTextColor(cfg.color || '#1C1C1A');

  // Cetak Nama
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(cfg.name.size);
  doc.text(p.nama, cfg.name.x, cfg.name.y, { align: 'center', baseline: 'middle' });

  // Cetak Peran
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(cfg.role.size);
  doc.text(p.peran, cfg.role.x, cfg.role.y, { align: 'center', baseline: 'middle' });

  // Cetak Nama Event & Tanggal
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(cfg.event.size);
  const dateStr = eventDate ? new Date(eventDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  doc.text(`${eventName} | ${dateStr}`, cfg.event.x, cfg.event.y, { align: 'center', baseline: 'middle' });

  doc.save(`Sertifikat_${p.nama.replace(/\s+/g, '_')}_${(eventName || 'Event').replace(/\s+/g, '_')}.pdf`);
}

// ===== TEMPLATE UPLOAD =====
function setEditorTemplate(src) {
  const img = document.getElementById('editor-bg');
  const placeholder = document.getElementById('canvas-placeholder');
  const label = document.getElementById('template-upload-label');
  if (!img) return;

  if (src) {
    img.src = src;
    img.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
    if (label) label.textContent = 'Klik atau seret untuk mengganti template acara ini';
  } else {
    img.removeAttribute('src');
    img.style.display = 'none';
    if (placeholder) placeholder.style.display = 'flex';
    if (label) label.textContent = 'Klik atau seret template sertifikat di sini';
  }
}

async function processTemplateFile(file) {
  const ev = getActiveEvent();
  if (!ev) { alert('Pilih acara terlebih dahulu.'); return; }
  if (!file) return;

  const ext = file.name.split('.').pop().toLowerCase();
  if (!['png', 'jpg', 'jpeg'].includes(ext)) {
    showMsg('template-msg', 'error', 'Hanya menerima file PNG atau JPG.');
    return;
  }

  showMsg('template-msg', 'success', `Mengunggah template HD untuk acara "${ev.name}" ke Supabase Storage...`);

  try {
    const fileName = `template_${ev.id.slice(0, 8)}_${Date.now()}.${ext}`;
    
    // Unggah file asli langsung ke Supabase Storage (Bebas limit 1 MB!)
    const { error: uploadError } = await sb.storage
      .from('certificates')
      .upload(fileName, file, { cacheControl: '3600', upsert: true });

    if (uploadError) throw uploadError;

    // Dapatkan URL publik gambar
    const { data: urlData } = sb.storage
      .from('certificates')
      .getPublicUrl(fileName);

    const publicUrl = urlData.publicUrl;

    // Simpan link URL ke tabel events untuk acara yang sedang aktif
    const { error: updateError } = await sb
      .from('events')
      .update({ template_url: publicUrl })
      .eq('id', ev.id);

    if (updateError) throw updateError;

    ev.template_url = publicUrl;
    setEditorTemplate(publicUrl);
    state.settings.certificateTemplate = publicUrl;

    showMsg('template-msg', 'success', `Template HD untuk "${ev.name}" berhasil disimpan tanpa kompresi!`);
    requestAnimationFrame(() => applyPositions());
    renderDashboard();
  } catch (err) {
    console.error('Gagal mengunggah template:', err);
    showMsg('template-msg', 'error', 'Gagal memproses template: ' + (err.message || err));
  }
}

async function handleTemplate(input) {
  const file = input.files?.[0];
  await processTemplateFile(file);
  input.value = '';
}

// ===== EDITOR DRAG & DROP POSISI =====
let editorDragActive = false;
let dragRafId = 0;
let pendingDrag = null;

function setDragElementPosition(el, xPx, yPx, rect) {
  const w = rect.width;
  const h = rect.height;
  if (!w || !h) return;
  const x = Math.max(0, Math.min(xPx, w));
  const y = Math.max(0, Math.min(yPx, h));
  el.style.left = ((x / w) * 100) + '%';
  el.style.top = ((y / h) * 100) + '%';
  el.style.transform = 'translate(-50%, -50%)';
}

function flushDragPosition() {
  dragRafId = 0;
  if (!pendingDrag) return;
  const { el, x, y, rect } = pendingDrag;
  setDragElementPosition(el, x, y, rect);
  pendingDrag = null;
}

function queueDragPosition(el, x, y, rect) {
  pendingDrag = { el, x, y, rect };
  if (!dragRafId) dragRafId = requestAnimationFrame(flushDragPosition);
}

function getEditorPositions() {
  const W = 297;
  const H = 210;
  const fb = state.settings.positions || {};
  const color = document.getElementById('cfg-color')?.value || fb.color || '#1E255E';
  const nameSize = parseInt(document.getElementById('cfg-name-size')?.value || fb.name?.size || 32, 10);
  const roleSize = parseInt(document.getElementById('cfg-role-size')?.value || fb.role?.size || 18, 10);
  const eventSize = parseInt(document.getElementById('cfg-event-size')?.value || fb.event?.size || 12, 10);
  const container = document.getElementById('canvas-container');

  const readPos = (id, fallback) => {
    const el = document.getElementById(id);
    if (!el || !container) return { ...fallback };
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return { ...fallback };
    const elRect = el.getBoundingClientRect();
    return {
      x: ((elRect.left + elRect.width / 2 - rect.left) / rect.width) * W,
      y: ((elRect.top + elRect.height / 2 - rect.top) / rect.height) * H
    };
  };

  return {
    name: { ...readPos('drag-name', fb.name || { x: 148, y: 105 }), size: nameSize },
    role: { ...readPos('drag-role', fb.role || { x: 148, y: 132 }), size: roleSize },
    event: { ...readPos('drag-event', fb.event || { x: 148, y: 155 }), size: eventSize },
    color
  };
}

function applyPositions() {
  if (editorDragActive) return;

  const pos = state.settings.positions;
  if (!pos) return;

  const W = 297;
  const H = 210;

  const place = (id, cfg) => {
    const el = document.getElementById(id);
    if (!el || !cfg || cfg.x == null || cfg.y == null) return;
    el.style.left = ((cfg.x / W) * 100) + '%';
    el.style.top = ((cfg.y / H) * 100) + '%';
    el.style.transform = 'translate(-50%, -50%)';
  };

  place('drag-name', pos.name);
  place('drag-role', pos.role);
  place('drag-event', pos.event);

  const nameSize = document.getElementById('cfg-name-size');
  const roleSize = document.getElementById('cfg-role-size');
  const eventSize = document.getElementById('cfg-event-size');
  const color = document.getElementById('cfg-color');
  if (nameSize && pos.name?.size) nameSize.value = pos.name.size;
  if (roleSize && pos.role?.size) roleSize.value = pos.role.size;
  if (eventSize && pos.event?.size) eventSize.value = pos.event.size;
  if (color && pos.color) color.value = pos.color;
  updateEditorStyle();
}

function initCertEditorDrag() {
  const container = document.getElementById('canvas-container');
  if (!container || container.dataset.dragReady === '1') return;
  container.dataset.dragReady = '1';

  let activeEl = null;
  let offsetX = 0;
  let offsetY = 0;
  let dragRect = null;
  let onDocMove = null;
  let onDocEnd = null;

  const stopDocListeners = () => {
    if (onDocMove) { document.removeEventListener('pointermove', onDocMove); onDocMove = null; }
    if (onDocEnd) {
      document.removeEventListener('pointerup', onDocEnd);
      document.removeEventListener('pointercancel', onDocEnd);
      onDocEnd = null;
    }
  };

  const endDrag = (e) => {
    if (!activeEl) return;
    if (dragRafId) { cancelAnimationFrame(dragRafId); dragRafId = 0; flushDragPosition(); }
    pendingDrag = null;

    if (e?.pointerId != null) {
      try { if (activeEl.hasPointerCapture(e.pointerId)) activeEl.releasePointerCapture(e.pointerId); } catch (_) {}
    }

    activeEl.classList.remove('is-dragging');
    activeEl.style.willChange = '';
    activeEl = null;
    dragRect = null;
    editorDragActive = false;
    stopDocListeners();
  };

  container.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.draggable');
    if (!el || !container.contains(el)) return;

    e.preventDefault();
    dragRect = container.getBoundingClientRect();
    if (!dragRect.width || !dragRect.height) return;

    activeEl = el;
    editorDragActive = true;
    el.classList.add('is-dragging');
    el.style.willChange = 'left, top';

    const elRect = el.getBoundingClientRect();
    const centerX = elRect.left + elRect.width / 2 - dragRect.left;
    const centerY = elRect.top + elRect.height / 2 - dragRect.top;
    offsetX = (e.clientX - dragRect.left) - centerX;
    offsetY = (e.clientY - dragRect.top) - centerY;

    onDocMove = (ev) => {
      if (!activeEl || !dragRect) return;
      const x = (ev.clientX - dragRect.left) - offsetX;
      const y = (ev.clientY - dragRect.top) - offsetY;
      queueDragPosition(activeEl, x, y, dragRect);
    };

    onDocEnd = (ev) => endDrag(ev);

    document.addEventListener('pointermove', onDocMove, { passive: true });
    document.addEventListener('pointerup', onDocEnd);
    document.addEventListener('pointercancel', onDocEnd);

    try { el.setPointerCapture(e.pointerId); } catch (_) {}
  });

  container.querySelectorAll('.draggable').forEach((el) => {
    el.addEventListener('dragstart', (ev) => ev.preventDefault());
  });
}

function updateEditorStyle() {
  const nameSize = document.getElementById('cfg-name-size')?.value || 32;
  const roleSize = document.getElementById('cfg-role-size')?.value || 18;
  const eventSize = document.getElementById('cfg-event-size')?.value || 12;
  const color = document.getElementById('cfg-color')?.value || '#1E255E';
  
  const n = document.getElementById('drag-name');
  const r = document.getElementById('drag-role');
  const e = document.getElementById('drag-event');
  
  if (n) { n.style.fontSize = nameSize + 'px'; n.style.color = color; }
  if (r) { r.style.fontSize = roleSize + 'px'; }
  if (e) { e.style.fontSize = eventSize + 'px'; e.style.color = color; }
}

async function savePositions() {
  const ev = getActiveEvent();
  if (!ev) { alert('Pilih acara terlebih dahulu.'); return; }

  const container = document.getElementById('canvas-container');
  if (!container) return;
  const rect = container.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    alert('Kanvas belum siap. Buka tab Acara & Template lalu coba lagi.');
    return;
  }

  const newPositions = getEditorPositions();

  try {
    const { error } = await sb.from("events").update({
      positions: newPositions
    }).eq('id', ev.id);

    if (error) throw error;
    
    ev.positions = newPositions;
    state.settings.positions = newPositions;

    const msg = document.getElementById('pos-msg');
    if (msg) {
      msg.style.display = 'block';
      setTimeout(() => msg.style.display = 'none', 2000);
    }
  } catch (err) {
    console.error(err);
    alert("Gagal menyimpan posisi: " + (err.message || err));
  }
}

async function resetPositionsDefault() {
  const defaultPos = {
    name: { x: 148, y: 105, size: 32 },
    role: { x: 148, y: 132, size: 18 },
    event: { x: 148, y: 155, size: 12 },
    color: '#1E255E'
  };
  state.settings.positions = defaultPos;
  const ev = getActiveEvent();
  if (ev) ev.positions = defaultPos;
  applyPositions();
  await savePositions();
}

async function previewDummyPDF() {
  const ev = getActiveEvent();
  if (!ev) { alert('Pilih acara terlebih dahulu.'); return; }
  const dummy = {
    id: 'dummy',
    nama: 'ACHMAD FAUZI NUGRAHA',
    peran: 'Peserta',
    eventName: ev.name,
    eventId: ev.id
  };
  await generatePDF(dummy, ev);
}

// ===== EXCEL UPLOAD =====
function handleExcel(input) {
  const file = input.files[0];
  if (!file) { return; }
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['xlsx', 'xls'].includes(ext)) {
    showMsg('upload-msg', 'error', 'Hanya menerima file .xlsx and .xls');
    return;
  }
  const reader = new FileReader();
  reader.onload = function (e) {
    const wb = XLSX.read(e.target.result, { type: 'binary' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    let headerRow = -1;
    for (let i = 0; i < Math.min(5, data.length); i++) {
      const row = data[i].map(c => String(c).toLowerCase().trim());
      if (row.some(c => c.includes('nama')) && row.some(c => c.includes('peran'))) { headerRow = i; break; }
    }
    if (headerRow < 0) {
      showMsg('upload-msg', 'error', 'Kolom "Nama Lengkap" dan "Peran" tidak ditemukan.');
      return;
    }
    const headers = data[headerRow].map(c => String(c).toLowerCase().trim());
    const namaIdx = headers.findIndex(c => c.includes('nama'));
    const peranIdx = headers.findIndex(c => c.includes('peran'));
    const rows = data.slice(headerRow + 1).filter(r => r[namaIdx] || r[peranIdx]);
    state.previewData = rows.map((r, i) => ({
      nama: String(r[namaIdx] || '').trim(),
      peran: String(r[peranIdx] || '').trim(),
      valid: !!(String(r[namaIdx] || '').trim() && String(r[peranIdx] || '').trim())
    }));
    if (state.previewData.length === 0) {
      showMsg('upload-msg', 'error', 'Tidak ada data yang dapat dibaca.');
      return;
    }
    showMsg('upload-msg', 'success', `Berhasil membaca ${state.previewData.length} baris.`);
    renderPreview();
  };
  reader.readAsBinaryString(file);
}

function downloadExcelTemplate() {
  const wsData = [
    ['Nama Lengkap', 'Peran'],
    ['Ahmad Fauzi Nugraha', 'Peserta'],
    ['Dian Pratama', 'Panitia Koordinator Acara'],
    ['Dr. Hendra Gunawan, M.Kom.', 'Narasumber'],
    ['Siti Rahmawati', 'Moderator'],
    ['Budi Santoso', 'Peserta']
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 32 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Template Peserta');
  XLSX.writeFile(wb, 'Template_Import_Peserta_HIMASI.xlsx');
}

function renderPreview() {
  const tbody = document.getElementById('preview-tbody');
  const totalBadge = document.getElementById('preview-total-badge');
  const validBadge = document.getElementById('preview-valid-badge');
  const invalidBadge = document.getElementById('preview-invalid-badge');

  const total = state.previewData.length;
  const validCount = state.previewData.filter(r => r.valid).length;
  const invalidCount = total - validCount;

  if (totalBadge) totalBadge.textContent = `Total: ${total}`;
  if (validBadge) validBadge.textContent = `Valid: ${validCount}`;
  if (invalidBadge) invalidBadge.textContent = `Tidak Valid: ${invalidCount}`;

  if (!tbody) return;

  tbody.innerHTML = state.previewData.map((r, i) => `
<tr>
  <td>${i + 1}</td>
  <td>${r.nama ? escapeHtml(r.nama) : '<span style="color:var(--danger)">kosong</span>'}</td>
  <td>${r.peran ? escapeHtml(r.peran) : '<span style="color:var(--danger)">kosong</span>'}</td>
  <td><span class="badge ${r.valid ? 'badge-green' : 'badge'}" style="${!r.valid ? 'background:var(--danger-light);color:var(--danger)' : ''}">${r.valid ? 'Valid' : 'Tidak Valid'}</span></td>
</tr>`).join('');
  document.getElementById('preview-table').style.display = 'block';
}

async function importData() {
  const valid = state.previewData.filter(r => r.valid);
  if (valid.length === 0) { showMsg('upload-msg', 'error', 'Tidak ada data valid untuk diimport.'); return; }

  const targetEventId = document.getElementById('upload-event-select')?.value;
  const targetEvent = state.events.find(e => e.id === targetEventId) || getActiveEvent();
  if (!targetEvent) {
    showMsg('upload-msg', 'error', 'Pilih acara target terlebih dahulu.');
    return;
  }

  showMsg('upload-msg', 'success', `Sedang mengimport ${valid.length} data peserta ke acara "${targetEvent.name}"...`);

  try {
    const rows = valid.map(r => ({
      nama: r.nama,
      peran: r.peran,
      event_id: targetEvent.id,
      event_name: targetEvent.name,
      download_count: 0
    }));

    // Insert batch ke Supabase (maks 200 baris per request)
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const { error } = await sb.from("participants").insert(chunk);
      if (error) throw error;
    }

    await loadParticipants();
    showMsg('upload-msg', 'success', `Berhasil mengimport ${valid.length} peserta ke acara "${targetEvent.name}"!`);
    document.getElementById('preview-table').style.display = 'none';
    state.previewData = [];
  } catch (err) {
    console.error(err);
    showMsg('upload-msg', 'error', 'Gagal mengimport data: ' + (err.message || err));
  }
}

// ===== EXPORT DATA KE EXCEL =====
function exportPesertaToExcel() {
  const q = (document.getElementById('admin-search')?.value || '').toLowerCase();
  const filterEvent = document.getElementById('filter-event-select')?.value || '';
  const filterRole = (document.getElementById('filter-role-select')?.value || '').toLowerCase();

  const list = state.participants.filter(p => {
    const matchesQ = !q || p.nama.toLowerCase().includes(q) || (p.eventName && p.eventName.toLowerCase().includes(q));
    const matchesEvent = !filterEvent || p.eventId === filterEvent;
    const matchesRole = !filterRole || p.peran.toLowerCase().includes(filterRole);
    return matchesQ && matchesEvent && matchesRole;
  });

  if (list.length === 0) {
    alert('Tidak ada data peserta yang cocok untuk diexport.');
    return;
  }

  const rows = [
    ['No', 'Nama Lengkap', 'Peran', 'Kegiatan / Acara', 'Jumlah Unduh', 'Tanggal Terdaftar']
  ];

  list.forEach((p, i) => {
    rows.push([
      i + 1,
      p.nama,
      p.peran,
      p.eventName || '-',
      p.downloadCount || 0,
      p.createdAt ? fmtDate(p.createdAt) : '-'
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 6 }, { wch: 32 }, { wch: 24 }, { wch: 32 }, { wch: 14 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Data Peserta');
  XLSX.writeFile(wb, `Data_Peserta_HIMASI_${Date.now()}.xlsx`);
}

function exportDownloadsToExcel() {
  const q = (document.getElementById('stat-search')?.value || '').toLowerCase();
  const filterEvent = document.getElementById('filter-dl-event-select')?.value || '';

  const list = state.downloads.filter(d => {
    const matchesQ = !q || (d.participantName && d.participantName.toLowerCase().includes(q));
    const matchesEvent = !filterEvent || (d.eventId === filterEvent || (d.eventName && d.eventName === filterEvent));
    return matchesQ && matchesEvent;
  });

  if (list.length === 0) {
    alert('Tidak ada riwayat unduhan yang cocok untuk diexport.');
    return;
  }

  const rows = [
    ['No', 'Nama Peserta', 'Peran', 'Kegiatan / Acara', 'Waktu Pengunduhan']
  ];

  list.forEach((d, i) => {
    rows.push([
      i + 1,
      d.participantName,
      d.peran || 'Peserta',
      d.eventName || '-',
      fmtDate(d.downloadDate)
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 6 }, { wch: 32 }, { wch: 22 }, { wch: 32 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Riwayat Unduhan');
  XLSX.writeFile(wb, `Riwayat_Unduhan_HIMASI_${Date.now()}.xlsx`);
}

// ===== SETTINGS ACARA =====
async function saveSettings() {
  const ev = getActiveEvent();
  if (!ev) { alert('Pilih acara terlebih dahulu.'); return; }

  const nameEl = document.getElementById('tpl-event-name') || document.getElementById('event-name');
  const dateEl = document.getElementById('tpl-event-date') || document.getElementById('event-date');
  const eventName = (nameEl ? nameEl.value : '').trim();
  const eventDate = dateEl ? dateEl.value : '';

  if (!eventName) {
    alert('Nama kegiatan tidak boleh kosong.');
    if (nameEl) nameEl.focus();
    return;
  }

  try {
    const cleanDate = (eventDate && eventDate.trim()) ? eventDate.trim() : null;
    const { error } = await sb.from("events").update({
      name: eventName,
      date: cleanDate
    }).eq('id', ev.id);

    if (error) throw error;

    ev.name = eventName;
    ev.date = cleanDate;
    state.settings.eventName = eventName;
    state.settings.eventDate = cleanDate;

    renderEventDropdowns();
    const sel = document.getElementById('event-select');
    if (sel) sel.value = ev.id;

    const msg = document.getElementById('tpl-settings-msg') || document.getElementById('settings-msg');
    if (msg) {
      msg.style.display = 'block';
      setTimeout(() => msg.style.display = 'none', 3000);
    }
    renderDashboard();
  } catch (err) {
    console.error(err);
    alert("Gagal menyimpan pengaturan acara: " + (err.message || err));
  }
}

// ===== PESERTA TABLE =====
function renderPesertaTable() {
  const q = (document.getElementById('admin-search')?.value || '').toLowerCase();
  const filterEvent = document.getElementById('filter-event-select')?.value || '';
  const filterRole = (document.getElementById('filter-role-select')?.value || '').toLowerCase();

  const list = state.participants.filter(p => {
    const matchesQ = !q || p.nama.toLowerCase().includes(q) || (p.eventName && p.eventName.toLowerCase().includes(q));
    const matchesEvent = !filterEvent || p.eventId === filterEvent;
    const matchesRole = !filterRole || p.peran.toLowerCase().includes(filterRole);
    return matchesQ && matchesEvent && matchesRole;
  });

  const countInfo = document.getElementById('peserta-count-info');
  if (countInfo) {
    countInfo.textContent = `Menampilkan ${list.length} dari ${state.participants.length} data peserta`;
  }

  const tbody = document.getElementById('peserta-tbody');
  const empty = document.getElementById('empty-peserta');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = list.map((p, i) => {
    const pRole = (p.peran || 'Peserta').toLowerCase();
    let badgeClass = 'badge-primary';
    if (pRole.includes('panitia')) badgeClass = 'badge-gold';
    else if (pRole.includes('narasumber') || pRole.includes('moderator') || pRole.includes('pembicara')) badgeClass = 'badge-green';

    return `
<tr>
  <td style="color:var(--text-muted);font-size:12.5px;">${i + 1}</td>
  <td>
    <div style="font-weight:700;color:var(--text-main);">${escapeHtml(p.nama)}</div>
  </td>
  <td><span class="badge ${badgeClass}" style="font-size:11.5px;">${escapeHtml(p.peran)}</span></td>
  <td><span class="badge badge-gray" style="font-size:11.5px;">${escapeHtml(p.eventName || 'Acara')}</span></td>
  <td>
    <span style="font-weight:700;color:${p.downloadCount > 0 ? 'var(--success)' : 'var(--text-muted)'};">${p.downloadCount || 0}x</span>
  </td>
  <td style="text-align:right">
    <div style="display:inline-flex;gap:6px;justify-content:flex-end">
      <button class="btn btn-outline btn-sm" title="Unduh / Cetak Sertifikat" onclick="downloadCert('${p.id}')" style="padding:6px 10px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span>Cetak</span>
      </button>
      <button class="btn btn-outline btn-sm" onclick="editPeserta('${p.id}')" style="padding:6px 10px;">Edit</button>
      <button class="btn btn-sm" style="background:var(--danger-light);color:var(--danger);border:none;padding:6px 10px;" onclick="deletePeserta('${p.id}')">Hapus</button>
    </div>
  </td>
</tr>`;
  }).join('');
}

// ===== MODAL PESERTA =====
function showAddModal() {
  document.getElementById('modal-peserta-title').textContent = 'Tambah Peserta';
  document.getElementById('modal-edit-id').value = '';
  document.getElementById('modal-nama').value = '';
  document.getElementById('modal-peran').value = '';

  const modalSelect = document.getElementById('modal-event-select');
  if (modalSelect && state.activeEventId) {
    modalSelect.value = state.activeEventId;
  }

  document.getElementById('modal-error').style.display = 'none';
  document.getElementById('modal-peserta').style.display = 'flex';
}

function editPeserta(id) {
  const p = state.participants.find(x => x.id === id);
  if (!p) return;
  document.getElementById('modal-peserta-title').textContent = 'Edit Peserta';
  document.getElementById('modal-edit-id').value = id;
  document.getElementById('modal-nama').value = p.nama;
  document.getElementById('modal-peran').value = p.peran;

  const modalSelect = document.getElementById('modal-event-select');
  if (modalSelect && p.eventId) {
    modalSelect.value = p.eventId;
  }

  document.getElementById('modal-error').style.display = 'none';
  document.getElementById('modal-peserta').style.display = 'flex';
}

async function savePeserta() {
  const id = document.getElementById('modal-edit-id').value;
  const nama = document.getElementById('modal-nama').value.trim();
  const peran = document.getElementById('modal-peran').value.trim();
  const eventId = document.getElementById('modal-event-select').value;
  const ev = state.events.find(e => e.id === eventId) || getActiveEvent();
  const err = document.getElementById('modal-error');

  if (!nama) { err.textContent = 'Nama tidak boleh kosong.'; err.style.display = 'block'; return; }
  if (!peran) { err.textContent = 'Peran tidak boleh kosong.'; err.style.display = 'block'; return; }
  if (!ev) { err.textContent = 'Pilih acara terlebih dahulu.'; err.style.display = 'block'; return; }

  try {
    if (id) {
      const { error } = await sb.from("participants").update({
        nama,
        peran,
        event_id: ev.id,
        event_name: ev.name
      }).eq('id', id);
      if (error) throw error;
    } else {
      const { error } = await sb.from("participants").insert({
        nama,
        peran,
        event_id: ev.id,
        event_name: ev.name,
        download_count: 0
      });
      if (error) throw error;
    }
    await loadParticipants();
    closeModal();
  } catch (error) {
    console.error(error);
    err.textContent = "Gagal menyimpan: " + (error.message || error);
    err.style.display = "block";
  }
}

function deletePeserta(id) {
  const p = state.participants.find(x => x.id === id);
  if (!p) return;
  state.deleteId = id;
  document.getElementById('delete-name').textContent = p.nama + ` (${p.eventName})`;
  document.getElementById('modal-delete').style.display = 'flex';
}

async function confirmDelete() {
  if (state.deleteId) {
    try {
      const { error } = await sb.from("participants").delete().eq('id', state.deleteId);
      if (error) throw error;
      state.deleteId = null;
      await loadParticipants();
      closeModal();
    } catch (error) {
      console.error(error);
      alert("Gagal menghapus data: " + (error.message || error));
    }
  }
}

function closeModal() {
  const modalPeserta = document.getElementById('modal-peserta');
  const modalDelete = document.getElementById('modal-delete');
  const modalAddEvent = document.getElementById('modal-add-event');
  if (modalPeserta) modalPeserta.style.display = 'none';
  if (modalDelete) modalDelete.style.display = 'none';
  if (modalAddEvent) modalAddEvent.style.display = 'none';
  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.style.display = 'none';
  });
}

// ===== DASHBOARD EVENTS LIST & STATS =====
function renderDashboardEventList() {
  const container = document.getElementById('dashboard-events-list');
  if (!container) return;
  const active = getActiveEvent();
  if (state.events.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;grid-column:1/-1;">Belum ada acara terdaftar. Klik "+ Tambah Acara Baru" untuk membuat acara.</p>';
    return;
  }

  container.innerHTML = state.events.map(e => {
    const count = state.participants.filter(p => p.eventId === e.id).length;
    const hasTpl = !!e.template_url;
    const isActive = active && active.id === e.id;
    const dateStr = e.date ? new Date(e.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Tanggal belum diatur';
    return `
      <div class="event-ov-card" style="${isActive ? 'border-color:var(--primary);box-shadow:var(--shadow-sm);' : ''}">
        <div class="event-ov-header">
          <div class="event-ov-title">${escapeHtml(e.name)}</div>
          ${isActive ? '<span class="badge badge-primary" style="font-size:10px;">Aktif</span>' : ''}
        </div>
        <div class="event-ov-meta">
          📅 ${dateStr} &bull; <strong>${count}</strong> Peserta
        </div>
        <div style="margin-bottom:12px;">
          ${hasTpl 
            ? '<span class="badge badge-green" style="font-size:11px;">✓ Template HD Siap</span>' 
            : '<span class="badge" style="font-size:11px;background:var(--accent-gold-light);color:var(--accent-gold);border:1px solid var(--accent-gold-border);">⚠️ Belum Ada Template</span>'
          }
        </div>
        <div class="event-ov-footer" style="gap:6px; flex-wrap:wrap;">
          <button class="btn btn-outline btn-sm" style="flex:1; font-size:11.5px; padding:6px 8px;" onclick="onSwitchEvent('${e.id}'); showTab('template', document.querySelector('[data-tab=\\'template\\']'))">
            Atur Template
          </button>
          <button class="btn btn-outline btn-sm" style="flex:1; font-size:11.5px; padding:6px 8px;" onclick="onSwitchEvent('${e.id}'); showTab('upload-peserta', document.querySelector('[data-tab=\\'upload-peserta\\']'))">
            Import Peserta
          </button>
          <button class="btn btn-sm" style="background:var(--danger-light);color:var(--danger);border:none;padding:6px 10px;" title="Hapus Acara" onclick="deleteEventById('${e.id}')">
            &times;
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function renderDashboard() {
  const dTotal = document.getElementById('d-total');
  const dDl = document.getElementById('d-downloads');
  const dEv = document.getElementById('d-event');
  const dTemplate = document.getElementById('d-template');
  const dEventsCount = document.getElementById('d-events-count');

  const active = getActiveEvent();

  if (dTotal) dTotal.textContent = state.participants.length;
  if (dDl) dDl.textContent = state.downloads.length;
  if (dEventsCount) dEventsCount.textContent = state.events.length;
  if (dEv) dEv.textContent = active ? active.name : 'Belum diatur';
  if (dTemplate) dTemplate.textContent = (active && active.template_url) ? '✓ Siap (HD)' : 'Belum ada';

  renderDashboardEventList();

  const recent = [...state.downloads].sort((a, b) => b.downloadDate - a.downloadDate).slice(0, 5);
  const tbody = document.getElementById('recent-downloads');
  if (tbody) {
    if (recent.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);font-size:13px;padding:24px;">Belum ada riwayat unduhan sertifikat.</td></tr>';
    } else {
      tbody.innerHTML = recent.map(d => `
    <tr>
      <td>
        <strong>${escapeHtml(d.participantName)}</strong>
        ${d.eventName ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${escapeHtml(d.eventName)}</div>` : ''}
      </td>
      <td><span class="badge badge-gray" style="font-size:11.5px;">${escapeHtml(d.peran || 'Peserta')}</span></td>
      <td style="color:var(--text-muted);font-size:13px;">${fmtDate(d.downloadDate)}</td>
    </tr>`).join('');
    }
  }
}

// ===== STATISTIK =====
function renderStat() {
  const total = state.participants.length;
  const dl = state.downloads.length;
  const uniqueDl = state.downloads.filter((d, i, a) => a.findIndex(x => x.participantId === d.participantId) === i).length;
  const pct = total > 0 ? Math.round(uniqueDl / total * 100) : 0;
  
  const sTotal = document.getElementById('s-total');
  const sDl = document.getElementById('s-downloads');
  const sPct = document.getElementById('s-pct');
  if (sTotal) sTotal.textContent = total;
  if (sDl) sDl.textContent = dl;
  if (sPct) sPct.textContent = pct + '%';

  const q = (document.getElementById('stat-search')?.value || '').toLowerCase();
  const filterEvent = document.getElementById('filter-dl-event-select')?.value || '';

  const list = state.downloads.filter(d => {
    const matchesQ = !q || (d.participantName && d.participantName.toLowerCase().includes(q));
    const matchesEvent = !filterEvent || (d.eventId === filterEvent || (d.eventName && d.eventName === filterEvent));
    return matchesQ && matchesEvent;
  });

  const sorted = [...list].sort((a, b) => b.downloadDate - a.downloadDate);
  const tbody = document.getElementById('stat-tbody');
  const empty = document.getElementById('empty-stat');
  if (!tbody) return;

  if (sorted.length === 0) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = sorted.map((d, i) => `
<tr>
  <td style="color:var(--text-muted);font-size:12.5px;">${i + 1}</td>
  <td><strong>${escapeHtml(d.participantName)}</strong></td>
  <td><span class="badge badge-gray" style="font-size:11.5px;">${escapeHtml(d.peran || 'Peserta')}</span></td>
  <td><span class="badge badge-green" style="font-size:11.5px;">${escapeHtml(d.eventName || 'Acara')}</span></td>
  <td style="color:var(--text-muted);font-size:13px;">${fmtDate(d.downloadDate)}</td>
</tr>`).join('');
}

async function clearDownloads() {
  if (!confirm('Apakah Anda yakin ingin menghapus semua riwayat download?')) return;

  try {
    const { error: dlErr } = await sb.from("downloads").delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (dlErr) throw dlErr;

    const { error: pErr } = await sb.from("participants").update({ download_count: 0 }).neq('id', '00000000-0000-0000-0000-000000000000');
    if (pErr) throw pErr;

    await Promise.all([loadDownloads(), loadParticipants()]);
  } catch (err) {
    console.error(err);
    alert("Gagal menghapus riwayat: " + (err.message || err));
  }
}

// ===== HELPERS =====
function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function showMsg(id, type, txt) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = 'alert ' + (type === 'error' ? 'alert-error' : 'alert-success');
  el.textContent = txt;
  el.style.display = 'block';
}

function initTemplateUploadZone() {
  const zone = document.getElementById('template-upload-zone');
  if (!zone || zone.dataset.dropReady === '1') return;
  zone.dataset.dropReady = '1';

  ['dragenter', 'dragover'].forEach((evt) => {
    zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.add('dragover'); });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    zone.addEventListener(evt, (e) => { e.preventDefault(); zone.classList.remove('dragover'); });
  });
  zone.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) processTemplateFile(file);
  });
}

// ===== INIT =====
initCertEditorDrag();
// Shortcut keyboard rahasia panitia: Ctrl + Shift + A
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
    e.preventDefault();
    showPage(state.loggedIn ? 'admin' : 'login');
  }
});

function checkRoute() {
  const isStored = sessionStorage.getItem('certifynow_admin') === '1';
  state.loggedIn = isStored;

  const currentHash = (window.location.hash || '').toLowerCase();
  const searchParams = new URLSearchParams(window.location.search);

  // Blokir keras upaya penyusupan via #admin, #login, #atmin
  if (currentHash === '#admin' || currentHash === '#login' || currentHash === '#atmin') {
    if (!state.loggedIn) {
      try {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch (e) {}
      showPage('public');
      return;
    }
  }

  // Pintu masuk URL khusus panitia (?auth=himasi atau #himasi-internal-gate)
  if (searchParams.get('auth') === 'himasi' || currentHash === '#himasi-internal-gate') {
    showPage(state.loggedIn ? 'admin' : 'login');
    return;
  }

  // Saat baru buka, SELALU arahkan ke portal publik
  showPage('public');
}

window.addEventListener('load', checkRoute);
window.addEventListener('hashchange', checkRoute);
checkRoute();

// ===== GLOBAL EXPORTS TO WINDOW =====
window.showPage = showPage;
window.showTab = showTab;
window.doLogin = doLogin;
window.doLogout = doLogout;
window.doSearch = doSearch;
window.downloadCert = downloadCert;
window.onSelectPubEvent = onSelectPubEvent;
window.showAddEventModal = showAddEventModal;
window.createEvent = createEvent;
window.deleteActiveEvent = deleteActiveEvent;
window.deleteEventById = deleteEventById;
window.onSwitchEvent = onSwitchEvent;
window.saveSettings = saveSettings;
window.savePositions = savePositions;
window.resetPositionsDefault = resetPositionsDefault;
window.previewDummyPDF = previewDummyPDF;
window.handleTemplate = handleTemplate;
window.showAddModal = showAddModal;
window.editPeserta = editPeserta;
window.deletePeserta = deletePeserta;
window.confirmDelete = confirmDelete;
window.savePeserta = savePeserta;
window.closeModal = closeModal;
window.handleExcel = handleExcel;
window.renderPreview = renderPreview;
window.importData = importData;
window.downloadExcelTemplate = downloadExcelTemplate;
window.exportPesertaToExcel = exportPesertaToExcel;
window.exportDownloadsToExcel = exportDownloadsToExcel;
window.renderPesertaTable = renderPesertaTable;
window.renderDashboardEventList = renderDashboardEventList;
window.renderEventPills = renderEventPills;
window.clearDownloads = clearDownloads;
window.updateEditorStyle = updateEditorStyle;
window.toggleMobileMenu = toggleMobileMenu;
window.handleLogoSecretClick = handleLogoSecretClick;