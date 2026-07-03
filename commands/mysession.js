const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

module.exports = {
    name: 'mysession',
    category: 'owner',
    description: 'Get current bot session ID (compressed base64)',
    async execute(sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo) {
            return await sock.sendMessage(from, { text: "This command is restricted to the owner and sudo users only." }, { quoted: msg });
        }

        const credsPath = path.join(__dirname, '..', 'session', 'creds.json');
        if (!fs.existsSync(credsPath)) {
            return await sock.sendMessage(from, { text: '❌ No session found. The bot is not connected.' }, { quoted: msg });
        }

        try {
            const creds = fs.readFileSync(credsPath);
            const compressed = zlib.gzipSync(creds);
            const compBase64 = compressed.toString('base64');
            const compSession = `Savage~${compBase64}`;

            await sock.sendMessage(from, { text: compSession }, { quoted: msg });
        } catch (err) {
            console.error('MySession error:', err);
            await sock.sendMessage(from, { text: `❌ Failed to generate session: ${err.message}` }, { quoted: msg });
        }
    }
};
