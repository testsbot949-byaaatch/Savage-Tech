const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

module.exports = {
    name: 'thumbsup',
    category: 'anime',
    description: 'Random anime thumbsup image',
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;

        try {
            await sock.sendMessage(from, { text: '🎴 Fetching random anime thumbsup...' }, { quoted: msg });
            const response = await axios.get('https://nekos.best/api/v2/thumbsup', { httpsAgent: agent, timeout: 10000 });
            const imgUrl = response.data.results[0].url;
            await sock.sendMessage(from, {
                image: { url: imgUrl },
                caption: '✅ Anime thumbsup'
            }, { quoted: msg });
        } catch (err) {
            console.error('Thumbsup error:', err);
            await sock.sendMessage(from, { text: '❌ Failed to fetch anime thumbsup.' }, { quoted: msg });
        }
    }
};
