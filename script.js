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

// ===== NAV =====
function showPage(p) {
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  const target = document.getElementById('page-' + p);
  if (target) target.classList.add('active');
  if (p === 'public') updatePublicStats();
  if (p === 'admin') {
    renderDashboard();
    renderPesertaTable();
    renderStat();
  }
}
window.showPage = showPage;

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
  updatePublicStats();
  renderDashboard();
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
    updatePublicStats();
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
    updatePublicStats();
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

// ===== LOGIN =====
function doLogin() {
  const email = (document.getElementById('login-email').value || '').trim().toLowerCase();
  const pass = (document.getElementById('login-pass').value || '').trim();
  const err = document.getElementById('login-error');

  const isValid = (
    (email === 'himasiubsikarawang@gmail.com' && pass === 'himasi7') ||
    (email === 'admin@certifynow.id' && pass === 'admin123') ||
    (email === 'admin' && pass === 'admin')
  );

  if (isValid) {
    state.loggedIn = true;
    sessionStorage.setItem('certifynow_admin', '1');
    err.style.display = 'none';
    showPage('admin');
  } else {
    err.textContent = 'Email atau password salah. Cek email & password Anda.';
    err.style.display = 'block';
  }
}

function doLogout() {
  state.loggedIn = false;
  sessionStorage.removeItem('certifynow_admin');
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

// ===== PUBLIC SEARCH =====
function doSearch() {
  const q = (document.getElementById('pub-search').value || '').trim().toLowerCase();
  const area = document.getElementById('result-area');
  if (!area) return;
  if (!q) { area.innerHTML = ''; return; }

  const matches = state.participants.filter(p => p.nama.toLowerCase().includes(q));
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
                <option value="${it.id}" data-role="${escapeHtml(it.peran)}" data-event="${escapeHtml(it.eventName || 'Acara')}" ${idx === 0 ? 'selected' : ''}>
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

          <button class="btn btn-primary btn-block btn-lg" onclick="downloadCert('${items[0].id}')">
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

function updatePublicStats() {
  const total = state.participants.length;
  const dl = state.downloads.length;
  const pubTotal = document.getElementById('pub-total');
  const pubDl = document.getElementById('pub-downloads');
  if (pubTotal) pubTotal.textContent = total;
  if (pubDl) pubDl.textContent = dl;
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
  const color = document.getElementById('cfg-color')?.value || fb.color || '#30338A';
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
    event: { ...readPos('drag-event', fb.event || { x: 148, y: 155 }), size: fb.event?.size || 12 },
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
  const color = document.getElementById('cfg-color')?.value || '#30338A';
  
  const n = document.getElementById('drag-name');
  const r = document.getElementById('drag-role');
  const e = document.getElementById('drag-event');
  
  if (n) { n.style.fontSize = nameSize + 'px'; n.style.color = color; }
  if (r) { r.style.fontSize = roleSize + 'px'; }
  if (e) { e.style.color = color; }
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

function renderPreview() {
  const tbody = document.getElementById('preview-tbody');
  tbody.innerHTML = state.previewData.map((r, i) => `
<tr>
  <td>${i + 1}</td>
  <td>${r.nama || '<span style="color:var(--danger)">kosong</span>'}</td>
  <td>${r.peran || '<span style="color:var(--danger)">kosong</span>'}</td>
  <td><span class="badge ${r.valid ? 'badge-green' : 'badge'}" style="${!r.valid ? 'background:var(--danger-light);color:var(--danger)' : ''}">${r.valid ? 'Valid' : 'Tidak Valid'}</span></td>
</tr>`).join('');
  document.getElementById('preview-table').style.display = 'block';
}

async function importData() {
  const valid = state.previewData.filter(r => r.valid);
  if (valid.length === 0) { showMsg('upload-msg', 'error', 'Tidak ada data valid.'); return; }

  const targetEventId = document.getElementById('upload-event-select')?.value;
  const targetEvent = state.events.find(e => e.id === targetEventId) || getActiveEvent();
  if (!targetEvent) {
    showMsg('upload-msg', 'error', 'Pilih acara target terlebih dahulu.');
    return;
  }

  showMsg('upload-msg', 'success', `Sedang mengimport ${valid.length} data ke acara "${targetEvent.name}"...`);

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
    updatePublicStats();
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

  const list = state.participants.filter(p => {
    const matchesQ = !q || p.nama.toLowerCase().includes(q) || (p.eventName && p.eventName.toLowerCase().includes(q));
    const matchesEvent = !filterEvent || p.eventId === filterEvent;
    return matchesQ && matchesEvent;
  });

  const tbody = document.getElementById('peserta-tbody');
  const empty = document.getElementById('empty-peserta');
  if (list.length === 0) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  tbody.innerHTML = list.map((p, i) => `
<tr>
  <td style="color:var(--text3)">${i + 1}</td>
  <td><strong>${p.nama}</strong></td>
  <td><span class="badge badge-gray">${p.peran}</span></td>
  <td><span class="badge badge-green" style="font-size:12px;">${p.eventName || 'Acara'}</span></td>
  <td>${p.downloadCount || 0}</td>
  <td>
    <div style="display:flex;gap:6px">
      <button class="btn btn-outline btn-sm" onclick="editPeserta('${p.id}')">Edit</button>
      <button class="btn btn-sm" style="background:var(--danger-light);color:var(--danger);border:none" onclick="deletePeserta('${p.id}')">Hapus</button>
    </div>
  </td>
</tr>`).join('');
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

// ===== DASHBOARD =====
function renderDashboard() {
  const dTotal = document.getElementById('d-total');
  const dDl = document.getElementById('d-downloads');
  const dEv = document.getElementById('d-event');
  const dTemplate = document.getElementById('d-template');

  const active = getActiveEvent();

  if (dTotal) dTotal.textContent = state.participants.length;
  if (dDl) dDl.textContent = state.downloads.length;
  if (dEv) dEv.textContent = active ? active.name : 'Belum diatur';
  if (dTemplate) dTemplate.textContent = (active && active.template_url) ? 'Aktif' : 'Belum ada';

  const recent = [...state.downloads].sort((a, b) => b.downloadDate - a.downloadDate).slice(0, 5);
  const tbody = document.getElementById('recent-downloads');
  if (tbody) {
    if (recent.length === 0) {
      tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;color:var(--text3);font-size:13px">Belum ada download.</td></tr>';
    } else {
      tbody.innerHTML = recent.map(d => `
    <tr>
      <td><strong>${d.participantName}</strong> ${d.eventName ? `<span style="font-size:12px;color:var(--text2)">(${d.eventName})</span>` : ''}</td>
      <td style="color:var(--text2)">${fmtDate(d.downloadDate)}</td>
    </tr>`).join('');
    }
  }
}

// ===== STATISTIK =====
function renderStat() {
  const total = state.participants.length;
  const dl = state.downloads.length;
  const pct = total > 0 ? Math.round(state.downloads.filter((d, i, a) => a.findIndex(x => x.participantId === d.participantId) === i).length / total * 100) : 0;
  
  const sTotal = document.getElementById('s-total');
  const sDl = document.getElementById('s-downloads');
  const sPct = document.getElementById('s-pct');
  if (sTotal) sTotal.textContent = total;
  if (sDl) sDl.textContent = dl;
  if (sPct) sPct.textContent = pct + '%';

  const sorted = [...state.downloads].sort((a, b) => b.downloadDate - a.downloadDate);
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
  <td style="color:var(--text3)">${i + 1}</td>
  <td><strong>${d.participantName}</strong></td>
  <td><span class="badge badge-gray">${d.peran}</span></td>
  <td><span class="badge badge-green" style="font-size:12px;">${d.eventName || 'Acara'}</span></td>
  <td style="color:var(--text2)">${fmtDate(d.downloadDate)}</td>
</tr>`).join('');
}

async function clearDownloads() {
  if (!confirm('Hapus semua riwayat download?')) return;

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
updatePublicStats();
initCertEditorDrag();
initTemplateUploadZone();
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function checkRoute() {
  const fullUrl = window.location.href.toLowerCase();
  const isStored = sessionStorage.getItem('certifynow_admin') === '1';
  if (isStored) {
    state.loggedIn = true;
  }

  if (fullUrl.includes('admin') || fullUrl.includes('atmin') || fullUrl.includes('login') || window.location.hash.includes('admin')) {
    showPage(state.loggedIn ? 'admin' : 'login');
  }
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
window.onSwitchEvent = onSwitchEvent;
window.saveSettings = saveSettings;
window.savePositions = savePositions;
window.handleTemplate = handleTemplate;
window.showAddModal = showAddModal;
window.editPeserta = editPeserta;
window.deletePeserta = deletePeserta;
window.confirmDelete = confirmDelete;
window.savePeserta = savePeserta;
window.closeModal = closeModal;
window.handleExcel = handleExcel;
window.importData = importData;
window.renderPesertaTable = renderPesertaTable;
window.clearDownloads = clearDownloads;
window.updateEditorStyle = updateEditorStyle;