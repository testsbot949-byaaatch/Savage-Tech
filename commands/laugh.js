const axios = require('axios');
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

module.exports = {
  name: 'laugh',
  category: 'anime',
  description: 'Random laugh anime',
  async execute(sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random laugh anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/laugh', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime laugh*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('laugh error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime laugh.' }, { quoted: msg });
    }
  }
};
