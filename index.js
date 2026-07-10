const {
  getData,
  getMedia,
  getDetectedMedia,
  downloadTikTok,
  downloadFile,
  parseSavetikHtml,
  normalizeUrl,
  validateTikTokUrl,
  validateDownloadType
} = require('./src/savetik');

module.exports = {
  getData,
  getMedia,
  getDetectedMedia,
  downloadTikTok,
  downloadFile,
  parseSavetikHtml,
  normalizeUrl,
  validateTikTokUrl,
  validateDownloadType,

  // aliases, biar cocok dengan gaya module downloader lain
  tiktokDownloader: getData,
  tiktokdl: getData,
  tiktokMedia: getMedia,
  download: downloadTikTok
};
