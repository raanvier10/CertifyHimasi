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
      } catch (e) { }
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
function normalizeEventName(name) {
  if (!name) return '';
  return String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findEventForParticipant(p) {
  if (!p) return null;
  // 1. By ID
  if (p.eventId) {
    const found = state.events.find(e => e.id === p.eventId);
    if (found) return found;
  }
  // 2. By Exact Name
  if (p.eventName) {
    const pTrim = p.eventName.trim().toLowerCase();
    const found = state.events.find(e => (e.name || '').trim().toLowerCase() === pTrim);
    if (found) return found;
  }
  // 3. By Normalized / Fuzzy Name (misal 'WorkshopUiUX' vs 'Workshop UI/UX Design')
  if (p.eventName) {
    const pNorm = normalizeEventName(p.eventName);
    const found = state.events.find(e => {
      const eNorm = normalizeEventName(e.name);
      return eNorm === pNorm || (pNorm.length > 3 && (eNorm.includes(pNorm) || pNorm.includes(eNorm)));
    });
    if (found) return found;
  }
  return null;
}

function getActiveEvent() {
  if (state.activeEventId) {
    const found = state.events.find(e => e.id === state.activeEventId);
    if (found) return found;
  }
  return state.events[0] || null;
}

function onSwitchEvent(eventId) {
  if (eventId === '__NEW_EVENT__') {
    showAddEventModal();
    const active = getActiveEvent();
    const eventSelect = document.getElementById('event-select');
    if (eventSelect && active) eventSelect.value = active.id;
    return;
  }

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

  const dragEventEl = document.getElementById('drag-event');
  if (dragEventEl) {
    const dStr = ev.date ? new Date(ev.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    dragEventEl.textContent = `${ev.name || 'Nama Kegiatan'}${dStr ? ' | ' + dStr : ''}`;
  }

  setEditorTemplate(ev.template_url);
  applyPositions();
  renderEventPills();
  renderEventParticipantDownloadSelect();
  renderDashboard();
}

function renderEventPills() {
  const container = document.getElementById('event-pills-container');
  if (!container) return;
  const active = getActiveEvent();
  container.innerHTML = state.events.map(e => {
    const count = state.participants.filter(p => p.eventId === e.id).length;
    const isActive = active && active.id === e.id;
    const hasTpl = !!e.template_url;
    return `
      <button class="event-pill ${isActive ? 'active' : ''}" onclick="onSwitchEvent('${e.id}')" title="${escapeHtml(e.name)}${hasTpl ? ' (Template HD Siap)' : ' (Belum ada template)'}">
        <span>${escapeHtml(e.name)}</span>
        <span class="badge-counter">${count}</span>
        ${hasTpl ? '<span style="font-size:11px; margin-left:2px;" title="Template HD Siap">🖼️</span>' : ''}
      </button>
    `;
  }).join('');
}

function renderEventParticipantDownloadSelect() {
  const sel = document.getElementById('event-participant-download-select');
  if (!sel) return;
  const active = getActiveEvent();
  if (!active) {
    sel.innerHTML = '<option value="">-- Pilih Peserta --</option>';
    return;
  }
  const eventParticipants = state.participants.filter(p => p.eventId === active.id);
  if (eventParticipants.length === 0) {
    sel.innerHTML = '<option value="">(Belum ada peserta terdaftar di acara ini)</option>';
  } else {
    sel.innerHTML = '<option value="">-- Pilih Peserta (' + eventParticipants.length + ' Peserta) --</option>' +
      eventParticipants.map(p => `
        <option value="${p.id}">
          ${escapeHtml(p.nama)} (${escapeHtml(p.peran || 'Peserta')})
        </option>
      `).join('');
  }
}

async function downloadSelectedEventParticipantCert() {
  const sel = document.getElementById('event-participant-download-select');
  const participantId = sel ? sel.value : '';
  if (!participantId) {
    alert('Silakan pilih salah satu peserta dari dropdown terlebih dahulu.');
    return;
  }
  await downloadCert(participantId);
}

async function previewEventDummy(eventId) {
  const ev = state.events.find(e => e.id === eventId) || getActiveEvent();
  if (!ev) return;
  const dummy = {
    id: 'dummy',
    nama: 'ACHMAD FAUZI NUGRAHA',
    peran: 'Peserta',
    eventName: ev.name,
    eventId: ev.id
  };
  await generatePDF(dummy, ev);
}

function renderEventDropdowns() {
  const evs = state.events;
  const active = getActiveEvent();

  // 1. Selector di Tab Template
  const eventSelect = document.getElementById('event-select');
  if (eventSelect) {
    eventSelect.innerHTML = evs.map(e => `
      <option value="${e.id}" ${active && active.id === e.id ? 'selected' : ''}>
        ${escapeHtml(e.name)} ${e.date ? '(' + e.date + ')' : ''} ${e.template_url ? '✓' : '(tanpa template)'}
      </option>
    `).join('') + `
      <option value="__NEW_EVENT__" style="font-weight:700; color:var(--primary);">➕ + Buat Acara Baru...</option>
    `;
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
  renderEventParticipantDownloadSelect();
}

function showAddEventModal() {
  const modal = document.getElementById('modal-add-event');
  const nameInput = document.getElementById('new-event-name');
  const dateInput = document.getElementById('new-event-date');
  const err = document.getElementById('modal-event-error');

  if (nameInput) nameInput.value = '';
  if (dateInput) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
  }
  if (err) {
    err.textContent = '';
    err.style.display = 'none';
  }

  if (modal) {
    modal.style.display = 'flex';
    setTimeout(() => { if (nameInput) nameInput.focus(); }, 80);
  } else {
    // Fallback jika modal DOM terganggu
    const promptName = prompt('Masukkan Nama Kegiatan / Acara baru:');
    if (promptName && promptName.trim()) {
      quickCreateEvent(promptName.trim());
    }
  }
}

async function quickCreateEvent(name, date = null) {
  const initialPos = {
    name: { x: 148, y: 105, size: 32 },
    role: { x: 148, y: 132, size: 18 },
    color: '#1E255E'
  };
  let newEvent = null;
  if (sb) {
    try {
      const { data, error } = await sb.from('events').insert({
        name,
        date: date || null,
        positions: initialPos
      }).select();
      if (!error && data && data.length > 0) newEvent = data[0];
      if (error) console.error('Supabase insert error in quickCreateEvent:', error);
    } catch (e) {
      console.warn('Supabase insert fallback:', e);
    }
  }
  if (!newEvent) {
    newEvent = {
      id: 'ev_' + Date.now(),
      name,
      date: date || null,
      positions: initialPos,
      template_url: null
    };
  }
  state.events = state.events.filter(e => e.id !== newEvent.id);
  state.events.push(newEvent);
  state.activeEventId = newEvent.id;

  if (sb) {
    await loadEvents();
    state.activeEventId = newEvent.id;
  }

  renderEventDropdowns();
  renderEventPills();
  onSwitchEvent(newEvent.id);
  renderDashboard();
  const tabBtn = document.querySelector('.nav-item[data-tab="template"]');
  if (tabBtn) showTab('template', tabBtn);
  return newEvent;
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
    } else {
      alert('Nama kegiatan / acara tidak boleh kosong.');
    }
    if (nameInput) nameInput.focus();
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Menyimpan ke database...';
  }

  const initialPos = {
    name: { x: 148, y: 105, size: 32 },
    role: { x: 148, y: 132, size: 18 },
    color: '#1E255E'
  };
  const cleanDate = (date && date.trim()) ? date.trim() : null;

  try {
    let created = null;

    if (sb) {
      const { data, error } = await sb.from('events').insert({
        name,
        date: cleanDate,
        positions: initialPos
      }).select();

      if (error) {
        console.warn('Supabase insert warning, creating local event:', error);
      } else if (data && data.length > 0) {
        created = data[0];
      }
    }

    if (!created) {
      created = {
        id: 'ev_' + Date.now(),
        name,
        date: cleanDate,
        positions: initialPos,
        template_url: null
      };
    }

    // Perbarui state lokal segera
    state.events = state.events.filter(e => e.id !== created.id);
    state.events.push(created);
    state.activeEventId = created.id;

    closeModal();

    if (sb) {
      await loadEvents();
      // Pastikan activeEventId tetap acara yang baru dibuat
      state.activeEventId = created.id;
    }

    renderEventDropdowns();
    renderEventPills();
    onSwitchEvent(created.id);
    renderDashboard();

    // Beralih ke tab Template agar langsung bisa atur latar sertifikat
    const tabBtn = document.querySelector('.nav-item[data-tab="template"]');
    if (tabBtn) showTab('template', tabBtn);

    // Bersihkan form
    if (nameInput) nameInput.value = '';

    const msg = document.getElementById('tpl-settings-msg');
    if (msg) {
      msg.textContent = `Acara "${name}" berhasil dibuat dan tersimpan! Silakan unggah gambar template sertifikat di bawah.`;
      msg.style.display = 'block';
      setTimeout(() => msg.style.display = 'none', 5000);
    }

    alert(`Acara "${name}" berhasil ditambahkan ke database!\nSilakan unggah gambar template latar sertifikat untuk acara ini.`);

  } catch (e) {
    console.error('Gagal membuat acara:', e);
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
  // Muat events terlebih dahulu agar daftar events lengkap saat mengaitkan data peserta
  await loadEvents();
  await loadParticipants();
  await loadDownloads();

  // Setup Realtime Subscription
  if (sb) {
    sb.channel('certifynow-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, async () => {
        await loadEvents();
        await loadParticipants();
      })
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
    renderEventPills();
    renderEventParticipantDownloadSelect();

    const active = getActiveEvent();
    if (active) {
      const nameEl = document.getElementById('tpl-event-name') || document.getElementById('event-name');
      const dateEl = document.getElementById('tpl-event-date') || document.getElementById('event-date');
      if (nameEl) nameEl.value = active.name || '';
      if (dateEl) dateEl.value = active.date || '';

      state.settings.eventName = active.name || '';
      state.settings.eventDate = active.date || '';
      state.settings.certificateTemplate = active.template_url || null;
      state.settings.positions = active.positions || state.settings.positions;

      const dragEventEl = document.getElementById('drag-event');
      if (dragEventEl) {
        const dStr = active.date ? new Date(active.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
        dragEventEl.textContent = `${active.name || 'Nama Kegiatan'}${dStr ? ' | ' + dStr : ''}`;
      }

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
      // Cari kecocokan event berdasarkan event_id atau event_name
      let ev = state.events.find(e => e.id === r.event_id);
      if (!ev && r.event_name) {
        ev = state.events.find(e => (e.name || '').trim().toLowerCase() === r.event_name.trim().toLowerCase());
      }
      if (!ev && r.event_name) {
        const normR = normalizeEventName(r.event_name);
        ev = state.events.find(e => normalizeEventName(e.name) === normR);
      }
      if (!ev && state.events.length > 0 && !r.event_id) {
        ev = state.events[0];
      }

      return {
        id: r.id,
        nama: r.nama,
        peran: r.peran,
        eventId: r.event_id || (ev ? ev.id : null),
        eventName: r.event_name || (ev ? ev.name : 'Acara'),
        downloadCount: r.download_count || 0,
        createdAt: r.created_at
      };
    });
    renderEventPills();
    renderEventParticipantDownloadSelect();
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
  } catch (e) { }
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

// ===== HELPER: FORMAT BADGE PERAN =====
function formatRoleBadge(role) {
  if (!role) return { label: 'Peserta Resmi', type: 'peserta' };
  const r = String(role).trim();
  if (!r) return { label: 'Peserta Resmi', type: 'peserta' };
  const rLower = r.toLowerCase();

  // 1. Peserta
  if (rLower === 'peserta') return { label: 'Peserta Resmi', type: 'peserta' };

  // 2. Pemateri, Narasumber, Speaker, Pembicara, Moderator, dll.
  if (rLower === 'pemateri') return { label: 'Pemateri', type: 'pemateri' };
  if (rLower === 'narasumber' || rLower === 'speaker' || rLower === 'pembicara') return { label: 'Narasumber', type: 'narasumber' };
  if (rLower === 'moderator') return { label: 'Moderator Acara', type: 'moderator' };
  if (rLower === 'fasilitator') return { label: 'Fasilitator', type: 'fasilitator' };
  if (rLower === 'instruktur') return { label: 'Instruktur', type: 'instruktur' };
  if (rLower === 'trainer') return { label: 'Trainer', type: 'trainer' };
  if (rLower === 'mc' || rLower === 'master of ceremony') return { label: 'Master of Ceremony (MC)', type: 'mc' };
  if (rLower === 'juri' || rLower === 'dewan juri') return { label: 'Dewan Juri', type: 'juri' };

  // 3. Pimpinan Panitia / BPH
  if (rLower === 'ketua pelaksana' || rLower === 'ketua panitia' || rLower === 'ketua' || rLower === 'ketupel') {
    return { label: 'Ketua Pelaksana', type: 'panitia' };
  }
  if (rLower === 'wakil ketua' || rLower === 'wakil ketua pelaksana' || rLower === 'wakil ketua panitia') {
    return { label: 'Wakil Ketua Pelaksana', type: 'panitia' };
  }
  if (rLower === 'sekretaris' || rLower === 'sekretaris pelaksana') {
    return { label: 'Sekretaris Pelaksana', type: 'panitia' };
  }
  if (rLower === 'bendahara' || rLower === 'bendahara pelaksana') {
    return { label: 'Bendahara Pelaksana', type: 'panitia' };
  }
  if (rLower === 'penanggung jawab' || rLower === 'pj') {
    return { label: 'Penanggung Jawab', type: 'panitia' };
  }
  if (rLower === 'panitia' || rLower === 'panitia pelaksana') {
    return { label: 'Panitia Pelaksana', type: 'panitia' };
  }

  // 4. Jika sudah memuat format Panitia
  if (rLower.startsWith('panitia · ') || rLower.startsWith('panitia - ')) {
    return { label: r, type: 'panitia' };
  }

  // 5. Jika diawali Sie / Divisi / Koordinator
  if (rLower.startsWith('sie ') || rLower.startsWith('divisi ') || rLower.startsWith('koordinator ')) {
    const formatted = r.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    return { label: `Panitia · ${formatted}`, type: 'panitia' };
  }

  // 6. Divisi umum kepanitiaan (acara, konsumsi, pubdok, humas, dll.)
  const knownDivisions = [
    'acara', 'konsumsi', 'pubdok', 'dokumentasi', 'publikasi', 'perlengkapan', 
    'logistik', 'humas', 'keamanan', 'dekorasi', 'sponsorship', 'sponsor', 'ticketing', 
    'tiket', 'kesekretariatan', 'medis', 'kestari', 'desain', 'multimedia', 'it', 'lapangan'
  ];
  if (knownDivisions.includes(rLower)) {
    const titleCase = (rLower.length <= 4 && rLower !== 'it') 
      ? r.toUpperCase() 
      : (r.charAt(0).toUpperCase() + r.slice(1).toLowerCase());
    return { label: `Panitia · Sie ${titleCase}`, type: 'panitia' };
  }

  // 7. Jika berupa singkatan seksi (misal DOK, PRK, dll. 2-4 huruf)
  if (r.length <= 4 && /^[a-zA-Z]+$/.test(r) && rLower !== 'guru') {
    return { label: `Panitia · Sie ${r.toUpperCase()}`, type: 'panitia' };
  }

  // 8. Peran kustom lainnya (misal Tamu Undangan, Dosen Pendamping)
  const titleCase = r.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  return { label: titleCase, type: 'custom' };
}

// Helper: Nama kegiatan yang informatif dan tepat sesuai data peserta
function getResolvedEventName(item) {
  if (item && item.eventName && item.eventName !== 'Acara') return item.eventName;
  const ev = findEventForParticipant(item);
  if (ev && ev.name) return ev.name;
  if (item && item.eventName) return item.eventName;
  return 'Kegiatan Resmi HIMASI UBSI';
}

// ===== PUBLIC SEARCH WITH THREAT MITIGATION (SQLi / XSS / FLOOD) =====
function doSearch() {
  const inputEl = document.getElementById('pub-search');
  const heroEl = document.getElementById('hero-search');
  const rawQ = (inputEl ? inputEl.value : '') || '';
  const area = document.getElementById('result-area');
  if (!area) return;

  const trimmed = rawQ.trim();
  if (!trimmed) {
    area.innerHTML = '';
    if (heroEl) heroEl.classList.remove('search-active');
    return;
  }

  // Aktifkan mode kompak 1 layar
  if (heroEl) heroEl.classList.add('search-active');

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
    const firstItem = items[0];
    const initialEventName = getResolvedEventName(firstItem);
    const initialRole = formatRoleBadge(firstItem.peran);
    const getCleanId = (it) => {
      const rawId = it.id || String(Math.abs((it.nama || name).split('').reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0) | 0, 0)));
      return rawId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase() || 'HM26';
    };
    const cleanId = getCleanId(firstItem);

    return `
    <div class="pub-result-card">
      <div class="credential-header">
        <span class="credential-verified">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <polyline points="9 12 11 14 15 10"/>
          </svg>
          Terverifikasi
        </span>
        <span class="credential-id-badge" id="pub-cid-${gIdx}">CN-${cleanId}</span>
      </div>

      <!-- Recipient Presentation -->
      <div class="credential-recipient-box">
        <div class="credential-overline">Diterbitkan kepada</div>
        <h3 class="credential-name">${escapeHtml(name)}</h3>
      </div>

      <!-- Credential Details Grid -->
      <div class="credential-details-grid">
        <div class="detail-item-card">
          <div class="detail-item-lbl">Kegiatan</div>
          <div class="detail-item-val" id="pub-meta-event-${gIdx}">
            ${isMulti ? `
              <div class="credential-select-wrap">
                <select class="credential-event-select" id="pub-sel-${gIdx}" onchange="onSelectPubEvent(${gIdx})" oninput="onSelectPubEvent(${gIdx})">
                  ${items.map((it, idx) => {
                    const evN = getResolvedEventName(it);
                    const itCleanId = getCleanId(it);
                    return `
                      <option value="${escapeHtml(it.id)}" data-role="${escapeHtml(it.peran || '')}" data-event="${escapeHtml(evN)}" data-cid="CN-${itCleanId}" ${idx === 0 ? 'selected' : ''}>
                        ${escapeHtml(evN)}
                      </option>
                    `;
                  }).join('')}
                </select>
              </div>
            ` : escapeHtml(initialEventName)}
          </div>
        </div>

        <div class="detail-item-card">
          <div class="detail-item-lbl">Peran</div>
          <div class="detail-item-val">
            <span class="role-badge" id="pub-meta-role-${gIdx}">
              ${escapeHtml(initialRole.label)}
            </span>
          </div>
        </div>
      </div>

      <!-- Action Area -->
      <div class="credential-action-area">
        <button class="credential-btn-download" id="pub-btn-${gIdx}" onclick="${isMulti ? `downloadCert(document.getElementById('pub-sel-${gIdx}').value)` : `downloadCert('${escapeHtml(firstItem.id)}')`}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span>Unduh E-Sertifikat</span>
          <span class="btn-cert-badge">PDF HD</span>
        </button>
      </div>

      <!-- Security Trust Footer -->
      <div class="credential-trust-footer">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <span>Diverifikasi oleh HIMASI UBSI Karawang</span>
      </div>
    </div>`;
  }).join('');

  // Geser halus supaya kartu hasil langsung terlihat, tanpa mengubah tampilan hero
  requestAnimationFrame(() => {
    const first = area.firstElementChild;
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

function onSelectPubEvent(gIdx) {
  const sel = document.getElementById('pub-sel-' + gIdx);
  if (!sel) return;
  const opt = sel.options[sel.selectedIndex];
  if (!opt) return;
  const role = opt.getAttribute('data-role');
  const cid = opt.getAttribute('data-cid');
  const roleEl = document.getElementById('pub-meta-role-' + gIdx);
  const cidEl = document.getElementById('pub-cid-' + gIdx);
  if (roleEl) {
    const fRole = formatRoleBadge(role);
    roleEl.textContent = fRole.label;
  }
  if (cidEl && cid) {
    cidEl.textContent = cid;
  }
  const btn = document.getElementById('pub-btn-' + gIdx);
  if (btn && opt.value) {
    btn.setAttribute('onclick', `downloadCert('${opt.value}')`);
  }
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
  if (!p) {
    alert('Data peserta tidak ditemukan.');
    return;
  }

  // Cari event yang tepat untuk peserta ini
  let ev = findEventForParticipant(p);
  if (!ev) {
    ev = {
      id: p.eventId || 'unknown',
      name: p.eventName || 'Acara',
      date: '',
      template_url: null,
      positions: state.settings.positions
    };
  }

  // Cek apakah template untuk acara ini sudah ada
  let tpl = ev.template_url;
  if (!tpl && ev.name) {
    const norm = normalizeEventName(ev.name);
    const sister = state.events.find(e => e.template_url && normalizeEventName(e.name) === norm);
    if (sister) {
      tpl = sister.template_url;
      ev.template_url = tpl;
    }
  }

  if (!tpl) {
    alert(`Template sertifikat untuk acara "${ev.name}" belum diunggah oleh panitia. Silakan hubungi panitia pelaksana.`);
    return;
  }

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

  // Pastikan template KHUSUS acara ini, JANGAN pernah jatuh ke template acara lain yang terakhir diunggah!
  let tpl = (ev && ev.template_url) ? ev.template_url : null;
  if (!tpl && ev && ev.name) {
    const norm = normalizeEventName(ev.name);
    const sister = state.events.find(e => e.template_url && normalizeEventName(e.name) === norm);
    if (sister) tpl = sister.template_url;
  }

  const eventName = (ev && ev.name) ? ev.name : (p && p.eventName ? p.eventName : 'Sertifikat');
  const eventDate = (ev && ev.date) ? ev.date : '';

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
      doc.rect(10, 10, W - 20, H - 20, 'S');
    }
  } else {
    // Fallback bersih jika benar-benar tidak ada template
    doc.setFillColor(250, 238, 218);
    doc.rect(0, 0, W, H, 'F');
    doc.setDrawColor(186, 117, 23); doc.setLineWidth(1.5);
    doc.rect(10, 10, W - 20, H - 20, 'S');
  }

  doc.setTextColor(cfg.color || '#1C1C1A');

  // Cetak Nama
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(cfg.name.size);
  doc.text(p.nama, cfg.name.x, cfg.name.y, { align: 'center', baseline: 'middle' });

  // Cetak Peran
  doc.setFont('times', 'bold');
  doc.setFontSize(cfg.role.size);
  doc.text(p.peran, cfg.role.x, cfg.role.y, { align: 'center', baseline: 'middle' });

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

    // Pastikan item di state.events terupdate
    const evInState = state.events.find(e => e.id === ev.id);
    if (evInState) evInState.template_url = publicUrl;

    // Sinkronkan ke sister event dengan nama mirip jika ada
    const norm = normalizeEventName(ev.name);
    state.events.forEach(e => {
      if (normalizeEventName(e.name) === norm) {
        e.template_url = publicUrl;
        if (sb && e.id !== ev.id) {
          sb.from('events').update({ template_url: publicUrl }).eq('id', e.id).then();
        }
      }
    });

    showMsg('template-msg', 'success', `Template HD untuk "${ev.name}" berhasil disimpan tanpa kompresi!`);
    requestAnimationFrame(() => applyPositions());
    renderEventPills();
    renderEventDropdowns();
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

  const nameSize = document.getElementById('cfg-name-size');
  const roleSize = document.getElementById('cfg-role-size');
  const color = document.getElementById('cfg-color');
  if (nameSize && pos.name?.size) nameSize.value = pos.name.size;
  if (roleSize && pos.role?.size) roleSize.value = pos.role.size;
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
      try { if (activeEl.hasPointerCapture(e.pointerId)) activeEl.releasePointerCapture(e.pointerId); } catch (_) { }
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

    try { el.setPointerCapture(e.pointerId); } catch (_) { }
  });

  container.querySelectorAll('.draggable').forEach((el) => {
    el.addEventListener('dragstart', (ev) => ev.preventDefault());
  });
}

function updateEditorStyle() {
  const nameSize = document.getElementById('cfg-name-size')?.value || 32;
  const roleSize = document.getElementById('cfg-role-size')?.value || 18;
  const color = document.getElementById('cfg-color')?.value || '#1E255E';

  const n = document.getElementById('drag-name');
  const r = document.getElementById('drag-role');

  if (n) { n.style.fontSize = nameSize + 'px'; n.style.color = color; }
  if (r) { r.style.fontSize = roleSize + 'px'; }
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
  if (!['xlsx', 'xls', 'csv'].includes(ext)) {
    showMsg('upload-msg', 'error', 'Hanya menerima file .xlsx, .xls, atau .csv');
    return;
  }
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const wb = XLSX.read(e.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (!data || data.length === 0) {
        showMsg('upload-msg', 'error', 'File Excel kosong atau tidak terbaca.');
        return;
      }

      let headerRow = -1;
      let namaIdx = -1;
      let peranIdx = -1;
      let acaraIdx = -1;

      for (let i = 0; i < Math.min(5, data.length); i++) {
        const row = data[i].map(c => String(c || '').toLowerCase().trim());
        const nI = row.findIndex(c => c.includes('nama') || c === 'name');
        const pI = row.findIndex(c => c.includes('peran') || c.includes('role') || c.includes('jabatan'));
        const aI = row.findIndex(c => c.includes('acara') || c.includes('kegiatan') || c.includes('event'));
        if (nI >= 0 && (pI >= 0 || aI >= 0)) {
          headerRow = i;
          namaIdx = nI;
          peranIdx = pI;
          acaraIdx = aI;
          break;
        }
      }

      let rawRows = [];
      if (headerRow >= 0) {
        rawRows = data.slice(headerRow + 1);
      } else {
        // Fallback jika file tanpa header
        namaIdx = 0;
        peranIdx = 1;
        acaraIdx = 2;
        rawRows = data;
      }

      const validRows = rawRows.filter(r => {
        const n = String(r[namaIdx] || '').trim();
        const p = peranIdx >= 0 ? String(r[peranIdx] || '').trim() : '';
        const a = acaraIdx >= 0 ? String(r[acaraIdx] || '').trim() : '';
        return n || p || a;
      });

      const parsedItems = [];

      validRows.forEach((r, rowIdx) => {
        const rawNama = String(r[namaIdx] || '').trim();
        const rawPeran = peranIdx >= 0 ? String(r[peranIdx] || '').trim() : '';
        const rawAcara = acaraIdx >= 0 ? String(r[acaraIdx] || '').trim() : '';

        if (!rawNama) {
          parsedItems.push({
            rowNum: rowIdx + 1,
            nama: '',
            peran: rawPeran,
            acara: rawAcara,
            valid: false,
            error: 'Nama tidak boleh kosong'
          });
          return;
        }

        // Support pemisah koma atau baris baru untuk multi-kegiatan & multi-peran
        // Format contoh: Muhammad adam | PDD,Acara | Pengabdian,WorkshopUiUX
        const roles = rawPeran
          ? rawPeran.split(/[,;\n]/).map(s => s.trim()).filter(Boolean)
          : ['Peserta'];
        
        const events = rawAcara
          ? rawAcara.split(/[,;\n]/).map(s => s.trim()).filter(Boolean)
          : [];

        if (events.length > 0) {
          const maxCount = Math.max(events.length, roles.length);
          for (let k = 0; k < maxCount; k++) {
            const evName = events[k] || events[events.length - 1];
            const rRole = roles[k] || roles[roles.length - 1] || 'Peserta';
            parsedItems.push({
              rowNum: rowIdx + 1,
              nama: rawNama,
              peran: rRole,
              acara: evName,
              valid: !!(rawNama && rRole),
              error: null
            });
          }
        } else {
          if (roles.length > 1) {
            roles.forEach(rRole => {
              parsedItems.push({
                rowNum: rowIdx + 1,
                nama: rawNama,
                peran: rRole,
                acara: '',
                valid: !!(rawNama && rRole),
                error: null
              });
            });
          } else {
            parsedItems.push({
              rowNum: rowIdx + 1,
              nama: rawNama,
              peran: roles[0] || 'Peserta',
              acara: '',
              valid: !!(rawNama && (roles[0] || 'Peserta')),
              error: null
            });
          }
        }
      });

      state.previewData = parsedItems;
      if (state.previewData.length === 0) {
        showMsg('upload-msg', 'error', 'Tidak ada data valid yang dapat dibaca.');
        return;
      }

      showMsg('upload-msg', 'success', `Berhasil membaca & mengurai ${state.previewData.length} entri sertifikat dari file Excel.`);
      renderPreview();
    } catch (err) {
      console.error('Error membaca excel:', err);
      showMsg('upload-msg', 'error', 'Gagal memproses file Excel: ' + (err.message || err));
    }
  };
  reader.readAsBinaryString(file);
}

function downloadExcelTemplate() {
  const wsData = [
    ['Nama Lengkap', 'Peran', 'Kegiatan / Acara'],
    ['Muhammad Adam', 'PDD, Acara', 'Pengabdian, WorkshopUiUX'],
    ['Ahmad Fauzi Nugraha', 'Peserta', 'Workshop UI/UX Design'],
    ['Dian Pratama', 'Koordinator Acara', 'Seminar Nasional IT'],
    ['Dr. Hendra Gunawan, M.Kom.', 'Narasumber', 'Seminar Nasional IT'],
    ['Siti Rahmawati', 'Moderator', 'Workshop UI/UX Design']
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 30 }, { wch: 25 }, { wch: 32 }];
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

  const targetEventId = document.getElementById('upload-event-select')?.value;
  const defaultEvent = state.events.find(e => e.id === targetEventId) || getActiveEvent();
  const defaultEventName = defaultEvent ? defaultEvent.name : 'Acara Terpilih';

  tbody.innerHTML = state.previewData.map((r, i) => {
    const displayEvent = r.acara ? escapeHtml(r.acara) : `<span style="color:var(--text-muted);font-style:italic;">Default (${escapeHtml(defaultEventName)})</span>`;
    return `
<tr>
  <td style="color:var(--text-muted);font-size:12.5px;">${i + 1}</td>
  <td>${r.nama ? `<strong style="color:var(--text-main);">${escapeHtml(r.nama)}</strong>` : '<span style="color:var(--danger)">kosong</span>'}</td>
  <td>${r.peran ? escapeHtml(r.peran) : '<span style="color:var(--danger)">kosong</span>'}</td>
  <td>${displayEvent}</td>
  <td><span class="badge ${r.valid ? 'badge-green' : 'badge'}" style="${!r.valid ? 'background:var(--danger-light);color:var(--danger)' : ''}">${r.valid ? 'Valid' : 'Tidak Valid'}</span></td>
</tr>`;
  }).join('');
  document.getElementById('preview-table').style.display = 'block';
}

async function importData() {
  const valid = state.previewData.filter(r => r.valid);
  if (valid.length === 0) { showMsg('upload-msg', 'error', 'Tidak ada data valid untuk diimport.'); return; }

  const targetEventId = document.getElementById('upload-event-select')?.value;
  const defaultTarget = state.events.find(e => e.id === targetEventId) || getActiveEvent();

  showMsg('upload-msg', 'success', `Sedang memproses & mengimport ${valid.length} data peserta...`);

  try {
    // 1. Identifikasi semua nama acara unik dari Excel
    const acaraNames = [...new Set(valid.map(r => r.acara ? r.acara.trim() : '').filter(Boolean))];
    
    // 2. Buat acara otomatis di Supabase jika acara belum terdaftar
    for (const acName of acaraNames) {
      const exists = state.events.find(e => (e.name || '').trim().toLowerCase() === acName.toLowerCase());
      if (!exists && sb) {
        const initialPos = {
          name: { x: 148, y: 105, size: 32 },
          role: { x: 148, y: 132, size: 18 },
          event: { x: 148, y: 155, size: 12 },
          color: '#1E255E'
        };
        const { data: createdEv, error: evErr } = await sb.from('events').insert({
          name: acName,
          date: null,
          positions: initialPos
        }).select();
        
        if (!evErr && createdEv && createdEv.length > 0) {
          state.events.push(createdEv[0]);
        }
      }
    }

    // Refresh daftar events dari database
    await loadEvents();

    // 3. Susun data baris peserta sesuai ID acara yang cocok
    const rows = valid.map(r => {
      let matchedEv = null;
      if (r.acara) {
        matchedEv = state.events.find(e => (e.name || '').trim().toLowerCase() === r.acara.trim().toLowerCase());
      }
      if (!matchedEv) {
        matchedEv = defaultTarget || state.events[0];
      }

      return {
        nama: r.nama,
        peran: r.peran,
        event_id: matchedEv ? matchedEv.id : null,
        event_name: matchedEv ? matchedEv.name : (r.acara || 'Kegiatan'),
        download_count: 0
      };
    });

    // 4. Batch insert ke Supabase (maksimal 200 baris per request)
    if (sb) {
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        const { error } = await sb.from("participants").insert(chunk);
        if (error) throw error;
      }
    }

    await loadParticipants();
    renderEventDropdowns();
    renderPesertaTable();

    showMsg('upload-msg', 'success', `Berhasil mengimport ${valid.length} data sertifikat peserta ke sistem!`);
    document.getElementById('preview-table').style.display = 'none';
    state.previewData = [];

    const fin = document.getElementById('excel-input');
    if (fin) fin.value = '';
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

async function createEventFromForm() {
  const nameEl = document.getElementById('tpl-event-name') || document.getElementById('event-name');
  const dateEl = document.getElementById('tpl-event-date') || document.getElementById('event-date');
  const eventName = (nameEl ? nameEl.value : '').trim();
  const eventDate = dateEl ? dateEl.value : '';

  if (!eventName) {
    alert('Silakan ketik nama kegiatan terlebih dahulu pada kolom Nama Kegiatan.');
    if (nameEl) nameEl.focus();
    return;
  }

  const cleanDate = (eventDate && eventDate.trim()) ? eventDate.trim() : null;
  const newEv = await quickCreateEvent(eventName, cleanDate);
  alert(`Acara "${eventName}" berhasil dibuat dan disimpan ke database!\nSilakan unggah gambar template latar sertifikat untuk acara ini.`);
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
    else if (pRole.includes('narasumber') || pRole.includes('moderator') || pRole.includes('pembicara') || pRole.includes('pemateri')) badgeClass = 'badge-green';

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
          <button class="btn btn-primary btn-sm" style="flex:1; font-size:11.5px; padding:6px 8px;" onclick="onSwitchEvent('${e.id}'); showTab('template', document.querySelector('[data-tab=\\'template\\']'))">
            Atur Template
          </button>
          <button class="btn btn-outline btn-sm" style="flex:1; font-size:11.5px; padding:6px 8px;" onclick="previewEventDummy('${e.id}')" title="Uji Cetak Contoh PDF">
            Uji Cetak
          </button>
          <button class="btn btn-outline btn-sm" style="flex:1; font-size:11.5px; padding:6px 8px;" onclick="onSwitchEvent('${e.id}'); showTab('upload-peserta', document.querySelector('[data-tab=\\'upload-peserta\\']'))">
            Import
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
      } catch (e) { }
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
window.formatRoleBadge = formatRoleBadge;
window.getResolvedEventName = getResolvedEventName;
window.downloadCert = downloadCert;
window.onSelectPubEvent = onSelectPubEvent;
window.showAddEventModal = showAddEventModal;
window.createEvent = createEvent;
window.quickCreateEvent = quickCreateEvent;
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
window.downloadSelectedEventParticipantCert = downloadSelectedEventParticipantCert;
window.previewEventDummy = previewEventDummy;
window.createEventFromForm = createEventFromForm;