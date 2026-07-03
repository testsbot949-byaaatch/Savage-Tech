module.exports = {
    name: "tagall",
    category: "group",
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) return await sock.sendMessage(from, { text: '❌ Group only command.' }, { quoted: msg });

        const sender = msg.key.participant || msg.key.remoteJid;
        const isAdmin = await global.checkAdmin?.(sock, from, sender) || false;
        if (!isAdmin) return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });

        const metadata = await sock.groupMetadata(from);
        const participants = metadata.participants.map(v => v.id);

        let message = `📣 *Group Mention*\n\n${args.join(" ") || "Attention everyone!"}\n\n`;
        participants.forEach(mem => { message += `🔹 @${mem.split('@')[0]}\n`; });

        await sock.sendMessage(from, { text: message, mentions: participants }, { quoted: msg });
    }
};
