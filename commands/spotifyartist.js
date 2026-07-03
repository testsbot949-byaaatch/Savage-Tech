const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

module.exports = {
    name: 'spotifyartist',
    category: 'Audio',
    description: 'Get Spotify metadata (track, album, artist, playlist)',
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .spotifyartist <spotify_url_or_search_term>' }, { quoted: msg });
        }

        const cmd = 'artist';
        const endpoint = 'artist';

        try {
            const apiKey = 'wxa_f_28d599362e';
            let apiUrl;
            if (query.match(/spotify\.com/)) {
                apiUrl = `https://apis.xwolf.space/api/spotify/${endpoint}?url=${encodeURIComponent(query)}&key=${apiKey}`;
            } else {
                apiUrl = `https://apis.xwolf.space/api/spotify/${endpoint}?q=${encodeURIComponent(query)}&key=${apiKey}`;
            }
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });
            let resultText = `🎵 *Spotify ${cmd.toUpperCase()}*\n\n`;
            if (response.data.success) {
                const data = response.data.result || response.data;
                resultText += JSON.stringify(data, null, 2);
            } else {
                resultText += `❌ Error: ${response.data.error || 'Not found'}`;
            }
            await sock.sendMessage(from, { text: resultText.slice(0, 2000) }, { quoted: msg });
        } catch (err) {
            console.error('Spotify artist error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    }
};
