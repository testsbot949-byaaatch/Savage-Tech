const settings = require('../settings.js');

module.exports = {
    name: "setprefix",
    category: "owner",
    description: "Change the global command trigger (use 'none' to remove prefix requirement)",
    async execute(sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        // isArchitect already includes isMe, but we keep it explicit for clarity
        if (!isArchitect && !isOwner && !isSudo && !isMe) {
            return await sock.sendMessage(from, { text: "This command is restricted to the owner and sudo users only." }, { quoted: msg });
        }

        if (!args[0]) {
            return await sock.sendMessage(from, {
                text: `⚠️ **ERROR:** Provide a new prefix. (Current: ${global.prefix === "none" ? "none (no prefix required)" : global.prefix})`
            }, { quoted: msg });
        }

        let newPrefix = args[0];
        let responseText = "";

        if (newPrefix.toLowerCase() === "none") {
            global.prefix = "none";
            settings.setGlobal('prefix', 'none');
            responseText = "✅ **SYSTEM UPDATED:** Prefix requirement removed. Now you can use commands without any prefix (e.g., type `menu` instead of `.menu`).\n\n⚠️ Note: The bot will check the **first word** of every message for a valid command.";
        } else {
            global.prefix = newPrefix;
            settings.setGlobal('prefix', newPrefix);
            responseText = `✅ **SYSTEM UPDATED:** Neural trigger changed to: [ ${newPrefix} ]`;
        }

        await sock.sendMessage(from, { text: responseText }, { quoted: msg });
    }
};
