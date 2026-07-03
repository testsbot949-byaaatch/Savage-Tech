const axios = require('axios');
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

module.exports = {
  name: 'facepalm',
  category: 'anime',
  description: 'Random facepalm anime',
  async execute(sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random facepalm anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/facepalm', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime facepalm*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('facepalm error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime facepalm.' }, { quoted: msg });
    }
  }
};
