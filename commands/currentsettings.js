const settings = require('../settings.js');

module.exports = {
    name: 'currentsettings',
    category: 'owner',
    description: 'Show current bot settings (owner & sudo only)',
    async execute(sock, msg, args, { isArchitect }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isSudo = global.sudoUsers?.includes(sender);
        if (!isArchitect && !isSudo) {
            return sock.sendMessage(from, { text: '❌ Owner or sudo only command.' }, { quoted: msg });
        }

        // Read from settings to guarantee accuracy (though global is synced)
        const prefix = settings.getGlobal('prefix', '.');
        const worktype = settings.getGlobal('worktype', 'public');
        const mode = worktype === 'public' ? '🌍 Public' : '🔒 Private';
        const autoRead = settings.getGlobal('autoRead', false) ? '✅ ON' : '❌ OFF';
        const autoTyping = settings.getGlobal('autoTyping', 'off') === 'on' ? '✅ ON' : '❌ OFF';
        const alwaysRecording = settings.getGlobal('alwaysRecording', false) ? '✅ ON' : '❌ OFF';
        const alwaysOnline = settings.getGlobal('alwaysOnline', true) !== false ? '✅ ON' : '❌ OFF';
        const autoViewStatus = settings.getGlobal('autoViewStatus', 'on') === 'on' ? '✅ ON' : '❌ OFF';
        const antiDelete = settings.getGlobal('antiDeleteEnabled', false) ? '✅ ON' : '❌ OFF';
        const antiEdit = settings.getGlobal('antiEditEnabled', false) ? '✅ ON' : '❌ OFF';
        const antideleteMode = settings.getGlobal('antideleteMode', 'private') || 'private';
        const menuStyle = settings.getGlobal('menuStyle', 'original') || 'original';

        const anticall = settings.getGlobal('anticall', { mode: 'off' });
        let anticallMode = '❌ OFF';
        if (anticall.mode === 'decline') anticallMode = '🔊 Decline';
        else if (anticall.mode === 'block') anticallMode = '🚫 Block';

        let output = `⚙️ *CURRENT BOT SETTINGS*\n\n`;
        output += `┌───¤  *STATIC SETTINGS*\n`;
        output += `│  🔹 Prefix: ${prefix}\n`;
        output += `│  🔹 Mode: ${mode}\n`;
        output += `│  🔹 Auto Read: ${autoRead}\n`;
        output += `│  🔹 Auto Typing: ${autoTyping}\n`;
        output += `│  🔹 Always Recording: ${alwaysRecording}\n`;
        output += `│  🔹 Always Online: ${alwaysOnline}\n`;
        output += `│  🔹 Auto View Status: ${autoViewStatus}\n`;
        output += `│  🔹 Anti‑Delete: ${antiDelete}\n`;
        output += `│  🔹 Anti‑Edit: ${antiEdit}\n`;
        output += `│  🔹 Anti‑Delete Mode: ${antideleteMode.toUpperCase()}\n`;
        output += `│  🔹 Menu Style: ${menuStyle}\n`;
        output += `│  🔹 Anti‑Call: ${anticallMode}\n`;

        // Optional dynamic settings (if any)
        if (global.botSettings && Object.keys(global.botSettings).length) {
            output += `│\n├───¤  *DYNAMIC SETTINGS*\n`;
            for (const [key, value] of Object.entries(global.botSettings)) {
                const display = typeof value === 'boolean' ? (value ? '✅ ON' : '❌ OFF') : value;
                output += `│  🔸 ${key}: ${display}\n`;
            }
        }
        output += `└───¤`;

        await sock.sendMessage(from, { text: output }, { quoted: msg });
    }
};
