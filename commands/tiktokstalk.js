const axios = require('axios');
const https = require('https');

const agent = new https.Agent({ rejectUnauthorized: false });

module.exports = {
    name: 'tiktokstalk',
    category: 'search menu',
    description: 'Lookup TikTok user profile info with photo',
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        const username = args[0];
        if (!username) {
            return sock.sendMessage(from, { text: '❌ Usage: .tiktokstalk <username>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/api/stalk/tiktok?username=${encodeURIComponent(username)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });
            const data = response.data;

            if (!data.success) {
                return sock.sendMessage(from, { text: `❌ TikTok lookup failed: ${data.error || 'User not found'}` }, { quoted: msg });
            }

            const user = data.result || data;
            const nickname = user.nickname || user.username || '-';
            const bio = (user.bio || '-').substring(0, 150);
            const bioDisplay = user.bio && user.bio.length > 150 ? bio + '...' : bio;

            const caption = `🎵 *TikTok User*\n\n` +
                `👤 User: ${nickname}\n` +
                `📛 Username: @${user.username || '-'}\n` +
                `📝 Bio: ${bioDisplay}\n` +
                `🔒 Private: ${user.privateAccount ? 'Yes' : 'No'}\n` +
                `✔️ Verified: ${user.verified ? 'Yes' : 'No'}\n\n` +
                `👥 Followers: ${(user.followers || 0).toLocaleString()}\n` +
                `👣 Following: ${(user.following || 0).toLocaleString()}\n` +
                `❤️ Total Likes: ${(user.likes || 0).toLocaleString()}\n` +
                `🎬 Videos: ${(user.videos || 0).toLocaleString()}\n\n` +
                `🔗 Profile: ${user.profileUrl || `https://tiktok.com/@${user.username}`}`;

            let imageBuffer = null;
            if (user.avatar) {
                try {
                    const imgRes = await axios.get(user.avatar, {
                        responseType: 'arraybuffer',
                        httpsAgent: agent,
                        timeout: 10000
                    });
                    imageBuffer = Buffer.from(imgRes.data);
                } catch (imgErr) {
                    console.log('Avatar download failed:', imgErr.message);
                }
            }

            if (imageBuffer) {
                await sock.sendMessage(from, {
                    image: imageBuffer,
                    caption: caption
                }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: caption }, { quoted: msg });
            }
        } catch (err) {
            console.error('TikTok stalk error:', err);
            await sock.sendMessage(from, { text: '❌ Network error or invalid username.' }, { quoted: msg });
        }
    }
};
