const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');

const BASE_URL = 'https://savetik.io';
const API_URL = 'https://savetik.io/api/ajaxSearch';

const DEFAULT_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
  accept: '*/*',
  'accept-language': 'en-US,en;q=0.9,id;q=0.8',
  'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
  'x-requested-with': 'XMLHttpRequest',
  origin: BASE_URL,
  referer: `${BASE_URL}/en/download-tiktok-photos`
};

const TIKTOK_HOSTNAMES = new Set([
  'tiktok.com',
  'www.tiktok.com',
  'm.tiktok.com',
  'vm.tiktok.com',
  'vt.tiktok.com'
]);
const DOWNLOAD_TYPES = new Set(['all', 'video', 'mp4', 'audio', 'mp3', 'photo', 'photos', 'image']);
const VIDEO_QUALITIES = new Set(['no_watermark', 'watermark', 'hd', 'standard']);
const CONTENT_TYPE_EXTENSIONS = new Map([
  ['video/mp4', 'mp4'],
  ['video/webm', 'webm'],
  ['audio/mpeg', 'mp3'],
  ['audio/mp4', 'm4a'],
  ['audio/aac', 'aac'],
  ['audio/ogg', 'ogg'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif']
]);

function validateTikTokUrl(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('URL TikTok tidak boleh kosong.');
  }

  let parsed;
  try {
    parsed = new URL(input.trim());
  } catch {
    throw new Error('URL harus berupa link TikTok yang valid.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || !TIKTOK_HOSTNAMES.has(parsed.hostname.toLowerCase())) {
    throw new Error('URL harus memakai hostname resmi TikTok.');
  }

  return parsed.toString();
}

function normalizeUrl(input) {
  if (!input || typeof input !== 'string') return null;

  let url = input.trim();

  if (!url || url === '#' || url.toLowerCase().startsWith('javascript:')) {
    return null;
  }

  url = url.replace(/&amp;/g, '&');

  if (url.startsWith('//')) {
    url = `https:${url}`;
  }

  if (url.startsWith('/')) {
    url = `${BASE_URL}${url}`;
  }

  return url;
}

function decodeUrlCandidate(input) {
  if (!input || typeof input !== 'string') return null;

  return input
    .trim()
    .replace(/\\\//g, '/')
    .replace(/\\u0026/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#034;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&');
}

function getElementUrls(el) {
  const attrs = [
    'href',
    'src',
    'data-src',
    'data-url',
    'data-href',
    'data-download',
    'data-original',
    'data-lazy-src',
    'data-image',
    'data-photo',
    'content'
  ];

  const urls = [];

  for (const attr of attrs) {
    const url = normalizeUrl(decodeUrlCandidate(el.attr(attr)));
    if (url) urls.push(url);
  }

  const srcset = el.attr('srcset') || el.attr('data-srcset') || '';
  for (const part of srcset.split(',')) {
    const url = normalizeUrl(decodeUrlCandidate(part.trim().split(/\s+/)[0]));
    if (url) urls.push(url);
  }

  const style = el.attr('style') || '';
  const styleMatches = style.matchAll(/url\((['"]?)(.*?)\1\)/gi);
  for (const match of styleMatches) {
    const url = normalizeUrl(decodeUrlCandidate(match[2]));
    if (url) urls.push(url);
  }

  return [...new Set(urls)];
}

function sanitizeFileName(input) {
  return String(input || 'tiktok')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 90) || `tiktok_${Date.now()}`;
}

function getExtFromUrl(url, fallback = 'bin') {
  try {
    const cleanUrl = url.split('?')[0].split('#')[0];
    const ext = path.extname(cleanUrl).replace('.', '').toLowerCase();

    if (ext && ext.length <= 6) return ext;
    return fallback;
  } catch {
    return fallback;
  }
}

function getText($, selector) {
  return $(selector).first().text().replace(/\s+/g, ' ').trim() || null;
}

function classifyLink({ text = '', href = '', className = '', title = '', download = '' }) {
  const raw = `${text} ${href} ${className} ${title} ${download}`.toLowerCase();

  if (
    raw.includes('mp3') ||
    raw.includes('audio') ||
    raw.includes('music') ||
    raw.includes('sound') ||
    raw.includes('lagu')
  ) {
    return 'audio';
  }

  if (
    raw.includes('photo') ||
    raw.includes('image') ||
    raw.includes('picture') ||
    raw.includes('gambar') ||
    /\.(jpg|jpeg|png|webp)(\?|#|$)/i.test(href)
  ) {
    return 'photo';
  }

  if (
    raw.includes('mp4') ||
    raw.includes('video') ||
    raw.includes('without watermark') ||
    raw.includes('no watermark') ||
    raw.includes('tanpa watermark') ||
    raw.includes('unduh mp4') ||
    raw.includes('download mp4') ||
    /\.mp4(\?|#|$)/i.test(href)
  ) {
    return 'video';
  }

  return 'unknown';
}

function guessQuality({ text = '', href = '', title = '' }) {
  const raw = `${text} ${href} ${title}`.toLowerCase();

  if (/no[ _-]?watermark|without[ _-]?watermark|tanpa[ _-]?watermark/.test(raw)) return 'no_watermark';
  if (raw.includes('watermark')) return 'watermark';
  if (/\bhd\b|high[ _-]?definition|1080p|2k|4k/.test(raw)) return 'hd';
  return 'standard';
}

function uniqueByUrl(items) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    if (!item || !item.url) continue;
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    result.push(item);
  }

  return result;
}

function looksLikePhotoUrl(url) {
  if (!url) return false;

  const raw = url.toLowerCase();

  return (
    /\.(jpg|jpeg|png|webp)(\?|#|$)/i.test(raw) ||
    raw.includes('tikcdn') ||
    raw.includes('tiktokcdn') ||
    raw.includes('muscdn') ||
    raw.includes('byteoversea') ||
    raw.includes('/tos-') ||
    raw.includes('/p16-') ||
    raw.includes('/p19-')
  );
}

function looksLikeVideoUrl(url) {
  if (!url) return false;

  const raw = url.toLowerCase();

  return (
    /\.mp4(\?|#|$)/i.test(raw) ||
    raw.includes('video/tos') ||
    raw.includes('/tos-') && raw.includes('mime_type=video')
  );
}

function extractMediaUrlsFromText(text) {
  if (!text || typeof text !== 'string') return [];

  const urls = [];
  const normalized = decodeUrlCandidate(text);
  const matches = normalized.match(/https?:\/\/[^\s"'<>\\]+/gi) || [];

  for (const match of matches) {
    const url = normalizeUrl(match.replace(/[),.;]+$/g, ''));
    if (url) urls.push(url);
  }

  return [...new Set(urls)];
}

function parseSavetikHtml(html) {
  const $ = cheerio.load(html || '');

  const title =
    getText($, 'h3') ||
    getText($, '.tik-left h3') ||
    getText($, '.content h3') ||
    getText($, '.video-title') ||
    getText($, '.title') ||
    null;

  const author =
    getText($, '.author') ||
    getText($, '.username') ||
    getText($, '.user-name') ||
    getText($, '.tik-left p') ||
    null;

  const thumbnail =
    normalizeUrl($('.image-tik img').first().attr('src')) ||
    normalizeUrl($('.thumbnail img').first().attr('src')) ||
    normalizeUrl($('.avatar img').first().attr('src')) ||
    normalizeUrl($('img').first().attr('src')) ||
    null;

  const collected = [];

  $('a').each((_, element) => {
    const el = $(element);
    const text = el.text().replace(/\s+/g, ' ').trim();
    const titleAttr = el.attr('title') || '';
    const className = el.attr('class') || '';
    const downloadAttr = el.attr('download') || '';

    for (const url of getElementUrls(el)) {
      let type = classifyLink({
        text,
        href: url,
        className,
        title: titleAttr,
        download: downloadAttr
      });

      if (type === 'unknown' && looksLikePhotoUrl(url)) type = 'photo';
      if (type === 'unknown' && looksLikeVideoUrl(url)) type = 'video';
      if (type === 'unknown') continue;

      collected.push({
        type,
        quality: guessQuality({ text, href: url, title: titleAttr }),
        label: text || titleAttr || type,
        url
      });
    }
  });

  // SaveTik photo/slideshow kadang menaruh foto di container khusus.
  const photoSelectors = [
    '.photo-list a',
    '.photo-list img',
    '.list-photo a',
    '.list-photo img',
    '.download-items a',
    '.download-items img',
    '.download-box a',
    '.download-box img',
    '.item-photo a',
    '.item-photo img',
    '.slides a',
    '.slides img'
  ];

  for (const selector of photoSelectors) {
    $(selector).each((_, element) => {
      const el = $(element);
      for (const url of getElementUrls(el)) {
        if (!looksLikePhotoUrl(url)) continue;

        collected.push({
          type: 'photo',
          quality: null,
          label: 'photo',
          url
        });
      }
    });
  }

  // Fallback: ambil image CDN yang tampak seperti foto TikTok, bukan logo kecil situs.
  $('img').each((_, element) => {
    for (const url of getElementUrls($(element))) {
      if (!looksLikePhotoUrl(url)) continue;

      collected.push({
        type: 'photo',
        quality: null,
        label: 'photo',
        url
      });
    }
  });

  for (const url of extractMediaUrlsFromText(html)) {
    if (looksLikePhotoUrl(url)) {
      collected.push({
        type: 'photo',
        quality: null,
        label: 'photo',
        url
      });
      continue;
    }

    if (looksLikeVideoUrl(url)) {
      collected.push({
        type: 'video',
        quality: guessQuality({ href: url }),
        label: 'video',
        url
      });
    }
  }

  const links = uniqueByUrl(collected);

  const videos = links.filter((item) => item.type === 'video');
  const audios = links.filter((item) => item.type === 'audio');
  const photos = links.filter((item) => item.type === 'photo');

  const bestVideo =
    videos.find((item) => item.quality === 'hd') ||
    videos.find((item) => item.quality === 'no_watermark') ||
    videos.find((item) => item.quality === 'standard') ||
    videos[0] ||
    null;

  const bestAudio =
    audios.find((item) => item.quality === 'mp3') ||
    audios[0] ||
    null;

  return {
    title,
    author,
    thumbnail,
    type: photos.length > 1 ? 'photo' : bestVideo ? 'video' : photos.length ? 'photo' : 'unknown',
    video: bestVideo ? bestVideo.url : null,
    videos,
    audio: bestAudio ? bestAudio.url : null,
    audios,
    photos: photos.map((item) => item.url),
    links
  };
}

async function requestSavetik(tiktokUrl, options = {}) {
  const url = validateTikTokUrl(tiktokUrl);
  const lang = options.lang || 'en';

  const body = new URLSearchParams({
    q: url,
    cursor: '0',
    page: '0',
    lang
  }).toString();

  const response = await axios.post(API_URL, body, {
    timeout: options.timeout || 30000,
    headers: {
      ...DEFAULT_HEADERS,
      referer: options.referer || `${BASE_URL}/${lang}/download-tiktok-photos`
    },
    maxRedirects: 5,
    validateStatus: () => true
  });

  if (response.status >= 400) {
    throw new Error(`SaveTik endpoint gagal. HTTP status: ${response.status}`);
  }

  const json = response.data;

  if (!json || typeof json !== 'object') {
    throw new Error('Response SaveTik bukan JSON valid.');
  }

  if (json.status === false || json.status === 'error') {
    throw new Error(json.message || 'SaveTik gagal memproses link.');
  }

  const html = typeof json.data === 'string' ? json.data : '';

  if (!html) {
    throw new Error('SaveTik tidak mengembalikan HTML media.');
  }

  const lowerHtml = html.toLowerCase();
  if (
    lowerHtml.includes('captcha') ||
    lowerHtml.includes('cloudflare') ||
    lowerHtml.includes('verify you are human') ||
    lowerHtml.includes('access denied')
  ) {
    throw new Error('SaveTik meminta verifikasi anti-bot. Coba lagi nanti atau gunakan provider fallback.');
  }

  return { json, html, input: url };
}

async function getData(tiktokUrl, options = {}) {
  const { json, html, input } = await requestSavetik(tiktokUrl, options);
  const parsed = parseSavetikHtml(html);

  if (!parsed.video && !parsed.audio && parsed.photos.length === 0) {
    throw new Error('Media tidak ditemukan. Link mungkin private, invalid, region-blocked, atau HTML SaveTik berubah.');
  }

  return {
    status: true,
    source: 'savetik',
    endpoint: API_URL,
    input,
    ...parsed,
    raw: options.raw ? json : undefined,
    rawHtml: options.rawHtml ? html : undefined
  };
}

function getDetectedMedia(data) {
  const type = data.type === 'photo' && data.photos.length > 0
    ? 'photo'
    : data.video
      ? 'video'
      : data.photos.length > 0
        ? 'photo'
        : data.audio
          ? 'audio'
          : 'unknown';

  return {
    status: data.status,
    source: data.source,
    input: data.input,
    title: data.title,
    author: data.author,
    thumbnail: data.thumbnail,
    type,
    video: type === 'video' ? data.video : null,
    audio: type === 'audio' ? data.audio : null,
    photos: type === 'photo' ? data.photos : [],
    links: type === 'video' ? [data.video] : type === 'photo' ? data.photos : type === 'audio' ? [data.audio] : []
  };
}

async function getMedia(tiktokUrl, options = {}) {
  const data = await getData(tiktokUrl, options);
  return getDetectedMedia(data);
}

async function downloadFile(fileUrl, outputPath, options = {}) {
  if (!fileUrl) throw new Error('URL file kosong.');
  if (!outputPath) throw new Error('Output path kosong.');

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const response = await axios.get(fileUrl, {
    responseType: 'stream',
    timeout: options.downloadTimeout || options.timeout || 60000,
    headers: {
      'user-agent': DEFAULT_HEADERS['user-agent'],
      accept: '*/*',
      referer: BASE_URL
    },
    maxRedirects: 5,
    validateStatus: () => true
  });

  if (response.status >= 400) {
    throw new Error(`Gagal download file. HTTP status: ${response.status}`);
  }

  const contentType = String(response.headers && response.headers['content-type'] || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  const detectedExt = CONTENT_TYPE_EXTENSIONS.get(contentType);
  const currentExt = path.extname(outputPath);
  const pathWithoutExt = currentExt ? outputPath.slice(0, -currentExt.length) : outputPath;
  const finalPath = detectedExt
    ? `${pathWithoutExt}.${detectedExt}`
    : outputPath;
  const partPath = `${finalPath}.part`;

  try {
    await pipeline(response.data, fs.createWriteStream(partPath));
    await fs.promises.rename(partPath, finalPath);
    return finalPath;
  } catch (error) {
    await fs.promises.rm(partPath, { force: true }).catch(() => {});
    throw error;
  }
}

function validateDownloadType(type) {
  if (typeof type !== 'string' || !DOWNLOAD_TYPES.has(type.toLowerCase())) {
    throw new Error(`Opsi type tidak valid. Gunakan: ${[...DOWNLOAD_TYPES].join(', ')}.`);
  }
  return type.toLowerCase();
}

async function downloadTikTok(tiktokUrl, options = {}) {
  const data = await getData(tiktokUrl, options);

  const outputDir = options.outputDir || path.join(process.cwd(), 'downloads');
  const baseName = sanitizeFileName(options.fileName || data.title || `tiktok_${Date.now()}`);
  const mode = validateDownloadType(options.type || 'all');
  const quality = options.quality || null;

  if (quality !== null && (typeof quality !== 'string' || !VIDEO_QUALITIES.has(quality.toLowerCase()))) {
    throw new Error(`Opsi quality tidak valid. Gunakan: ${[...VIDEO_QUALITIES].join(', ')}.`);
  }

  const files = {
    video: null,
    audio: null,
    photos: []
  };

  const selectedVideo = quality
    ? data.videos.find((item) => item.quality === quality.toLowerCase())
    : data.videos.find((item) => item.url === data.video);

  if ((mode === 'all' || mode === 'video' || mode === 'mp4') && selectedVideo) {
    const videoPath = path.join(outputDir, `${baseName}.mp4`);
    files.video = await downloadFile(selectedVideo.url, videoPath, options);
  }

  if ((mode === 'all' || mode === 'audio' || mode === 'mp3') && data.audio) {
    const audioPath = path.join(outputDir, `${baseName}.mp3`);
    files.audio = await downloadFile(data.audio, audioPath, options);
  }

  if ((mode === 'all' || mode === 'photo' || mode === 'photos' || mode === 'image') && data.photos.length > 0) {
    for (let i = 0; i < data.photos.length; i++) {
      const url = data.photos[i];
      const ext = getExtFromUrl(url, 'jpg');
      const photoPath = path.join(outputDir, `${baseName}_photo_${String(i + 1).padStart(2, '0')}.${ext}`);
      const savedPath = await downloadFile(url, photoPath, options);
      files.photos.push(savedPath);
    }
  }

  return {
    ...data,
    files
  };
}

module.exports = {
  BASE_URL,
  API_URL,
  getData,
  getMedia,
  getDetectedMedia,
  requestSavetik,
  parseSavetikHtml,
  downloadTikTok,
  downloadFile,
  normalizeUrl,
  validateTikTokUrl,
  validateDownloadType
};
