export class FileManager {
  constructor() {
    this.files = [];
    this._listeners = {};
    this._activeCabinet = null;

    this._setupDOM();
  }

  // ─── DOM wiring ───────────────────────────────────────────────
  _setupDOM() {
    const input = document.getElementById('file-input');
    const uploadBtn = document.getElementById('upload-btn');
    const closeBtn = document.getElementById('cabinet-close');
    const viewerClose = document.getElementById('viewer-close');

    uploadBtn?.addEventListener('click', () => input?.click());

    input?.addEventListener('change', (e) => {
      [...(e.target.files || [])].forEach(f => this.add(f));
      input.value = '';
      // refresh cabinet UI
      if (this._activeCabinet) this.openCabinetUI(this._activeCabinet);
    });

    closeBtn?.addEventListener('click', () => this.closeCabinetUI());
    viewerClose?.addEventListener('click', () => this.closeViewer());

    // Close viewer on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.isViewerOpen()) this.closeViewer();
      }
    });
  }

  // ─── File management ─────────────────────────────────────────
  add(file) {
    const url = URL.createObjectURL(file);
    const cat = this._categorize(file.type, file.name);
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      type: file.type,
      size: file.size,
      cat,
      url,
      addedAt: Date.now(),
    };
    this.files.push(entry);
    this._emit('add', entry);
    return entry;
  }

  remove(id) {
    const idx = this.files.findIndex(f => f.id === id);
    if (idx === -1) return;
    URL.revokeObjectURL(this.files[idx].url);
    this.files.splice(idx, 1);
    this._emit('remove', id);
  }

  getAll(cat = 'all') {
    if (cat === 'all') return [...this.files];
    return this.files.filter(f => f.cat === cat);
  }

  _categorize(mime, name = '') {
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    const ext = name.split('.').pop().toLowerCase();
    const docExts = ['pdf', 'doc', 'docx', 'txt', 'md', 'xls', 'xlsx', 'ppt', 'pptx', 'csv'];
    if (mime.includes('pdf') || mime.includes('text') || docExts.includes(ext)) return 'document';
    return 'other';
  }

  // ─── Cabinet UI ──────────────────────────────────────────────
  openCabinetUI(cabinet) {
    this._activeCabinet = cabinet;
    const ui = document.getElementById('cabinet-ui');
    const list = document.getElementById('cabinet-file-list');
    const catBadge = document.getElementById('cabinet-cat');

    const cat = cabinet.category;
    const catLabels = {
      all: 'ALL FILES', image: 'IMAGES', video: 'VIDEOS',
      audio: 'AUDIO', document: 'DOCUMENTS', other: 'OTHER',
    };
    catBadge.textContent = catLabels[cat] || cat.toUpperCase();

    const files = this.getAll(cat);
    list.innerHTML = '';

    if (files.length === 0) {
      list.innerHTML = `<div class="empty-msg">NO FILES HERE<br>ADD SOME WITH THE BUTTON BELOW</div>`;
    } else {
      files.forEach(f => {
        const el = document.createElement('div');
        el.className = 'file-item';
        el.innerHTML = `
          <span class="icon">${this._icon(f.cat)}</span>
          <span class="name">${f.name}</span>
          <span class="size">${this._fmtSize(f.size)}</span>
        `;
        el.addEventListener('click', () => this.openViewer(f));
        list.appendChild(el);
      });
    }

    ui.classList.add('open');

    // Release pointer lock so mouse works in UI
    if (document.pointerLockElement) document.exitPointerLock();
  }

  closeCabinetUI() {
    const ui = document.getElementById('cabinet-ui');
    ui.classList.remove('open');
    this._activeCabinet = null;
    // Tell game to re-show lock screen
    window._game?.onUIClose();
  }

  isCabinetOpen() {
    return document.getElementById('cabinet-ui').classList.contains('open');
  }

  // ─── File viewer ─────────────────────────────────────────────
  openViewer(file) {
    const viewer = document.getElementById('file-viewer');
    const content = document.getElementById('viewer-content');
    const name = document.getElementById('viewer-name');

    content.innerHTML = '';
    name.textContent = file.name;

    if (file.cat === 'image') {
      const img = document.createElement('img');
      img.src = file.url;
      content.appendChild(img);
    } else if (file.cat === 'video') {
      const vid = document.createElement('video');
      vid.src = file.url;
      vid.controls = true;
      vid.autoplay = true;
      content.appendChild(vid);
    } else if (file.cat === 'audio') {
      const aud = document.createElement('audio');
      aud.src = file.url;
      aud.controls = true;
      content.appendChild(aud);
    } else {
      const div = document.createElement('div');
      div.className = 'doc-preview';
      div.innerHTML = `
        ${this._icon(file.cat)} &nbsp; ${file.name}<br><br>
        <a href="${file.url}" download="${file.name}">DOWNLOAD FILE</a>
      `;
      content.appendChild(div);
    }

    viewer.classList.add('open');
  }

  closeViewer() {
    const viewer = document.getElementById('file-viewer');
    viewer.classList.remove('open');
    // Stop any video
    const vid = viewer.querySelector('video');
    if (vid) { vid.pause(); vid.src = ''; }
  }

  isViewerOpen() {
    return document.getElementById('file-viewer').classList.contains('open');
  }

  isAnyUIOpen() {
    return this.isCabinetOpen() || this.isViewerOpen();
  }

  // ─── Helpers ─────────────────────────────────────────────────
  _icon(cat) {
    return { image: '🖼', video: '🎬', audio: '🎵', document: '📄', other: '📦' }[cat] || '📁';
  }

  _fmtSize(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / 1048576).toFixed(1)}MB`;
  }

  on(event, cb) {
    (this._listeners[event] ??= []).push(cb);
  }

  _emit(event, data) {
    (this._listeners[event] || []).forEach(cb => cb(data));
  }
}
