const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

module.exports = {
    name: 'cohere',
    category: 'ai',
    description: 'Chat with Cohere AI',
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .cohere <message>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_273f9867e9';
            const url = `https://apis.xwolf.space/api/ai/cohere?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(url, { httpsAgent: agent, timeout: 30000 });
            const data = response.data;

            let reply = 'No response';
            if (data.status && data.result) {
                reply = data.result;
            } else if (data.error) {
                reply = `⚠️ ${data.error}`;
            }

            await sock.sendMessage(from, { text: `🤖 *Cohere:*\n${reply.slice(0, 2000)}` }, { quoted: msg });
        } catch (err) {
            console.error('Cohere error:', err);
            await sock.sendMessage(from, { text: '❌ API error. Please try again later.' }, { quoted: msg });
        }
    }
};
