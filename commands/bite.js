const axios = require('axios');
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

module.exports = {
  name: 'bite',
  category: 'anime',
  description: 'Random bite anime',
  async execute(sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random bite anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/bite', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime bite*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('bite error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime bite.' }, { quoted: msg });
    }
  }
};
