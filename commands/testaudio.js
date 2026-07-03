const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

module.exports = {
    name: 'testaudio',
    category: 'debug',
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
            return sock.sendMessage(from, { text: '❌ Need a URL.' }, { quoted: msg });
        }

        if (!url.startsWith('http')) {
            return sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/api/audio/bass?url=${encodeURIComponent(url)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000, responseType: 'text' });

            await sock.sendMessage(from, {
                text: `Content-Type: ${response.headers['content-type']}\n\nFirst 500 chars:\n${response.data.slice(0, 500)}`
            }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(from, { text: `Error: ${err.message}` }, { quoted: msg });
        }
    }
};
