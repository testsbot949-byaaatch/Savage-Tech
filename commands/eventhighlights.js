const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

function formatResult(data) {
    if (!data.success) return "❌ Error: " + (data.error || 'Unknown');
    if (!data.result) return "No data found.";
    if (Array.isArray(data.result) && data.result.length) {
        let str = `Found ${data.result.length} items:\n`;
        data.result.slice(0, 10).forEach((item, i) => {
            str += `${i + 1}. ${item.name || item.title || item.event || 'Item'}\n`;
        });
        return str;
    }
    if (typeof data.result === 'object') return JSON.stringify(data.result, null, 2).slice(0, 1500);
    return data.result;
}

module.exports = {
    name: 'eventhighlights',
    category: 'sports',
    description: 'Get sports event highlights',
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .eventhighlights <query>' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: `🏆 Fetching event highlights...` }, { quoted: msg });

            const apiKey = 'wxa_f_273f9867e9';
            const apiUrl = `https://apis.xwolf.space/api/sports/event/highlights?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });

            const result = formatResult(response.data);
            const output = `🏅 *Event Highlights*\n🔍 Query: ${query}\n\n${result}`;

            await sock.sendMessage(from, { text: output.slice(0, 2000) }, { quoted: msg });
        } catch (err) {
            console.error('Event highlights error:', err);
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
        }
    }
};
