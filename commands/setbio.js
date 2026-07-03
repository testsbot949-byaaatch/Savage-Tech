module.exports = {
    name: "setbio",
    category: "owner",
    async execute(sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = isArchitect || isMe || (global.ownerJid && sender === global.ownerJid);
        const isSudo = global.sudoUsers?.includes(sender) || false;
        if (!isOwner && !isSudo) {
            return await sock.sendMessage(from, { text: "❌ Command restricted to the owner and sudo users only." }, { quoted: msg });
        }
        const newBio = args.join(" ");
        if (!newBio) {
            return await sock.sendMessage(from, { text: "❌ Usage: .setbio <your new bio text>" }, { quoted: msg });
        }
        try {
            await sock.updateProfileStatus(newBio);
            await sock.sendMessage(from, { text: `✅ Bio updated to: ${newBio}` }, { quoted: msg });
        } catch (err) {
            console.error("Setbio error:", err);
            await sock.sendMessage(from, { text: `❌ Failed to update bio: ${err.message}` }, { quoted: msg });
        }
    }
};
