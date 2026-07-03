const axios = require('axios');

module.exports = {
    name: 'pokemontypes',
    category: 'fun',
    description: 'List all 18 Pokemon types',
    async execute(sock, msg) {
        const from = msg.key.remoteJid;
        try {
            const apiKey = 'wxa_f_1be53c1604';
            const url = `https://apis.xwolf.space/api/pokemon/types?key=${apiKey}`;
            const response = await axios.get(url, { timeout: 15000 });
            const data = response.data;

            if (!data.success) {
                return sock.sendMessage(from, { text: '❌ Could not fetch Pokemon types.' }, { quoted: msg });
            }

            const types = data.types || [];
            let text = '🔖 *Pokemon Types*\n\n';
            for (const t of types) {
                text += `🔹 ${t}\n`;
            }

            await sock.sendMessage(from, { text }, { quoted: msg });
        } catch (err) {
            console.error('Pokemon types error:', err);
            await sock.sendMessage(from, { text: '❌ API error.' }, { quoted: msg });
        }
    }
};
