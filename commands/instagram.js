const axios = require('axios');

module.exports = {
    name: 'instagram',
    category: 'download',
    description: 'Download Instagram video/reel (ravenn.site)',
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        const url = args[0];
        if (!url) return sock.sendMessage(from, { text: '❌ Provide an Instagram URL.' }, { quoted: msg });

        try {
            await sock.sendMessage(from, { text: '⏳ Downloading from Instagram...' }, { quoted: msg });

            const apiUrl = `https://ravenn.site/download/instadl?url=${encodeURIComponent(url)}`;
            const response = await axios.get(apiUrl, { timeout: 15000 });
            const data = response.data;

            if (data.status && data.result) {
                const mediaUrl = data.result;

                const isVideo = mediaUrl.match(/\.mp4$/i) || mediaUrl.includes('video');
                if (isVideo) {
                    await sock.sendMessage(from, {
                        video: { url: mediaUrl },
                        caption: '✅ Instagram video downloaded successfully.'
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, {
                        image: { url: mediaUrl },
                        caption: '✅ Instagram image downloaded successfully.'
                    }, { quoted: msg });
                }
            } else {
                throw new Error('API returned: ' + JSON.stringify(data));
            }
        } catch (error) {
            console.error('Instagram error:', error);
            await sock.sendMessage(from, {
                text: `❌ Failed to download: ${error.message || 'Unknown error'}`
            }, { quoted: msg });
        }
    }
};
