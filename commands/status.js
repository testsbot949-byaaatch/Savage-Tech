const os = require('os');

module.exports = {
    name: 'status',
    category: 'engine',
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        let runtime = '';
        if (days > 0) runtime += `${days}d `;
        if (hours > 0) runtime += `${hours}h `;
        if (minutes > 0) runtime += `${minutes}m `;
        runtime += `${seconds}s`;

        const statusText = `*SΛVΛGΞ-TECH STATUS*\n\n📡 **UPLINK:** STABLE\n⏳ **RUNTIME:** ${runtime}\n⛓️ **SYSTEM:** ABSOLUTE`;

        await sock.sendMessage(from, { text: statusText }, { quoted: msg });
    }
};
