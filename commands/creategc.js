module.exports = {
    name: 'creategc',
    category: 'owner',
    description: 'Create a WhatsApp group (owner only)',
    async execute(sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo) {
            return await sock.sendMessage(from, { text: "This command is restricted to the owner and sudo users only." }, { quoted: msg });
        }

        if (args.length === 0) {
            return await sock.sendMessage(from, { text: '❓ Usage: .creategc <group_name (max 10 words)> [phone1 phone2 ...]' }, { quoted: msg });
        }

        const maxNameWords = 10;
        const groupNameWords = args.slice(0, maxNameWords);
        const groupName = groupNameWords.join(' ');
        const participantArgs = args.slice(maxNameWords);

        let participants = [];
        for (let p of participantArgs) {
            let cleaned = p.replace(/[^0-9]/g, '');
            if (cleaned) {
                participants.push(cleaned + '@s.whatsapp.net');
            } else {
                return await sock.sendMessage(from, { text: `❌ Invalid phone number: ${p}. Use digits only.` }, { quoted: msg });
            }
        }

        try {
            const group = await sock.groupCreate(groupName, participants);
            const groupJid = group.id;
            const inviteCode = await sock.groupInviteCode(groupJid);
            const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
            await sock.sendMessage(from, {
                text: `✅ Group created!\n📛 ${groupName}\n🆔 ${groupJid}\n🔗 ${inviteLink}\n👥 Added: ${participants.length}`
            }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    }
};
