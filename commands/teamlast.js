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
    name: 'teamlast',
    category: 'sports',
    description: 'Get last matches for a team',
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .teamlast <team name or ID>' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: `🏆 Fetching last matches for "${query}"...` }, { quoted: msg });

            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/api/sports/team/last?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });
            const data = response.data;

            const result = formatResult(data);
            const output = `🏅 *Last Matches*\n🔍 Query: ${query}\n\n${result}`;

            await sock.sendMessage(from, { text: output.slice(0, 2000) }, { quoted: msg });

        } catch (err) {
            console.error('Team last error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    }
};
