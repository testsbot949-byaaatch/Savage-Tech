const settings = require('../settings.js');

module.exports = {
    name: "alwaysonline",
    category: "owner",
    description: "Toggle bot to always show online status (owner & sudo)",
    async execute(sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo) {
            return await sock.sendMessage(from, { text: "❌ Restricted to owner and sudo users." }, { quoted: msg });
        }

        if (global.alwaysOnline === undefined) {
            global.alwaysOnline = settings.getGlobal('alwaysOnline', true);
        }

        const sub = args[0]?.toLowerCase();
        let newState;
        if (sub === 'on') newState = true;
        else if (sub === 'off') newState = false;
        else newState = !global.alwaysOnline;

        global.alwaysOnline = newState;
        settings.setGlobal('alwaysOnline', newState);

        const status = newState ? "enabled" : "disabled";
        await sock.sendMessage(from, { text: `✅ Always Online ${status}.` }, { quoted: msg });
    }
};
