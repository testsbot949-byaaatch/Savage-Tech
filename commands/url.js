const { downloadMediaMessage } = require("@whiskeysockets/baileys");
const axios = require('axios');
const FormData = require('form-data');

module.exports = {
    name: 'url',
    category: 'tools',
    description: 'Upload media to Catbox and get a direct URL (reply to an image, video, sticker, or audio)',
    async execute(sock, msg) {
        const from = msg.key.remoteJid;
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted) {
            return sock.sendMessage(from, { text: '❌ Reply to a media message (image, video, sticker, audio, or document).' }, { quoted: msg });
        }

        let mediaBuffer, filename, contentType;
        try {
            if (quoted.imageMessage) {
                mediaBuffer = await downloadMediaMessage({ message: quoted }, 'buffer', {});
                filename = 'image.jpg';
                contentType = 'image/jpeg';
            } else if (quoted.videoMessage) {
                mediaBuffer = await downloadMediaMessage({ message: quoted }, 'buffer', {});
                filename = 'video.mp4';
                contentType = 'video/mp4';
            } else if (quoted.audioMessage) {
                mediaBuffer = await downloadMediaMessage({ message: quoted }, 'buffer', {});
                filename = 'audio.mp3';
                contentType = 'audio/mpeg';
            } else if (quoted.stickerMessage) {
                mediaBuffer = await downloadMediaMessage({ message: quoted }, 'buffer', {});
                filename = 'sticker.webp';
                contentType = 'image/webp';
            } else if (quoted.documentMessage) {
                mediaBuffer = await downloadMediaMessage({ message: quoted }, 'buffer', {});
                const doc = quoted.documentMessage;
                filename = doc.fileName || 'document.bin';
                contentType = doc.mimetype || 'application/octet-stream';
            } else {
                return sock.sendMessage(from, { text: '❌ Unsupported media type.' }, { quoted: msg });
            }
        } catch (err) {
            console.error('Media download error:', err);
            return sock.sendMessage(from, { text: '❌ Failed to download the media.' }, { quoted: msg });
        }

        try {
            const form = new FormData();
            form.append('reqtype', 'fileupload');
            form.append('fileToUpload', mediaBuffer, { filename, contentType });

            const response = await axios.post('https://catbox.moe/user/api.php', form, {
                headers: form.getHeaders()
            });

            const url = response.data.trim();
            if (!url.startsWith('https://files.catbox.moe/')) {
                throw new Error('Invalid response from Catbox');
            }

            await sock.sendMessage(from, { text: `✅ Media uploaded!\n\n🔗 ${url}` }, { quoted: msg });
        } catch (err) {
            console.error('Catbox upload error:', err);
            await sock.sendMessage(from, { text: '❌ Failed to upload the media. Please try again later.' }, { quoted: msg });
        }
    }
};
