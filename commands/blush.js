const axios = require('axios');
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

module.exports = {
  name: 'blush',
  category: 'anime',
  description: 'Random blush anime',
  async execute(sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random blush anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/blush', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime blush*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('blush error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime blush.' }, { quoted: msg });
    }
  }
};
