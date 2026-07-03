const axios = require('axios');
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

module.exports = {
  name: 'smug',
  category: 'anime',
  description: 'Random smug anime',
  async execute(sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random smug anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/smug', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime smug*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('smug error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime smug.' }, { quoted: msg });
    }
  }
};
