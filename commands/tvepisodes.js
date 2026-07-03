const axios = require('axios');

module.exports = {
    name: 'tvepisodes',
    category: 'media',
    description: 'Get episode list for a TV show by TVMaze ID (use .tvsearch to find ID)',
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        const id = args[0];
        if (!id) {
            return sock.sendMessage(from, { text: '❌ Usage: .tvepisodes <TVMaze numeric ID> [season number]' }, { quoted: msg });
        }
        if (isNaN(id)) {
            return sock.sendMessage(from, { text: '❌ ID must be a number. Use .tvsearch to find the correct numeric ID.' }, { quoted: msg });
        }

        const season = args[1] ? `?season=${args[1]}` : '';

        try {
            const response = await axios.get(`https://api.tvmaze.com/shows/${id}/episodes${season}`, { timeout: 15000 });
            let episodes = response.data;
            if (!episodes.length) {
                return sock.sendMessage(from, { text: '❌ No episodes found for this season or show.' }, { quoted: msg });
            }

            episodes = episodes.slice(0, 20);
            let text = `📅 *Episodes*\n\n`;
            for (const ep of episodes) {
                const airdate = ep.airdate || 'TBA';
                text += `🎬 S${ep.season}E${ep.number}: ${ep.name}\n   📅 ${airdate}\n`;
            }
            if (response.data.length > 20) {
                text += `\n⚠️ Showing first 20 of ${response.data.length}.`;
            }

            await sock.sendMessage(from, { text }, { quoted: msg });
        } catch (err) {
            console.error('TV episodes error:', err);
            await sock.sendMessage(from, { text: '❌ Network error or invalid ID.' }, { quoted: msg });
        }
    }
};
