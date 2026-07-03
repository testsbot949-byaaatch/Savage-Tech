const axios = require('axios');
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

module.exports = {
  name: 'punch',
  category: 'anime',
  description: 'Random punch anime',
  async execute(sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random punch anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/punch', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime punch*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('punch error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime punch.' }, { quoted: msg });
    }
  }
};
