const axios = require('axios');
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

function formatResult(data) {
  if (!data.success) return "❌ Error: " + (data.error || 'Unknown');
  if (!data.result) return "No data found.";
  if (Array.isArray(data.result) && data.result.length) {
    let str = `Found ${data.result.length} items:\n`;
    data.result.slice(0, 10).forEach((item, i) => {
      str += `${i+1}. ${item.name || item.title || item.event || 'Item'}\n`;
    });
    return str;
  }
  if (typeof data.result === 'object') return JSON.stringify(data.result, null, 2).slice(0, 1500);
  return data.result;
}

module.exports = {
  name: 'leaguescountry',
  category: 'sports',
  description: 'Get sports data (leaguescountry)',
  async execute(sock, msg, args) {
    const from = msg.key.remoteJid;
    const query = args.join(' ');
    if (!query) return sock.sendMessage(from, { text: '❓ Usage: .leaguescountry <query>' }, { quoted: msg });

    try {
      await sock.sendMessage(from, { text: `🏆 Fetching leaguescountry...` }, { quoted: msg });
      const apiUrl = `https://apis.xwolf.space/api/sports/leagues/country?q=${encodeURIComponent(query)}`;
      const res = await axios.get(apiUrl, { httpsAgent: agent });
      const result = formatResult(res.data);
      const output = `🏅 *Sports: leaguescountry*\n🔍 Query: ${query}\n\n${result}`;
      await sock.sendMessage(from, { text: output.slice(0, 2000) }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
    }
  }
};
