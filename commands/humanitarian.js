const axios = require('axios');

module.exports = {
    name: 'humanizer',
    category: 'tools',
    description: 'Convert AI-generated text to human-like',
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        const text = args.join(' ');
        if (!text) {
            return sock.sendMessage(from, { text: '❌ Usage: .humanizer <text>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_1be53c1604';
            const response = await axios.post(
                `https://apis.xwolf.space/api/ai/humanizer?key=${apiKey}`,
                { text },
                { timeout: 30000 }
            );

            if (response.data.status === true) {
                const humanText = response.data.result || response.data.humanized || 'No humanized text returned.';
                await sock.sendMessage(from, { text: `👤 *Humanized:*\n${humanText.slice(0, 2000)}` }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: `⚠️ ${response.data.error || 'Humanizer failed.'}` }, { quoted: msg });
            }
        } catch (error) {
            console.error('Humanizer error:', error);
            await sock.sendMessage(from, { text: '❌ Humanizer API error.' }, { quoted: msg });
        }
    }
};
