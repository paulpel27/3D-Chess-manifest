// Service Worker for Grandmaster 3D Chess PWA
// Provides full offline caching and serves 192x192 & 512x512 PNG icons

const CACHE_NAME = 'chess-3d-pwa-v9';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './manifest.webmanifest',
  './css/styles.css?v=9',
  './js/sound.js?v=9',
  './js/ai.js?v=9',
  './js/board3d.js?v=9',
  './js/app.js?v=9',
  './icons/icon.svg',
  'https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
];

// Pure-JS binary PNG encoder fallback + OffscreenCanvas generator for 192x192 and 512x512 PNG icons
async function generateChessIconPNGResponse(size) {
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const canvas = new OffscreenCanvas(size, size);
      const ctx = canvas.getContext('2d');

      // Dark luxury background
      const grad = ctx.createLinearGradient(0, 0, size, size);
      grad.addColorStop(0, '#1a1c29');
      grad.addColorStop(1, '#0b0c12');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);

      // Gold frame border
      ctx.strokeStyle = '#d4af37';
      ctx.lineWidth = Math.max(4, Math.floor(size * 0.04));
      const pad = Math.floor(size * 0.08);
      ctx.strokeRect(pad, pad, size - pad * 2, size - pad * 2);

      // Gold Knight symbol
      ctx.fillStyle = '#f5d76e';
      ctx.font = `bold ${Math.floor(size * 0.54)}px "Segoe UI Symbol", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('♞', size / 2, size * 0.53);

      const blob = await canvas.convertToBlob({ type: 'image/png' });
      return new Response(blob, {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'image/png',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=31536000'
        }
      });
    } catch (e) {
      // Fall through to binary PNG builder
    }
  }

  // Fallback: Pure-JS uncompressed PNG generator (valid IHDR + zlib store IDAT + IEND)
  const bytes = buildBinaryPNG(size, size);
  return new Response(bytes, {
    status: 200,
    statusText: 'OK',
    headers: {
      'Content-Type': 'image/png',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=31536000'
    }
  });
}

function buildBinaryPNG(width, height) {
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c;
  }

  function crc32(buf, start, len) {
    let c = 0xffffffff;
    for (let i = start; i < start + len; i++) {
      c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xff];
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function writeUInt32BE(buf, offset, val) {
    buf[offset] = (val >>> 24) & 0xff;
    buf[offset + 1] = (val >>> 16) & 0xff;
    buf[offset + 2] = (val >>> 8) & 0xff;
    buf[offset + 3] = val & 0xff;
  }

  const rowSize = 1 + width * 4;
  const rawLen = height * rowSize;
  const raw = new Uint8Array(rawLen);

  const pad = Math.floor(width * 0.08);
  const borderW = Math.max(4, Math.floor(width * 0.04));
  const cx = width / 2;
  const cy = height / 2;
  const r = width * 0.26;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    raw[rowOffset] = 0; // No filter
    for (let x = 0; x < width; x++) {
      const p = rowOffset + 1 + x * 4;
      const isBorder =
        x >= pad &&
        x < width - pad &&
        y >= pad &&
        y < height - pad &&
        (x < pad + borderW ||
          x >= width - pad - borderW ||
          y < pad + borderW ||
          y >= height - pad - borderW);

      const dx = x - cx;
      const dy = y - cy;
      const inEmblem = dx * dx + dy * dy <= r * r;

      if (isBorder || inEmblem) {
        raw[p] = 212;
        raw[p + 1] = 175;
        raw[p + 2] = 55;
        raw[p + 3] = 255;
      } else {
        raw[p] = 14;
        raw[p + 1] = 18;
        raw[p + 2] = 28;
        raw[p + 3] = 255;
      }
    }
  }

  // Wrap raw scanlines in uncompressed Zlib blocks (max 65535 bytes per block)
  const maxBlock = 65535;
  const numBlocks = Math.ceil(rawLen / maxBlock);
  const zlibLen = 2 + rawLen + numBlocks * 5 + 4;
  const zlibData = new Uint8Array(zlibLen);
  zlibData[0] = 0x78;
  zlibData[1] = 0x01;

  let zOffset = 2;
  let s1 = 1;
  let s2 = 0;

  for (let b = 0; b < numBlocks; b++) {
    const start = b * maxBlock;
    const len = Math.min(maxBlock, rawLen - start);
    const isLast = b === numBlocks - 1 ? 1 : 0;
    zlibData[zOffset++] = isLast;
    zlibData[zOffset++] = len & 0xff;
    zlibData[zOffset++] = (len >>> 8) & 0xff;
    const nlen = ~len & 0xffff;
    zlibData[zOffset++] = nlen & 0xff;
    zlibData[zOffset++] = (nlen >>> 8) & 0xff;

    for (let i = 0; i < len; i++) {
      const byte = raw[start + i];
      zlibData[zOffset++] = byte;
      s1 = (s1 + byte) % 65521;
      s2 = (s2 + s1) % 65521;
    }
  }

  const adler = ((s2 << 16) | s1) >>> 0;
  writeUInt32BE(zlibData, zOffset, adler);

  // Assemble PNG file: Signature (8) + IHDR (25) + IDAT (12 + zlibLen) + IEND (12)
  const totalLen = 8 + 25 + (12 + zlibLen) + 12;
  const png = new Uint8Array(totalLen);
  png.set([137, 80, 78, 71, 13, 10, 26, 10], 0);

  let pos = 8;
  // IHDR
  writeUInt32BE(png, pos, 13);
  png.set([73, 72, 68, 82], pos + 4);
  writeUInt32BE(png, pos + 8, width);
  writeUInt32BE(png, pos + 12, height);
  png[pos + 16] = 8; // bit depth
  png[pos + 17] = 6; // RGBA
  png[pos + 18] = 0;
  png[pos + 19] = 0;
  png[pos + 20] = 0;
  writeUInt32BE(png, pos + 21, crc32(png, pos + 4, 17));
  pos += 25;

  // IDAT
  writeUInt32BE(png, pos, zlibLen);
  png.set([73, 68, 65, 84], pos + 4);
  png.set(zlibData, pos + 8);
  writeUInt32BE(png, pos + 8 + zlibLen, crc32(png, pos + 4, 4 + zlibLen));
  pos += 12 + zlibLen;

  // IEND
  writeUInt32BE(png, pos, 0);
  png.set([73, 69, 78, 68], pos + 4);
  writeUInt32BE(png, pos + 8, crc32(png, pos + 4, 4));

  return png;
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // Pre-generate and cache both required 192x192 and 512x512 PNG icons
      const res192 = await generateChessIconPNGResponse(192);
      const res512 = await generateChessIconPNGResponse(512);
      await cache.put('./icons/icon-192.png', res192);
      await cache.put('./icons/icon-512.png', res512);

      return Promise.allSettled(
        ASSETS_TO_CACHE.map((url) => cache.add(url))
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Always serve valid 192x192 and 512x512 PNG icons
  if (url.pathname.endsWith('/icons/icon-192.png')) {
    event.respondWith(
      caches.match('./icons/icon-192.png').then((cached) => {
        return cached || generateChessIconPNGResponse(192);
      })
    );
    return;
  }

  if (url.pathname.endsWith('/icons/icon-512.png')) {
    event.respondWith(
      caches.match('./icons/icon-512.png').then((cached) => {
        return cached || generateChessIconPNGResponse(512);
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (networkResponse.type === 'basic' || networkResponse.type === 'cors')
        ) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request, { ignoreSearch: true }).then((cached) => {
          return cached || caches.match('./index.html');
        });
      })
  );
});
