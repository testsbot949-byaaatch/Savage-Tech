const axios = require('axios');

module.exports = {
  name: 'neural',
  category: 'ai',
  description: 'Chat with Intel\'s NeuralChat',
  async execute(sock, msg, args) {
    const from = msg.key.remoteJid;
    const query = args.join(' ');
    if (!query) return await sock.sendMessage(from, { text: '❓ Ask NeuralChat?' }, { quoted: msg });

    try {
      const url = `https://apis.xwolf.space/api/ai/neural?q=${encodeURIComponent(query)}`;
      const res = await axios.get(url);
      const reply = res.data.status ? (res.data.result || 'No response') : `⚠️ ${res.data.error}`;
      await sock.sendMessage(from, { text: `🤖 *NeuralChat:*\n${reply.slice(0, 2000)}` }, { quoted: msg });
    } catch {
      await sock.sendMessage(from, { text: '❌ API error' }, { quoted: msg });
    }
  }
};
