const axios = require('axios');

module.exports = {
  name: 'humanizer',
  category: 'tools',
  description: 'Convert AI-generated text to human-like',
  async execute(sock, msg, args) {
    const from = msg.key.remoteJid;
    const text = args.join(' ');
    if (!text) return await sock.sendMessage(from, { text: '❓ Provide AI text to humanize.' }, { quoted: msg });

    try {
      const response = await axios.post('https://apis.xwolf.space/api/ai/humanizer', { text });
      if (response.data.status === true) {
        const humanText = response.data.result || response.data.humanized || 'No humanized text returned.';
        await sock.sendMessage(from, { text: `👤 *Humanized:*\n${humanText.slice(0, 2000)}` }, { quoted: msg });
      } else {
        await sock.sendMessage(from, { text: `⚠️ ${response.data.error || 'Humanizer failed.'}` }, { quoted: msg });
      }
    } catch (error) {
      await sock.sendMessage(from, { text: '❌ Humanizer API error.' }, { quoted: msg });
    }
  }
};
