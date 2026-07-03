const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

module.exports = {
    name: 'testdl',
    category: 'debug',
    description: 'Test download API response',
    async execute(sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo) {
            return await sock.sendMessage(from, { text: "❌ Restricted to owner and sudo users." }, { quoted: msg });
        }

        let url = args[0];
        if (!url) {
            return sock.sendMessage(from, { text: '❌ Usage: .testdl <URL>' }, { quoted: msg });
        }

        try {
            let platform = 'instagram';
            if (url.includes('facebook.com')) platform = 'facebook';
            else if (url.includes('tiktok.com')) platform = 'tiktok';
            else if (url.includes('twitter.com') || url.includes('x.com')) platform = 'twitter';
            else if (url.includes('youtube.com') || url.includes('youtu.be')) platform = 'youtube';
            else if (url.includes('snapchat.com')) platform = 'snapchat';

            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/api/download/${platform}?url=${encodeURIComponent(url)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });

            let text = `Platform: ${platform}\nResponse:\n${JSON.stringify(response.data, null, 2)}`;
            if (text.length > 2000) text = text.slice(0, 2000) + '...';

            await sock.sendMessage(from, { text: text }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(from, { text: `Error: ${err.message}` }, { quoted: msg });
        }
    }
};
