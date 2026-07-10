#!/usr/bin/env node
const path = require('path');
const { getData, downloadTikTok } = require('../index');

function getArg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

async function main() {
  const url = process.argv[2];

  if (!url || url === '--help' || url === '-h') {
    console.log('SaveTik TikTok Downloader CLI');
    console.log('');
    console.log('Cara pakai:');
    console.log('  npx savetik-dl "LINK_TIKTOK"');
    console.log('  node bin/savetik-cli.js "LINK_TIKTOK" --download --type all --out downloads');
    console.log('');
    console.log('Opsi:');
    console.log('  --download          Download file ke folder lokal');
    console.log('  --type all          all | video | mp4 | audio | mp3 | photo | photos | image');
    console.log('  --quality QUALITY   no_watermark | watermark | hd | standard (khusus video)');
    console.log('  --out downloads     Folder output');
    console.log('  --lang en           Bahasa endpoint SaveTik');
    return;
  }

  const shouldDownload = process.argv.includes('--download');
  const type = getArg('--type', 'all');
  const outputDir = getArg('--out', path.join(process.cwd(), 'downloads'));
  const lang = getArg('--lang', 'en');
  const quality = getArg('--quality');

  if (shouldDownload) {
    const result = await downloadTikTok(url, { type, quality, outputDir, lang });
    console.log(JSON.stringify({
      status: result.status,
      title: result.title,
      author: result.author,
      type: result.type,
      files: result.files
    }, null, 2));
    return;
  }

  const result = await getData(url, { lang });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error('Gagal:', err.message);
  process.exit(1);
});
