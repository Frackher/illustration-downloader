(function () {
  const OVERLAY_CLASS = 'img-downloader-overlay';
  const OVERLAY_ATTR = 'data-img-downloader-bound';
  const TWIMG_REG = /^https?:\/\/pbs\.twimg\.com\/media\/[^/?]+/;
  const PXIMG_REG = /^https?:\/\/i\.pximg\.net\//;

  const CONSOLE_PREFIX = '[Illustration Downloader]';
  const CONSOLE_STYLE = 'color: #58a6ff; font-weight: bold;';
  const CONSOLE_STYLE_ERROR = 'color: #f85149; font-weight: bold;';

  function isPixivPage() {
    return /^https?:\/\/(www\.)?pixiv\.net\//.test(window.location.href);
  }

  function logDownload(message, data) {
    if (data !== undefined && data !== '') {
      console.log('%c' + CONSOLE_PREFIX, CONSOLE_STYLE, message, data);
    } else {
      console.log('%c' + CONSOLE_PREFIX, CONSOLE_STYLE, message);
    }
  }

  function logDownloadError(message, details) {
    console.error('%c' + CONSOLE_PREFIX, CONSOLE_STYLE_ERROR, message);
    if (details) console.error('%c' + CONSOLE_PREFIX + ' (détails)', 'color: #8b949e;', details);
  }

  function getBestImageUrl(src) {
    if (!src) return src;
    try {
      if (TWIMG_REG.test(src)) {
        const u = new URL(src);
        u.searchParams.set('format', 'jpg');
        u.searchParams.set('name', 'orig');
        return u.toString();
      }
      if (PXIMG_REG.test(src)) {
        const u = new URL(src);
        let path = u.pathname;
        path = path.replace(/^\/c\/[^/]+\//, '/');
        path = path.replace(/\/(img-master|custom-thumb)\//, '/img-original/');
        path = path.replace(/_((?!p\d)[a-z]+\d*)(\.[a-z]+)$/i, '$2');
        u.pathname = path;
        return u.toString();
      }
    } catch (_) {}
    return src;
  }

  function findArticleForImage(img) {
    let node = img;
    for (let i = 0; i < 25 && node; i++) {
      node = node.parentElement;
      if (!node) break;
      const article = node.closest('article');
      if (article) return article;
    }
    return null;
  }

  /** Extrait le nom d’utilisateur depuis l’URL de la page (ex. /very_ito/status/123 ou /very_ito/status/123/photo/1). */
  function getArtistFromPageUrl() {
    try {
      const path = (window.location.pathname || '').trim();
      const m = path.match(/^\/([^/]+)\/status\//);
      if (m && m[1] && m[1] !== 'search' && m[1] !== 'hashtag') return m[1];
    } catch (_) {}
    return null;
  }

  function findArtistForImage(img) {
    const article = findArticleForImage(img);
    if (article) {
      const links = article.querySelectorAll('a[href^="/"][href*="status"]');
      for (const a of links) {
        const href = (a.getAttribute('href') || '').trim();
        const m = href.match(/^\/([^/]+)\/status\//);
        if (m && m[1] && !m[1].startsWith('status')) return m[1];
      }
      const anyUserLink = article.querySelector('a[href^="/"]');
      if (anyUserLink) {
        const href = (anyUserLink.getAttribute('href') || '').trim();
        const seg = href.split('/').filter(Boolean);
        if (seg.length === 1 && seg[0] !== 'search' && seg[0] !== 'hashtag') return seg[0];
      }
    }
    return getArtistFromPageUrl();
  }

  /** Returns full post URL (origin + path) or empty string. */
  function findPostUrl(img) {
    const article = findArticleForImage(img);
    if (article) {
      const link = article.querySelector('a[href^="/"][href*="status"]');
      if (link) {
        const href = (link.getAttribute('href') || '').trim();
        if (href) {
          try {
            return new URL(href, window.location.origin).href;
          } catch (_) {}
        }
      }
    }
    try {
      const path = (window.location.pathname || '').trim();
      const m = path.match(/^(\/[^/]+\/status\/\d+)/);
      if (m && m[1]) return new URL(m[1], window.location.origin).href;
    } catch (_) {}
    return '';
  }

  /** Returns tweet text from the post (best-effort selector). Sur la vue photo, le texte peut être ailleurs dans la page. */
  function findPostText(img) {
    const article = findArticleForImage(img);
    const container = article || document.body;
    const el = container.querySelector('[data-testid="tweetText"]');
    if (!el) return '';
    return (el.textContent || '').trim().slice(0, 2000);
  }

  /** Auteur depuis la carte qui contient l’image (pages favoris, recherche, etc. : évite le pseudo du connecté). */
  /** Carte = ancêtre qui contient à la fois un lien œuvre ET un lien user (sinon on tombe sur le <a> autour de l'image, sans auteur). */
  function findPixivCard(img) {
    if (!img || !img.parentElement) return null;
    let card = img.parentElement;
    for (let i = 0; i < 30 && card; i++) {
      if (card.querySelector('a[href*="/artworks/"]') && card.querySelector('a[href*="/users/"]')) {
        return card;
      }
      card = card.parentElement;
    }
    return null;
  }

  function getPixivArtistForImage(img) {
    const card = findPixivCard(img);
    if (!card) return null;
    const isPixivSiteName = (s) => !s || /^pixiv\s*;?\s*$/i.test(String(s).trim());
    const ok = (s) => s && s.length > 0 && s.length < 100 && !isPixivSiteName(s);
    const userLinks = card.querySelectorAll('a[href*="/users/"]');
    const firstUserOnPage = document.querySelector('a[href*="/users/"]');
    for (const a of userLinks) {
      const name = (a.textContent || '').trim();
      if (ok(name) && (!firstUserOnPage || a.getAttribute('href') !== firstUserOnPage.getAttribute('href'))) {
        return name.slice(0, 80);
      }
    }
    const firstOk = [...userLinks].find(a => ok((a.textContent || '').trim()));
    return firstOk ? (firstOk.textContent || '').trim().slice(0, 80) : null;
  }

  function getPixivTitleForImage(img) {
    const card = findPixivCard(img);
    if (!card) return '';
    const artLinks = card.querySelectorAll('a[href*="/artworks/"]');
    let best = '';
    for (const a of artLinks) {
      const t = (a.textContent || '').trim();
      if (t && t.length < 500 && !a.contains(img)) return t.slice(0, 2000);
      if (t && (!best || t.length < best.length)) best = t.slice(0, 2000);
    }
    return best;
  }

  function getPixivPostUrlForImage(img) {
    const card = findPixivCard(img);
    if (!card) return null;
    const artLink = card.querySelector('a[href*="/artworks/"]');
    if (!artLink || !artLink.href) return null;
    try {
      return new URL(artLink.href, window.location.origin).href;
    } catch (_) {
      return null;
    }
  }

  function getPixivArtist(img) {
    const isPixivSiteName = (s) => !s || /^pixiv\s*;?\s*$/i.test(String(s).trim());
    const ok = (s) => s && s.length > 0 && s.length < 100 && !isPixivSiteName(s);

    const fromCard = img ? getPixivArtistForImage(img) : null;
    if (fromCard) return fromCard;

    const path = (window.location.pathname || '').trim();
    if (/\/users\/\d+/.test(path)) {
      const h1 = document.querySelector('h1');
      if (h1) {
        const name = (h1.textContent || '').trim().slice(0, 80);
        if (ok(name)) return name;
      }
      const og = document.querySelector('meta[property="og:title"]');
      if (og?.content) {
        const name = og.content.split(/\s*-\s*/).map(p => p.trim()).filter(Boolean)[0];
        if (ok(name)) return name.slice(0, 80);
      }
    }

    const viewAllLink = Array.from(document.querySelectorAll('a[href*="/users/"][href*="/artworks"]'))
      .find(a => /view all works/i.test((a.textContent || '').trim()));
    const authorBlock = viewAllLink?.closest('div');
    if (authorBlock) {
      const authorLinks = authorBlock.querySelectorAll('a[href*="/users/"]');
      for (const link of authorLinks) {
        if (link.querySelector('.img-downloader-overlay')) continue;
        const name = (link.textContent || '').trim();
        if (ok(name)) return name.slice(0, 80);
      }
      const titleEl = authorBlock.querySelector('[title]');
      if (titleEl && !titleEl.closest('.img-downloader-overlay-wrap')) {
        const title = titleEl.getAttribute('title');
        if (ok(title)) return title.slice(0, 80);
      }
    }

    const html = document.documentElement.innerHTML;
    const byMatch = html.match(/"description"\s*:\s*"[^"]*\s+by\s+([^"\\]+)"/);
    if (byMatch && byMatch[1]) {
      const name = byMatch[1].trim().replace(/\\u[\da-f]{4}/gi, (c) => String.fromCharCode(parseInt(c.slice(2), 16)));
      if (ok(name)) return name.slice(0, 80);
    }

    const og = document.querySelector('meta[property="og:title"]');
    if (og && og.content) {
      const parts = og.content.split(/\s*-\s*/).map(p => p.trim()).filter(Boolean);
      const authorPart = parts.find(p => /のイラスト\s*$/i.test(p));
      if (authorPart) {
        const name = authorPart.replace(/のイラスト\s*$/i, '').trim().slice(0, 80);
        if (name && !isPixivSiteName(name)) return name;
      }
      if (parts.length >= 2) {
        const middle = parts.length >= 3 ? parts[parts.length - 2] : parts[1];
        if (middle && !isPixivSiteName(middle)) return middle.replace(/のイラスト$/i, '').trim().slice(0, 80);
      }
    }

    const link = document.querySelector('a[href*="/users/"]');
    if (link) {
      const name = (link.textContent || '').trim();
      if (ok(name)) return name.slice(0, 80);
    }
    return null;
  }

  function getPixivTitle(img) {
    const fromCard = img ? getPixivTitleForImage(img) : '';
    if (fromCard) return fromCard;
    const h1 = document.querySelector('h1');
    if (h1) return (h1.textContent || '').trim().slice(0, 2000);
    const og = document.querySelector('meta[property="og:title"]');
    if (og && og.content) {
      const part = og.content.split(' - ')[0];
      if (part) return part.trim().slice(0, 2000);
    }
    return '';
  }

  function getPixivPostUrl(img) {
    const fromCard = img ? getPixivPostUrlForImage(img) : null;
    if (fromCard) return fromCard;
    try {
      const path = (window.location.pathname || '').trim();
      const m = path.match(/\/artworks\/(\d+)/);
      if (m) return window.location.origin + '/artworks/' + m[1];
    } catch (_) {}
    return window.location.href;
  }

  function handleDownloadResponse(overlay, icon, res) {
    overlay.disabled = false;
    let lastError;
    try {
      lastError = chrome.runtime.lastError;
    } catch (e) {
      lastError = e;
    }
    if (lastError) {
      const msg = (lastError.message || String(lastError)).includes('Extension context invalidated')
        ? 'Extension reloaded. Please refresh the page.'
        : (lastError.message || String(lastError));
      logDownloadError(I18N.t('errCannotContact'), msg);
      overlay.textContent = icon;
      return;
    }
    if (!res || !res.ok) {
      const errMsg = (res && res.errorKey) ? I18N.t(res.errorKey) : (res && res.error) ? res.error : I18N.t('errUnknown');
      logDownloadError(errMsg, res ? res : undefined);
      overlay.textContent = '!';
      setTimeout(() => { overlay.textContent = icon; }, 1500);
      return;
    }
    const msg = res.skipped ? I18N.t('msgAlreadySaved') : I18N.t('msgSaved');
    logDownload(msg, res.format ? { format: res.format, skipped: res.skipped } : { skipped: res.skipped });
    overlay.textContent = '✓';
    overlay.classList.add('done');
    setTimeout(() => { overlay.textContent = icon; overlay.classList.remove('done'); }, 1500);
  }

  function addOverlay(img) {
    if (img[OVERLAY_ATTR]) return;
    img[OVERLAY_ATTR] = true;

    let container = img.parentElement;
    while (container && container !== document.body) {
      const style = getComputedStyle(container);
      if (style.position !== 'static' || container.tagName === 'ARTICLE') break;
      container = container.parentElement;
    }
    container = container || img.parentElement;
    if (!container) return;
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';

    const wrapper = document.createElement('div');
    wrapper.className = 'img-downloader-overlay-wrap';

    const t = (key) => (typeof I18N !== 'undefined' && I18N.t) ? I18N.t(key) : key;

    if (typeof I18N !== 'undefined' && I18N.init) {
      I18N.init().then(() => addButtons(), () => addButtons());
    } else {
      addButtons();
    }

    function addButtons() {
      const defaultOpts = { nsfwEnabled: false };
      try {
        chrome.storage.sync.get(['nsfwEnabled'], (result) => {
          try {
            const nsfwEnabled = !!(result && typeof result === 'object' && result.nsfwEnabled);
            addButtonsWithOpts({ nsfwEnabled });
          } catch (_) {
            addButtonsWithOpts(defaultOpts);
          }
        });
      } catch (_) {
        addButtonsWithOpts(defaultOpts);
      }
    }
    function addButtonsWithOpts(opts) {
      const nsfwEnabled = !!(opts && opts.nsfwEnabled);

        if (nsfwEnabled) {
          const nsfwBtn = document.createElement('button');
          nsfwBtn.type = 'button';
          nsfwBtn.className = OVERLAY_CLASS + ' img-downloader-overlay-nsfw';
          nsfwBtn.setAttribute('aria-label', t('ariaDownloadNsfw'));
          nsfwBtn.textContent = '🔞';
        nsfwBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (nsfwBtn.disabled) return;
          nsfwBtn.disabled = true;
          nsfwBtn.textContent = '…';
          const rawSrc = img.currentSrc || img.src;
          const imageUrl = getBestImageUrl(rawSrc);
          const isPixiv = isPixivPage() && PXIMG_REG.test(rawSrc);
          const platform = isPixiv ? 'pixiv' : 'x';
          const artistName = isPixiv ? (getPixivArtist(img) || 'unknown') : (findArtistForImage(img) || 'unknown');
          const postUrl = isPixiv ? getPixivPostUrl(img) : findPostUrl(img);
          const postText = isPixiv ? getPixivTitle(img) : findPostText(img);
          logDownload(t('ariaDownloadNsfw'), { imageUrl, artistName });
          try {
            chrome.runtime.sendMessage({
              type: 'DOWNLOAD_IMAGE',
              imageUrl,
              artistName,
              platform,
              nsfw: true,
              postUrl: postUrl || undefined,
              postText: postText || undefined
            }, (res) => {
              try {
                handleDownloadResponse(nsfwBtn, '🔞', res);
              } catch (_) {
                nsfwBtn.textContent = '🔞';
              }
            });
          } catch (e) {
            handleDownloadResponse(nsfwBtn, '🔞', null);
            if ((e.message || '').includes('Extension context invalidated')) {
              logDownloadError(I18N.t('errCannotContact'), 'Extension reloaded. Please refresh the page.');
            }
          }
        });
        wrapper.appendChild(nsfwBtn);
      }

      const overlay = document.createElement('button');
      overlay.type = 'button';
      overlay.className = OVERLAY_CLASS;
      overlay.setAttribute('aria-label', t('ariaDownloadImage'));
      overlay.innerHTML = '↓';
      overlay.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (overlay.disabled) return;
        overlay.disabled = true;
        overlay.textContent = '…';
        const rawSrc = img.currentSrc || img.src;
        const imageUrl = getBestImageUrl(rawSrc);
        const isPixiv = isPixivPage() && PXIMG_REG.test(rawSrc);
        const platform = isPixiv ? 'pixiv' : 'x';
        const artistName = isPixiv ? (getPixivArtist(img) || 'unknown') : (findArtistForImage(img) || 'unknown');
        const postUrl = isPixiv ? getPixivPostUrl(img) : findPostUrl(img);
        const postText = isPixiv ? getPixivTitle(img) : findPostText(img);
        logDownload(t('ariaDownloadImage'), { imageUrl, artistName });
        try {
          chrome.runtime.sendMessage({
            type: 'DOWNLOAD_IMAGE',
            imageUrl,
            artistName,
            platform,
            postUrl: postUrl || undefined,
            postText: postText || undefined
          }, (res) => {
            try {
              handleDownloadResponse(overlay, '↓', res);
            } catch (_) {
              overlay.textContent = '↓';
            }
          });
        } catch (e) {
          handleDownloadResponse(overlay, '↓', null);
          if ((e.message || '').includes('Extension context invalidated')) {
            logDownloadError(I18N.t('errCannotContact'), 'Extension reloaded. Please refresh the page.');
          }
        }
      });
        wrapper.appendChild(overlay);

        container.appendChild(wrapper);
    }
  }

  function processImage(img) {
    const src = img.currentSrc || img.src;
    if (!src) return;
    if (TWIMG_REG.test(src)) { addOverlay(img); return; }
    if (isPixivPage() && PXIMG_REG.test(src) && !/\/user-profile\//i.test(src)) { addOverlay(img); }
  }

  function scan() {
    document.querySelectorAll(`img[src*="pbs.twimg.com"]:not([${OVERLAY_ATTR}])`).forEach(processImage);
    if (isPixivPage()) {
      document.querySelectorAll(`img[src*="i.pximg.net"]:not([${OVERLAY_ATTR}])`).forEach(processImage);
    }
  }

  const observer = new MutationObserver(() => scan());
  observer.observe(document.body, { childList: true, subtree: true });
  scan();
})();
