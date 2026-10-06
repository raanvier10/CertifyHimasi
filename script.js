// Supabase Client Configuration
const SUPABASE_URL = "https://xzdkthtqemwjeetthged.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ySOjaWeHsWHIGNSSF8V59w_zwVGvOJu";
const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

// ===== STATE =====
let state = {
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
  if (p === 'admin') { renderDashboard(); renderPesertaTable(); renderStat(); }
}
window.showPage = showPage;

// ===== SINKRONISASI DATA SUPABASE =====
async function syncData() {
  await Promise.all([
    loadSettings(),
    loadParticipants(),
    loadDownloads()
  ]);

  // Setup Realtime Subscription
  if (sb) {
    sb.channel('certifynow-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => loadSettings())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, () => loadParticipants())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'downloads' }, () => loadDownloads())
      .subscribe();
  }
}

async function loadSettings() {
  if (!sb) return;
  try {
    const { data, error } = await sb.from('settings').select('*').eq('id', 'main').single();
    if (error && error.code !== 'PGRST116') throw error;
    if (data) {
      state.settings = {
        ...state.settings,
        eventName: data.event_name || state.settings.eventName,
        eventDate: data.event_date || state.settings.eventDate,
        certificateTemplate: data.certificate_template || null,
        positions: {
          ...state.settings.positions,
          ...(data.positions || {})
        }
      };
      updatePublicStats();

      const nameEl = document.getElementById('event-name');
      const dateEl = document.getElementById('event-date');
      if (nameEl && data.event_name) nameEl.value = data.event_name;
      if (dateEl && data.event_date) dateEl.value = data.event_date;

      setEditorTemplate(state.settings.certificateTemplate);
      applyPositions();
    }
  } catch (err) {
    console.error("Gagal load settings:", err);
  }
}

async function loadParticipants() {
  if (!sb) return;
  try {
    const { data, error } = await sb.from('participants').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    state.participants = (data || []).map(r => ({
      id: r.id,
      nama: r.nama,
      peran: r.peran,
      downloadCount: r.download_count || 0,
      createdAt: r.created_at
    }));
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
      downloadDate: r.download_date ? new Date(r.download_date) : null
    }));
    if (document.getElementById('page-admin') && document.getElementById('page-admin').classList.contains('active')) {
      renderDashboard();
    }
  } catch (err) {
    console.error("Gagal load downloads:", err);
  }
}

// Ambil data saat inisialisasi
syncData();

function showTab(tab, el) {
  document.querySelectorAll('[id^="tab-"]').forEach(x => x.style.display = 'none');
  document.getElementById('tab-' + tab).style.display = 'block';
  document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
  if (el) el.classList.add('active');
  const titles = { dashboard: 'Dashboard', 'upload-peserta': 'Upload Data Peserta', kelola: 'Kelola Peserta', template: 'Upload Template', statistik: 'Statistik' };
  document.getElementById('admin-title').textContent = titles[tab] || tab;
  if (tab === 'statistik') renderStat();
  if (tab === 'kelola') renderPesertaTable();
  if (tab === 'dashboard') renderDashboard();
  if (tab === 'template') {
    setEditorTemplate(state.settings.certificateTemplate);
    requestAnimationFrame(() => applyPositions());
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

// ===== PUBLIC SEARCH =====
function doSearch() {
  const q = document.getElementById('pub-search').value.trim().toLowerCase();
  const area = document.getElementById('result-area');
  if (!q) { area.innerHTML = ''; return; }
  const found = state.participants.find(p => p.nama.toLowerCase().includes(q));
  if (found) {
    area.innerHTML = `
  <div class="result-card">
    <span class="badge badge-green">✓ Data Ditemukan</span>
    <div class="r-name">${found.nama}</div>
    <div class="r-role">${found.peran}</div>
    <div class="r-status">Status: Terdaftar sebagai ${found.peran}</div>
    <button class="btn btn-primary" onclick="downloadCert('${found.id}')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Unduh Sertifikat
    </button>
  </div>`;
  } else {
    area.innerHTML = `<div class="not-found">😔 Nama tidak ditemukan. Pastikan nama sesuai dengan saat pendaftaran.</div>`;
  }
}

function updatePublicStats() {
  const total = state.participants.length;
  const dl = state.downloads.length;
  document.getElementById('pub-total').textContent = total;
  document.getElementById('pub-downloads').textContent = dl;
  const evEl = document.getElementById('pub-event');
  if (evEl) {
    evEl.textContent = state.settings.eventName || '—';
    evEl.style.fontSize = '14px';
  }
}

// ===== DOWNLOAD / GENERATE CERT =====
async function downloadCert(id) {
  const p = state.participants.find(x => x.id === id);
  if (!p) return;

  try {
    if (sb) {
      await sb.from("downloads").insert({
        participant_id: id,
        participant_name: p.nama,
        peran: p.peran,
        download_date: new Date().toISOString()
      });

      await sb.rpc('increment_download', { row_id: id });
      loadDownloads();
    }
  } catch (err) {
    console.error("Gagal mencatat download:", err);
  }

  await generatePDF(p);
}

// GENERATE PDF RESOLUSI TINGGI (HD): Mempertahankan kualitas asli tanpa kompresi buram
async function generatePDF(p) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: false });
  const W = 297, H = 210;
  const cfg = state.settings.positions;

  // Render Background Template Gambar
  const tpl = state.settings.certificateTemplate;
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
  const dateStr = state.settings.eventDate ? new Date(state.settings.eventDate).toLocaleDateString('id-ID', {day:'numeric', month:'long', year:'numeric'}) : '';
  doc.text(`${state.settings.eventName} | ${dateStr}`, cfg.event.x, cfg.event.y, { align: 'center', baseline: 'middle' });

  doc.save(`Sertifikat_${p.nama.replace(/\s+/g, '_')}.pdf`);
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
    if (label) label.textContent = 'Klik atau seret untuk mengganti template';
  } else {
    img.removeAttribute('src');
    img.style.display = 'none';
    if (placeholder) placeholder.style.display = 'flex';
    if (label) label.textContent = 'Klik atau seret template sertifikat di sini';
  }
}

async function processTemplateFile(file) {
  if (!file) return;

  const ext = file.name.split('.').pop().toLowerCase();
  if (!['png', 'jpg', 'jpeg'].includes(ext)) {
    showMsg('template-msg', 'error', 'Hanya menerima file PNG atau JPG.');
    return;
  }

  showMsg('template-msg', 'success', 'Mengunggah template HD ke Supabase Storage (kualitas penuh)...');

  try {
    const fileName = `template_${Date.now()}.${ext}`;
    
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
    setEditorTemplate(publicUrl);
    state.settings.certificateTemplate = publicUrl;

    // Simpan link URL ke tabel settings di database
    const { error: updateError } = await sb
      .from('settings')
      .update({ certificate_template: publicUrl })
      .eq('id', 'main');

    if (updateError) throw updateError;

    showMsg('template-msg', 'success', 'Template HD berhasil disimpan tanpa kompresi!');
    requestAnimationFrame(() => applyPositions());
  } catch (err) {
    console.error('Gagal mengunggah template:', err);
    showMsg('template-msg', 'error', 'Gagal memproses template: ' + (err.message || err));
  }
}

function getImageDimensions(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => { resolve({ width: img.width, height: img.height }); };
      img.onerror = () => resolve(null);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

async function handleTemplate(input) {
  const file = input.files?.[0];
  await processTemplateFile(file);
  input.value = '';
}

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
  const nameSize = document.getElementById('cfg-name-size').value;
  const roleSize = document.getElementById('cfg-role-size').value;
  const color = document.getElementById('cfg-color').value;
  
  const n = document.getElementById('drag-name');
  const r = document.getElementById('drag-role');
  const e = document.getElementById('drag-event');
  
  if (n) { n.style.fontSize = nameSize + 'px'; n.style.color = color; }
  if (r) { r.style.fontSize = roleSize + 'px'; }
  if (e) { e.style.color = color; }
}

async function savePositions() {
  const container = document.getElementById('canvas-container');
  if (!container) return;
  const rect = container.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    alert('Kanvas belum siap. Buka tab Upload Template lalu coba lagi.');
    return;
  }

  const newPositions = getEditorPositions();

  try {
    state.settings.positions = newPositions;
    const { error } = await sb.from("settings").update({
      positions: newPositions
    }).eq('id', 'main');

    if (error) throw error;
    
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
  
  showMsg('upload-msg', 'success', `Sedang mengimport ${valid.length} data...`);
  
  try {
    const rows = valid.map(r => ({
      nama: r.nama,
      peran: r.peran,
      download_count: 0
    }));

    // Insert batch ke Supabase (maks 200 baris per request)
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const { error } = await sb.from("participants").insert(chunk);
      if (error) throw error;
    }
    
    await loadParticipants();
    showMsg('upload-msg', 'success', `Berhasil mengimport ${valid.length} peserta!`);
    document.getElementById('preview-table').style.display = 'none';
    state.previewData = [];
  } catch (err) {
    console.error(err);
    showMsg('upload-msg', 'error', 'Gagal mengimport data: ' + (err.message || err));
  }
}

// ===== SETTINGS =====
async function saveSettings() {
  const eventName = document.getElementById('event-name').value;
  const eventDate = document.getElementById('event-date').value;
  
  try {
    const { error } = await sb.from("settings").update({
      event_name: eventName,
      event_date: eventDate,
      positions: state.settings.positions,
      certificate_template: state.settings.certificateTemplate
    }).eq('id', 'main');

    if (error) throw error;

    const msg = document.getElementById('settings-msg');
    if (msg) {
      msg.style.display = 'block';
      setTimeout(() => msg.style.display = 'none', 2500);
    }
  } catch (err) {
    console.error(err);
    alert("Gagal menyimpan pengaturan: " + (err.message || err));
  }
}

// ===== PESERTA TABLE =====
function renderPesertaTable() {
  const q = (document.getElementById('admin-search')?.value || '').toLowerCase();
  const list = state.participants.filter(p => !q || p.nama.toLowerCase().includes(q));
  const tbody = document.getElementById('peserta-tbody');
  const empty = document.getElementById('empty-peserta');
  if (list.length === 0) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  tbody.innerHTML = list.map((p, i) => `
<tr>
  <td style="color:var(--text3)">${i + 1}</td>
  <td><strong>${p.nama}</strong></td>
  <td><span class="badge badge-gray">${p.peran}</span></td>
  <td>${p.downloadCount || 0}</td>
  <td>
    <div style="display:flex;gap:6px">
      <button class="btn btn-outline btn-sm" onclick="editPeserta('${p.id}')">Edit</button>
      <button class="btn btn-sm" style="background:var(--danger-light);color:var(--danger);border:none" onclick="deletePeserta('${p.id}')">Hapus</button>
    </div>
  </td>
</tr>`).join('');
}

// ===== MODAL =====
function showAddModal() {
  document.getElementById('modal-peserta-title').textContent = 'Tambah Peserta';
  document.getElementById('modal-edit-id').value = '';
  document.getElementById('modal-nama').value = '';
  document.getElementById('modal-peran').value = '';
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
  document.getElementById('modal-error').style.display = 'none';
  document.getElementById('modal-peserta').style.display = 'flex';
}

async function savePeserta() {
  const id = document.getElementById('modal-edit-id').value;
  const nama = document.getElementById('modal-nama').value.trim();
  const peran = document.getElementById('modal-peran').value.trim();
  const err = document.getElementById('modal-error');
  if (!nama) { err.textContent = 'Nama tidak boleh kosong.'; err.style.display = 'block'; return; }
  if (!peran) { err.textContent = 'Peran tidak boleh kosong.'; err.style.display = 'block'; return; }
  
  try {
    if (id) {
      const { error } = await sb.from("participants").update({ nama, peran }).eq('id', id);
      if (error) throw error;
    } else {
      const { error } = await sb.from("participants").insert({
        nama,
        peran,
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
  document.getElementById('delete-name').textContent = p.nama;
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
  document.getElementById('modal-peserta').style.display = 'none';
  document.getElementById('modal-delete').style.display = 'none';
}

// ===== DASHBOARD =====
function renderDashboard() {
  document.getElementById('d-total').textContent = state.participants.length;
  document.getElementById('d-downloads').textContent = state.downloads.length;
  document.getElementById('d-event').textContent = state.settings.eventName || 'Belum diatur';
  document.getElementById('d-template').textContent = state.settings.certificateTemplate ? 'Aktif' : 'Belum ada';
  const recent = [...state.downloads].sort((a, b) => b.downloadDate - a.downloadDate).slice(0, 5);
  const tbody = document.getElementById('recent-downloads');
  if (recent.length === 0) {
    tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;color:var(--text3);font-size:13px">Belum ada download.</td></tr>';
  } else {
    tbody.innerHTML = recent.map(d => `
  <tr><td><strong>${d.participantName}</strong></td>
  <td style="color:var(--text2)">${fmtDate(d.downloadDate)}</td></tr>`).join('');
  }
}

// ===== STATISTIK =====
function renderStat() {
  const total = state.participants.length;
  const dl = state.downloads.length;
  const pct = total > 0 ? Math.round(state.downloads.filter((d, i, a) => a.findIndex(x => x.participantId === d.participantId) === i).length / total * 100) : 0;
  document.getElementById('s-total').textContent = total;
  document.getElementById('s-downloads').textContent = dl;
  document.getElementById('s-pct').textContent = pct + '%';
  const sorted = [...state.downloads].sort((a, b) => b.downloadDate - a.downloadDate);
  const tbody = document.getElementById('stat-tbody');
  const empty = document.getElementById('empty-stat');
  if (sorted.length === 0) { tbody.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  tbody.innerHTML = sorted.map((d, i) => `
<tr>
  <td style="color:var(--text3)">${i + 1}</td>
  <td><strong>${d.participantName}</strong></td>
  <td><span class="badge badge-gray">${d.peran}</span></td>
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