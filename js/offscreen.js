const IDB_NAME = 'ImgDownloader';
const IDB_STORE = 'handles';
const HANDLE_KEY = 'downloadDir';

function arrayBufferToBinaryString(ab) {
  const u = new Uint8Array(ab);
  let s = '';
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return s;
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

/** XMP en UTF-8 pour japonais et autres langues. */
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

function injectJpegMetadata(arrayBuffer, { artistName, postUrl, postText }) {
  const piexif = typeof window !== 'undefined' && window.piexif;
  if (!piexif) return null;
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
    const outStr = piexif.insert(exifBytes, jpegStr);
    let out = binaryStringToArrayBuffer(outStr);
    const u = new Uint8Array(out);
    if (u.length < 2 || u[0] !== 0xff || u[1] !== 0xd8) return null;
    out = injectXMP(out, { artistName, postUrl, postText });
    return out;
  } catch (_) {
    return null;
  }
}

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

function getBaseAndExt(fileName) {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1) return { base: fileName, ext: '' };
  return { base: fileName.slice(0, lastDot), ext: fileName.slice(lastDot) };
}

/** Returns { path, skipped } where skipped=true if same image already exists (same size). */
async function findAvailablePath(dirHandle, fileName, arrayBuffer) {
  const { base, ext } = getBaseAndExt(fileName);
  const baseName = base + ext;
  try {
    const existingHandle = await dirHandle.getFileHandle(baseName, { create: false });
    const file = await existingHandle.getFile();
    if (file.size === arrayBuffer.byteLength) {
      return { path: baseName, skipped: true };
    }
  } catch (_) {
    return { path: baseName, skipped: false };
  }
  for (let n = 1; n <= 99; n++) {
    const num = String(n).padStart(2, '0');
    const candidate = `${base}_${num}${ext}`;
    try {
      await dirHandle.getFileHandle(candidate, { create: false });
    } catch (_) {
      return { path: candidate, skipped: false };
    }
  }
  throw new Error('Trop de fichiers (limite _99 atteinte)');
}

async function writeFile(relativePath, arrayBuffer) {
  const dir = await getStoredHandle();
  if (!dir) throw new Error('Aucun dossier choisi');
  const parts = relativePath.split('/').filter(Boolean);
  const fileName = parts.pop();
  let current = dir;
  for (const segment of parts) {
    current = await current.getDirectoryHandle(segment, { create: true });
  }
  const { path: finalFileName, skipped } = await findAvailablePath(current, fileName, arrayBuffer);
  if (skipped) return { skipped: true };
  const fileHandle = await current.getFileHandle(finalFileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write({ type: 'write', data: arrayBuffer });
  await writable.close();
  return { skipped: false };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'WRITE_FILE' || !msg.relativePath) {
    return false;
  }
  if (!msg.imageUrl && !msg.arrayBuffer) {
    sendResponse({ ok: false, error: 'Missing imageUrl or arrayBuffer' });
    return true;
  }
  (async () => {
    try {
      let arrayBuffer;
      if (msg.arrayBuffer && msg.arrayBuffer.byteLength > 0) {
        arrayBuffer = msg.arrayBuffer;
      } else {
        const fetchOpts = { mode: 'cors', cache: 'no-store' };
        if (msg.referer) fetchOpts.headers = { Referer: msg.referer };
        let url = msg.imageUrl;
        let res = await fetch(url, fetchOpts);
        if (res.status === 404 && url.includes('i.pximg.net/img-original/')) {
          const base = url.replace(/\.[a-z]+$/i, '');
          const currentExt = (url.match(/\.([a-z]+)$/i) || [])[1]?.toLowerCase().replace('jpeg', 'jpg') || '';
          const otherExts = ['png', 'jpg', 'webp', 'gif'].filter(ext => ext !== currentExt);
          for (const ext of otherExts) {
            res = await fetch(base + '.' + ext, fetchOpts);
            if (res.ok) break;
          }
          if (!res.ok) {
            const base = url.replace(/\/img-original\//, '/img-master/').replace(/(\.[a-z]+)$/i, '$1');
            const ext = (url.match(/(\.[a-z]+)$/i) || [])[1] || '.jpg';
            for (const suffix of ['_master1200', '_square1200']) {
              url = base + suffix + ext;
              res = await fetch(url, fetchOpts);
              if (res.ok) break;
            }
          }
        }
        if (!res.ok) throw new Error('Fetch failed: ' + res.status);
        const blob = await res.blob();
        arrayBuffer = await blob.arrayBuffer();
      }
      if (msg.isJpeg && msg.metadata && (msg.metadata.artistName || msg.metadata.postUrl || msg.metadata.postText)) {
        const injected = injectJpegMetadata(arrayBuffer, msg.metadata);
        if (injected) arrayBuffer = injected;
      }
      const result = await writeFile(msg.relativePath, arrayBuffer);
      sendResponse({ ok: true, skipped: result.skipped });
    } catch (e) {
      sendResponse({ ok: false, error: e.message || String(e) });
    }
  })();
  return true;
});
