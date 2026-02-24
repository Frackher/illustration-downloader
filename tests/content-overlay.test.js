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
});
