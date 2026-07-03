const axios = require('axios');
const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

module.exports = {
  name: 'latency',
  category: 'ethical hacking',
  description: 'Measure HTTP latency (same as .ping)',
  async execute(sock, msg, args) {
    const from = msg.key.remoteJid;
    let target = args[0];
    if (!target) return sock.sendMessage(from, { text: '❓ Usage: .latency <domain>' }, { quoted: msg });
    if (!target.startsWith('http')) target = 'https://' + target;

    try {
      await sock.sendMessage(from, { text: `⏱️ Measuring latency to ${target}...` }, { quoted: msg });
      const start = Date.now();
      await axios.get(target, { httpsAgent: agent, timeout: 10000 });
      const latency = Date.now() - start;
      await sock.sendMessage(from, { text: `🛡️ *Latency Result*\n🎯 Target: ${target}\n\n✅ Latency: ${latency} ms` }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ Latency check failed: ${err.message}` }, { quoted: msg });
    }
  }
};
