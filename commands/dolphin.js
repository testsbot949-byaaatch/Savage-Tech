const axios = require('axios');

module.exports = {
  name: 'dolphin',
  category: 'ai',
  description: 'Chat with Dolphin - uncensored AI',
  async execute(sock, msg, args) {
    const from = msg.key.remoteJid;
    const query = args.join(' ');
    if (!query) return await sock.sendMessage(from, { text: '❓ What do you want to ask Dolphin?' }, { quoted: msg });

    try {
      const url = `https://apis.xwolf.space/api/ai/dolphin?q=${encodeURIComponent(query)}`;
      const res = await axios.get(url);
      const reply = res.data.status ? (res.data.result || 'No response') : `⚠️ ${res.data.error}`;
      await sock.sendMessage(from, { text: `🤖 *Dolphin:*\n${reply.slice(0, 2000)}` }, { quoted: msg });
    } catch {
      await sock.sendMessage(from, { text: '❌ API error' }, { quoted: msg });
    }
  }
};
