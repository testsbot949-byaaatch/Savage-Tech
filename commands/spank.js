const axios = require('axios');
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

module.exports = {
  name: 'spank',
  category: 'anime',
  description: 'Random spank anime',
  async execute(sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random spank anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/spank', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime spank*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('spank error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime spank.' }, { quoted: msg });
    }
  }
};
