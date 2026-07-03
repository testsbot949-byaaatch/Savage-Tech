const axios = require('axios');

module.exports = {
    name: 'owner',
    category: 'engine',
    description: 'Contact the bot owner',
    async execute(sock, msg) {
        const from = msg.key.remoteJid;
        const ownerNum = '254105397996';
        const caption = `😈 *SΛVΛGΞ OWNER* 😈

👑 *Name:* Spencer
📱 *Phone:* +${ownerNum}
💬 *WhatsApp:* wa.me/${ownerNum}

⚡ _Tap the WhatsApp link to chat directly._`;

        let imageBuffer = null;
        try {
            const imgRes = await axios.get('https://files.catbox.moe/2857dd.jpg', {
                responseType: 'arraybuffer',
                timeout: 10000
            });
            imageBuffer = Buffer.from(imgRes.data);
        } catch (err) {
            console.warn('Could not fetch owner image:', err.message);
        }

        if (imageBuffer) {
            await sock.sendMessage(from, {
                image: imageBuffer,
                caption: caption
            }, { quoted: msg });
        } else {
            await sock.sendMessage(from, {
                text: caption
            }, { quoted: msg });
        }
    }
};
