// Contoh potongan fitur untuk bot WhatsApp Baileys.
// Tempel bagian case ini ke handler command kamu.

const { getData } = require('../index');

async function handleTikTokCommand(sock, from, args) {
  const url = args[0];

  if (!url) {
    await sock.sendMessage(from, {
      text: 'Masukkan link TikTok.\n\nContoh:\n.tiktok https://vt.tiktok.com/xxxx'
    });
    return;
  }

  try {
    const data = await getData(url);

    if (data.video) {
      await sock.sendMessage(from, {
        video: { url: data.video },
        caption: data.title || 'Berhasil download video TikTok.'
      });
    }

    if (!data.video && data.photos.length > 0) {
      for (let i = 0; i < data.photos.length; i++) {
        await sock.sendMessage(from, {
          image: { url: data.photos[i] },
          caption: i === 0 ? data.title || 'Foto TikTok' : ''
        });
      }
    }

    if (data.audio) {
      await sock.sendMessage(from, {
        audio: { url: data.audio },
        mimetype: 'audio/mpeg'
      });
    }

    if (!data.video && !data.audio && data.photos.length === 0) {
      await sock.sendMessage(from, { text: 'Media tidak ditemukan.' });
    }
  } catch (err) {
    await sock.sendMessage(from, {
      text: `Gagal download TikTok: ${err.message}`
    });
  }
}

module.exports = { handleTikTokCommand };
