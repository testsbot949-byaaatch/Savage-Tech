module.exports = {
    name: "pingall",
    category: "group",
    description: "Tag every member in the group",
    async execute(sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo) {
            return await sock.sendMessage(from, { text: "This command is restricted to the owner and sudo users only." }, { quoted: msg });
        }

        const isGroup = from.endsWith('@g.us');
        if (!isGroup) {
            return await sock.sendMessage(from, { text: "❌ *ERROR:* Group protocol only." }, { quoted: msg });
        }

        try {
            const metadata = await sock.groupMetadata(from);
            const participants = metadata.participants;
            
            let mentions = [];
            let messageText = `📢 **ANNOUNCEMENT:** ${args.length > 0 ? args.join(' ') : 'System Broadcast'}\n\n`;

            for (let participant of participants) {
                messageText += `🔹 @${participant.id.split('@')[0]}\n`;
                mentions.push(participant.id);
            }

            await sock.sendMessage(from, { 
                text: messageText, 
                mentions: mentions 
            }, { quoted: msg });

        } catch (error) {
            console.error("PINGALL ERROR:", error);
            await sock.sendMessage(from, { text: "❌ **FAILED:** Metadata extraction error." }, { quoted: msg });
        }
    }
};
