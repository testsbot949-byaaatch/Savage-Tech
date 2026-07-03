const settings = require('../settings.js');

module.exports = {
    name: 'groupsettings',
    category: 'group',
    description: 'Show current group settings',
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) {
            return await sock.sendMessage(from, { text: '❌ This command can only be used in groups.' }, { quoted: msg });
        }

        let groupName = from;
        try {
            const meta = await sock.groupMetadata(from);
            groupName = meta.subject;
        } catch (e) {}

        const getSetting = (key, defaultValue) => {
            const value = settings.getGroup(from, key);
            return value !== undefined && value !== null ? value : defaultValue;
        };

        const antiLinkConfig = getSetting('antiLinkConfig', { enabled: false });
        const antiLink = antiLinkConfig.enabled ? '✅ ON' : '❌ OFF';

        const antiTagConfig = getSetting('antiTagConfig', { enabled: false });
        const antiTag = antiTagConfig.enabled ? '✅ ON' : '❌ OFF';

        const antiTagAdminConfig = getSetting('antiTagAdminConfig', { enabled: false });
        const antiTagAdmin = antiTagAdminConfig.enabled ? '✅ ON' : '❌ OFF';

        const antiGroupMentionConfig = getSetting('antigroupmention', { enabled: false });
        const antiGroupMention = antiGroupMentionConfig.enabled ? '✅ ON' : '❌ OFF';

        const antiLeave = getSetting('antiLeave', false) ? '✅ ON' : '❌ OFF';

        const welcome = getSetting('welcomeEnabled', false) ? '✅ ON' : '❌ OFF';

        const goodbye = getSetting('goodbyeEnabled', false) ? '✅ ON' : '❌ OFF';

        const badWordEnabled = getSetting('badWordEnabled', false) ? '✅ ON' : '❌ OFF';
        const badWords = getSetting('badWords', []);
        let badWordList = 'None';
        if (badWords && badWords.length > 0) {
            badWordList = badWords.slice(0, 5).join(', ') + (badWords.length > 5 ? '...' : '');
        }

        const antiSpamConfig = getSetting('antiSpamConfig', { enabled: false });
        const antiSpam = antiSpamConfig.enabled ? '✅ ON' : '❌ OFF';

        const antiBot = getSetting('antiBot', false) ? '✅ ON' : '❌ OFF';

        const antiStatusMentionConfig = getSetting('antistatusmention', { enabled: false });
        const antiStatusMention = antiStatusMentionConfig.enabled ? '✅ ON' : '❌ OFF';

        const antiDemoteConfig = getSetting('antidemote', { enabled: false });
        const antiDemote = antiDemoteConfig.enabled ? '✅ ON' : '❌ OFF';

        const antiPromoteConfig = getSetting('antipromote', { enabled: false });
        const antiPromote = antiPromoteConfig.enabled ? '✅ ON' : '❌ OFF';

        const antiForwardConfig = getSetting('antiForwardConfig', { enabled: false });
        const antiForward = antiForwardConfig.enabled ? '✅ ON' : '❌ OFF';

        let output = `⚙️ *GROUP SETTINGS*\n📛 *${groupName}*\n🆔 ${from}\n\n`;
        output += `┌───¤  *SECURITY SETTINGS*\n`;
        output += `│  🔹 Anti-Link: ${antiLink}\n`;
        output += `│  🔹 Anti-Tag (members): ${antiTag}\n`;
        output += `│  🔹 Anti-Tag (admins): ${antiTagAdmin}\n`;
        output += `│  🔹 Anti-Group Mention: ${antiGroupMention}\n`;
        output += `│  🔹 Anti-Status Mention: ${antiStatusMention}\n`;
        output += `│  🔹 Anti-Forward: ${antiForward}\n`;
        output += `│  🔹 Anti-Bot: ${antiBot}\n`;
        output += `│  🔹 Anti-Leave: ${antiLeave}\n`;
        output += `│  🔹 Anti-Demote: ${antiDemote}\n`;
        output += `│  🔹 Anti-Promote: ${antiPromote}\n`;
        output += `│\n`;
        output += `├───¤  *MODERATION SETTINGS*\n`;
        output += `│  🔹 Anti-Spam: ${antiSpam}\n`;
        output += `│  🔹 Bad Word Filter: ${badWordEnabled}\n`;
        output += `│  🔹 Bad Words: ${badWordList}\n`;
        output += `│\n`;
        output += `├───¤  *MESSAGING SETTINGS*\n`;
        output += `│  🔹 Welcome: ${welcome}\n`;
        output += `│  🔹 Goodbye: ${goodbye}\n`;
        output += `└───¤`;

        await sock.sendMessage(from, { text: output }, { quoted: msg });
    }
};
