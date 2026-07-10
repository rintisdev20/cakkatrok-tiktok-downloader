const { downloadTikTok } = require('../index');

async function main() {
  const url = process.argv[2] || 'ISI_LINK_TIKTOK_DI_SINI';

  if (url === 'ISI_LINK_TIKTOK_DI_SINI') {
    console.log('Isi link TikTok dulu: node examples/download-all.js "LINK_TIKTOK"');
    return;
  }

  const result = await downloadTikTok(url, {
    type: 'all',
    outputDir: './downloads'
  });

  console.log('Selesai download:');
  console.log(result.files);
}

main().catch((err) => console.error('Gagal:', err.message));
