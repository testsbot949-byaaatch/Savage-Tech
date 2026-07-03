const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

function extractShortUrl(obj) {
    if (!obj) return null;
    if (typeof obj === 'string') return obj;
    if (obj.shortUrl) return obj.shortUrl;
    if (obj.url) return obj.url;
    if (obj.result) return extractShortUrl(obj.result);
    if (obj.data) return extractShortUrl(obj.data);
    return null;
}

module.exports = {
    name: 'vgd',
    category: 'tools',
    description: 'Shorten URL with v.gd',
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        const longUrl = args[0];
        if (!longUrl || !longUrl.startsWith('http')) {
            return sock.sendMessage(from, { text: '❌ Usage: .vgd <https://example.com/long/url>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/api/short/vgd?url=${encodeURIComponent(longUrl)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });

            let short = null;
            if (response.data.success) {
                short = extractShortUrl(response.data);
            }
            if (!short) {
                short = response.data.error || 'Shortening failed';
            }

            await sock.sendMessage(from, {
                text: `🔗 *Shortened URL (v.gd)*\n\n${short}`
            }, { quoted: msg });
        } catch (err) {
            console.error('v.gd error:', err);
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
        }
    }
};
