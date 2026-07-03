const axios = require('axios');

module.exports = {
    name: 'shazam',
    category: 'tools',
    description: 'Search for songs on Shazam',
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .shazam <song name or artist>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_28d599362e';
            const url = `https://apis.xwolf.space/api/shazam/search?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(url, { timeout: 15000 });
            const data = response.data;

            if (!data.success || !data.results || data.results.length === 0) {
                return sock.sendMessage(from, { text: `❌ No results found for "${query}".` }, { quoted: msg });
            }

            const results = data.results.slice(0, 10);
            let text = `🎵 *Shazam Results for "${query}"*\n\n`;
            for (const r of results) {
                text += `🔹 *${r.title}* – ${r.artist}\n`;
                if (r.album) text += `   📀 ${r.album}\n`;
                if (r.year) text += `   📅 ${r.year}\n`;
                text += `\n`;
            }

            await sock.sendMessage(from, { text }, { quoted: msg });
        } catch (err) {
            console.error('Shazam error:', err);
            await sock.sendMessage(from, { text: '❌ API error.' }, { quoted: msg });
        }
    }
};
