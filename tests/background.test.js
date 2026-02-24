import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadBackground } from './setup.js';

describe('Background – logique critique téléchargement', () => {
  let bg;

  beforeEach(() => {
    vi.clearAllMocks();
    bg = loadBackground();
  });

  describe('getFormatFolder', () => {
    it('ratio dans [min,max] => square', () => {
      expect(bg.getFormatFolder(1, 0.9, 1.1)).toBe('square');
      expect(bg.getFormatFolder(0.95, 0.9, 1.1)).toBe('square');
    });

    it('ratio > max => landscape', () => {
      expect(bg.getFormatFolder(1.5, 0.9, 1.1)).toBe('landscape');
    });

    it('ratio < min => portrait', () => {
      expect(bg.getFormatFolder(0.8, 0.9, 1.1)).toBe('portrait');
    });
  });

  describe('getExtensionFromUrl', () => {
    it('détecte jpg, png, gif, webp', () => {
      expect(bg.getExtensionFromUrl('https://x.com/img.jpg')).toBe('jpg');
      expect(bg.getExtensionFromUrl('https://x.com/a/b/c.png')).toBe('png');
      expect(bg.getExtensionFromUrl('https://x.com/f.webp')).toBe('webp');
      expect(bg.getExtensionFromUrl('https://x.com/f.jpeg')).toBe('jpg');
    });

    it('retourne null si pas d’extension reconnue', () => {
      expect(bg.getExtensionFromUrl('https://x.com/foo')).toBeNull();
    });
  });

  describe('safeFilenamePart', () => {
    it('remplace caractères interdits et limite à 80 caractères', () => {
      expect(bg.safeFilenamePart('user')).toBe('user');
      expect(bg.safeFilenamePart('a/b\\c')).toBe('a_b_c');
      expect(bg.safeFilenamePart(null)).toBe('unknown');
      expect(bg.safeFilenamePart('a'.repeat(100)).length).toBe(80);
    });
  });

  describe('pximgOriginalToMaster', () => {
    it('convertit img-original en img-master avec _master1200', () => {
      const url = 'https://i.pximg.net/img-original/img/2026/01/04/01/58/50/139492032_p0.jpg';
      expect(bg.pximgOriginalToMaster(url)).toBe('https://i.pximg.net/img-master/img/2026/01/04/01/58/50/139492032_p0_master1200.jpg');
    });
    it('retourne null si pas img-original', () => {
      expect(bg.pximgOriginalToMaster('https://i.pximg.net/img-master/img/foo.jpg')).toBeNull();
      expect(bg.pximgOriginalToMaster('https://example.com/img-original/foo.png')).toBeNull();
    });
  });

  describe('pximgOriginalAlternateUrls', () => {
    it('retourne les URLs avec autres extensions (png, jpg, webp, gif)', () => {
      const url = 'https://i.pximg.net/img-original/img/2026/01/04/01/58/50/139492032_p0.jpg';
      const alts = bg.pximgOriginalAlternateUrls(url);
      expect(alts).toContain('https://i.pximg.net/img-original/img/2026/01/04/01/58/50/139492032_p0.png');
      expect(alts).toContain('https://i.pximg.net/img-original/img/2026/01/04/01/58/50/139492032_p0.webp');
      expect(alts).toContain('https://i.pximg.net/img-original/img/2026/01/04/01/58/50/139492032_p0.gif');
      expect(alts).not.toContain(url);
      expect(alts).toHaveLength(3);
    });
    it('retourne tableau vide si pas img-original', () => {
      expect(bg.pximgOriginalAlternateUrls('https://i.pximg.net/img-master/img/foo.jpg')).toEqual([]);
    });
  });
});
