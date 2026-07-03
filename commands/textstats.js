module.exports = {
    name: 'textstats',
    category: 'tools',
    description: 'Analyze text statistics',
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        const text = args.join(' ');
        if (!text) {
            return sock.sendMessage(from, { text: '❌ Usage: .textstats <text>' }, { quoted: msg });
        }

        const chars = text.length;
        const words = text.trim().split(/\s+/).filter(w => w).length;
        const lines = text.split('\n').length;
        const sentences = text.split(/[.!?]+/).filter(s => s.trim()).length;

        const result = `Characters: ${chars}\nWords: ${words}\nLines: ${lines}\nSentences: ${sentences}`;
        await sock.sendMessage(from, { text: `📊 *Text Statistics*\n\n${result}` }, { quoted: msg });
    }
};
