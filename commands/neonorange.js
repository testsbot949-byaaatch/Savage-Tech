const axios = require('axios');
const https = require('https');
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { agent: httpsAgent }, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        downloadFile(res.headers.location).then(resolve).catch(reject);
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

module.exports = {
  name: 'neonorange',
  category: 'Ephoto',
  description: 'Generate neon-orange text effect',
  async execute(sock, msg, args) {
    const from = msg.key.remoteJid;
    const text = args.join(' ');
    if (!text) return sock.sendMessage(from, { text: '❓ Usage: .neonorange <text>' }, { quoted: msg });

    try {
      const apiUrl = `https://apis.xwolf.space/api/textpro/neon-orange?text=${encodeURIComponent(text)}`;
      const response = await axios.get(apiUrl, { httpsAgent });
      if (!response.data.success) throw new Error(response.data.error || 'API failure');
      if (!response.data.imageUrl) throw new Error('No imageUrl in response');
      const imgBuffer = await downloadFile(response.data.imageUrl);
      const caption = '🎨 *Text Effect: neonorange*';
      await sock.sendMessage(from, { image: imgBuffer, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('neonorange error:', err);
      await sock.sendMessage(from, { text: `❌ Failed to generate image.\n${err.message}` }, { quoted: msg });
    }
  }
};
