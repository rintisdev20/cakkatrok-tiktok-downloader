const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const axios = require('axios');
const {
  parseSavetikHtml,
  getDetectedMedia,
  validateTikTokUrl,
  validateDownloadType,
  downloadFile
} = require('./index');

test('validasi hanya menerima URL dengan hostname resmi TikTok', () => {
  assert.equal(validateTikTokUrl('https://vt.tiktok.com/abc'), 'https://vt.tiktok.com/abc');
  assert.throws(() => validateTikTokUrl('https://tiktok.com.evil.example/video/1'), /hostname resmi/);
  assert.throws(() => validateTikTokUrl('bukan-url'), /valid/);
});

test('validasi type menerima alias resmi dan menolak teks sembarang', () => {
  assert.equal(validateDownloadType('MP3'), 'mp3');
  assert.equal(validateDownloadType('photos'), 'photos');
  assert.throws(() => validateDownloadType('dokumen'), /type tidak valid/);
});

test('parser mendeteksi video, audio, foto, dan empat kualitas video', () => {
  const result = parseSavetikHtml(`
    <h3>Contoh</h3>
    <a href="https://cdn.example/no.mp4">Download without watermark</a>
    <a href="https://cdn.example/wm.mp4">Download watermark</a>
    <a href="https://cdn.example/hd.mp4">Download HD</a>
    <a href="https://cdn.example/std.mp4">Download video</a>
    <a href="https://cdn.example/song.mp3">Download MP3 audio</a>
    <a href="https://cdn.example/photo.jpg">Download photo</a>
  `);

  assert.deepEqual(result.videos.map(({ quality }) => quality), [
    'no_watermark', 'watermark', 'hd', 'standard'
  ]);
  assert.equal(result.audios.length, 1);
  assert.equal(result.photos.length, 1);
  assert.equal(result.video, 'https://cdn.example/hd.mp4');
});

test('deteksi media dapat menghasilkan tipe audio', () => {
  const result = getDetectedMedia({
    status: true, source: 'savetik', input: 'x', title: null, author: null,
    thumbnail: null, type: 'unknown', video: null, audio: 'https://cdn.example/a.mp3', photos: []
  });
  assert.equal(result.type, 'audio');
  assert.equal(result.audio, 'https://cdn.example/a.mp3');
  assert.deepEqual(result.links, ['https://cdn.example/a.mp3']);
});

test('download memakai Content-Type, file .part, lalu rename', async (t) => {
  const originalGet = axios.get;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'savetik-test-'));
  t.after(() => {
    axios.get = originalGet;
    fs.rmSync(dir, { recursive: true, force: true });
  });
  axios.get = async () => ({
    status: 200,
    headers: { 'content-type': 'image/png; charset=binary' },
    data: Readable.from(Buffer.from('PNG'))
  });

  const requested = path.join(dir, 'media.jpg');
  const saved = await downloadFile('https://cdn.example/media', requested);
  assert.equal(saved, path.join(dir, 'media.png'));
  assert.equal(fs.readFileSync(saved, 'utf8'), 'PNG');
  assert.equal(fs.existsSync(`${saved}.part`), false);
});

test('download menghapus file .part saat stream gagal', async (t) => {
  const originalGet = axios.get;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'savetik-test-'));
  t.after(() => {
    axios.get = originalGet;
    fs.rmSync(dir, { recursive: true, force: true });
  });
  axios.get = async () => ({
    status: 200,
    headers: { 'content-type': 'video/mp4' },
    data: new Readable({ read() { this.destroy(new Error('stream rusak')); } })
  });

  const output = path.join(dir, 'media.mp4');
  await assert.rejects(downloadFile('https://cdn.example/media', output), /stream rusak/);
  assert.equal(fs.existsSync(`${output}.part`), false);
  assert.equal(fs.existsSync(output), false);
});
