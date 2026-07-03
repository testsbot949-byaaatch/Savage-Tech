const axios = require('axios');

module.exports = {
    name: 'dolphin',
    category: 'ai',
    description: 'Chat with Dolphin - uncensored AI',
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .dolphin <message>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_273f9867e9';
            const url = `https://apis.xwolf.space/api/ai/dolphin?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(url, { timeout: 30000 });

            let reply = 'No response';
            if (response.data.status && response.data.result) {
                reply = response.data.result;
            } else if (response.data.error) {
                reply = `⚠️ ${response.data.error}`;
            }

            await sock.sendMessage(from, { text: `🤖 *Dolphin:*\n${reply.slice(0, 2000)}` }, { quoted: msg });
        } catch (err) {
            console.error('Dolphin error:', err);
            await sock.sendMessage(from, { text: '❌ API error. Please try again later.' }, { quoted: msg });
        }
    }
};
