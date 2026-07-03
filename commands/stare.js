const axios = require('axios');
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

module.exports = {
  name: 'stare',
  category: 'anime',
  description: 'Random stare anime',
  async execute(sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random stare anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/stare', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime stare*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('stare error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime stare.' }, { quoted: msg });
    }
  }
};
