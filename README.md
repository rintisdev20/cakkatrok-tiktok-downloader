# Cakkatrok TikTok Downloader

Downloader TikTok untuk Node.js yang mengambil video, slideshow foto, dan audio melalui endpoint web SaveTik. Paket ini dapat dipakai sebagai module CommonJS maupun melalui CLI.

> Proyek ini bukan API resmi TikTok atau SaveTik. Endpoint dan struktur halaman SaveTik dapat berubah sewaktu-waktu.

## Fitur

- Mendeteksi konten `video`, `photo`, atau `audio`.
- Menyediakan kualitas video `no_watermark`, `watermark`, `hd`, dan `standard` jika tersedia.
- Mengunduh video, audio, foto, atau seluruh media sekaligus.
- Memvalidasi link dengan `new URL()` dan hostname resmi TikTok.
- Menentukan ekstensi file dari header HTTP `Content-Type`.
- Menulis unduhan ke file `.part` dan mengganti nama setelah selesai.
- Menghapus file `.part` secara otomatis jika unduhan gagal.
- Mendukung Node.js 18 atau lebih baru.

## Instalasi

Dari npm:

```bash
npm install cakkatrok-tiktok-downloader
```

Untuk pengembangan dari source repository:

```bash
npm install
npm test
```

Jika PowerShell memblokir `npm.ps1`, gunakan:

```powershell
npm.cmd install
npm.cmd test
```

## CLI

Setelah paket terpasang, tampilkan data media dengan:

```bash
npx savetik-dl "https://www.tiktok.com/@username/video/123456789"
```

Saat bekerja langsung dari source repository, perintah yang setara adalah:

```bash
node bin/savetik-cli.js "LINK_TIKTOK"
```

Download seluruh media:

```bash
npx savetik-dl "LINK_TIKTOK" --download --type all --out downloads
```

Download video tanpa watermark:

```bash
npx savetik-dl "LINK_TIKTOK" --download --type video --quality no_watermark --out downloads
```

Download audio atau semua foto:

```bash
npx savetik-dl "LINK_TIKTOK" --download --type mp3 --out downloads
npx savetik-dl "LINK_TIKTOK" --download --type photos --out downloads
```

### Opsi CLI

| Opsi | Keterangan | Default |
| --- | --- | --- |
| `--download` | Mengunduh media ke penyimpanan lokal | Tidak aktif |
| `--type <type>` | Memilih jenis media yang diunduh | `all` |
| `--quality <quality>` | Memilih kualitas video | Kualitas terbaik yang terdeteksi |
| `--out <folder>` | Menentukan folder output | `downloads` |
| `--lang <kode>` | Menentukan bahasa request SaveTik | `en` |
| `-h`, `--help` | Menampilkan bantuan CLI | — |

Nilai `type` yang diterima:

- `all`
- `video` atau `mp4`
- `audio` atau `mp3`
- `photo`, `photos`, atau `image`

Nilai `quality` yang diterima:

- `no_watermark`
- `watermark`
- `hd`
- `standard`

Nilai lain akan ditolak dengan pesan kesalahan. Pilihan kualitas hanya berlaku untuk video dan bergantung pada link yang disediakan SaveTik.

## Penggunaan sebagai Module

### Mendeteksi jenis media

Gunakan `getMedia()` untuk memperoleh hasil yang telah difilter berdasarkan jenis konten.

```js
const { getMedia } = require('cakkatrok-tiktok-downloader');

async function main() {
  const media = await getMedia('LINK_TIKTOK', { lang: 'en' });

  if (media.type === 'video') console.log(media.video);
  if (media.type === 'photo') console.log(media.photos);
  if (media.type === 'audio') console.log(media.audio);
}

main().catch(console.error);
```

Contoh hasil video:

```js
{
  status: true,
  source: 'savetik',
  input: 'https://vt.tiktok.com/example',
  title: 'Judul konten',
  author: '@username',
  thumbnail: 'https://...',
  type: 'video',
  video: 'https://...',
  audio: null,
  photos: [],
  links: ['https://...']
}
```

### Mengambil seluruh data media

`getData()` mengembalikan semua video beserta kualitasnya, audio, foto, dan link yang ditemukan.

```js
const { getData } = require('cakkatrok-tiktok-downloader');

const data = await getData('LINK_TIKTOK');

console.log(data.videos);
console.log(data.audios);
console.log(data.photos);
console.log(data.links);
```

Item video memiliki bentuk berikut:

```js
{
  type: 'video',
  quality: 'no_watermark',
  label: 'Download without watermark',
  url: 'https://...'
}
```

### Mengunduh media

```js
const { downloadTikTok } = require('cakkatrok-tiktok-downloader');

async function main() {
  const result = await downloadTikTok('LINK_TIKTOK', {
    type: 'video',
    quality: 'hd',
    outputDir: './downloads',
    fileName: 'video-saya',
    lang: 'en'
  });

  console.log(result.files);
}

main().catch(console.error);
```

Hasil `files`:

```js
{
  video: 'downloads/video-saya.mp4',
  audio: null,
  photos: []
}
```

Ekstensi akhir dapat berbeda dari nama awal apabila header `Content-Type` menunjukkan format lain.

## API Ringkas

| Fungsi | Keterangan |
| --- | --- |
| `getMedia(url, options)` | Mendeteksi jenis konten dan mengembalikan media utamanya |
| `getData(url, options)` | Mengembalikan seluruh hasil parser SaveTik |
| `downloadTikTok(url, options)` | Mengambil data dan mengunduh media yang dipilih |
| `downloadFile(url, outputPath, options)` | Mengunduh satu file secara aman melalui file `.part` |
| `parseSavetikHtml(html)` | Mengurai HTML hasil SaveTik tanpa request jaringan |
| `validateTikTokUrl(url)` | Memvalidasi URL dan hostname TikTok |
| `validateDownloadType(type)` | Memvalidasi pilihan jenis unduhan |

Hostname TikTok yang diterima adalah `tiktok.com`, `www.tiktok.com`, `m.tiktok.com`, `vm.tiktok.com`, dan `vt.tiktok.com` dengan protokol HTTP atau HTTPS.

## Unit Test

Unit test memakai runner bawaan `node:test` dan tidak melakukan request ke TikTok atau SaveTik.

```bash
npm test
```

Pengujian link TikTok sungguhan dilakukan melalui CLI, bukan melalui `test.js`:

```bash
node bin/savetik-cli.js "LINK_TIKTOK"
```

## Contoh

- `examples/basic.js` — deteksi media dasar.
- `examples/download-all.js` — mengunduh semua media.
- `examples/baileys-example.js` — contoh integrasi dengan bot Baileys.

## Troubleshooting

### Media tidak ditemukan

Pastikan link berasal dari hostname TikTok yang didukung dan kontennya publik. Konten private, dihapus, atau dibatasi wilayah mungkin tidak dapat diproses.

### SaveTik meminta verifikasi

Rate limit, CAPTCHA, Cloudflare, atau perubahan endpoint dapat menyebabkan request gagal. Coba lagi nanti dan periksa apakah struktur SaveTik telah berubah.

### File tidak dapat diunduh

Link CDN TikTok dapat kedaluwarsa. Ambil data baru dengan `getData()` atau jalankan kembali perintah download.

### `type` atau `quality` ditolak

Gunakan salah satu nilai resmi yang tercantum pada bagian opsi CLI. Penulisan tidak membedakan huruf besar dan kecil.

## Endpoint

Paket ini menggunakan:

```text
POST https://savetik.io/api/ajaxSearch
```

## Credit

Dibuat oleh RintisW.P.

- Telegram: <https://t.me/rintisdep>
- Bug dan permintaan fitur: <https://github.com/RintisWP/cakkatrok-tiktok-downloader/issues>

## Disclaimer

Gunakan paket ini secara bertanggung jawab. Pastikan penggunaan dan distribusi media mematuhi aturan TikTok, hak cipta, serta izin pemilik konten.

## License

MIT
