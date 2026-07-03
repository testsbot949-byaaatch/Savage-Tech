const axios = require('axios');

module.exports = {
  name: 'starcoder',
  category: 'ai',
  description: 'Chat with StarCoder - code generation AI',
  async execute(sock, msg, args) {
    const from = msg.key.remoteJid;
    const query = args.join(' ');
    if (!query) return await sock.sendMessage(from, { text: '❓ What code do you want StarCoder to write?' }, { quoted: msg });

    try {
      const url = `https://apis.xwolf.space/api/ai/starcoder?q=${encodeURIComponent(query)}`;
      const res = await axios.get(url);
      const reply = res.data.status ? (res.data.result || 'No response') : `⚠️ ${res.data.error}`;
      await sock.sendMessage(from, { text: `🤖 *StarCoder:*\n${reply.slice(0, 2000)}` }, { quoted: msg });
    } catch {
      await sock.sendMessage(from, { text: '❌ API error' }, { quoted: msg });
    }
  }
};
