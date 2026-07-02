const axios = require('axios');
const ytSearch = require('yt-search');

const getBuffer = async (url) => {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(response.data);
};

module.exports = {
  name: 'mp3',
  pattern: /^\.mp3\s+(.+)/,
  run: async (sock, message, args) => {
    const input = args.join(' ');
    let quality = '128';
    let query = input;

    const tokens = input.trim().split(/\s+/);
    const last = tokens[tokens.length - 1];
    if (last === '128' || last === '320') {
      quality = last;
      query = tokens.slice(0, -1).join(' ');
    }
    if (!query) query = input;

    const processingMsg = await sock.sendMessage(message.key.remoteJid, {
      text: `🔍 ${query.match(/^https?:\/\//) ? 'Processing URL' : 'Searching for'} *${query}*...`
    });

    try {
      let videoUrl;

      if (/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)/i.test(query)) {
        videoUrl = query;
      } else {
        const results = await ytSearch(query);
        if (!results || results.videos.length === 0) {
          throw new Error('No results found.');
        }
        videoUrl = results.videos[0].url;
      }

      const apiUrl = `https://api.gifted.co.ke/api?url=${encodeURIComponent(videoUrl)}&quality=${quality}&apiKey=gifted`;
      const response = await axios.get(apiUrl);
      const data = response.data;

      if (!data.success || !data.result || !data.result.download_url) {
        throw new Error('API error – no download URL');
      }

      const { title, thumbnail, download_url } = data.result;
      const audioBuffer = await getBuffer(download_url);

      await sock.sendMessage(message.key.remoteJid, {
        audio: audioBuffer,
        mimetype: 'audio/mpeg',
        caption: `🎵 *${title}*\nQuality: ${quality} kbps`
      });

      await sock.sendMessage(message.key.remoteJid, { delete: processingMsg.key })
        .catch(() => {});

    } catch (error) {
      console.error('MP3 command error:', error);
      await sock.sendMessage(message.key.remoteJid, {
        text: `❌ ${error.message || 'Something went wrong'}`
      });
    }
  }
};
