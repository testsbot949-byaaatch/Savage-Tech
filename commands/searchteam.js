const axios = require('axios');
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

async function downloadFile(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { agent }, (res) => {
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
  name: 'searchteam',
  category: 'sports',
  description: 'Search team by name (sends badge)',
  async execute(sock, msg, args) {
    const from = msg.key.remoteJid;
    const query = args.join(' ');
    if (!query) {
      return await sock.sendMessage(from, { text: '❓ Usage: .searchteam <team name>' }, { quoted: msg });
    }

    try {
      await sock.sendMessage(from, { text: `🔍 Searching for team "${query}"...` }, { quoted: msg });
      const res = await axios.get(`https://apis.xwolf.space/api/sports/search/team?q=${encodeURIComponent(query)}`, { httpsAgent: agent });
      if (!res.data.success || !res.data.result) throw new Error('No results');
      const t = res.data.result;
      let caption = `🏆 *Team: ${t.name}*\n\n`;
      caption += `🏷️ ID: ${t.id}\n⚽ Sport: ${t.sport}\n🏅 League: ${t.league}\n🌍 Country: ${t.country}\n🏟️ Stadium: ${t.stadium || 'N/A'}\n📝 ${(t.description || '').slice(0, 200)}`;
      let imgUrl = t.badge || t.thumbnail;
      if (imgUrl && imgUrl.startsWith('http')) {
        const imgBuffer = await downloadFile(imgUrl);
        await sock.sendMessage(from, { image: imgBuffer, caption: caption }, { quoted: msg });
      } else {
        await sock.sendMessage(from, { text: caption }, { quoted: msg });
      }
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ Team not found: ${err.message}` }, { quoted: msg });
    }
  }
};
