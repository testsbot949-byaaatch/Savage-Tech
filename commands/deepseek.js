const axios = require('axios');

module.exports = {
  name: 'deepseek',
  category: 'tools',
  description: 'Chat with DeepSeek AI',
  async execute(sock, msg, args, { isArchitect, isMe }) {
    const from = msg.key.remoteJid;
    const query = args.join(' ');
    if (!query) {
      await sock.sendMessage(from, { text: '❓ What do you want to ask DeepSeek?' }, { quoted: msg });
      return;
    }

    try {
      const url = `https://apis.xwolf.space/api/ai/deepseek?q=${encodeURIComponent(query)}`;
      const response = await axios.get(url);

      if (response.data.status === true) {
        const reply = response.data.result || 'No response.';
        await sock.sendMessage(from, { text: `🤖 *DeepSeek:*\n${reply.slice(0, 2000)}` }, { quoted: msg });
      } else {
        await sock.sendMessage(from, { text: `⚠️ API error: ${response.data.error || 'Unknown'}` }, { quoted: msg });
      }
    } catch (error) {
      console.error('DeepSeek error:', error);
      await sock.sendMessage(from, { text: '❌ Failed to reach DeepSeek API.' }, { quoted: msg });
    }
  }
};
