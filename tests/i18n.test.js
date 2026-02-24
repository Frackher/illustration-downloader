import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadI18n, mockChrome, root } from './setup.js';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('I18N (parcours critique: boutons overlay)', () => {
  let I18N;

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.__IMG_DOWNLOADER_TEST__ = true;
    mockChrome.storage.sync.get.mockImplementation((key, cb) => {
      if (typeof key === 'function') {
        key({ localeOverride: 'en' });
        return;
      }
      cb({ localeOverride: cb ? 'en' : 'auto' });
    });
    globalThis.fetch = vi.fn((url) => {
      const match = String(url).match(/_locales[/\\]([^/\\]+)/);
      const locale = match ? match[1] : 'en';
      const filePath = join(root, '_locales', locale, 'messages.json');
      try {
        const data = JSON.parse(readFileSync(filePath, 'utf8'));
        return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
      } catch {
        return Promise.resolve({ ok: false });
      }
    });
    I18N = loadI18n();
  });

  it('init() résout toujours (ne bloque pas les boutons)', async () => {
    const locale = await I18N.init();
    expect(locale).toBeDefined();
    expect(['en', 'fr', 'es', 'ja', 'ko', 'zh_CN']).toContain(locale);
  });

  it('init() résout même si fetch échoue (fallback)', async () => {
    globalThis.fetch = vi.fn(() => Promise.resolve({ ok: false }));
    const locale = await I18N.init();
    expect(locale).toBeDefined();
    expect(I18N.t('ariaDownloadImage')).toBe('ariaDownloadImage'); // fallback = key
  });

  it('t() retourne un message pour les clés overlay (boutons visibles)', async () => {
    await I18N.init();
    expect(I18N.t('ariaDownloadImage')).not.toBe('ariaDownloadImage');
    expect(I18N.t('ariaDownloadNsfw')).not.toBe('ariaDownloadNsfw');
    expect(I18N.t('msgSaved')).toBeTruthy();
    expect(I18N.t('errUnknown')).toBeTruthy();
  });

  it('t() avec substitution $1$', async () => {
    await I18N.init();
    const msg = I18N.t('optFolderChosen', ['MyFolder']);
    expect(msg).toContain('MyFolder');
  });

  it('addButtons serait appelé: init().then(success, failure) appelle le callback', async () => {
    const addButtons = vi.fn();
    await I18N.init().then(() => addButtons(), () => addButtons());
    expect(addButtons).toHaveBeenCalledTimes(1);
  });
});
