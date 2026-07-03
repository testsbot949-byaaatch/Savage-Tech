const settings = require('../settings.js');

global.autoReact = global.autoReact || {};
global.autoReactGroups = global.autoReactGroups || false;
global.autoReactAll = global.autoReactAll || false;

const reactions = [
    "🔥","⚡","💀","🧊","🚀","😈","😂","❤️","👀","🐐",
    "💯","🤖","😎","🥶","☠️","🫡","👑","🎯","🛸","🌙",
    "⭐","🌟","✨","💫","⚔️","🧠","🦅","🐉","🐺","🦂",
    "🍷","🍿","🎮","🎧","📱","💻","🖤","🤍","💜","💙",
    "💚","💛","🧡","❤️‍🔥","💥","☢️","⚔","🔱","🪬","🌀",
    "🌪️","🌊","🌋","⛈️","☄️","🌌","🪐","🌈","🍀","🎲",
    "🎭","🎪","🎨","🎤","🎼","🥷","🕶️","⌛","🕰️","📡",
    "🛰️","🚨","🛡️","🔮","🧿","🪙","💎","👻","🤡","😹",
    "😤","🥵","🥴","🤯","😵","🤠","🫠","🫥","🫣","🫨",
    "🦾","🦿","🫀","🧬","🧪","⚙️","🔋","💡","📀","🗿",
    "😀","😃","😄","😁","😆","😅","😂","🤣","🥲","😊",
    "😇","🙂","🙃","😉","😌","😍","🥰","😘","😗","😙",
    "😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎",
    "🥸","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁",
    "😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡",
    "🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓",
    "🤗","🤔","🫣","🤭","🤫","🤥","😶","😐","😑","😬",
    "🫨","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧",
    "😷","🤒","🤕","🤑","🤠","😈","👿","👹","👺","🤡",
    "💩","👻","💀","☠️","👽","👾","🤖","🎃","😺","😸",
    "😹","😻","😼","😽","🙀","😿","😾","🙈","🙉","🙊",
    "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯",
    "🦁","🐮","🐷","🐸","🐒","🐔","🐧","🐦","🐤","🐣",
    "🐥","🐺","🐗","🐴","🦄","🐝","🪱","🐛","🦋","🐌",
    "🐞","🐜","🪰","🪲","🪳","🐢","🐍","🦎","🐙","🦑",
    "🪼","🦐","🦞","🐠","🐟","🐡","🐬","🐳","🐋","🦈",
    "🌵","🎄","🌲","🌳","🌴","🌱","🌿","☘️","🍀","🎍",
    "🪴","🎋","🍃","🍂","🍁","🍄","🐚","🌾","🌺","🌻",
    "🌹","🥀","🌷","🌸","🌼","💐","🪸","🌎","🌍","🌏",
    "🪨","🌕","🌖","🌗","🌘","🌑","🌒","🌓","🌔","🌙",
    "🌚","🌛","🌜","☀️","🌝","🌞","⭐","🌟","🌠","🪐",
    "💫","⚡","🔥","💥","☄️","💧","🌊","❄️","☃️","⛄",
    "🌬️","💨","🌀","🌪️","🌈","☔","☂️","🌂","💦","💨"
];

module.exports = {
    name: "autoreact",
    category: "owner",
    async execute(sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo) {
            return await sock.sendMessage(from, { text: "This command is restricted to the owner and sudo users only." }, { quoted: msg });
        }

        if (args.length === 0) {
            return await sock.sendMessage(from, { text: "Usage: .autoreact chat on/off\n.autoreact groups on/off\n.autoreact all on/off\n.autoreact off" }, { quoted: msg });
        }

        const first = args[0].toLowerCase();
        if (first === "off") {
            global.autoReactAll = false;
            global.autoReactGroups = false;
            if (global.autoReact) global.autoReact[from] = false;
            settings.setGlobal('autoReactAll', false);
            settings.setGlobal('autoReactGroups', false);
            settings.setGroup(from, 'autoReact', false);
            return await sock.sendMessage(from, { text: "✅ Auto‑reaction disabled for this chat (and all groups/all chats)." }, { quoted: msg });
        }

        const scope = first;
        const state = args[1]?.toLowerCase();
        if (!["chat", "groups", "all"].includes(scope) || !["on", "off"].includes(state)) {
            return await sock.sendMessage(from, { text: "Usage: .autoreact chat on/off\n.autoreact groups on/off\n.autoreact all on/off" }, { quoted: msg });
        }

        if (scope === "chat") {
            if (!global.autoReact) global.autoReact = {};
            global.autoReact[from] = state === "on";
            settings.setGroup(from, 'autoReact', state === "on");
            await sock.sendMessage(from, { text: `✅ Auto‑reaction in this chat: ${state.toUpperCase()}` }, { quoted: msg });
        } else if (scope === "groups") {
            global.autoReactGroups = state === "on";
            settings.setGlobal('autoReactGroups', state === "on");
            await sock.sendMessage(from, { text: `✅ Auto‑reaction in ALL groups: ${state.toUpperCase()}` }, { quoted: msg });
        } else if (scope === "all") {
            global.autoReactAll = state === "on";
            settings.setGlobal('autoReactAll', state === "on");
            await sock.sendMessage(from, { text: `✅ Auto‑reaction in ALL chats (private and groups): ${state.toUpperCase()}` }, { quoted: msg });
        }
    }
};

module.exports.reactToMessage = async function(sock, msg) {
    try {
        const from = msg.key.remoteJid;
        const isGroup = from.endsWith("@g.us");
        if (msg.key.fromMe) return;
        let shouldReact = false;
        if (global.autoReactAll === true) {
            shouldReact = true;
        } else if (global.autoReactGroups === true && isGroup) {
            shouldReact = true;
        } else if (global.autoReact && global.autoReact[from] === true) {
            shouldReact = true;
        }
        if (!shouldReact) return;
        const emoji = reactions[Math.floor(Math.random() * reactions.length)];
        await sock.sendMessage(from, { react: { text: emoji, key: msg.key } });
    } catch (err) {}
};
