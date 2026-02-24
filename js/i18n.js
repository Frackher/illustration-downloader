/**
 * Custom i18n for the extension: supports "auto" (browser language) or a chosen locale.
 * Use init() then t(key, substitutions).
 */
const I18N = (function () {
  const SUPPORTED = ['en', 'fr', 'es', 'ja', 'ko', 'zh_CN'];
  const UI_TO_LOCALE = {
    en: 'en', 'en-US': 'en', 'en-GB': 'en',
    fr: 'fr', 'fr-FR': 'fr', 'fr-CA': 'fr',
    es: 'es', 'es-ES': 'es', 'es-MX': 'es',
    ja: 'ja', 'ko': 'ko', 'ko-KR': 'ko',
    zh: 'zh_CN', 'zh-CN': 'zh_CN', 'zh-TW': 'zh_CN'
  };
  let currentLocale = 'en';
  let messages = {};
  const cache = {};

  function mapUILanguageToLocale(uiLang) {
    const base = (uiLang || '').split('-')[0];
    return UI_TO_LOCALE[uiLang] || UI_TO_LOCALE[base] || 'en';
  }

  function getEffectiveLocale(stored) {
    if (stored && stored !== 'auto' && SUPPORTED.includes(stored)) return stored;
    const ui = typeof chrome !== 'undefined' && chrome.i18n ? chrome.i18n.getUILanguage() : navigator.language || 'en';
    return mapUILanguageToLocale(ui);
  }

  function loadLocale(locale) {
    if (cache[locale]) return Promise.resolve(cache[locale]);
    const url = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
    return fetch(url)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Locale not found')))
      .then(data => {
        const out = {};
        for (const [key, obj] of Object.entries(data)) {
          if (obj && obj.message) out[key] = obj.message;
        }
        cache[locale] = out;
        return out;
      });
  }

  async function init() {
    try {
      const stored = await new Promise(resolve => {
        chrome.storage.sync.get('localeOverride', o => resolve(o && o.localeOverride !== undefined ? o.localeOverride : 'auto'));
      });
      currentLocale = getEffectiveLocale(stored);
      messages = await loadLocale(currentLocale);
    } catch (e) {
      try {
        currentLocale = 'en';
        messages = await loadLocale('en');
      } catch (_) {
        messages = {};
      }
    }
    return currentLocale;
  }

  function t(key, substitutions) {
    let msg = messages[key];
    if (msg == null) msg = key;
    if (substitutions && (Array.isArray(substitutions) || typeof substitutions === 'string')) {
      const arr = Array.isArray(substitutions) ? substitutions : [substitutions];
      arr.forEach((s, i) => {
        msg = msg.replace(new RegExp('\\$' + (i + 1) + '\\$', 'g'), String(s));
      });
    }
    return msg;
  }

  function getLocale() {
    return currentLocale;
  }

  function getSupportedLocales() {
    return SUPPORTED.slice();
  }

  return { init, t, getLocale, getSupportedLocales, getEffectiveLocale, loadLocale };
})();
