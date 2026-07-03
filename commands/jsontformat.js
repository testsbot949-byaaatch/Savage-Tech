const axios = require('axios');
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

module.exports = {
  name: 'jsontformat',
  category: 'tools',
  description: 'Format/validate JSON',
  async execute(sock, msg, args) {
    const from = msg.key.remoteJid;
    const json = args.join(' ');
    if (!json) return sock.sendMessage(from, { text: '❓ Usage: .jsontformat <json_string>' }, { quoted: msg });

    try {
      const res = await axios.post('https://apis.xwolf.space/api/tools/jsontformat', { json }, { httpsAgent: agent });
      const result = res.data.result || res.data.formatted || 'No result';
      await sock.sendMessage(from, {
        text: `📝 *JSON Formatted*\n\n${result.slice(0, 1900)}`
      }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
    }
  }
};
