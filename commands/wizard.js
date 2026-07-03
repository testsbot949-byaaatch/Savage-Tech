const axios = require('axios');

module.exports = {
    name: 'wizard',
    category: 'ai',
    description: 'Chat with WizardLM AI',
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .wizard <message>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_9ddecf073b';
            const url = `https://apis.xwolf.space/api/ai/wizard?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(url, { timeout: 30000 });
            const data = response.data;

            let reply = 'No response';
            if (data.status && data.result) {
                reply = data.result;
            } else if (data.error) {
                reply = `⚠️ ${data.error}`;
            }

            await sock.sendMessage(from, { text: `🤖 *WizardLM:*\n${reply.slice(0, 2000)}` }, { quoted: msg });
        } catch (err) {
            console.error('WizardLM error:', err);
            await sock.sendMessage(from, { text: '❌ API error. Please try again later.' }, { quoted: msg });
        }
    }
};
