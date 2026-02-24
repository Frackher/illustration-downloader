import { describe, it, expect, vi } from 'vitest';

/**
 * Parcours critique: les boutons de téléchargement doivent toujours être ajoutés
 * (que I18N.init() résolve ou rejette). Ce test valide le pattern utilisé dans content.js.
 */
describe('Content overlay – addButtons toujours appelé', () => {
  it('quand I18N.init() résout, addButtons est appelé', async () => {
    const addButtons = vi.fn();
    const initResolve = Promise.resolve();
    initResolve.then(() => addButtons(), () => addButtons());
    await initResolve;
    await Promise.resolve();
    expect(addButtons).toHaveBeenCalledTimes(1);
  });

  it('quand I18N.init() rejette, addButtons est quand même appelé', async () => {
    const addButtons = vi.fn();
    const initReject = Promise.reject(new Error('fetch failed'));
    initReject.then(() => addButtons(), () => addButtons());
    await Promise.resolve().then(() => {});
    await Promise.resolve();
    expect(addButtons).toHaveBeenCalledTimes(1);
  });

  it('sans I18N (undefined), addButtons est appelé directement', () => {
    const addButtons = vi.fn();
    const I18N = undefined;
    if (typeof I18N !== 'undefined' && I18N && I18N.init) {
      I18N.init().then(() => addButtons(), () => addButtons());
    } else {
      addButtons();
    }
    expect(addButtons).toHaveBeenCalledTimes(1);
  });

  it('getBestImageUrl: URL twimg devient format=jpg name=orig', () => {
    const TWIMG_REG = /^https?:\/\/pbs\.twimg\.com\/media\/[^/?]+/;
    function getBestImageUrl(src) {
      if (!src || !TWIMG_REG.test(src)) return src;
      try {
        const u = new URL(src);
        u.searchParams.set('format', 'jpg');
        u.searchParams.set('name', 'orig');
        return u.toString();
      } catch (_) {
        return src;
      }
    }
    const out = getBestImageUrl('https://pbs.twimg.com/media/abc123?format=png');
    expect(out).toContain('format=jpg');
    expect(out).toContain('name=orig');
  });

  describe('getBestImageUrl Pixiv', () => {
    const PXIMG_REG = /^https?:\/\/i\.pximg\.net\//;
    function getBestImageUrlPixiv(src) {
      if (!src || !PXIMG_REG.test(src)) return src;
      try {
        const u = new URL(src);
        let path = u.pathname;
        path = path.replace(/^\/c\/[^/]+\//, '/');
        path = path.replace(/\/img-master\//, '/img-original/');
        path = path.replace(/_((?!p\d)[a-z]+\d*)(\.[a-z]+)$/i, '$2');
        u.pathname = path;
        return u.toString();
      } catch (_) {
        return src;
      }
    }

    it('img-master → img-original et enlève _master1200', () => {
      const in_ = 'https://i.pximg.net/img-master/img/2026/01/04/01/58/50/139492032_p0_master1200.jpg';
      const out = getBestImageUrlPixiv(in_);
      expect(out).toContain('/img-original/');
      expect(out).toContain('139492032_p0.jpg');
      expect(out).not.toContain('_master1200');
    });

    it('enlève préfixe /c/ (crop) et _square1200', () => {
      const in_ = 'https://i.pximg.net/c/240x240/img-master/img/2026/01/04/01/58/50/139492032_p0_square1200.jpg';
      const out = getBestImageUrlPixiv(in_);
      expect(out).not.toContain('/c/240x240/');
      expect(out).toContain('/img-original/');
      expect(out).toContain('139492032_p0.jpg');
      expect(out).not.toContain('_square1200');
    });

    it('préserve _p0 (numéro de page)', () => {
      const in_ = 'https://i.pximg.net/img-master/img/2026/01/04/01/58/50/139492032_p0_master1200.png';
      const out = getBestImageUrlPixiv(in_);
      expect(out).toContain('139492032_p0.png');
    });
  });
});
