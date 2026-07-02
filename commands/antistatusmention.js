const settings = require('../settings.js');

function cleanJid(jid) {
    if (!jid) return jid;
    const clean = jid.split(':')[0];
    return clean.includes('@') ? clean : clean + '@s.whatsapp.net';
}

function formatCustomMessage(template, vars) {
    if (!template || typeof template !== 'string') return '';
    return template.replace(/\{(\w+)\}/g, (_, key) =>
        Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : `{${key}}`
    );
}

function getConfig(groupId) {
    return settings.getGroup(groupId, 'antistatusmention') || {
        enabled: false,
        mode: 'warn',
        maxWarnings: 3,
        exemptAdmins: true,
        customMessage: '',
        warnings: {}
    };
}

function setConfig(groupId, config) {
    settings.setGroup(groupId, 'antistatusmention', config);
}

module.exports = {
    name: 'antistatusmention',
    category: 'group',
    description: 'Detect and act when someone mentions the group in their status',

    async execute(sock, msg, args, { isArchitect }) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) {
            return await sock.sendMessage(from, { text: '❌ Group only command.' }, { quoted: msg });
        }

        const sender = msg.key.participant || msg.key.remoteJid;
        const isAdmin = await global.checkAdmin(sock, from, sender);
        if (!isAdmin && !isArchitect) {
            return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });
        }

        const config = getConfig(from);
        const sub = args[0]?.toLowerCase();

        if (!sub || sub === 'help') {
            return await sock.sendMessage(from, {
                text: `.antistatusmention warn - Enable warn mode\n.antistatusmention delete - Enable delete mode\n.antistatusmention kick - Enable kick mode\n.antistatusmention off - Disable\n.antistatusmention maxwarn <num> - Set max warnings\n.antistatusmention reset <@user|all> - Reset warnings\n.antistatusmention set <text> - Custom message ({user} {group} {warns} {limit} {mode})\n.antistatusmention resetmsg - Reset to default\n.antistatusmention status - View settings`
            }, { quoted: msg });
        }

        try {
            if (sub === 'warn' || sub === 'delete' || sub === 'kick') {
                config.enabled = true;
                config.mode = sub;
                setConfig(from, config);
                return await sock.sendMessage(from, {
                    text: `✅ Anti-Status-Mention ENABLED\nMode: ${sub.toUpperCase()}\nMax warnings: ${config.maxWarnings}`
                }, { quoted: msg });
            }

            if (sub === 'off') {
                config.enabled = false;
                setConfig(from, config);
                return await sock.sendMessage(from, { text: '❌ Anti-Status-Mention DISABLED.' }, { quoted: msg });
            }

            if (sub === 'maxwarn' || sub === 'maxwarnings') {
                const num = parseInt(args[1]);
                if (!num || num < 1 || num > 10) {
                    return await sock.sendMessage(from, { text: '❌ Provide a number between 1 and 10.' }, { quoted: msg });
                }
                config.maxWarnings = num;
                setConfig(from, config);
                return await sock.sendMessage(from, { text: `✅ Max warnings set to ${num}` }, { quoted: msg });
            }

            if (sub === 'reset') {
                const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
                if (mentioned && mentioned.length > 0) {
                    const target = cleanJid(mentioned[0]);
                    if (config.warnings?.[target]) {
                        delete config.warnings[target];
                        setConfig(from, config);
                        return await sock.sendMessage(from, {
                            text: `✅ Warnings reset for @${target.split('@')[0]}`,
                            mentions: [target]
                        }, { quoted: msg });
                    }
                    return await sock.sendMessage(from, { text: '⚠️ No warnings for that user.' }, { quoted: msg });
                }
                if (args[1] === 'all') {
                    config.warnings = {};
                    setConfig(from, config);
                    return await sock.sendMessage(from, { text: '✅ All warnings reset.' }, { quoted: msg });
                }
                return await sock.sendMessage(from, { text: '❌ Tag a user or use .antistatusmention reset all' }, { quoted: msg });
            }

            if (sub === 'set' || sub === 'setmsg') {
                const customText = args.slice(1).join(' ').trim();
                if (!customText) {
                    return await sock.sendMessage(from, {
                        text: 'Usage: .antistatusmention set <text> with {user} {group} {warns} {limit} {mode}'
                    }, { quoted: msg });
                }
                config.customMessage = customText;
                setConfig(from, config);
                return await sock.sendMessage(from, { text: `✅ Custom message set.\n${customText}` }, { quoted: msg });
            }

            if (sub === 'resetmsg' || sub === 'cleartext') {
                config.customMessage = '';
                setConfig(from, config);
                return await sock.sendMessage(from, { text: '✅ Custom message cleared.' }, { quoted: msg });
            }

            if (sub === 'status' || sub === 'settings') {
                const warns = Object.entries(config.warnings || {});
                let warnText = warns.length ? '\n\nWarnings:\n' + warns.map(([j, c]) => `• @${j.split('@')[0]}: ${c}`).join('\n') : '';
                return await sock.sendMessage(from, {
                    text: `Status: ${config.enabled ? '✅ ON' : '❌ OFF'}\nMode: ${config.mode.toUpperCase()}\nMax Warnings: ${config.maxWarnings}\nAdmins Exempt: ${config.exemptAdmins ? 'Yes' : 'No'}${warnText}`
                }, { quoted: msg });
            }

            return await sock.sendMessage(from, { text: '❌ Unknown option. Use .antistatusmention help' }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
        }
    }
};
