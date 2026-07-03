module.exports = {
    name: 'timestamp',
    category: 'tools',
    description: 'Get current timestamp in multiple formats',
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        const now = new Date();
        const unix = Math.floor(now.getTime() / 1000);
        const iso = now.toISOString();
        const local = now.toLocaleString();
        const result = `Unix: ${unix}\nISO: ${iso}\nLocal: ${local}`;
        await sock.sendMessage(from, {
            text: `⏱️ *Current Timestamp*\n\n${result}`
        }, { quoted: msg });
    }
};
