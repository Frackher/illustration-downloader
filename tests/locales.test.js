import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { root } from './setup.js';

const LOCALES = ['en', 'fr', 'es', 'ja', 'ko', 'zh_CN'];

const CRITICAL_KEYS = [
  'extName',
  'extDescription',
  'ariaDownloadImage',
  'ariaDownloadNsfw',
  'msgSaved',
  'msgAlreadySaved',
  'errUnknown',
  'errCannotContact',
  'errWriteFailed',
  'optSave',
  'optSectionLanguage',
  'optLanguageAuto',
  'optLanguageCustom',
];

describe('_locales – clés critiques présentes', () => {
  for (const locale of LOCALES) {
    it(`${locale} a tous les messages critiques`, () => {
      const filePath = join(root, '_locales', locale, 'messages.json');
      const data = JSON.parse(readFileSync(filePath, 'utf8'));
      for (const key of CRITICAL_KEYS) {
        expect(data[key], `missing key ${key} in ${locale}`).toBeDefined();
        expect(data[key].message, `missing message for ${key} in ${locale}`).toBeTruthy();
      }
    });
  }

  it('toutes les locales ont le même ensemble de clés', () => {
    const keysByLocale = {};
    for (const locale of LOCALES) {
      const filePath = join(root, '_locales', locale, 'messages.json');
      const data = JSON.parse(readFileSync(filePath, 'utf8'));
      keysByLocale[locale] = new Set(Object.keys(data));
    }
    const enKeys = keysByLocale.en;
    for (const locale of LOCALES) {
      if (locale === 'en') continue;
      const missing = [...enKeys].filter((k) => !keysByLocale[locale].has(k));
      const extra = [...keysByLocale[locale]].filter((k) => !enKeys.has(k));
      expect(missing, `${locale} missing keys vs en`).toEqual([]);
      expect(extra, `${locale} extra keys vs en`).toEqual([]);
    }
  });

  it('messages avec $1$ ont placeholders défini', () => {
    for (const locale of LOCALES) {
      const filePath = join(root, '_locales', locale, 'messages.json');
      const data = JSON.parse(readFileSync(filePath, 'utf8'));
      for (const [key, obj] of Object.entries(data)) {
        if (obj.message && obj.message.includes('$1$')) {
          expect(obj.placeholders, `key ${key} in ${locale} uses $1$ but has no placeholders`).toBeDefined();
          expect(obj.placeholders['1'], `key ${key} in ${locale} should have placeholder "1"`).toBeDefined();
        }
      }
    }
  });
});
