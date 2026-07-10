const { getMedia } = require('../index');

async function main() {
  const url = process.argv[2] || 'ISI_LINK_TIKTOK_DI_SINI';

  if (url === 'ISI_LINK_TIKTOK_DI_SINI') {
    console.log('Isi link TikTok dulu: node examples/basic.js "LINK_TIKTOK"');
    return;
  }

  const data = await getMedia(url);

  console.log('Judul:', data.title);
  console.log('Author:', data.author);
  console.log('Tipe:', data.type);
  console.log('Video:', data.video);
  console.log('Foto:', data.photos);
}

main().catch((err) => console.error('Gagal:', err.message));
