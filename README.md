# Cakkatrok TikTok Downloader

Downloader TikTok berbasis Node.js yang memakai endpoint web SaveTik untuk mengambil link media dan mengunduh file ke lokal.

Module ini bisa mendeteksi isi link TikTok:

- Jika berisi video, hasilnya mengembalikan link video.
- Jika berisi foto/slideshow, hasilnya mengembalikan semua link foto.
- Bisa mengambil audio/MP3 melalui `getData()`.
- Bisa download video, audio, dan foto ke folder lokal.
- Cocok dipakai untuk bot WhatsApp, Telegram, atau script pribadi.

> Catatan: ini bukan API resmi TikTok dan bukan API resmi SaveTik. Endpoint web SaveTik bisa berubah sewaktu-waktu.

## Credit

Created by RintisW.P

- Telegram: https://t.me/rintisdep
- Report masalah, bug, atau request perbaikan: https://t.me/rintisdep

## Install

```bash
npm install
```

Minimal Node.js:

```txt
Node.js >= 18
```

## Cara Cepat

Gunakan CLI untuk memeriksa link atau mengunduh media. `npm test` khusus menjalankan unit test dan tidak membutuhkan link TikTok.

```bash
npx savetik-dl "LINK_TIKTOK"
npx savetik-dl "LINK_TIKTOK" --download --type all --out downloads
```

## Output Deteksi Media

Jika link TikTok berisi video:

```json
{
  "title": "...",
  "author": "...",
  "type": "video",
  "video": "https://...",
  "photos": [],
  "links": ["https://..."]
}
```

Jika link TikTok berisi foto/slideshow:

```json
{
  "title": "...",
  "author": "...",
  "type": "photo",
  "video": null,
  "photos": [
    "https://foto-1...",
    "https://foto-2..."
  ],
  "links": [
    "https://foto-1...",
    "https://foto-2..."
  ]
}
```

## CLI

Ambil data media:

```bash
node bin/savetik-cli.js "LINK_TIKTOK"
```

Download semua media:

```bash
node bin/savetik-cli.js "LINK_TIKTOK" --download --type all --out downloads
```

Download video saja:

```bash
node bin/savetik-cli.js "LINK_TIKTOK" --download --type video --out downloads
```

Pilih kualitas video:

```bash
node bin/savetik-cli.js "LINK_TIKTOK" --download --type video --quality no_watermark
node bin/savetik-cli.js "LINK_TIKTOK" --download --type video --quality hd
```

Download MP3 saja:

```bash
node bin/savetik-cli.js "LINK_TIKTOK" --download --type mp3 --out downloads
```

Download foto saja:

```bash
node bin/savetik-cli.js "LINK_TIKTOK" --download --type photos --out downloads
```

## Pemakaian Sebagai Module

Gunakan `getMedia()` jika hanya butuh deteksi video/foto dan link media yang sesuai.

```js
const { getMedia } = require('cakkatrok-tiktok-downloader');

async function main() {
  const data = await getMedia('LINK_TIKTOK');

  if (data.type === 'video') {
    console.log('Video:', data.video);
    return;
  }

  if (data.type === 'photo') {
    console.log('Foto:', data.photos);
    return;
  }

  console.log('Media tidak ditemukan.');
}

main().catch(console.error);
```

Gunakan `downloadTikTok()` untuk download file ke folder lokal.

```js
const { downloadTikTok } = require('cakkatrok-tiktok-downloader');

async function main() {
  const result = await downloadTikTok('LINK_TIKTOK', {
    type: 'all',
    outputDir: './downloads'
  });

  console.log(result.files);
}

main().catch(console.error);
```

## API

### getMedia(url, options)

Mengembalikan hasil yang sudah difilter sesuai jenis konten TikTok.

```js
const { getMedia } = require('cakkatrok-tiktok-downloader');

const data = await getMedia('LINK_TIKTOK', {
  lang: 'en'
});
```

Field penting:

```js
{
  status: true,
  source: 'savetik',
  input: 'https://vt.tiktok.com/xxxx',
  title: '...',
  author: '...',
  thumbnail: 'https://...',
  type: 'video', // video | photo | unknown
  video: 'https://...',
  photos: [],
  links: []
}
```

### getData(url, options)

Mengembalikan data lengkap dari parser, termasuk video, audio, foto, dan semua link yang ditemukan.

```js
const { getData } = require('cakkatrok-tiktok-downloader');

const data = await getData('LINK_TIKTOK');

console.log(data.video);
console.log(data.audio);
console.log(data.photos);
console.log(data.links);
```

### downloadTikTok(url, options)

Download media ke folder lokal.

```js
const { downloadTikTok } = require('cakkatrok-tiktok-downloader');

const result = await downloadTikTok('LINK_TIKTOK', {
  type: 'all',
  outputDir: './downloads',
  lang: 'en'
});
```

Pilihan `type`:

- `all`
- `video`
- `mp4`
- `audio`
- `mp3`
- `photo`
- `photos`
- `image`

Nilai selain daftar tersebut akan ditolak. Pilihan `quality` untuk video:

- `no_watermark`
- `watermark`
- `hd`
- `standard`

Link masukan divalidasi memakai `new URL()` dan hanya menerima hostname resmi TikTok: `tiktok.com`, `www.tiktok.com`, `m.tiktok.com`, `vm.tiktok.com`, dan `vt.tiktok.com`.

Ekstensi hasil unduhan ditentukan dari header HTTP `Content-Type`, bukan hanya dari URL. File ditulis dahulu sebagai `.part`, kemudian diubah ke nama akhir setelah selesai; file sementara otomatis dihapus jika unduhan gagal.

## Unit Test

```bash
npm test
```

## Contoh Bot Baileys

Lihat file:

```txt
examples/baileys-example.js
```

## Endpoint Yang Dipakai

```txt
POST https://savetik.io/api/ajaxSearch
```

Body:

```txt
q=LINK_TIKTOK
cursor=0
page=0
lang=en
```

## Troubleshooting

Jika media tidak muncul atau link download kosong, kemungkinan penyebabnya:

1. Link TikTok private, invalid, atau region-blocked.
2. SaveTik sedang rate-limit atau meminta verifikasi anti-bot.
3. Struktur HTML SaveTik berubah.
4. Link CDN TikTok sudah expired.
5. Konten TikTok sudah dihapus atau tidak publik.

Untuk report masalah, kirim detail error dan link contoh ke:

```txt
https://t.me/rintisdep
```

## Disclaimer

Gunakan module ini dengan bijak. Pastikan penggunaan media mengikuti aturan TikTok, hak cipta, dan izin pemilik konten.
