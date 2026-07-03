module.exports = {
    name: "savestatus",
    category: "tools",
    description: "Save a status update (story) and forward it to the bot owner",
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted) {
            return await sock.sendMessage(from, { text: "❌ Reply to a status message (story)." }, { quoted: msg });
        }

        let mediaType = null;
        let mediaMsg = null;
        if (quoted.imageMessage) {
            mediaType = "image";
            mediaMsg = quoted.imageMessage;
        } else if (quoted.videoMessage) {
            mediaType = "video";
            mediaMsg = quoted.videoMessage;
        } else if (quoted.audioMessage) {
            mediaType = "audio";
            mediaMsg = quoted.audioMessage;
        } else {
            return await sock.sendMessage(from, { text: "❌ This is not a status message with image/video/audio. Reply to a story." }, { quoted: msg });
        }

        try {
            // Construct a proper message object for download
            const quotedMsg = {
                key: {
                    remoteJid: quoted.key?.remoteJid || 'status@broadcast',
                    id: quoted.key?.id,
                    participant: quoted.key?.participant,
                    fromMe: false
                },
                message: quoted
            };

            const buffer = await global.downloadMediaMessage(quotedMsg, "buffer", {});
            if (!buffer || buffer.length === 0) throw new Error("Download failed");

            let owner = "Unknown";
            if (quoted.key?.participant) {
                owner = quoted.key.participant.split('@')[0];
            } else if (quoted.key?.remoteJid && quoted.key.remoteJid !== "status@broadcast") {
                owner = quoted.key.remoteJid.split('@')[0];
            }

            const caption = `📥 *Status saved*\nFrom: ${owner}\nType: ${mediaType}`;

            const ownerJid = global.ownerJid;
            if (ownerJid) {
                if (mediaType === "image") {
                    await sock.sendMessage(ownerJid, { image: buffer, caption: caption });
                } else if (mediaType === "video") {
                    await sock.sendMessage(ownerJid, { video: buffer, caption: caption });
                } else if (mediaType === "audio") {
                    await sock.sendMessage(ownerJid, { audio: buffer, mimetype: 'audio/mpeg', caption: caption });
                }
                await sock.sendMessage(from, { text: `✅ Status saved and forwarded to the owner.` }, { quoted: msg });
            } else {
                if (mediaType === "image") {
                    await sock.sendMessage(from, { image: buffer, caption: caption }, { quoted: msg });
                } else if (mediaType === "video") {
                    await sock.sendMessage(from, { video: buffer, caption: caption }, { quoted: msg });
                } else if (mediaType === "audio") {
                    await sock.sendMessage(from, { audio: buffer, mimetype: 'audio/mpeg', caption: caption }, { quoted: msg });
                }
                await sock.sendMessage(from, { text: `⚠️ No owner registered. Status sent to you instead.` }, { quoted: msg });
            }
        } catch (err) {
            console.error("savestatus error:", err);
            await sock.sendMessage(from, { text: `❌ Failed to save status: ${err.message}` }, { quoted: msg });
        }
    }
};
