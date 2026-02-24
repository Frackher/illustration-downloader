import { vi } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Mock chrome API for extension scripts
const mockChrome = {
  storage: {
    sync: {
      get: vi.fn((keys, cb) => {
        const result = {
          localeOverride: 'en',
          saveFolder: 'Illustrations',
          askEachTime: false,
          squareRatioMin: 0.9,
          squareRatioMax: 1.1,
          useCustomFolder: false,
          nsfwEnabled: false,
        };
        if (typeof keys === 'function') {
          keys(result);
          return;
        }
        if (cb) cb(result);
      }),
      set: vi.fn((_, cb) => { if (cb) cb(); }),
    },
  },
  runtime: {
    getURL: (path) => `chrome-extension://test-id/${path}`,
    sendMessage: vi.fn(() => Promise.resolve({ ok: true })),
    onMessage: { addListener: vi.fn() },
    lastError: null,
  },
  i18n: {
    getUILanguage: () => 'en',
  },
  action: { onClicked: { addListener: vi.fn() } },
  tabs: { create: vi.fn() },
  downloads: { download: vi.fn(() => Promise.resolve()) },
  offscreen: { createDocument: vi.fn(() => Promise.resolve()) },
};

function loadI18n() {
  globalThis.chrome = mockChrome;
  globalThis.__IMG_DOWNLOADER_TEST__ = true;
  const code = readFileSync(join(root, 'js', 'i18n.js'), 'utf8') +
    '\nif (typeof globalThis !== "undefined" && globalThis.__IMG_DOWNLOADER_TEST__) globalThis.__I18N__ = I18N;\n';
  eval(code);
  return globalThis.__I18N__;
}

function loadBackground() {
  globalThis.__IMG_DOWNLOADER_TEST__ = true;
  globalThis.chrome = {
    ...mockChrome,
    storage: {
      sync: {
        get: vi.fn((keys) => Promise.resolve({
          saveFolder: 'Illustrations',
          squareRatioMin: 0.9,
          squareRatioMax: 1.1,
          useCustomFolder: false,
          askEachTime: false,
        })),
      },
    },
    runtime: {
      ...mockChrome.runtime,
      getContexts: vi.fn(() => Promise.resolve([])),
    },
  };
  globalThis.fetch = vi.fn();
  globalThis.createImageBitmap = vi.fn(() => Promise.resolve({ width: 800, height: 600, close: vi.fn() }));
  globalThis.importScripts = vi.fn(); // background.js loads lib/piexif.js via importScripts
  const code = readFileSync(join(root, 'js', 'background.js'), 'utf8') +
    '\nglobalThis.__bg = { getFormatFolder, getExtensionFromUrl, safeFilenamePart, pximgOriginalAlternateUrls, pximgOriginalToMaster };\n';
  eval(code);
  return globalThis.__bg;
}

export { mockChrome, loadI18n, loadBackground, root };
