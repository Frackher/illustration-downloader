const DEFAULTS = {
  saveFolder: 'Illustrations',
  askEachTime: false,
  nsfwEnabled: false,
  squareRatioMin: 0.9,
  squareRatioMax: 1.1,
  localeOverride: 'auto'
};

const IDB_NAME = 'ImgDownloader';
const IDB_STORE = 'handles';
const HANDLE_KEY = 'downloadDir';

function openDB() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(IDB_NAME, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore(IDB_STORE); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function getStoredHandle() {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(IDB_STORE, 'readonly');
    const req = t.objectStore(IDB_STORE).get(HANDLE_KEY);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

function setStoredHandle(handle) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(IDB_STORE, 'readwrite');
    const req = t.objectStore(IDB_STORE).put(handle, HANDLE_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  }));
}

function deleteStoredHandle() {
  return openDB().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(IDB_STORE, 'readwrite');
    const req = t.objectStore(IDB_STORE).delete(HANDLE_KEY);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  }));
}

function getValues() {
  const raw = document.getElementById('saveFolder').value.trim();
  const saveFolder = raw.replace(/[/\\]+/g, '/').replace(/^\/|\/$/g, '') || DEFAULTS.saveFolder;
  const localeMode = document.querySelector('input[name="localeMode"]:checked').value;
  const localeOverride = localeMode === 'auto' ? 'auto' : document.getElementById('customLocale').value;
  return {
    saveFolder,
    askEachTime: document.getElementById('askEachTime').checked,
    nsfwEnabled: document.getElementById('nsfwEnabled').checked,
    squareRatioMin: Math.max(0.5, Math.min(1, parseFloat(document.getElementById('squareRatioMin').value) || DEFAULTS.squareRatioMin)),
    squareRatioMax: Math.max(1, Math.min(2, parseFloat(document.getElementById('squareRatioMax').value) || DEFAULTS.squareRatioMax)),
    localeOverride: localeOverride ?? DEFAULTS.localeOverride
  };
}

function setValues(opts) {
  document.getElementById('saveFolder').value = opts.saveFolder ?? DEFAULTS.saveFolder;
  document.getElementById('askEachTime').checked = opts.askEachTime ?? DEFAULTS.askEachTime;
  document.getElementById('nsfwEnabled').checked = opts.nsfwEnabled ?? DEFAULTS.nsfwEnabled;
  document.getElementById('squareRatioMin').value = opts.squareRatioMin ?? DEFAULTS.squareRatioMin;
  document.getElementById('squareRatioMax').value = opts.squareRatioMax ?? DEFAULTS.squareRatioMax;
  const localeOverride = opts.localeOverride ?? DEFAULTS.localeOverride;
  if (localeOverride === 'auto') {
    document.getElementById('localeAuto').checked = true;
    document.getElementById('customLocaleWrap').style.display = 'none';
  } else {
    document.getElementById('localeCustom').checked = true;
    document.getElementById('customLocale').value = localeOverride;
    document.getElementById('customLocaleWrap').style.display = 'block';
  }
  updateSaveFolderHint(opts.saveFolder ?? DEFAULTS.saveFolder);
}

function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (!key) return;
    if (el.tagName === 'INPUT' && el.type === 'text' && el.placeholder) {
      if (key === 'optDefaultFolderName') el.placeholder = I18N.t('optDefaultFolderName');
      return;
    }
    const msg = I18N.t(key);
    if (el.getAttribute('title') !== undefined) el.setAttribute('title', msg);
    else if (el.tagName === 'OPTION') return;
    else el.textContent = msg;
  });
  const localeSelect = document.getElementById('customLocale');
  if (localeSelect) {
    const opts = [
      { v: 'en', k: 'optLocaleEn' }, { v: 'fr', k: 'optLocaleFr' }, { v: 'es', k: 'optLocaleEs' },
      { v: 'ja', k: 'optLocaleJa' }, { v: 'ko', k: 'optLocaleKo' }, { v: 'zh_CN', k: 'optLocaleZh' }
    ];
    const flags = { en: '🇬🇧', fr: '🇫🇷', es: '🇪🇸', ja: '🇯🇵', ko: '🇰🇷', zh_CN: '🇨🇳' };
    opts.forEach(o => {
      const opt = localeSelect.querySelector(`option[value="${o.v}"]`);
      if (opt) opt.textContent = flags[o.v] + ' ' + I18N.t(o.k);
    });
  }
  document.title = I18N.t('optPageTitle');
}

function updateSaveFolderHint(folderName) {
  const container = document.getElementById('saveFolderHintContainer');
  if (!container) return;
  const before = I18N.t('optSaveFolderHintBefore');
  const after = I18N.t('optSaveFolderHintAfter');
  const name = folderName || I18N.t('optDefaultFolderName');
  container.textContent = '';
  container.appendChild(document.createTextNode(before));
  const strong = document.createElement('strong');
  strong.id = 'folderPreview';
  strong.textContent = name;
  container.appendChild(strong);
  container.appendChild(document.createTextNode(after));
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function showStatus(message, type) {
  const el = document.getElementById('status');
  el.textContent = message;
  el.className = 'status ' + (type || '');
  if (message) setTimeout(() => { el.textContent = ''; el.className = 'status'; }, 3000);
}

function updateCustomFolderDisplay(name) {
  const pathEl = document.getElementById('customFolderPath');
  if (pathEl) pathEl.textContent = name ? I18N.t('optFolderChosen', [name]) : '';
}

const hasPicker = 'showDirectoryPicker' in window;
document.getElementById('customFolderBlock').style.display = hasPicker ? 'block' : 'none';

document.getElementById('localeAuto').addEventListener('change', () => {
  document.getElementById('customLocaleWrap').style.display = 'none';
});
document.getElementById('localeCustom').addEventListener('change', () => {
  document.getElementById('customLocaleWrap').style.display = 'block';
});

document.getElementById('chooseFolder').addEventListener('click', async () => {
  if (!hasPicker) return;
  try {
    const dir = await showDirectoryPicker({ mode: 'readwrite' });
    await setStoredHandle(dir);
    await chrome.storage.sync.set({ useCustomFolder: true, customFolderName: dir.name });
    updateCustomFolderDisplay(dir.name);
    showStatus(I18N.t('statusFolderSaved'), 'status-ok');
  } catch (e) {
    if (e.name === 'AbortError') return;
    showStatus(I18N.t('statusErrorPrefix') + e.message, 'status-error');
  }
});

document.getElementById('clearFolder').addEventListener('click', async () => {
  try {
    await deleteStoredHandle();
    await chrome.storage.sync.set({ useCustomFolder: false, customFolderName: '' });
    updateCustomFolderDisplay('');
    showStatus(I18N.t('statusFolderReset'), 'status-ok');
  } catch (e) {
    showStatus(I18N.t('statusErrorPrefix') + e.message, 'status-error');
  }
});

document.getElementById('saveFolder').addEventListener('input', () => {
  const v = document.getElementById('saveFolder').value.trim().replace(/[/\\]+/g, '/').replace(/^\/|\/$/g, '') || I18N.t('optDefaultFolderName');
  updateSaveFolderHint(v);
});

document.getElementById('save').addEventListener('click', async () => {
  const v = getValues();
  if (v.squareRatioMin >= v.squareRatioMax) {
    showStatus(I18N.t('statusRatioError'), 'status-error');
    return;
  }
  try {
    await chrome.storage.sync.set(v);
    showStatus(I18N.t('statusSaved'), 'status-ok');
    await I18N.init();
    applyI18n();
    setValues(v);
  } catch (e) {
    showStatus(I18N.t('statusErrorPrefix') + e.message, 'status-error');
  }
});

async function load() {
  const opts = await chrome.storage.sync.get([...Object.keys(DEFAULTS), 'customFolderName', 'useCustomFolder']);
  if (opts.nsfwEnabled === undefined) opts.nsfwEnabled = DEFAULTS.nsfwEnabled;
  if (opts.localeOverride === undefined) opts.localeOverride = DEFAULTS.localeOverride;
  setValues(opts);
  if (opts.useCustomFolder && opts.customFolderName) {
    updateCustomFolderDisplay(opts.customFolderName);
  } else {
    getStoredHandle().then(handle => {
      if (handle) {
        updateCustomFolderDisplay(handle.name);
        chrome.storage.sync.set({ useCustomFolder: true, customFolderName: handle.name });
      } else {
        updateCustomFolderDisplay('');
      }
    }).catch(() => updateCustomFolderDisplay(''));
  }
}

(async () => {
  await I18N.init();
  applyI18n();
  document.getElementById('saveFolder').placeholder = I18N.t('optDefaultFolderName');
  await load();
})();
