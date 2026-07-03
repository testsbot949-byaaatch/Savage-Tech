const axios = require('axios');
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

module.exports = {
  name: 'security-headers',
  category: 'ethical hacking',
  description: 'Check security headers with Mozilla Observatory',
  async execute(sock, msg, args) {
    const from = msg.key.remoteJid;
    let host = args[0];
    if (!host) {
      return await sock.sendMessage(from, { text: '❓ Usage: .security-headers <domain>' }, { quoted: msg });
    }
    host = host.replace(/^https?:\/\//, '');

    try {
      await sock.sendMessage(from, { text: `🔍 Scanning security headers for ${host}...` }, { quoted: msg });
      const res = await axios.get(`https://http-observatory.security.mozilla.org/api/v1/analyze?host=${encodeURIComponent(host)}`, { httpsAgent: agent });
      const data = res.data;
      let text = `🛡️ Observatory Score: ${data.score || 'N/A'}\n`;
      text += `Grade: ${data.grade || 'N/A'}\n`;
      if (data.tests) {
        text += `Passed tests: ${Object.values(data.tests).filter(t => t.pass).length}/${Object.keys(data.tests).length}\n`;
      }
      await sock.sendMessage(from, { text }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ Scan failed: ${err.message}` }, { quoted: msg });
    }
  }
};
