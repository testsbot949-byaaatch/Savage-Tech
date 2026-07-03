const axios = require('axios');

module.exports = {
    name: 'ytinfo',
    category: 'download',
    description: 'Get YouTube video information',
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        let url = args[0];

        if (!url && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            if (quoted.conversation) {
                const match = quoted.conversation.match(/(https?:\/\/[^\s]+)/);
                if (match) url = match[0];
            } else if (quoted.extendedTextMessage?.text) {
                const match = quoted.extendedTextMessage.text.match(/(https?:\/\/[^\s]+)/);
                if (match) url = match[0];
            }
        }

        if (!url) {
            return sock.sendMessage(from, {
                text: '❌ Provide a YouTube URL, or reply to a message with one.\nExample: `.ytinfo https://youtu.be/xxx`'
            }, { quoted: msg });
        }

        if (!url.startsWith('http')) {
            return sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: '📊 Fetching YouTube info...' }, { quoted: msg });

            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/download/youtube/info?url=${encodeURIComponent(url)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { timeout: 15000 });
            const data = response.data;

            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch info');
            }

            let infoText = '';
            if (data.result) {
                if (typeof data.result === 'object') {
                    infoText = JSON.stringify(data.result, null, 2);
                } else {
                    infoText = data.result;
                }
            } else if (data.info) {
                infoText = JSON.stringify(data.info, null, 2);
            } else {
                infoText = JSON.stringify(data, null, 2);
            }

            const output = `📋 *YouTube Info*\n\n${infoText.slice(0, 2000)}`;

            await sock.sendMessage(from, { text: output }, { quoted: msg });
        } catch (err) {
            console.error('YouTube info error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    }
};
