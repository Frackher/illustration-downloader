importScripts('/js/lib/piexif.js');

const PIXIV_REFERER_RULE_ID = 1;

function initPixivRefererRule() {
  if (typeof chrome.declarativeNetRequest === 'undefined') return;
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [PIXIV_REFERER_RULE_ID],
    addRules: [{
      id: PIXIV_REFERER_RULE_ID,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [{ header: 'Referer', operation: 'set', value: 'https://www.pixiv.net/' }]
      },
      condition: {
        urlFilter: '*://i.pximg.net/*',
        resourceTypes: ['xmlhttprequest', 'image']
      }
    }]
  });
}

initPixivRefererRule();

function getExtensionFromUrl(url) {
  try {
    const path = new URL(url).pathname;
    const match = path.match(/\.(jpe?g|png|gif|webp)/i);
    if (match) return match[1].toLowerCase().replace('jpeg', 'jpg');
  } catch (_) {}
  return null;
}

function safeFilenamePart(s) {
  return (s || 'unknown').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 80);
}

function getFormatFolder(ratio, min, max) {
  if (ratio >= min && ratio <= max) return 'square';
  return ratio > max ? 'landscape' : 'portrait';
}

function getFetchOpts(url) {
  const opts = { mode: 'cors', cache: 'no-store' };
  if (url && url.includes('pximg.net')) {
    opts.headers = { Referer: 'https://www.pixiv.net/' };
  }
  return opts;
}

const PXIMG_ORIGINAL_EXTENSIONS = ['png', 'jpg', 'webp', 'gif'];

/** Returns img-original URLs with other extensions (same path). Try these before falling back to img-master. */
function pximgOriginalAlternateUrls(url) {
  if (!url || !url.includes('i.pximg.net/img-original/')) return [];
  const base = url.replace(/\.[a-z]+$/i, '');
  const currentExt = (url.match(/\.([a-z]+)$/i) || [])[1]?.toLowerCase().replace('jpeg', 'jpg') || '';
  return PXIMG_ORIGINAL_EXTENSIONS
    .filter(ext => ext !== currentExt)
    .map(ext => base + '.' + ext);
}

function pximgOriginalToMaster(url) {
  if (!url || !url.includes('i.pximg.net/img-original/')) return null;
  return url.replace(/\/img-original\//, '/img-master/').replace(/(\.[a-z]+)$/i, '_master1200$1');
}

/** URLs img-master à essayer en fallback (_master1200 puis _square1200). */
function pximgMasterFallbackUrls(url) {
  if (!url || !url.includes('i.pximg.net/img-original/')) return [];
  const base = url.replace(/\/img-original\//, '/img-master/').replace(/(\.[a-z]+)$/i, '$1');
  const ext = (url.match(/(\.[a-z]+)$/i) || [])[1] || '.jpg';
  return [base + '_master1200' + ext, base + '_square1200' + ext];
}

/** Returns { width, height, mime, blob }. width/height can be null if the image could not be decoded. */
async function getImageBlobAndDimensions(url) {
  let res = await fetch(url, getFetchOpts(url));
  if (res.status === 404 && url.includes('i.pximg.net/img-original/')) {
    const opts = getFetchOpts(url);
    for (const altUrl of pximgOriginalAlternateUrls(url)) {
      res = await fetch(altUrl, opts);
      if (res.ok) break;
    }
    if (!res.ok) {
      for (const masterUrl of pximgMasterFallbackUrls(url)) {
        res = await fetch(masterUrl, getFetchOpts(masterUrl));
        if (res.ok) break;
      }
    }
  }
  if (!res.ok) throw new Error('Fetch failed: ' + res.status);
  const blob = await res.blob();
  const mime = blob.type || null;
  if (!mime || !mime.startsWith('image/')) throw new Error('The source image could not be decoded.');
  let width = null;
  let height = null;
  try {
    const bitmap = await createImageBitmap(blob);
    width = bitmap.width;
    height = bitmap.height;
    bitmap.close();
  } catch (_) {
    // e.g. "The source image could not be decoded" — keep blob for download, use default format
  }
  return { width, height, mime, blob };
}

function arrayBufferToBinaryString(ab) {
  const u = new Uint8Array(ab);
  let s = '';
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return s;
}

/** Base64 en chunks pour éviter stack overflow sur gros buffers. */
function arrayBufferToBase64(ab) {
  const u = new Uint8Array(ab);
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < u.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, u.subarray(i, i + chunkSize));
  }
  return typeof btoa !== 'undefined' ? btoa(binary) : '';
}

/** Crée une URL pour chrome.downloads : blob si dispo, sinon data URL (fallback pour service workers). */
function createDownloadUrl(blob, arrayBuffer, mime) {
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    try {
      return { url: URL.createObjectURL(blob), revoke: true };
    } catch (_) {}
  }
  const base64 = arrayBufferToBase64(arrayBuffer);
  if (!base64) throw new Error('URL.createObjectURL is not a function');
  return { url: 'data:' + (mime || 'application/octet-stream') + ';base64,' + base64, revoke: false };
}

function binaryStringToArrayBuffer(s) {
  const ab = new ArrayBuffer(s.length);
  const u = new Uint8Array(ab);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 0xff;
  return ab;
}

function escapeXml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isAsciiOnly(s) {
  if (!s) return true;
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) > 127) return false;
  return true;
}

/**
 * Injecte un segment XMP (UTF-8) dans le JPEG pour description/créateur/source/date.
 * Les logiciels qui lisent le XMP afficheront correctement japonais et autres langues.
 */
function injectXMP(arrayBuffer, { artistName, postUrl, postText }) {
  const desc = (postText || '').slice(0, 2000);
  const source = (postUrl || '').slice(0, 500);
  const artist = (artistName || '').slice(0, 255);
  const now = new Date();
  const isoDate = now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0') + 'T' +
    String(now.getHours()).padStart(2, '0') + ':' +
    String(now.getMinutes()).padStart(2, '0') + ':' +
    String(now.getSeconds()).padStart(2, '0');

  const parts = [];
  parts.push('<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">');
  if (desc) parts.push('<dc:description><rdf:Alt><rdf:li xml:lang="x-default">', escapeXml(desc), '</rdf:li></rdf:Alt></dc:description>');
  if (artist) parts.push('<dc:creator><rdf:Seq><rdf:li>', escapeXml(artist), '</rdf:li></rdf:Seq></dc:creator>');
  if (source) parts.push('<dc:source>', escapeXml(source), '</dc:source>');
  parts.push('</rdf:Description><rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/"><xmp:CreateDate>', escapeXml(isoDate), '</xmp:CreateDate></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>');

  const xmpXml = parts.join('');
  const utf8 = new TextEncoder().encode(xmpXml);
  const id = 'http://ns.adobe.com/xap/1.0/\x00';
  const idBytes = new Uint8Array(id.length);
  for (let i = 0; i < id.length; i++) idBytes[i] = id.charCodeAt(i);
  const payloadLen = 2 + idBytes.length + utf8.length;
  if (payloadLen > 65535) return arrayBuffer;
  const segment = new Uint8Array(2 + 2 + idBytes.length + utf8.length);
  segment[0] = 0xff; segment[1] = 0xe1;
  segment[2] = (payloadLen >> 8) & 0xff; segment[3] = payloadLen & 0xff;
  segment.set(idBytes, 4);
  segment.set(utf8, 4 + idBytes.length);

  const view = new Uint8Array(arrayBuffer);
  if (view.length < 4 || view[0] !== 0xff || view[1] !== 0xd8) return arrayBuffer;
  let pos = 2;
  while (pos < view.length - 4) {
    if (view[pos] === 0xff && view[pos + 1] === 0xe1) {
      const segLen = (view[pos + 2] << 8) | view[pos + 3];
      const insertAt = pos + 2 + segLen;
      const out = new Uint8Array(view.length + segment.length);
      out.set(view.subarray(0, insertAt), 0);
      out.set(segment, insertAt);
      out.set(view.subarray(insertAt), insertAt + segment.length);
      return out.buffer;
    }
    if (view[pos] === 0xff && view[pos + 1] === 0xda) break;
    const segLen = (view[pos + 2] << 8) | view[pos + 3];
    pos += 2 + segLen;
  }
  return arrayBuffer;
}

/**
 * Injects EXIF metadata into a JPEG buffer. Returns new ArrayBuffer or null if not JPEG / error.
 * EXIF en ASCII/Latin-1 ; pour l’unicode (japonais, etc.) le XMP est utilisé en plus.
 */
function injectJpegMetadata(arrayBuffer, { artistName, postUrl, postText }) {
  if (typeof self.piexif === 'undefined') return null;
  const piexif = self.piexif;
  const desc = (postText || '').slice(0, 2000);
  const source = (postUrl || '').slice(0, 500);
  const artist = (artistName || '').slice(0, 255);
  const now = new Date();
  const dateStr = now.getFullYear() + ':' +
    String(now.getMonth() + 1).padStart(2, '0') + ':' +
    String(now.getDate()).padStart(2, '0') + ' ' +
    String(now.getHours()).padStart(2, '0') + ':' +
    String(now.getMinutes()).padStart(2, '0') + ':' +
    String(now.getSeconds()).padStart(2, '0');

  const zeroth = {};
  if (desc && isAsciiOnly(desc)) zeroth[piexif.ImageIFD.ImageDescription] = desc;
  zeroth[piexif.ImageIFD.DateTime] = dateStr;
  if (artist && isAsciiOnly(artist)) zeroth[piexif.ImageIFD.Artist] = artist;
  if (source && isAsciiOnly(source)) zeroth[piexif.ImageIFD.Copyright] = source;

  const exifObj = { '0th': zeroth, Exif: {}, GPS: {}, Interop: {}, '1st': {}, thumbnail: null };
  try {
    const exifBytes = piexif.dump(exifObj);
    const jpegStr = arrayBufferToBinaryString(arrayBuffer);
    if (jpegStr.slice(0, 2) !== '\xff\xd8') return null;
    let outStr = piexif.insert(exifBytes, jpegStr);
    let out = binaryStringToArrayBuffer(outStr);
    const u = new Uint8Array(out);
    if (u.length < 2 || u[0] !== 0xff || u[1] !== 0xd8) return null;
    out = injectXMP(out, { artistName, postUrl, postText });
    return out;
  } catch (_) {
    return null;
  }
}

async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL('offscreen.html');
  if ('getContexts' in chrome.runtime) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [offscreenUrl]
    });
    if (contexts.length > 0) return;
  }
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['BLOBS'],
      justification: 'Écriture des images dans le dossier choisi par l\'utilisateur.'
    });
  } catch (e) {
    if (!e.message || !e.message.includes('single offscreen')) throw e;
  }
}

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'DOWNLOAD_IMAGE') {
    sendResponse({ ok: false, error: 'Unknown message type' });
    return true;
  }

  const { imageUrl, artistName, nsfw, postUrl, postText, platform } = message;
  if (!imageUrl) {
    sendResponse({ ok: false, error: 'Missing imageUrl' });
    return true;
  }
  const platformKey = (platform === 'pixiv' ? 'pixiv' : 'x');

  (async () => {
    try {
      const opts = await chrome.storage.sync.get([
        'saveFolder',
        'askEachTime',
        'squareRatioMin',
        'squareRatioMax',
        'useCustomFolder'
      ]);
      const useCustomFolder = !!opts.useCustomFolder;
      const saveFolder = (opts.saveFolder || 'Illustrations').trim().replace(/[/\\]+/g, '/').replace(/^\//, '') || 'Illustrations';
      const askEachTime = !!opts.askEachTime;

      let formatFolder;
      let blob;
      let mime;
      let ext = getExtensionFromUrl(imageUrl);

      if (nsfw) {
        formatFolder = 'nsfw';
        let res = await fetch(imageUrl, getFetchOpts(imageUrl));
        if (res.status === 404 && imageUrl.includes('i.pximg.net/img-original/')) {
          const opts = getFetchOpts(imageUrl);
          for (const altUrl of pximgOriginalAlternateUrls(imageUrl)) {
            res = await fetch(altUrl, opts);
            if (res.ok) break;
          }
          if (!res.ok) {
            for (const masterUrl of pximgMasterFallbackUrls(imageUrl)) {
              res = await fetch(masterUrl, opts);
              if (res.ok) break;
            }
          }
        }
        blob = await res.blob();
        mime = blob.type || null;
        if (!ext && mime) {
          const mimeMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };
          ext = mimeMap[mime] || 'jpg';
        }
        if (!ext) ext = 'jpg';
      } else {
        const ratioMin = Math.max(0.5, Math.min(1, Number(opts.squareRatioMin) || 0.9));
        const ratioMax = Math.max(1, Math.min(2, Number(opts.squareRatioMax) || 1.1));
        const data = await getImageBlobAndDimensions(imageUrl);
        blob = data.blob;
        mime = data.mime;
        if (data.width != null && data.height != null) {
          const ratio = data.width / data.height;
          formatFolder = getFormatFolder(ratio, ratioMin, ratioMax);
        } else {
          formatFolder = 'landscape';
        }
        if (!ext && mime) {
          const mimeMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };
          ext = mimeMap[mime] || 'jpg';
        }
        if (!ext) ext = 'jpg';
      }

      let arrayBuffer = await blob.arrayBuffer();
      const isJpeg = mime === 'image/jpeg' || (ext && ext.toLowerCase() === 'jpg');
      if (isJpeg && (artistName || postUrl || postText)) {
        const injected = injectJpegMetadata(arrayBuffer, { artistName, postUrl, postText });
        if (injected) arrayBuffer = injected;
      }

      const date = new Date();
      const yyyymmdd = date.getFullYear() +
        String(date.getMonth() + 1).padStart(2, '0') +
        String(date.getDate()).padStart(2, '0');
      const artist = safeFilenamePart(artistName);
      const baseName = `${yyyymmdd}_${platformKey}_${artist}`;
      const extClean = (ext || 'jpg').replace(/[^a-z0-9]/gi, '') || 'jpg';
      const fileName = `${baseName}.${extClean}`;

      if (useCustomFolder) {
        await ensureOffscreenDocument();
        const relativePath = `${formatFolder}/${fileName}`;
        const r = await chrome.runtime.sendMessage({
          type: 'WRITE_FILE',
          relativePath,
          imageUrl,
          referer: imageUrl.includes('pximg.net') ? 'https://www.pixiv.net/' : undefined,
          metadata: { artistName, postUrl, postText },
          isJpeg: mime === 'image/jpeg' || (ext && ext.toLowerCase() === 'jpg')
        });
        if (r && r.ok) {
          sendResponse({ ok: true, format: formatFolder, skipped: !!r.skipped });
          return;
        }
        const customFolderUnavailable = r?.error && (
          r.error.includes('getDirectoryHandle') ||
          r.error.includes('not allowed by the user agent') ||
          r.error.includes('request is not allowed')
        );
        if (!customFolderUnavailable) {
          sendResponse({ ok: false, error: r?.error || 'Write failed', errorKey: 'errWriteFailed' });
          return;
        }
      }

      const pathSeg = (s) => String(s).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'download';
      const filename = `${pathSeg(saveFolder)}/${pathSeg(formatFolder)}/${fileName}`;
      const blobForDownload = new Blob([arrayBuffer], { type: mime || 'application/octet-stream' });
      const { url: downloadUrl, revoke } = createDownloadUrl(blobForDownload, arrayBuffer, mime);
      await chrome.downloads.download({
        url: downloadUrl,
        filename,
        saveAs: askEachTime,
        conflictAction: 'uniquify'
      });
      if (revoke && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 60000);
      }

      sendResponse({ ok: true, format: formatFolder });
    } catch (e) {
      sendResponse({ ok: false, error: e.message || String(e) });
    }
  })();

  return true;
});
