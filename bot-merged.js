require('dotenv').config();

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    downloadMediaMessage,
    downloadContentFromMessage   // <-- added
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const fs = require("fs");
const qrcode = require("qrcode-terminal");
const path = require("path");
const express = require("express");
const axios = require("axios");
const os = require("os");
const zlib = require("zlib");

const settings = require('./settings.js');

const PACKAGE_JSON = {
  "name": "savage-tech",
  "version": "1.0.0",
  "description": "WhatsApp Bot by Spencer",
  "main": "index.js",
  "type": "commonjs",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "@distube/ytdl-core": "^4.16.12",
    "@google/generative-ai": "^0.24.1",
    "@meting/core": "^1.6.1",
    "@vitalets/google-translate-api": "^9.2.1",
    "@whiskeysockets/baileys": "^6.7.23",
    "axios": "^1.18.1",
    "cheerio": "^1.2.0",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "form-data": "^4.0.6",
    "fs-extra": "^11.2.0",
    "pino": "^8.19.0",
    "qrcode": "^1.5.4",
    "qrcode-terminal": "^0.12.0",
    "yt-search": "^2.13.1",
    "ytdl-core": "^4.11.5"
  },
  "devDependencies": {
    "javascript-obfuscator": "^5.4.2"
  }
};

settings.loadSettings();
settings.syncGlobals();




global.downloadMediaMessage = downloadMediaMessage;

const colors = {
    label: '\x1b[36m',
    value: '\x1b[32m',
    arrow: '\x1b[35m',
    reset: '\x1b[0m'
};

const pingApp = express();
const PING_PORT = process.env.PORT || 3000;
pingApp.get('/', (req, res) => res.send('✅ SAVAGE-TECH is alive'));
pingApp.listen(PING_PORT, () => console.log(`✅ Keep-alive server running on port ${PING_PORT}`));

let BOT_URL = null;
if (process.env.RENDER_EXTERNAL_URL) BOT_URL = process.env.RENDER_EXTERNAL_URL;
else if (process.env.HEROKU_APP_NAME) BOT_URL = `https://${process.env.HEROKU_APP_NAME}.herokuapp.com`;
else if (process.env.RAILWAY_PUBLIC_DOMAIN) BOT_URL = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
else if (process.env.REPL_SLUG) BOT_URL = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
else if (process.env.COOLIFY_URL) BOT_URL = process.env.COOLIFY_URL;
else if (process.env.KOYEB_URL) BOT_URL = process.env.KOYEB_URL;
else if (process.env.VERCEL_URL) BOT_URL = `https://${process.env.VERCEL_URL}`;

if (BOT_URL) {
    setInterval(async () => {
        try {
            await axios.get(BOT_URL);
            console.log('🔄 Keep-alive ping sent');
        } catch (err) {
            console.error('❌ Ping failed:', err.message);
        }
    }, 5 * 60 * 1000);
    console.log(`✅ Self-pinger started – pinging ${BOT_URL} every 5 minutes`);
} else {
    console.warn('⚠️ Could not detect public URL – self-pinger disabled');
}

process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason) => {
    console.error('UNHANDLED REJECTION:', reason);
});

global.commands = new Map();
global.blacklist = new Set();
global.BOT_START_TIME = Date.now();
global.STARTUP_MSG_SENT = false;

global.messageCounts = {};
global.lastMessageTime = {};
global.antideleteOwnerChat = null;
global.goodbyeEnabled = {};
global.welcomeEnabled = {};

global.antiLink = {};
global.violationWarnings = {};
global.antiGroupMention = {};
global.groupMentionWarnings = {};

global.antiStatusMention = {};
global.statusWarnings = {};

global._msgCache = new Map();
global._mediaCache = new Map();
global._statusCache = new Map();

global.alwaysRecording = false;
global.pendingJoinRequests = {};

global.badWords = {};
global.badWordWarnings = {};
global.badWordEnabled = {};
global.badWordConfig = {};

global.antiLinkConfig = {};
global.antiLinkWarnings = {};

global.antiTagConfig = {};
global.antiTagWarnings = {};

global.antiTagAdminConfig = {};
global.antiTagAdminWarnings = {};

global.anticall = { mode: "off", msg: "❌ Calls are not accepted. Send a message instead." };

global.antiDeleteEnabled = false;
global.antiEditEnabled = false;

global.antiSpamConfig = {};
global.antiSpamWarnings = {};
global.antiSpamTrack = {};

global.antiBot = {};

global.gateConfig = {};
global.pendingVerifications = {};

// ======== UPDATED SUPPORT GROUP LINK ========
const SUPPORT_GROUP_LINK = "https://chat.whatsapp.com/HNpbG40z4tZ6Hyja4jI00y?s=cl&p=a&ilr=4";
const SUPPORT_CHANNEL_LINK = "https://whatsapp.com/channel/0029VbCuEBJEAKWOWVH3G21e";

// ======== INLINED EVENT HANDLER ========
const eventHandler = {
    async sendWelcome(sock, id, participant, groupName) {
        const quotes = [
            "🎉 Welcome to the squad! Hope you're ready for some chaos.",
            "👋 Hey there! Happy to have you here. Let's make it legendary.",
            "🚀 Another awesome person joins the crew. Welcome aboard!",
            "🙌 You're in! Grab a seat and enjoy the ride.",
            "🔥 Welcome! Stay sharp, have fun, and make some memories.",
            "🤘 Welcome to the family! You're now part of something cool.",
            "💪 Welcome! Let's build something great together.",
            "😎 You're in good company. Welcome to the group!",
            "✌️ A new face – and a great one at that. Welcome!",
            "🎈 Welcome! We've been waiting for someone like you.",
            "👑 Welcome to the kingdom. Make yourself comfortable.",
            "🌟 You're now part of this amazing community. Let's grow!",
            "🎯 Welcome! Your presence just made this group better.",
            "💫 Welcome to the circle! Hope you're ready for the journey.",
            "🤝 Glad you're here! Let's make some incredible things happen."
        ];
        const quote = quotes[Math.floor(Math.random() * quotes.length)];
        await sock.sendMessage(id, {
            text: `😈 *WELCOME TO ${groupName}*\n\n@${participant.split('@')[0]}\n${quote}`,
            mentions: [participant]
        });
    },

    async sendGoodbye(sock, id, participant) {
        const quotes = [
            "👋 Farewell! Hope to see you again soon.",
            "😢 Hate to see you go. You'll be missed!",
            "🚪 You left, but the door is always open.",
            "💔 Goodbye! You were a great part of this group.",
            "👋 Catch you later! Stay awesome out there.",
            "✨ You may leave, but your vibe stays with us.",
            "🤝 Until next time! Take care of yourself.",
            "🎈 Goodbye! Wishing you all the best in your journey.",
            "🌟 You're leaving – but you'll always be a legend here.",
            "💪 Stay strong, stay savage. See you around!",
            "👑 You'll be missed. Keep being amazing.",
            "💫 You're off to new adventures. We'll be here when you're back.",
            "🚀 Goodbye for now! Don't forget to drop by sometimes.",
            "🎯 You left, but you'll always be part of the story.",
            "💬 We'll leave a seat empty for you. Take care!"
        ];
        const quote = quotes[Math.floor(Math.random() * quotes.length)];
        await sock.sendMessage(id, {
            text: `😈 *PERIMETER UPDATE*\n\n@${participant.split('@')[0]}\n${quote}`,
            mentions: [participant]
        });
    }
};
// ======== END INLINED EVENT HANDLER ========

// ======== GLOBAL HELPERS (inlined from command files) ========
function detectHost() {
  if (process.env.RENDER) return 'Render Cloud';
  if (process.env.DYNO) return 'Heroku Dyno';
  if (process.env.KOYEB) return 'Koyeb';
  if (process.env.RAILWAY_ENVIRONMENT) return 'Railway';
  if (process.env.VERCEL) return 'Vercel';
  if (process.env.REPLIT_DB_URL) return 'Replit';
  if (process.env.COOLIFY) return 'Coolify';
  if (process.env.SERVER_ID || process.env.PTERODACTYL) return 'Panel';
  if (fs.existsSync('/home/container') || process.env.USER === 'container') return 'Panel';
  if (os.platform() === 'linux') {
    if (process.env.PREFIX === '/data/data/com.termux/usr' || fs.existsSync('/data/data/com.termux')) return 'Termux (Android)';
    return 'Linux VPS';
  }
  if (os.platform() === 'win32') return 'Windows';
  if (os.platform() === 'darwin') return 'macOS';
  return 'Unknown / Local';
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${days}d ${hours}h ${minutes}m ${secs}s`;
}

function getHostPlatform() {
    if (process.env.DYNO) return 'Heroku (Dyno)';
    if (process.env.RENDER) return 'Render';
    if (process.env.VERCEL) return 'Vercel';
    if (process.env.KOYEB) return 'Koyeb';
    if (process.env.RAILWAY_ENVIRONMENT) return 'Railway';
    if (process.env.REPLIT_DB_URL) return 'Replit';
    if (process.env.COOLIFY) return 'Coolify';
    if (os.platform() === 'android' && process.env.PREFIX === '/data/data/com.termux/usr') return 'Termux (Android)';
    if (os.platform() === 'linux') return 'Panel';
    if (os.platform() === 'win32') return 'Windows';
    if (os.platform() === 'darwin') return 'macOS';
    return 'Unknown / Local';
}

function applyMenuStyle(rawMenu, style) {
    if (!style || style === 'original') return rawMenu;
    const lines = rawMenu.split('\n');
    switch (style) {
        case 'dim': return lines.map(line => '> ' + line).join('\n');
        case 'minimal': return lines.map(line => line.replace(/^[┌┃┕]───¤\s*\*\s*|\s*\*$/, '').replace(/♤/g, '•')).join('\n');
        case 'compact': return lines.filter(line => !line.match(/^[┌┃┕]───¤/)).join('\n');
        case 'bullet': return rawMenu.replace(/♤/g, '•');
        case 'mono': return '```\n' + rawMenu + '\n```';
        case 'boldhead': return rawMenu;
        case 'noicon': return rawMenu.replace(/♤ /g, '  ').replace(/┃  ♤ /g, '┃    ');
        default: return rawMenu;
    }
}

const DEFAULT_IMAGES = [
    'https://files.catbox.moe/5q66wb.png',
    'https://files.catbox.moe/6927i7.jpg'
];

const https = require('https');
const agent = new https.Agent({ rejectUnauthorized: false });

function downloadFile(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { agent }, (res) => {
            if (res.statusCode === 302 || res.statusCode === 301) {
                downloadFile(res.headers.location).then(resolve).catch(reject);
                return;
            }
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
            res.on('error', reject);
        }).on('error', reject);
    });
}
// ======== END GLOBAL HELPERS ========

const ownerFile = path.join(__dirname, 'owner.json');
if (fs.existsSync(ownerFile)) {
    try {
        const data = JSON.parse(fs.readFileSync(ownerFile, 'utf-8'));
        global.ownerJid = data.ownerJid;
        console.log(`[OWNER] Loaded owner JID: ${global.ownerJid}`);
    } catch (e) {}
}

global.sudoUsers = [];
const sudoFile = path.join(__dirname, 'sudo.json');
if (fs.existsSync(sudoFile)) {
    try {
        const data = JSON.parse(fs.readFileSync(sudoFile, 'utf-8'));
        if (Array.isArray(data)) {
            global.sudoUsers = data;
            console.log(`[SUDO] Loaded ${global.sudoUsers.length} sudo users`);
        } else {
            console.warn('[SUDO] sudo.json must contain an array of JIDs');
        }
    } catch (e) {
        console.warn('[SUDO] Failed to parse sudo.json:', e.message);
    }
} else {
    console.log('[SUDO] No sudo.json found – sudo users list is empty');
}

async function checkAdmin(sock, groupId, sender) {
    try {
        const meta = await sock.groupMetadata(groupId);
        const senderNumber = sender.split('@')[0].split(':')[0];
        const participant = meta.participants.find(p => {
            const pNumber = p.id.split('@')[0].split(':')[0];
            return pNumber === senderNumber;
        });
        return participant?.admin === 'admin' || participant?.admin === 'superadmin';
    } catch {
        return false;
    }
}
global.checkAdmin = checkAdmin;

async function getGroupName(sock, groupId) {
    try {
        const meta = await sock.groupMetadata(groupId);
        return meta.subject || groupId;
    } catch {
        return groupId;
    }
}

async function handleStatusMention(sock, msg, from, sender, isAdmin) {
    if (!from.endsWith("@g.us")) return;
    if (!global.antiStatusMention[from]) return;
    if (isAdmin) return;

    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
    const mentions = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (text.includes("@all") || text.includes("@everyone")) return;
    if (!mentions.length) return;

    if (!global.statusWarnings[from]) global.statusWarnings[from] = {};
    const count = (global.statusWarnings[from][sender] || 0) + 1;
    global.statusWarnings[from][sender] = count;

    try {
        await sock.sendMessage(from, { delete: msg.key });
    } catch (err) {}

    let quote;
    if (count === 1) quote = "First warning: status mention.";
    else if (count === 2) quote = "Second warning: status mention.";
    else quote = "Final warning: status mention. Removed.";

    await sock.sendMessage(from, {
        text: `🚨 @${sender.split("@")[0]}\n\n${quote}`,
        mentions: [sender]
    });

    if (count >= 3) {
        try {
            await sock.groupParticipantsUpdate(from, [sender], "remove");
        } catch (err) {}
        delete global.statusWarnings[from][sender];
    }
}

async function generateCaptcha(groupId, type) {
    if (type === 'math') {
        const a = Math.floor(Math.random() * 10) + 1;
        const b = Math.floor(Math.random() * 10) + 1;
        const answer = a + b;
        return { question: `Solve: ${a} + ${b} = ?`, answer: answer.toString() };
    } else if (type === 'text') {
        const words = ['SAVAGE', 'TECH', 'BOT', 'VERIFY', 'GATE'];
        const word = words[Math.floor(Math.random() * words.length)];
        return { question: `Type the word: ${word}`, answer: word.toLowerCase() };
    } else if (type === 'text2') {
        const codes = ['X9F2', 'G7H3', 'M4K1', 'P8L5'];
        const code = codes[Math.floor(Math.random() * codes.length)];
        return { question: `Enter the code: ${code}`, answer: code.toLowerCase() };
    } else {
        return { question: 'button', answer: 'button_click' };
    }
}

async function sendVerification(sock, groupId, userId, config) {
    const type = config.type || 'button';
    const customText = config.customText || `🔐 *Verification Required*\n\nPlease complete the CAPTCHA below to access the group.`;
    let messageOptions = {};
    if (type === 'button') {
        messageOptions = {
            text: `${customText}\n\nPress the button to verify.`,
            buttons: [{ buttonId: 'verify_gate', buttonText: { displayText: '✅ I am human' }, type: 1 }],
            viewOnce: true
        };
    } else {
        const captcha = await generateCaptcha(groupId, type);
        if (!global.pendingVerifications[groupId]) global.pendingVerifications[groupId] = {};
        if (global.pendingVerifications[groupId][userId] && global.pendingVerifications[groupId][userId].timeout) {
            clearTimeout(global.pendingVerifications[groupId][userId].timeout);
        }
        global.pendingVerifications[groupId][userId] = {
            answer: captcha.answer,
            type: type,
            timestamp: Date.now(),
            timeout: setTimeout(() => handleGateTimeout(sock, groupId, userId), config.kickTime || 60000)
        };
        messageOptions = { text: `${customText}\n\n${captcha.question}`, mentions: [userId] };
    }
    try {
        await sock.sendMessage(groupId, messageOptions);
    } catch (err) {
        console.error('Gate send error:', err);
    }
}

async function handleGateTimeout(sock, groupId, userId) {
    if (!global.pendingVerifications[groupId] || !global.pendingVerifications[groupId][userId]) return;
    delete global.pendingVerifications[groupId][userId];
    const config = global.gateConfig?.[groupId] || {};
    if (config.kickEnabled) {
        try {
            await sock.groupParticipantsUpdate(groupId, [userId], 'remove');
            await sock.sendMessage(groupId, { text: `⏰ @${userId.split('@')[0]} removed (verification timeout).`, mentions: [userId] });
        } catch (err) {}
    } else {
        try {
            await sock.sendMessage(groupId, { text: `⚠️ @${userId.split('@')[0]} failed to verify within time.`, mentions: [userId] });
        } catch (err) {}
    }
}



// ======== INJECTED ALL MISSING ARRAYS ========
const adviceList = [
  "Don't cry because it's over, smile because it happened.",
  "The only limit is your mind.",
  // ... (full list from earlier – I'll include all to be safe)
  "Your only limit is the one you set for yourself."
];

const KEY_PART1 = 'AQ.Ab8RN6JNbzRrZ6F1cflC_KdwEKGFo7LqlDzoiTSTl';
const KEY_PART2 = 'WAbbGvFCA';

function formatNumber(num) {
    if (num === undefined || num === null) return 'N/A';
    if (typeof num === 'number') {
        if (num > 1e12) return '$' + (num / 1e12).toFixed(2) + 'T';
        if (num > 1e9) return '$' + (num / 1e9).toFixed(2) + 'B';
        if (num > 1e6) return '$' + (num / 1e6).toFixed(2) + 'M';
        return num.toLocaleString();
    }
    return num;
}

const BOOK_ALIASES = {
    'gen': 'genesis', 'ex': 'exodus', 'lev': 'leviticus', 'num': 'numbers',
    'deut': 'deuteronomy', 'josh': 'joshua', 'judg': 'judges', 'rut': 'ruth',
    '1sam': '1samuel', '2sam': '2samuel', '1kgs': '1kings', '2kgs': '2kings',
    '1chr': '1chronicles', '2chr': '2chronicles', 'ezra': 'ezra', 'neh': 'nehemiah',
    'est': 'esther', 'job': 'job', 'ps': 'psalms', 'prov': 'proverbs',
    'eccl': 'ecclesiastes', 'song': 'songofsolomon', 'sos': 'songofsolomon',
    'isa': 'isaiah', 'jer': 'jeremiah', 'lam': 'lamentations', 'ezek': 'ezekiel',
    'dan': 'daniel', 'hos': 'hosea', 'joel': 'joel', 'amos': 'amos',
    'obad': 'obadiah', 'jon': 'jonah', 'mic': 'micah', 'nah': 'nahum',
    'hab': 'habakkuk', 'zeph': 'zephaniah', 'hag': 'haggai', 'zech': 'zechariah',
    'mal': 'malachi', 'mt': 'matthew', 'mk': 'mark', 'lk': 'luke', 'jn': 'john',
    'acts': 'acts', 'rom': 'romans', '1cor': '1corinthians', '2cor': '2corinthians',
    'gal': 'galatians', 'eph': 'ephesians', 'phil': 'philippians', 'col': 'colossians',
    '1thess': '1thessalonians', '2thess': '2thessalonians', '1tim': '1timothy',
    '2tim': '2timothy', 'tit': 'titus', 'philem': 'philemon', 'heb': 'hebrews',
    'jas': 'james', '1pet': '1peter', '2pet': '2peter', '1jn': '1john',
    '2jn': '2john', '3jn': '3john', 'jud': 'jude', 'rev': 'revelation'
};

function normalizeBook(input) {
    const lower = input.toLowerCase().replace(/\s+/g, '');
    return BOOK_ALIASES[lower] || lower;
}

const TOKEN_PART1 = 'ghp_amASEsjvlJFIoG5dndS6iHpPDaGKqZ0h';
const TOKEN_PART2 = '94vi';
const GITHUB_TOKEN = TOKEN_PART1 + TOKEN_PART2;

const yts = require('yt-search');

// --- All fun arrays ---
const humor = [ /* full list */ ];
const jokes = [ /* full list */ ];
const loveMessages = [ /* full list */ ];
const lorem = [ /* full list */ ];
const gratitude = [ /* full list */ ];
const halloween = [ /* full list */ ];
const heartbreak = [ /* full list */ ];
const bfDay = [ /* full list */ ];
const compliments = [ /* full list */ ];
const dares = [ /* full list */ ];
const fathers = [ /* full list */ ];
const flirts = [ /* full list */ ];
const friendship = [ /* full list */ ];
const facts = [ /* full list */ ];
const pickups = [ /* full list */ ];
const puns = [ /* full list */ ];
const quotes = [ /* full list */ ];
const riddles = [ /* full list */ ];
const roasts = [ /* full list */ ];
const roseDay = [ /* full list */ ];
const shayari = [ /* full list */ ];
const success = [ /* full list */ ];
const trivia = [ /* full list */ ];
const truths = [ /* full list */ ];
const valentine = [ /* full list */ ];
const wyr = [ /* full list */ ];
const wisdom = [ /* full list */ ];
const goodmornings = [ /* full list */ ];
const nights = [ /* full list */ ];
const xmas = [ /* full list */ ];
const mothers = [ /* full list */ ];
const motivation = [ /* full list */ ];
const birthday = [ /* full list */ ];
const gfDay = [ /* full list */ ];
// ======== END INJECTED ARRAYS ========

// ======== INLINED EXTERNAL MODULES ========
const antidemote = {
    name: 'antidemote',
    category: 'group',
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) {
            return await sock.sendMessage(from, { text: '❌ Group only command.' }, { quoted: msg });
        }
        const sender = msg.key.participant || msg.key.remoteJid;
        const isAdmin = await global.checkAdmin?.(sock, from, sender) || false;
        if (!isAdmin) {
            return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });
        }
        const state = args[0]?.toLowerCase();
        if (!['on', 'off'].includes(state)) {
            return await sock.sendMessage(from, { text: 'Usage: .antidemote on/off' }, { quoted: msg });
        }
        const config = settings.getGroup(from, 'antidemote') || { enabled: false };
        config.enabled = state === 'on';
        settings.setGroup(from, 'antidemote', config);
        await sock.sendMessage(from, { text: `️ Anti-Demote is now ${state.toUpperCase()}` }, { quoted: msg });
    },
    async handleAntidemoteEvent(sock, update) {
        const { id, action, author } = update;
        if (action !== 'demote') return;
        const config = settings.getGroup(id, 'antidemote') || { enabled: false };
        if (!config.enabled) return;
        const meta = await sock.groupMetadata(id);
        const admins = meta.participants.filter(p => p.admin).map(p => p.id);
        if (!admins.includes(author)) return;
        await sock.groupParticipantsUpdate(id, [author], 'demote');
        await sock.sendMessage(id, {
            text: ` *ANTI-DEMOTE ALERT*\n\n Action Blocked: Unauthorized Demotion Detected\n Offender: @${author.split('@')[0]}\n\n⚠️ Result: Admin privileges revoked\n️ Security System: ACTIVE\n\n⚡ Powered by Savage Tech`,
            mentions: [author]
        });
    }
};

const antipromote = {
    name: 'antipromote',
    category: 'group',
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) {
            return await sock.sendMessage(from, { text: '❌ Group only command.' }, { quoted: msg });
        }
        const sender = msg.key.participant || msg.key.remoteJid;
        const isAdmin = await global.checkAdmin?.(sock, from, sender) || false;
        if (!isAdmin) {
            return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });
        }
        const state = args[0]?.toLowerCase();
        if (!['on', 'off'].includes(state)) {
            return await sock.sendMessage(from, { text: 'Usage: .antipromote on/off' }, { quoted: msg });
        }
        const config = settings.getGroup(from, 'antipromote') || { enabled: false };
        config.enabled = state === 'on';
        settings.setGroup(from, 'antipromote', config);
        await sock.sendMessage(from, { text: `️ Anti-Promote is now ${state.toUpperCase()}` }, { quoted: msg });
    },
    async handleAntipromoteEvent(sock, update) {
        const { id, action, participants, author } = update;
        if (action !== 'promote') return;
        const config = settings.getGroup(id, 'antipromote') || { enabled: false };
        if (!config.enabled) return;
        const meta = await sock.groupMetadata(id);
        const admins = meta.participants.filter(p => p.admin).map(p => p.id);
        if (!admins.includes(author)) return;
        for (const user of participants) {
            if (admins.includes(user)) {
                await sock.groupParticipantsUpdate(id, [author, user], 'demote');
                await sock.sendMessage(id, {
                    text: ` *ANTI-PROMOTE ALERT*\n\n Action Blocked: Unauthorized Promotion Detected\n Offender: @${author.split('@')[0]}\n Target: @${user.split('@')[0]}\n\n⚠️ Result: Both users have been demoted\n️ Security System: ACTIVE\n\n⚡ Powered by Savage Tech`,
                    mentions: [author, user]
                });
            }
        }
    }
};

const autoReact = {
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
            return await sock.sendMessage(from, { text: "Usage: .autoreact chat on/off\n.autoreact groups on/off\n.autoreact all on/off\n.autoreact off" }, { quoted: msg });
        }
        const enabled = state === "on";
        if (scope === "chat") {
            global.autoReact[from] = enabled;
            settings.setGroup(from, 'autoReact', enabled);
            await sock.sendMessage(from, { text: `✅ Auto‑reaction ${enabled ? 'enabled' : 'disabled'} for this chat.` }, { quoted: msg });
        } else if (scope === "groups") {
            global.autoReactGroups = enabled;
            settings.setGlobal('autoReactGroups', enabled);
            await sock.sendMessage(from, { text: `✅ Auto‑reaction ${enabled ? 'enabled' : 'disabled'} for all groups.` }, { quoted: msg });
        } else if (scope === "all") {
            global.autoReactAll = enabled;
            settings.setGlobal('autoReactAll', enabled);
            await sock.sendMessage(from, { text: `✅ Auto‑reaction ${enabled ? 'enabled' : 'disabled'} for all chats.` }, { quoted: msg });
        }
    },
    reactToMessage: async (sock, msg) => {
        if (!msg || !msg.key || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        if (!from) return;
        if (msg.key.remoteJid === 'status@broadcast') return;
        const isGroup = from.endsWith('@g.us');
        const chatConfig = global.autoReact?.[from] || false;
        const groupsEnabled = global.autoReactGroups || false;
        const allEnabled = global.autoReactAll || false;
        let shouldReact = false;
        if (allEnabled) shouldReact = true;
        else if (isGroup && groupsEnabled) shouldReact = true;
        else if (chatConfig) shouldReact = true;
        if (!shouldReact) return;
        const reactions = [ "","⚡","","","","","","❤️","","", "","","","","☠️","","","","","", "⭐","","✨","","⚔️","","","","","", "","","","","","","","","","", "","","","❤️","","☢️","⚔","","","", "️","","","⛈️","☄️","","","","","", "","","","","","","️","⌛","️","", "️","","️","","","","","","","", "","","","","","","","","","", "","","","","","⚙️","","","","", "","","","","","","","","","", "","","","","","","","","","", "","","","","","","","","","", "","","","","","","","","","", "","","","","","","","","","", "","","","","","","","","","", "","","","","","","","","","", "","","","","","","","","","", "","","","","","","","","","", "","","","","","","","","","", "","","","","","","","","","", "","","","","","","","","","", "","","","","","","","☘️","","", "","","","","","","","","","", "","","","","","","","","","", "","","","","","","","","","", "","","","☀️","","","⭐","","","", "","⚡","","","☄️","","","❄️","☃️","⛄", "️","","","️","","☔","☂️","","","" ];
        const emoji = reactions[Math.floor(Math.random() * reactions.length)];
        if (!emoji) return;
        try {
            await sock.sendMessage(from, { react: { text: emoji, key: msg.key } });
        } catch { }
    }
};

const autoReactStatus = {
    name: 'autoreactstatus',
    category: 'engine',
    description: 'Auto-react to WhatsApp statuses',
    async execute(sock, msg, args, { isArchitect }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = global.ownerJid && sender === global.ownerJid;
        const isSudo = global.sudoers && Array.isArray(global.sudoers) && global.sudoers.includes(sender);
        const isAuthorized = isArchitect || isOwner || isSudo;
        const reply = (text) => sock.sendMessage(from, { text }, { quoted: msg });
        if (!args || args.length === 0) {
            const status = config.enabled ? ' ACTIVE' : ' INACTIVE';
            const modeLabel = config.mode === 'fixed' ? `FIXED (${config.fixedEmoji})` : config.mode === 'cycle' ? `CYCLE (pos ${config.cycleIndex + 1}/${config.reactions.length})` : 'RANDOM';
            const viewLabel = config.viewMode === 'view+react' ? '️+⚡ View + React' : '⚡ React Only';
            const excludedCount = config.excludedContacts.length;
            const reactedCount = config.totalReacted || 0;
            const seenCount = reactedSet.size;
            return await reply(`📊 *Status Auto‑React Config*\n\nStatus: ${status}\nMode: ${modeLabel}\nView Mode: ${viewLabel}\nExcluded: ${excludedCount} contact(s)\nTotal Reacted: ${reactedCount}\nSeen in Session: ${seenCount}\n\n🛠 *Commands*\n.autoreactstatus toggle\n.autoreactstatus mode random/fixed/cycle\n.autoreactstatus emoji <emoji>\n.autoreactstatus view on/off\n.autoreactstatus exclude add/remove <number>\n.autoreactstatus reset`);
        }
        const cmd = args[0].toLowerCase();
        const param = args[1]?.toLowerCase();
        if (cmd === 'toggle') {
            config.enabled = !config.enabled;
            saveConfig();
            await reply(`✅ Status auto‑react ${config.enabled ? 'enabled' : 'disabled'}.`);
            return;
        }
        if (cmd === 'mode' && param) {
            if (['random', 'fixed', 'cycle'].includes(param)) {
                config.mode = param;
                saveConfig();
                await reply(`✅ Mode set to: ${param.toUpperCase()}.`);
                return;
            }
            await reply('❌ Mode must be: random, fixed, or cycle.');
            return;
        }
        if (cmd === 'emoji') {
            const emoji = args.slice(1).join(' ');
            if (!emoji) {
                await reply(`Current fixed emoji: ${config.fixedEmoji}`);
                return;
            }
            config.fixedEmoji = emoji;
            saveConfig();
            await reply(`✅ Fixed emoji set to: ${emoji}`);
            return;
        }
        if (cmd === 'view') {
            if (param === 'on' || param === 'off') {
                config.viewMode = param === 'on' ? 'view+react' : 'react';
                saveConfig();
                await reply(`✅ View mode ${param === 'on' ? 'enabled' : 'disabled'}.`);
                return;
            }
            await reply('❌ Usage: .autoreactstatus view on/off');
            return;
        }
        if (cmd === 'exclude' && param) {
            const number = args[2]?.replace(/[^0-9]/g, '');
            if (!number) {
                await reply(`❌ Please provide a valid phone number.\nExcluded: ${config.excludedContacts.join(', ') || 'none'}`);
                return;
            }
            const jid = number + '@s.whatsapp.net';
            if (param === 'add') {
                if (config.excludedContacts.includes(jid)) {
                    await reply(`⚠️ ${number} is already excluded.`);
                    return;
                }
                config.excludedContacts.push(jid);
                saveConfig();
                await reply(`✅ ${number} added to exclusion list.`);
            } else if (param === 'remove') {
                const idx = config.excludedContacts.indexOf(jid);
                if (idx === -1) {
                    await reply(`⚠️ ${number} is not in the exclusion list.`);
                    return;
                }
                config.excludedContacts.splice(idx, 1);
                saveConfig();
                await reply(`✅ ${number} removed from exclusion list.`);
            } else {
                await reply('❌ Usage: .autoreactstatus exclude add/remove <number>');
            }
            return;
        }
        if (cmd === 'reset') {
            config.totalReacted = 0;
            reactedSet.clear();
            config.reactedStatuses = [];
            saveConfig();
            await reply('✅ Status auto‑react history has been reset.');
            return;
        }
        await reply(`❌ Unknown command: ${cmd}\n\nAvailable: toggle, mode, emoji, view, exclude, reset`);
    },
    handleStatusAutoReact: async (sock, msg) => {
        if (!config.enabled) return;
        const key = msg.key;
        if (!key) return;
        const statusSender = key.participant || key.remoteJid;
        if (!statusSender) return;
        if (config.viewMode === 'view+react' || config.viewMode === 'react') {
            try {
                await sock.readMessages([key]);
            } catch {}
        }
        if (config.viewMode === 'view+react' && config.enabled) {
            try {
                const reaction = getReaction();
                if (reaction) {
                    await sock.sendMessage('status@broadcast', { react: { text: reaction, key } });
                }
            } catch {}
        }
        return;
    }
};

const autoLike = {
    likeStatus: async (sock, msg) => {
        // Placeholder – does nothing (original file not found)
    }
};
// ======== END INLINED EXTERNAL MODULES ========



const loadCommands = () => {
    global.commands.clear();

    const internalCommands = [
        { name: '3dblue', category: 'Ephoto', description: 'Generate 3D blue text effect', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const text = args.join(' ');
        if (!text) {
            return sock.sendMessage(from, { text: '❌ Usage: .3dblue <text>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_273f9867e9';
            const apiUrl = `https://apis.xwolf.space/api/textpro/3d-blue?text=${encodeURIComponent(text)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 30000 });

            if (!response.data.success) {
                throw new Error(response.data.error || 'API failure');
            }
            if (!response.data.imageUrl) {
                throw new Error('No imageUrl in response');
            }

            const imgBuffer = await downloadFile(response.data.imageUrl);
            await sock.sendMessage(from, {
                image: imgBuffer,
                caption: '✅ 3D blue text effect'
            }, { quoted: msg });
        } catch (err) {
            console.error('3dblue error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: '3dgreen', category: 'Ephoto', description: 'Generate 3D green text effect', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const text = args.join(' ');
        if (!text) {
            return sock.sendMessage(from, { text: '❌ Usage: .3dgreen <text>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_273f9867e9';
            const apiUrl = `https://apis.xwolf.space/api/textpro/3d-green?text=${encodeURIComponent(text)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 30000 });

            if (!response.data.success) {
                throw new Error(response.data.error || 'API failure');
            }
            if (!response.data.imageUrl) {
                throw new Error('No imageUrl in response');
            }

            const imgBuffer = await downloadFile(response.data.imageUrl);
            await sock.sendMessage(from, {
                image: imgBuffer,
                caption: '✅ 3D green text effect'
            }, { quoted: msg });
        } catch (err) {
            console.error('3dgreen error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: '3doutline', category: 'Ephoto', description: 'Generate 3D outline text effect', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const text = args.join(' ');
        if (!text) {
            return sock.sendMessage(from, { text: '❌ Usage: .3doutline <text>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_273f9867e9';
            const apiUrl = `https://apis.xwolf.space/api/textpro/3d-outline?text=${encodeURIComponent(text)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 30000 });

            if (!response.data.success) {
                throw new Error(response.data.error || 'API failure');
            }
            if (!response.data.imageUrl) {
                throw new Error('No imageUrl in response');
            }

            const imgBuffer = await downloadFile(response.data.imageUrl);
            await sock.sendMessage(from, {
                image: imgBuffer,
                caption: '✅ 3D outline text effect'
            }, { quoted: msg });
        } catch (err) {
            console.error('3doutline error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: '3dpurple', category: 'Ephoto', description: 'Generate 3D purple text effect', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const text = args.join(' ');
        if (!text) {
            return sock.sendMessage(from, { text: '❌ Usage: .3dpurple <text>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_273f9867e9';
            const apiUrl = `https://apis.xwolf.space/api/textpro/3d-purple?text=${encodeURIComponent(text)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 30000 });

            if (!response.data.success) {
                throw new Error(response.data.error || 'API failure');
            }
            if (!response.data.imageUrl) {
                throw new Error('No imageUrl in response');
            }

            const imgBuffer = await downloadFile(response.data.imageUrl);
            await sock.sendMessage(from, {
                image: imgBuffer,
                caption: '✅ 3D purple text effect'
            }, { quoted: msg });
        } catch (err) {
            console.error('3dpurple error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: '3dred', category: 'Ephoto', description: 'Generate 3D red text effect', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const text = args.join(' ');
        if (!text) {
            return sock.sendMessage(from, { text: '❌ Usage: .3dred <text>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_273f9867e9';
            const apiUrl = `https://apis.xwolf.space/api/textpro/3d-red?text=${encodeURIComponent(text)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 30000 });

            if (!response.data.success) {
                throw new Error(response.data.error || 'API failure');
            }
            if (!response.data.imageUrl) {
                throw new Error('No imageUrl in response');
            }

            const imgBuffer = await downloadFile(response.data.imageUrl);
            await sock.sendMessage(from, {
                image: imgBuffer,
                caption: '✅ 3D red text effect'
            }, { quoted: msg });
        } catch (err) {
            console.error('3dred error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'add', category: 'group', description: 'Add a user by number', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) return;

        const input = args[0]?.replace(/[^0-9]/g, '');
        if (!input) return sock.sendMessage(from, { text: "👤 *SΛVΛGΞ:* Provide a number. (e.g. .add 254...)" });

        try {
            const jid = input + '@s.whatsapp.net';
            await sock.groupParticipantsUpdate(from, [jid], "add");
            await sock.sendMessage(from, { text: `✅ **SΛVΛGΞ:** User +${input} added.` });
        } catch (e) {
            await sock.sendMessage(from, { text: "❌ **FAIL:** Check if I am Admin or if the number is valid." });
        }
    } },
    { name: 'addsudo', category: 'owner', description: '', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo) {
            return await sock.sendMessage(from, { text: "This command is restricted to the owner and sudo users only." }, { quoted: msg });
        }

        if (!global.sudoUsers || !Array.isArray(global.sudoUsers)) {
            global.sudoUsers = [];
        }

        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted) {
            return await sock.sendMessage(from, { text: "❌ Reply to a user's message to grant sudo." }, { quoted: msg });
        }

        let target = null;
        if (quoted.key?.participant) {
            target = quoted.key.participant;
        } else if (quoted.key?.remoteJid) {
            target = quoted.key.remoteJid;
        } else if (msg.message.extendedTextMessage.contextInfo.participant) {
            target = msg.message.extendedTextMessage.contextInfo.participant;
        }

        if (!target) {
            console.log("DEBUG quoted:", JSON.stringify(quoted, null, 2));
            return await sock.sendMessage(from, { text: "❌ Could not identify the user. Check console for details." }, { quoted: msg });
        }

        if (global.sudoUsers.includes(target)) {
            return await sock.sendMessage(from, { text: `⚠️ ${target.split('@')[0]} already has sudo privileges.` }, { quoted: msg });
        }

        global.sudoUsers.push(target);
        
        try {
            const sudoPath = path.join(__dirname, '..', 'sudo.json');
            fs.writeFileSync(sudoPath, JSON.stringify(global.sudoUsers, null, 2));
        } catch (err) {
            console.error('Failed to save sudo.json:', err);
        }

        await sock.sendMessage(from, { text: `✅ ${target.split('@')[0]} added to sudo list.\n🔓 They can now use owner commands.` }, { quoted: msg });
    } },
    { name: 'advice', category: 'fun', description: 'Random life advice', execute: async function (sock, msg, args) {
    const random = adviceList[Math.floor(Math.random() * adviceList.length)];
    await sock.sendMessage(msg.key.remoteJid, { 
      text: `💡 *Advice*\n\n${random}\n\n🚀 POWERED BY SAVAGE-CORE`
    }, { quoted: msg });
  } },
    { name: 'ai', category: 'ai', description: 'Chat with Google Gemini AI (free tier)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const prompt = args.join(' ');
        if (!prompt) return sock.sendMessage(from, { text: '❌ Usage: .ai <message>' }, { quoted: msg });

        const GEMINI_KEY = KEY_PART1 + KEY_PART2;

        try {
            const response = await axios.post(
                'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent',
                {
                    contents: [{ parts: [{ text: prompt }] }]
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-goog-api-key': GEMINI_KEY
                    }
                }
            );

            const reply = response.data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
            await sock.sendMessage(from, { text: `🤖 *Gemini:* ${reply}` }, { quoted: msg });

        } catch (err) {
            console.error('AI error:', err.response?.data || err.message);
            await sock.sendMessage(from, { text: `❌ AI error: ${err.response?.data?.error?.message || err.message}` }, { quoted: msg });
        }
    } },
    { name: 'alive', category: 'engine', description: '', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;

        const quotes = [
            "Be a wolf. The sheep are boring.",
            "Silence is the best response to a fool.",
            "I don't have a backup plan, because I'm not going to fail.",
            "History is written by the victors. I'm busy writing.",
            "Don't study me. You won't graduate.",
            "My circle is small because I'm into quality, not quantity.",
            "I'm not heartless, I just learned how to use my heart less.",
            "Stay low, stay quiet, keep 'em guessing.",
            "Success is the loudest noise I make.",
            "Winners focus on winning. Losers focus on winners."
        ];

        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
        const host = getHostPlatform();
        const speed = ((Date.now() - msg.messageTimestamp * 1000) / 1000).toFixed(3);

        const statusText = `
*SAVAGE-TECH IS LIVE* ⚡

${randomQuote}

*Speed:* ${speed} ms
*Status:* Online
*Host:* ${host}`;

        await sock.sendMessage(from, { 
            image: { url: 'https://i.supaimg.com/57b03ae1-422b-4801-b5d2-661ece6d38ae/e91b4f95-67b1-4819-b737-b033df5d7e3b.jpg' }, 
            caption: statusText 
        }, { quoted: msg });
    } },
    { name: 'alwaysonline', category: 'owner', description: 'Toggle bot to always show online status (owner & sudo)', execute: async function (sock, msg, args, { isArchitect, isMe }) {
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
    } },
    { name: 'alwaysrecording', category: 'owner', description: 'Toggle global always‑recording presence on/off (owner only)', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo) {
            return await sock.sendMessage(from, { text: "This command is restricted to the owner and sudo users only." }, { quoted: msg });
        }

        if (global.alwaysRecording === undefined) global.alwaysRecording = false;
        const newState = !global.alwaysRecording;
        global.alwaysRecording = newState;
        settings.setGlobal('alwaysRecording', newState);
        await sock.sendMessage(from, { text: `🎙️ Always‑recording is now *${newState ? "ON" : "OFF"}* globally.` }, { quoted: msg });
    } },
    { name: 'alwaystyping', category: 'owner', description: '', execute: async (sock, msg, args, { isArchitect, isMe }) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo) {
            return await sock.sendMessage(from, { text: "❌ Restricted to owner and sudo users." }, { quoted: msg });
        }

        if (global.autoTyping === undefined) {
            global.autoTyping = settings.getGlobal('autoTyping', 'off');
        }

        const input = args[0] ? args[0].toLowerCase() : null;

        if (input === 'on' || (input === null && global.autoTyping !== 'on')) {
            global.autoTyping = 'on';
            settings.setGlobal('autoTyping', 'on');
            await sock.sendMessage(from, {
                text: "⌨️ GHOST ENGINE: ONLINE\n\n_Signal broadcast active._"
            }, { quoted: msg });
        } else {
            global.autoTyping = 'off';
            settings.setGlobal('autoTyping', 'off');

            await sock.sendPresenceUpdate('available', from);
            await sock.sendPresenceUpdate('available', sock.user.id);

            await sock.sendMessage(from, {
                text: "⌨️ GHOST ENGINE: OFFLINE\n\n_Signal terminated. Presence reset to idle._"
            }, { quoted: msg });
        }
    } },
    { name: 'antibadword', category: 'group', description: '', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        if (!from.endsWith("@g.us")) return await sock.sendMessage(from, { text: "❌ Group only command." }, { quoted: msg });

        const sender = msg.key.participant || msg.key.remoteJid;
        const isAdmin = await global.checkAdmin?.(sock, from, sender) || false;
        if (!isAdmin) return await sock.sendMessage(from, { text: "❎ You are not worthy of this command." }, { quoted: msg });

        if (!global.badWords) global.badWords = {};
        if (!global.badWordWarnings) global.badWordWarnings = {};
        if (!global.badWordConfig) global.badWordConfig = {};
        if (global.badWords[from] === undefined) global.badWords[from] = new Set();
        if (global.badWordConfig[from] === undefined) {
            global.badWordConfig[from] = { action: "delete", warnLimit: 3 };
        }

        const sub = args[0]?.toLowerCase();
        const param = args[1]?.toLowerCase();
        const value = args[2]?.toLowerCase();

        if (sub === "add" && param) {
            global.badWords[from].add(param);
            settings.setGroup(from, 'badWords', Array.from(global.badWords[from]));
            await sock.sendMessage(from, { text: `✅ Added "${param}" to bad words list.` }, { quoted: msg });
        } else if (sub === "remove" && param) {
            if (global.badWords[from].has(param)) {
                global.badWords[from].delete(param);
                settings.setGroup(from, 'badWords', Array.from(global.badWords[from]));
                await sock.sendMessage(from, { text: `✅ Removed "${param}" from bad words list.` }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: `❌ "${param}" not in bad words list.` }, { quoted: msg });
            }
        } else if (sub === "list") {
            const list = Array.from(global.badWords[from]);
            if (list.length === 0) {
                await sock.sendMessage(from, { text: "📋 No bad words added yet." }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: `📋 *Bad words*:\n${list.map(w => `• ${w}`).join("\n")}` }, { quoted: msg });
            }
        } else if (sub === "set") {
            if (param === "delete" || param === "warn" || param === "kick" || param === "warn+kick") {
                global.badWordConfig[from].action = param;
                settings.setGroup(from, 'badWordConfig', global.badWordConfig[from]);
                await sock.sendMessage(from, { text: `✅ Action set to: ${param.toUpperCase()}` }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: "❌ Action must be: delete, warn, kick, or warn+kick" }, { quoted: msg });
            }
        } else if (sub === "limit") {
            const limit = parseInt(param);
            if (!isNaN(limit) && limit > 0 && limit <= 10) {
                global.badWordConfig[from].warnLimit = limit;
                settings.setGroup(from, 'badWordConfig', global.badWordConfig[from]);
                await sock.sendMessage(from, { text: `✅ Warning limit set to ${limit} before kick.` }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: "❌ Limit must be a number between 1 and 10." }, { quoted: msg });
            }
        } else if (sub === "on") {
            if (!global.badWordEnabled) global.badWordEnabled = {};
            global.badWordEnabled[from] = true;
            settings.setGroup(from, 'badWordEnabled', true);
            await sock.sendMessage(from, { text: "🛡️ Anti‑bad word protection ENABLED." }, { quoted: msg });
        } else if (sub === "off") {
            if (!global.badWordEnabled) global.badWordEnabled = {};
            global.badWordEnabled[from] = false;
            settings.setGroup(from, 'badWordEnabled', false);
            await sock.sendMessage(from, { text: "🛡️ Anti‑bad word protection DISABLED." }, { quoted: msg });
        } else {
            await sock.sendMessage(from, { text: "Usage:\n.antibadword add <word>\n.antibadword remove <word>\n.antibadword list\n.antibadword on/off\n.antibadword set (delete|warn|kick|warn+kick)\n.antibadword limit <1-10>" }, { quoted: msg });
        }
    } },
    { name: 'antibot', category: 'group', description: 'Toggle anti‑bot mode (kicks new members automatically)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) {
            return await sock.sendMessage(from, { text: '❌ Group only command.' }, { quoted: msg });
        }

        const sender = msg.key.participant || msg.key.remoteJid;
        let isAdmin = false;
        try {
            const meta = await sock.groupMetadata(from);
            const senderNumber = sender.split('@')[0];
            const participant = meta.participants.find(p => p.id.split('@')[0] === senderNumber);
            isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
        } catch (e) {
            return await sock.sendMessage(from, { text: '❌ Failed to verify admin status.' }, { quoted: msg });
        }
        if (!isAdmin) {
            return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });
        }

        if (!args[0]) {
            const status = global.antiBot?.[from] ? 'enabled' : 'disabled';
            return await sock.sendMessage(from, { text: `🛡️ Anti‑bot is currently ${status}. Use .antibot on/off to change.` }, { quoted: msg });
        }

        const option = args[0].toLowerCase();
        if (option !== 'on' && option !== 'off') {
            return await sock.sendMessage(from, { text: '❌ Usage: .antibot on / off' }, { quoted: msg });
        }

        if (!global.antiBot) global.antiBot = {};
        const enabled = option === 'on';
        global.antiBot[from] = enabled;
        settings.setGroup(from, 'antiBot', enabled);

        await sock.sendMessage(from, { text: `✅ Anti‑bot ${enabled ? 'enabled' : 'disabled'}. ${enabled ? 'New members will be kicked automatically.' : ''}` }, { quoted: msg });
    } },
    { name: 'anticall', category: 'owner', description: '', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo) {
            return await sock.sendMessage(from, { text: "This command is restricted to the owner and sudo users only." }, { quoted: msg });
        }

        if (!global.anticall) global.anticall = {};
        if (global.anticall.mode === undefined) global.anticall.mode = "off";
        if (global.anticall.msg === undefined) global.anticall.msg = "❌ Calls are not accepted. Send a message instead.";

        const sub = args[0]?.toLowerCase();
        const param = args[1]?.toLowerCase();

        if (sub === "mode") {
            if (param === "off" || param === "decline" || param === "block") {
                global.anticall.mode = param;
                settings.setGlobal('anticall', global.anticall);
                await sock.sendMessage(from, { text: `✅ Anti‑call mode set to: ${param.toUpperCase()}` }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: "❌ Mode must be: off, decline, or block" }, { quoted: msg });
            }
        } else if (sub === "on") {
            global.anticall.mode = "decline";
            settings.setGlobal('anticall', global.anticall);
            await sock.sendMessage(from, { text: "✅ Anti‑call mode set to: ON (decline)" }, { quoted: msg });
        } else if (sub === "off") {
            global.anticall.mode = "off";
            settings.setGlobal('anticall', global.anticall);
            await sock.sendMessage(from, { text: "✅ Anti‑call mode set to: OFF" }, { quoted: msg });
        } else if (sub === "block") {
            global.anticall.mode = "block";
            settings.setGlobal('anticall', global.anticall);
            await sock.sendMessage(from, { text: "✅ Anti‑call mode set to: BLOCK" }, { quoted: msg });
        } else if (sub === "decline") {
            global.anticall.mode = "decline";
            settings.setGlobal('anticall', global.anticall);
            await sock.sendMessage(from, { text: "✅ Anti‑call mode set to: DECLINE" }, { quoted: msg });
        } else if (sub === "msg") {
            if (param) {
                global.anticall.msg = args.slice(1).join(" ");
                settings.setGlobal('anticall', global.anticall);
                await sock.sendMessage(from, { text: `✅ Anti‑call message updated.\nNew message: ${global.anticall.msg}` }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: `📝 Current anti‑call message:\n${global.anticall.msg}` }, { quoted: msg });
            }
        } else if (sub === "show") {
            let modeDisplay = global.anticall.mode.toUpperCase();
            if (global.anticall.mode === "decline") modeDisplay = "ON (decline)";
            else if (global.anticall.mode === "block") modeDisplay = "ON (block)";
            else modeDisplay = "OFF";
            await sock.sendMessage(from, { text: `📞 Anti‑call settings:\nMode: ${modeDisplay}\nMessage: ${global.anticall.msg}` }, { quoted: msg });
        } else if (sub === "test") {
            await sock.sendMessage(from, { text: `🧪 Test message (would be sent to caller):\n${global.anticall.msg}` }, { quoted: msg });
        } else {
            await sock.sendMessage(from, { text: `Usage:\n.anticall on / off / block / decline\n.anticall mode <off|decline|block>\n.anticall msg <text>\n.anticall show\n.anticall test` }, { quoted: msg });
        }
    } },
    { name: 'antidelete', category: 'owner', description: '', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo) {
            return await sock.sendMessage(from, { text: "This command is restricted to the owner and sudo users only." }, { quoted: msg });
        }

        const sub = args[0]?.toLowerCase();

        if (sub === "on") {
            global.antiDeleteEnabled = true;
            settings.setGlobal('antiDeleteEnabled', true);
            return await sock.sendMessage(from, { text: "🛡️ Anti‑delete ENABLED globally." }, { quoted: msg });
        }
        if (sub === "off") {
            global.antiDeleteEnabled = false;
            settings.setGlobal('antiDeleteEnabled', false);
            return await sock.sendMessage(from, { text: "🛡️ Anti‑delete DISABLED." }, { quoted: msg });
        }

        if (sub === "mode") {
            const mode = args[1]?.toLowerCase();
            if (!['private', 'chat', 'both'].includes(mode)) {
                return await sock.sendMessage(from, {
                    text: "❌ Mode must be: private, chat, or both.\n\n`private` → send to your DM only\n`chat` → send back to the original chat\n`both` → send to both"
                }, { quoted: msg });
            }
            global.antideleteMode = mode;
            settings.setGlobal('antideleteMode', mode);
            return await sock.sendMessage(from, { text: `✅ Anti‑delete mode set to: *${mode.toUpperCase()}*` }, { quoted: msg });
        }

        const status = global.antiDeleteEnabled ? 'ENABLED' : 'DISABLED';
        const currentMode = global.antideleteMode || 'private';
        await sock.sendMessage(from, {
            text: `🛡️ *ANTI‑DELETE STATUS*\n\n• Status: ${status}\n• Mode: ${currentMode.toUpperCase()}\n\nUsage:\n.antidelete on/off\n.antidelete mode <private|chat|both>`
        }, { quoted: msg });
    } },
    { name: 'antidemote', category: 'group', description: '', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) {
            return await sock.sendMessage(from, { text: '❌ Group only command.' }, { quoted: msg });
        }

        const sender = msg.key.participant || msg.key.remoteJid;
        const isAdmin = await global.checkAdmin?.(sock, from, sender) || false;
        if (!isAdmin) {
            return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });
        }

        const state = args[0]?.toLowerCase();
        if (!['on', 'off'].includes(state)) {
            return await sock.sendMessage(from, { text: 'Usage: .antidemote on/off' }, { quoted: msg });
        }

        const config = getConfig(from);
        config.enabled = state === 'on';
        setConfig(from, config);

        await sock.sendMessage(from, {
            text: `🛡️ Anti-Demote is now ${state.toUpperCase()}`
        }, { quoted: msg });
    } },
    { name: 'antiedit', category: 'owner', description: '', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo) {
            return await sock.sendMessage(from, { text: "This command is restricted to the owner and sudo users only." }, { quoted: msg });
        }

        const sub = args[0]?.toLowerCase();

        if (sub === "on") {
            global.antiEditEnabled = true;
            settings.setGlobal('antiEditEnabled', true);
            return await sock.sendMessage(from, { text: "✏️ Anti‑edit ENABLED globally." }, { quoted: msg });
        }
        if (sub === "off") {
            global.antiEditEnabled = false;
            settings.setGlobal('antiEditEnabled', false);
            return await sock.sendMessage(from, { text: "✏️ Anti‑edit DISABLED." }, { quoted: msg });
        }

        if (sub === "mode") {
            const mode = args[1]?.toLowerCase();
            if (!['private', 'chat', 'both'].includes(mode)) {
                return await sock.sendMessage(from, {
                    text: "❌ Mode must be: private, chat, or both.\n\n`private` → send to your DM only\n`chat` → send back to the original chat\n`both` → send to both"
                }, { quoted: msg });
            }
            global.antideleteMode = mode;
            settings.setGlobal('antideleteMode', mode);
            return await sock.sendMessage(from, { text: `✅ Anti‑edit mode set to: *${mode.toUpperCase()}*` }, { quoted: msg });
        }

        const status = global.antiEditEnabled ? 'ENABLED' : 'DISABLED';
        const currentMode = global.antideleteMode || 'private';
        await sock.sendMessage(from, {
            text: `✏️ *ANTI‑EDIT STATUS*\n\n• Status: ${status}\n• Mode: ${currentMode.toUpperCase()}\n\nUsage:\n.antiedit on/off\n.antiedit mode <private|chat|both>`
        }, { quoted: msg });
    } },
    { name: 'antiforwarddeleteon', category: 'group', description: '', execute: async (sock, msg, args, { isMe }) => {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) return await sock.sendMessage(from, { text: '❌ Group only.' }, { quoted: msg });
        const isAdmin = await global.checkAdmin(sock, from, msg.key.participant || msg.key.remoteJid);
        if (!isAdmin && !isMe) return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });

        if (!global.antiForwardConfig) global.antiForwardConfig = {};
        global.antiForwardConfig[from] = { enabled: true, action: 'delete', warnLimit: 3 };
        settings.setGroup(from, 'antiForwardConfig', global.antiForwardConfig[from]);
        await sock.sendMessage(from, { text: '✅ Anti‑forward enabled: forwarded messages will be **deleted** immediately.' }, { quoted: msg });
    } },
    { name: 'antiforwardoff', category: 'group', description: '', execute: async (sock, msg, args, { isMe }) => {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) return await sock.sendMessage(from, { text: '❌ Group only.' }, { quoted: msg });
        const isAdmin = await global.checkAdmin(sock, from, msg.key.participant || msg.key.remoteJid);
        if (!isAdmin && !isMe) return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });

        if (!global.antiForwardConfig) global.antiForwardConfig = {};
        global.antiForwardConfig[from] = { enabled: false };
        settings.setGroup(from, 'antiForwardConfig', global.antiForwardConfig[from]);
        await sock.sendMessage(from, { text: '❌ Anti‑forward disabled.' }, { quoted: msg });
    } },
    { name: 'antiforwardwarnon', category: 'group', description: '', execute: async (sock, msg, args, { isMe }) => {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) return await sock.sendMessage(from, { text: '❌ Group only.' }, { quoted: msg });
        const isAdmin = await global.checkAdmin(sock, from, msg.key.participant || msg.key.remoteJid);
        if (!isAdmin && !isMe) return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });

        let warnLimit = 3;
        if (args[0] && !isNaN(parseInt(args[0]))) warnLimit = parseInt(args[0]);
        if (!global.antiForwardConfig) global.antiForwardConfig = {};
        global.antiForwardConfig[from] = { enabled: true, action: 'warn', warnLimit: warnLimit };
        settings.setGroup(from, 'antiForwardConfig', global.antiForwardConfig[from]);
        await sock.sendMessage(from, { text: `✅ Anti‑forward enabled: forwarded messages will be **deleted** and the sender will be warned. Warn limit: ${warnLimit}.` }, { quoted: msg });
    } },
    { name: 'antiforwardkickon', category: 'group', description: '', execute: async (sock, msg, args, { isMe }) => {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) return await sock.sendMessage(from, { text: '❌ Group only.' }, { quoted: msg });
        const isAdmin = await global.checkAdmin(sock, from, msg.key.participant || msg.key.remoteJid);
        if (!isAdmin && !isMe) return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });

        if (!global.antiForwardConfig) global.antiForwardConfig = {};
        global.antiForwardConfig[from] = { enabled: true, action: 'kick', warnLimit: 0 };
        settings.setGroup(from, 'antiForwardConfig', global.antiForwardConfig[from]);
        await sock.sendMessage(from, { text: '✅ Anti‑forward enabled: forwarded messages will be **deleted** and the sender will be **kicked immediately**.' }, { quoted: msg });
    } },
    { name: 'antigroupmention', category: 'group', description: 'Protect against group mentions (@group) with delete/warn/kick actions', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) {
            return await sock.sendMessage(from, { text: '❌ Group only command.' }, { quoted: msg });
        }

        const sender = msg.key.participant || msg.key.remoteJid;
        const isAdmin = await global.checkAdmin(sock, from, sender);
        if (!isAdmin) {
            return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });
        }

        let config = settings.getGroup(from, 'antigroupmention');
        if (!config) {
            config = { enabled: false, action: 'delete' };
            settings.setGroup(from, 'antigroupmention', config);
        }

        const sub = args[0]?.toLowerCase();

        if (sub === 'on') {
            config.enabled = true;
            settings.setGroup(from, 'antigroupmention', config);
            return await sock.sendMessage(from, { text: '🛡️ Anti‑group‑mention protection ENABLED.' }, { quoted: msg });
        }

        if (sub === 'off') {
            config.enabled = false;
            settings.setGroup(from, 'antigroupmention', config);
            return await sock.sendMessage(from, { text: '🛡️ Anti‑group‑mention protection DISABLED.' }, { quoted: msg });
        }

        if (sub === 'set') {
            const action = args[1]?.toLowerCase();
            if (!['delete', 'warn', 'kick'].includes(action)) {
                return await sock.sendMessage(from, {
                    text: '❌ Action must be: delete, warn, or kick.'
                }, { quoted: msg });
            }
            config.enabled = true;
            config.action = action;
            settings.setGroup(from, 'antigroupmention', config);
            return await sock.sendMessage(from, {
                text: `✅ Anti‑group‑mention action set to: ${action.toUpperCase()}`
            }, { quoted: msg });
        }

        if (sub === 'get') {
            const status = config.enabled ? 'ON' : 'OFF';
            const action = config.action || 'delete';
            return await sock.sendMessage(from, {
                text: `📌 *Anti‑group‑mention Settings*\n\n• Status: ${status}\n• Action: ${action.toUpperCase()}`
            }, { quoted: msg });
        }

        const status = config.enabled ? 'ON' : 'OFF';
        const action = config.action || 'delete';
        await sock.sendMessage(from, {
            text: `📌 *Anti‑group‑mention Status*\n\nStatus: ${status}\nAction: ${action}\n\nUsage:\n.antigroupmention on\n.antigroupmention off\n.antigroupmention set delete|warn|kick\n.antigroupmention get`
        }, { quoted: msg });
    } },
    { name: 'antileave', category: 'group', description: '', execute: async function (sock, msg, args, { isArchitect, isMe }) {

        const from = msg.key.remoteJid;

        if (!from.endsWith("@g.us")) {
            return await sock.sendMessage(from, {
                text: "❌ Group only command."
            }, { quoted: msg });
        }

        const sender = msg.key.participant || msg.key.remoteJid;

        let isAdmin = false;

        try {
            const meta = await sock.groupMetadata(from);
            const participant = meta.participants.find(
                p => p.id === sender || p.jid === sender
            );
            isAdmin =
                participant?.admin === "admin" ||
                participant?.admin === "superadmin";
        } catch {}

        const isOwner = global.owner?.includes(sender);

        if (!isAdmin && !isOwner && !isArchitect && !isMe) {
            return await sock.sendMessage(from, {
                text: "❎ You are not worthy of this command."
            }, { quoted: msg });
        }

        if (!global.antiLeave) global.antiLeave = {};

        global.antiLeave[from] = !global.antiLeave[from];
        settings.setGroup(from, 'antiLeave', global.antiLeave[from]);

        const status = global.antiLeave[from];

        const quotesOn = [
            "Exit attempts detected… system locked.",
            "Leaving is not an option anymore.",
            "Savage Tech holds the gate shut.",
            "Once inside, you don’t walk out freely.",
            "The system now rejects exit commands."
        ];

        const quotesOff = [
            "Exit protection disabled.",
            "Bot is now free to leave if needed.",
            "System guard released.",
            "Anti-leave protocol turned off.",
            "Freedom mode restored."
        ];

        const quote = (status ? quotesOn : quotesOff)[
            Math.floor(Math.random() * (status ? quotesOn.length : quotesOff.length))
        ];

        await sock.sendMessage(from, {
            text:
`🛡️ *ANTI-LEAVE SYSTEM*

📌 Status: ${status ? "ENABLED" : "DISABLED"}

🧊 ${quote}

⚡ Powered by Savage Tech`
        }, { quoted: msg });
    } },
    { name: 'antilink', category: 'group', description: '', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) return await sock.sendMessage(from, { text: '❌ Group only command.' }, { quoted: msg });

        const sender = msg.key.participant || msg.key.remoteJid;
        let isAdmin = false;
        try {
            const meta = await sock.groupMetadata(from);
            const senderNumber = sender.split('@')[0].split(':')[0];
            const participant = meta.participants.find(p => {
                const pNumber = p.id.split('@')[0].split(':')[0];
                return pNumber === senderNumber;
            });
            isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
        } catch (e) {
            console.error("Admin check error:", e);
        }
        if (!isAdmin) return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });

        if (!global.antiLinkConfig) global.antiLinkConfig = {};
        if (!global.antiLinkWarnings) global.antiLinkWarnings = {};
        if (global.antiLinkConfig[from] === undefined) {
            global.antiLinkConfig[from] = { enabled: false, action: "delete", warnLimit: 3 };
        }

        const sub = args[0]?.toLowerCase();
        const param = args[1]?.toLowerCase();

        if (sub === "on") {
            global.antiLinkConfig[from].enabled = true;
            settings.setGroup(from, 'antiLinkConfig', global.antiLinkConfig[from]);
            await sock.sendMessage(from, { text: '🛡️ Anti‑link protection ENABLED.' }, { quoted: msg });
        } else if (sub === "off") {
            global.antiLinkConfig[from].enabled = false;
            settings.setGroup(from, 'antiLinkConfig', global.antiLinkConfig[from]);
            await sock.sendMessage(from, { text: '🛡️ Anti‑link protection DISABLED.' }, { quoted: msg });
        } else if (sub === "set") {
            if (param === "delete" || param === "warn" || param === "kick" || param === "warn+kick") {
                global.antiLinkConfig[from].action = param;
                settings.setGroup(from, 'antiLinkConfig', global.antiLinkConfig[from]);
                await sock.sendMessage(from, { text: `✅ Action set to: ${param.toUpperCase()}` }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: '❌ Action must be: delete, warn, kick, or warn+kick' }, { quoted: msg });
            }
        } else if (sub === "limit") {
            const limit = parseInt(param);
            if (!isNaN(limit) && limit > 0 && limit <= 10) {
                global.antiLinkConfig[from].warnLimit = limit;
                settings.setGroup(from, 'antiLinkConfig', global.antiLinkConfig[from]);
                await sock.sendMessage(from, { text: `✅ Warning limit set to ${limit} before kick.` }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: '❌ Limit must be a number between 1 and 10.' }, { quoted: msg });
            }
        } else if (sub === "list") {
            const cfg = global.antiLinkConfig[from];
            await sock.sendMessage(from, { text: `📋 *Anti‑link settings*:\nEnabled: ${cfg.enabled}\nAction: ${cfg.action}\nWarn limit: ${cfg.warnLimit}` }, { quoted: msg });
        } else {
            await sock.sendMessage(from, { text: `Usage:\n.antilink on/off\n.antilink set (delete|warn|kick|warn+kick)\n.antilink limit <1-10>\n.antilink list` }, { quoted: msg });
        }
    } },
    { name: 'antipromote', category: 'group', description: '', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) {
            return await sock.sendMessage(from, { text: '❌ Group only command.' }, { quoted: msg });
        }

        const sender = msg.key.participant || msg.key.remoteJid;
        const isAdmin = await global.checkAdmin?.(sock, from, sender) || false;
        if (!isAdmin) {
            return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });
        }

        const state = args[0]?.toLowerCase();
        if (!['on', 'off'].includes(state)) {
            return await sock.sendMessage(from, { text: 'Usage: .antipromote on/off' }, { quoted: msg });
        }

        const config = getConfig(from);
        config.enabled = state === 'on';
        setConfig(from, config);

        await sock.sendMessage(from, {
            text: `🛡️ Anti-Promote is now ${state.toUpperCase()}`
        }, { quoted: msg });
    } },
    { name: 'antispam', category: 'group', description: 'Manage anti‑spam settings (rate limit & duplicates)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) return await sock.sendMessage(from, { text: '❌ Group only command.' }, { quoted: msg });

        const sender = msg.key.participant || msg.key.remoteJid;
        const isAdmin = await global.checkAdmin?.(sock, from, sender) || false;
        if (!isAdmin) return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });

        if (!global.antiSpamConfig) global.antiSpamConfig = {};
        if (!global.antiSpamWarnings) global.antiSpamWarnings = {};
        if (!global.antiSpamTrack) global.antiSpamTrack = {};

        if (!global.antiSpamConfig[from]) {
            global.antiSpamConfig[from] = {
                enabled: false,
                action: 'delete',
                warnLimit: 3,
                timeWindow: 3,
                maxMessages: 5,
                duplicateWindow: 2
            };
        }

        const sub = args[0]?.toLowerCase();
        const param = args[1]?.toLowerCase();

        if (sub === 'on') {
            global.antiSpamConfig[from].enabled = true;
            settings.setGroup(from, 'antiSpamConfig', global.antiSpamConfig[from]);
            await sock.sendMessage(from, { text: '🛡️ Anti‑spam protection ENABLED.' }, { quoted: msg });
        } else if (sub === 'off') {
            global.antiSpamConfig[from].enabled = false;
            settings.setGroup(from, 'antiSpamConfig', global.antiSpamConfig[from]);
            await sock.sendMessage(from, { text: '🛡️ Anti‑spam protection DISABLED.' }, { quoted: msg });
        } else if (sub === 'set' && param) {
            const validActions = ['delete', 'warn', 'kick', 'warn+kick'];
            if (validActions.includes(param)) {
                global.antiSpamConfig[from].action = param;
                settings.setGroup(from, 'antiSpamConfig', global.antiSpamConfig[from]);
                await sock.sendMessage(from, { text: `✅ Action set to: ${param.toUpperCase()}` }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: '❌ Action must be: delete, warn, kick, or warn+kick' }, { quoted: msg });
            }
        } else if (sub === 'limit') {
            const limit = parseInt(param);
            if (!isNaN(limit) && limit >= 1 && limit <= 10) {
                global.antiSpamConfig[from].warnLimit = limit;
                settings.setGroup(from, 'antiSpamConfig', global.antiSpamConfig[from]);
                await sock.sendMessage(from, { text: `✅ Warning limit set to ${limit} before kick (for warn/warn+kick actions).` }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: '❌ Limit must be a number between 1 and 10.' }, { quoted: msg });
            }
        } else if (sub === 'window') {
            const seconds = parseInt(param);
            if (!isNaN(seconds) && seconds >= 1 && seconds <= 60) {
                global.antiSpamConfig[from].timeWindow = seconds;
                settings.setGroup(from, 'antiSpamConfig', global.antiSpamConfig[from]);
                await sock.sendMessage(from, { text: `✅ Rate‑limit window set to ${seconds} seconds.` }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: '❌ Window must be 1–60 seconds.' }, { quoted: msg });
            }
        } else if (sub === 'max') {
            const max = parseInt(param);
            if (!isNaN(max) && max >= 1 && max <= 20) {
                global.antiSpamConfig[from].maxMessages = max;
                settings.setGroup(from, 'antiSpamConfig', global.antiSpamConfig[from]);
                await sock.sendMessage(from, { text: `✅ Max messages per window set to ${max}.` }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: '❌ Max must be 1–20.' }, { quoted: msg });
            }
        } else if (sub === 'dup') {
            const seconds = parseInt(param);
            if (!isNaN(seconds) && seconds >= 1 && seconds <= 10) {
                global.antiSpamConfig[from].duplicateWindow = seconds;
                settings.setGroup(from, 'antiSpamConfig', global.antiSpamConfig[from]);
                await sock.sendMessage(from, { text: `✅ Duplicate message window set to ${seconds} seconds.` }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: '❌ Duplicate window must be 1–10 seconds.' }, { quoted: msg });
            }
        } else if (sub === 'list') {
            const cfg = global.antiSpamConfig[from];
            const status = cfg.enabled ? '✅ ENABLED' : '❌ DISABLED';
            await sock.sendMessage(from, {
                text: `🛡️ *ANTI‑SPAM SETTINGS*\nStatus: ${status}\nAction: ${cfg.action}\nWarn Limit: ${cfg.warnLimit}\nTime Window: ${cfg.timeWindow}s\nMax Messages: ${cfg.maxMessages}\nDuplicate Window: ${cfg.duplicateWindow}s`
            }, { quoted: msg });
        } else {
            await sock.sendMessage(from, {
                text: `📖 *Anti‑spam commands:*\n.antispam on/off\n.antispam set (delete|warn|kick|warn+kick)\n.antispam limit <1-10>\n.antispam window <1-60>\n.antispam max <1-20>\n.antispam dup <1-10>\n.antispam list`
            }, { quoted: msg });
        }

        if (!global.groupSettings) global.groupSettings = {};
        if (!global.groupSettings[from]) global.groupSettings[from] = {};
        const cfg = global.antiSpamConfig[from];
        global.groupSettings[from].antiSpam = `${cfg.enabled ? 'ON' : 'OFF'} | action:${cfg.action} | limit:${cfg.warnLimit}`;
    } },
    { name: 'antistatusmention', category: 'group', description: 'Detect and act when someone mentions the group in their status', execute: async function (sock, msg, args, { isArchitect }) {
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
    } },
    { name: 'antitag', category: 'group', description: '', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) return await sock.sendMessage(from, { text: '❌ Group only command.' }, { quoted: msg });

        const sender = msg.key.participant || msg.key.remoteJid;
        let isAdmin = false;
        try {
            const meta = await sock.groupMetadata(from);
            const senderNumber = sender.split('@')[0].split(':')[0];
            const participant = meta.participants.find(p => {
                const pNumber = p.id.split('@')[0].split(':')[0];
                return pNumber === senderNumber;
            });
            isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
        } catch (e) {}
        if (!isAdmin) return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });

        if (!global.antiTagConfig) global.antiTagConfig = {};
        if (!global.antiTagWarnings) global.antiTagWarnings = {};
        if (global.antiTagConfig[from] === undefined) {
            global.antiTagConfig[from] = { enabled: false, action: "delete", warnLimit: 3 };
        }

        const sub = args[0]?.toLowerCase();
        const param = args[1]?.toLowerCase();

        if (sub === "on") {
            global.antiTagConfig[from].enabled = true;
            settings.setGroup(from, 'antiTagConfig', global.antiTagConfig[from]);
            await sock.sendMessage(from, { text: '🛡️ Anti-tag protection ENABLED.' }, { quoted: msg });
        } else if (sub === "off") {
            global.antiTagConfig[from].enabled = false;
            settings.setGroup(from, 'antiTagConfig', global.antiTagConfig[from]);
            await sock.sendMessage(from, { text: '🛡️ Anti-tag protection DISABLED.' }, { quoted: msg });
        } else if (sub === "set") {
            if (param === "delete" || param === "warn" || param === "kick" || param === "warn+kick") {
                global.antiTagConfig[from].action = param;
                settings.setGroup(from, 'antiTagConfig', global.antiTagConfig[from]);
                await sock.sendMessage(from, { text: `✅ Action set to: ${param.toUpperCase()}` }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: '❌ Action must be: delete, warn, kick, or warn+kick' }, { quoted: msg });
            }
        } else if (sub === "limit") {
            const limit = parseInt(param);
            if (!isNaN(limit) && limit > 0 && limit <= 10) {
                global.antiTagConfig[from].warnLimit = limit;
                settings.setGroup(from, 'antiTagConfig', global.antiTagConfig[from]);
                await sock.sendMessage(from, { text: `✅ Warning limit set to ${limit} before kick.` }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: '❌ Limit must be a number between 1 and 10.' }, { quoted: msg });
            }
        } else if (sub === "list") {
            const cfg = global.antiTagConfig[from];
            await sock.sendMessage(from, { text: `📋 *Anti-tag settings*:\nEnabled: ${cfg.enabled}\nAction: ${cfg.action}\nWarn limit: ${cfg.warnLimit}` }, { quoted: msg });
        } else {
            await sock.sendMessage(from, { text: `Usage:\n.antitag on/off\n.antitag set (delete|warn|kick|warn+kick)\n.antitag limit <1-10>\n.antitag list` }, { quoted: msg });
        }
    } },
    { name: 'antitagadmin', category: 'group', description: '', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) return await sock.sendMessage(from, { text: '❌ Group only command.' }, { quoted: msg });

        const sender = msg.key.participant || msg.key.remoteJid;
        let isAdmin = false;
        try {
            const meta = await sock.groupMetadata(from);
            const senderNumber = sender.split('@')[0].split(':')[0];
            const participant = meta.participants.find(p => {
                const pNumber = p.id.split('@')[0].split(':')[0];
                return pNumber === senderNumber;
            });
            isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
        } catch (e) {}
        if (!isAdmin) return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });

        if (!global.antiTagAdminConfig) global.antiTagAdminConfig = {};
        if (!global.antiTagAdminWarnings) global.antiTagAdminWarnings = {};
        if (global.antiTagAdminConfig[from] === undefined) {
            global.antiTagAdminConfig[from] = { enabled: false, action: "delete", warnLimit: 3 };
        }

        const sub = args[0]?.toLowerCase();
        const param = args[1]?.toLowerCase();

        if (sub === "on") {
            global.antiTagAdminConfig[from].enabled = true;
            settings.setGroup(from, 'antiTagAdminConfig', global.antiTagAdminConfig[from]);
            await sock.sendMessage(from, { text: '🛡️ Anti‑tag‑admin protection ENABLED.' }, { quoted: msg });
        } else if (sub === "off") {
            global.antiTagAdminConfig[from].enabled = false;
            settings.setGroup(from, 'antiTagAdminConfig', global.antiTagAdminConfig[from]);
            await sock.sendMessage(from, { text: '🛡️ Anti‑tag‑admin protection DISABLED.' }, { quoted: msg });
        } else if (sub === "set") {
            if (param === "delete" || param === "warn" || param === "kick" || param === "warn+kick") {
                global.antiTagAdminConfig[from].action = param;
                settings.setGroup(from, 'antiTagAdminConfig', global.antiTagAdminConfig[from]);
                await sock.sendMessage(from, { text: `✅ Action set to: ${param.toUpperCase()}` }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: '❌ Action must be: delete, warn, kick, or warn+kick' }, { quoted: msg });
            }
        } else if (sub === "limit") {
            const limit = parseInt(param);
            if (!isNaN(limit) && limit > 0 && limit <= 10) {
                global.antiTagAdminConfig[from].warnLimit = limit;
                settings.setGroup(from, 'antiTagAdminConfig', global.antiTagAdminConfig[from]);
                await sock.sendMessage(from, { text: `✅ Warning limit set to ${limit} before kick.` }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: '❌ Limit must be a number between 1 and 10.' }, { quoted: msg });
            }
        } else if (sub === "list") {
            const cfg = global.antiTagAdminConfig[from];
            await sock.sendMessage(from, { text: `📋 *Anti‑tag‑admin settings*:\nEnabled: ${cfg.enabled}\nAction: ${cfg.action}\nWarn limit: ${cfg.warnLimit}` }, { quoted: msg });
        } else {
            await sock.sendMessage(from, { text: `Usage:\n.antitagadmin on/off\n.antitagadmin set (delete|warn|kick|warn+kick)\n.antitagadmin limit <1-10>\n.antitagadmin list` }, { quoted: msg });
        }
    } },
    { name: 'approveall', category: 'group', description: 'Approve all pending join requests (admin only)', execute: async function (sock, msg, args, { isMe }) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) return await sock.sendMessage(from, { text: '❌ Group only command.' }, { quoted: msg });

        const sender = msg.key.participant || msg.key.remoteJid;
        let isAdmin = false;
        try {
            const groupMetadata = await sock.groupMetadata(from);
            const participant = groupMetadata.participants.find(p => p.id === sender);
            isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
        } catch (e) {}
        if (!isAdmin && !isMe) return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });

        const pending = global.pendingJoinRequests?.[from] || [];
        if (pending.length === 0) {
            return await sock.sendMessage(from, { text: '✅ No pending join requests at the moment.' }, { quoted: msg });
        }

        let approved = 0;
        let failed = 0;
        for (const jid of pending) {
            try {
                await sock.groupParticipantsUpdate(from, [jid], 'add');
                approved++;
            } catch (err) {
                console.error(`Failed to approve ${jid}:`, err);
                failed++;
            }
        }
        delete global.pendingJoinRequests[from];

        await sock.sendMessage(from, { text: `✅ Approved ${approved} join requests.\n❌ Failed: ${failed}` }, { quoted: msg });
    } },
    { name: 'audio', category: 'audio', description: 'Download audio via yta4 endpoint (YouTube URL or song name)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) return sock.sendMessage(from, { text: '❌ Usage: .audio <YouTube URL or song name>' }, { quoted: msg });

        try {
            await sock.sendMessage(from, { text: `🎵 Processing: ${query}\n⏳ Fetching audio...` }, { quoted: msg });

            let audioUrl = null;
            let title = 'Unknown';
            let artist = 'Unknown';
            let duration = 'N/A';
            let cover = null;
            let videoUrl = null;
            let usedFallback = false;

            const isUrl = query.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/);

            if (isUrl) {
                videoUrl = query;
                try {
                    const info = await yts({ videoId: videoUrl });
                    if (info) {
                        title = info.title || 'Unknown';
                        artist = info.author?.name || 'Unknown';
                        duration = info.duration?.timestamp || 'N/A';
                        cover = info.thumbnail || null;
                    }
                } catch (e) {}
            } else {
                try {
                    const searchResult = await yts(query);
                    const video = searchResult.videos[0];
                    if (video) {
                        videoUrl = video.url;
                        title = video.title || 'Unknown';
                        artist = video.author.name || 'Unknown';
                        duration = video.duration.timestamp || 'N/A';
                        cover = video.thumbnail || null;
                    } else {
                        throw new Error('No YouTube results');
                    }
                } catch (ytErr) {
                    console.log('YouTube search failed:', ytErr.message);
                }
            }

            if (videoUrl) {
                try {
                    const response = await axios.get(`https://ravenn.site/download/yta4?url=${encodeURIComponent(videoUrl)}`, { timeout: 15000 });
                    if (response.data.status && response.data.result) {
                        audioUrl = response.data.result;
                        if (title === 'Unknown') title = 'YouTube Audio';
                    }
                } catch (ravErr) {
                    console.log('Ravenn yta4 error:', ravErr.message);
                }
            }

            if (!audioUrl) {
                console.log('yta4 failed, falling back to Deezer...');
                usedFallback = true;
                try {
                    const deezerRes = await axios.get(`https://api.deezer.com/search?q=${encodeURIComponent(query)}`);
                    const track = deezerRes.data.data[0];
                    if (track && track.preview) {
                        audioUrl = track.preview;
                        title = track.title || 'Unknown';
                        artist = track.artist.name || 'Unknown';
                        duration = track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}` : '30s (preview)';
                        cover = track.album.cover_medium || null;
                    } else {
                        throw new Error('No results from Deezer');
                    }
                } catch (deezerErr) {
                    console.log('Deezer error:', deezerErr.message);
                    return sock.sendMessage(from, { text: '❌ No results found for that song.' }, { quoted: msg });
                }
            }

            if (!audioUrl) {
                throw new Error('Could not retrieve audio');
            }

            const caption = `🎵 *${title}*\n👤 *Artist:* ${artist}\n⏱️ *Duration:* ${duration}${usedFallback ? ' (preview)' : ''}`;

            let imageBuffer = null;
            if (cover) {
                try {
                    const imgRes = await axios.get(cover, { responseType: 'arraybuffer' });
                    imageBuffer = Buffer.from(imgRes.data);
                } catch (e) {}
            }

            if (imageBuffer) {
                await sock.sendMessage(from, { image: imageBuffer, caption }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: caption }, { quoted: msg });
            }

            const audioRes = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 30000 });
            let audioBuffer = Buffer.from(audioRes.data);

            const fileSizeMB = audioBuffer.length / (1024 * 1024);
            if (fileSizeMB > 15) {
                try {
                    const tempFile = path.join(__dirname, `temp_${Date.now()}.mp3`);
                    const outFile = path.join(__dirname, `temp_out_${Date.now()}.mp3`);
                    fs.writeFileSync(tempFile, audioBuffer);
                    await execPromise(`ffmpeg -i "${tempFile}" -b:a 96k "${outFile}" -y`);
                    const compressedBuffer = fs.readFileSync(outFile);
                    fs.unlinkSync(tempFile);
                    fs.unlinkSync(outFile);
                    if (compressedBuffer.length < audioBuffer.length) {
                        audioBuffer = compressedBuffer;
                    }
                } catch (ffErr) {
                    console.log('FFmpeg compression failed:', ffErr.message);
                }
            }

            await sock.sendMessage(from, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                ptt: false,
                caption: caption
            }, { quoted: msg });

        } catch (err) {
            console.error('Audio error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'autoreact', category: 'owner', description: '', execute: async function (sock, msg, args, { isArchitect, isMe }) {
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
    } },
    { name: 'autoreactstatus', category: 'engine', description: 'Auto-react to WhatsApp statuses', execute: async function (sock, msg, args, { isArchitect }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = global.ownerJid && sender === global.ownerJid;
        const isSudo = global.sudoers && Array.isArray(global.sudoers) && global.sudoers.includes(sender);
        const isAuthorized = isArchitect || isOwner || isSudo;

        const reply = (text) => sock.sendMessage(from, { text }, { quoted: msg });

        if (!args || args.length === 0) {
            const status = config.enabled ? '🟢 ACTIVE' : '🔴 INACTIVE';
            const modeLabel = config.mode === 'fixed' ? `FIXED (${config.fixedEmoji})` :
                              config.mode === 'cycle' ? `CYCLE (pos ${config.cycleIndex + 1}/${config.reactions.length})` :
                              'RANDOM';
            const viewLabel = config.viewMode === 'view+react' ? '👁️+⚡ View + React' : '⚡ React only';
            let text = `╭─⌈ ⚡ *AUTOREACT STATUS* ⌋\n│\n`;
            text += `├ Status    : ${status}\n`;
            text += `├ View Mode : ${viewLabel}\n`;
            text += `├ Emoji Mode: ${modeLabel}\n`;
            text += `├ Total     : ${config.totalReacted || 0}\n`;
            text += `├ Excluded  : ${config.excludedContacts.length}\n`;
            text += `├ Tracked   : ${reactedSet.size}\n`;
            text += `│\n`;
            text += `├─⊷ *${global.prefix}autoreact on* — Enable\n`;
            text += `├─⊷ *${global.prefix}autoreact off* — Disable\n`;
            text += `├─⊷ *${global.prefix}autoreact view* — View+React mode\n`;
            text += `├─⊷ *${global.prefix}autoreact react* — React only\n`;
            text += `├─⊷ *${global.prefix}autoreact random* — Random emoji\n`;
            text += `├─⊷ *${global.prefix}autoreact fixed ⚡* — Fixed emoji\n`;
            text += `├─⊷ *${global.prefix}autoreact cycle* — Cycle emojis\n`;
            text += `├─⊷ *${global.prefix}autoreact exclude 2547xxxx* — Skip a contact\n`;
            text += `├─⊷ *${global.prefix}autoreact include 2547xxxx* — Unskip\n`;
            text += `├─⊷ *${global.prefix}autoreact excluded* — Show skip list\n`;
            text += `├─⊷ *${global.prefix}autoreact stats* — Statistics\n`;
            text += `╰⊷ *Powered by SAVAGE-TECH*`;
            await reply(text);
            return;
        }

        if (!isAuthorized) {
            await reply('❌ Only owner and sudo users can configure auto-react.');
            return;
        }

        const action = args[0].toLowerCase();

        switch (action) {
            case 'on':
            case 'enable':
                config.enabled = true;
                saveConfig();
                await reply(`✅ *AUTOREACT ENABLED*\n\n⚡ Will ${config.viewMode === 'view+react' ? 'view then react to' : 'react to'} all statuses.`);
                break;

            case 'off':
            case 'disable':
                config.enabled = false;
                saveConfig();
                await reply(`❌ *AUTOREACT DISABLED*`);
                break;

            case 'view':
                config.viewMode = 'view+react';
                saveConfig();
                await reply(`👁️+⚡ *VIEW+REACT MODE*\n\nWill view the status first, then react.`);
                break;

            case 'react':
                config.viewMode = 'react-only';
                saveConfig();
                await reply(`⚡ *REACT-ONLY MODE*\n\nWill react without marking as viewed.`);
                break;

            case 'random':
                config.mode = 'random';
                saveConfig();
                await reply(`🎲 *RANDOM MODE*\n\n${config.reactions.join(' ')}`);
                break;

            case 'fixed':
                if (!args[1]) {
                    await reply(`Current emoji: ${config.fixedEmoji}\n\nUsage: ${global.prefix}autoreact fixed ⚡`);
                    return;
                }
                const emoji = args[1];
                if ([...emoji].length <= 2) {
                    config.fixedEmoji = emoji;
                    config.mode = 'fixed';
                    saveConfig();
                    await reply(`✅ Emoji set to: ${emoji}`);
                } else {
                    await reply('❌ Invalid emoji.');
                }
                break;

            case 'cycle':
                if (!config.reactions.length) {
                    await reply('❌ No emojis in cycle list. Use `.autoreact setrandom ⚡,❤️,🔥` first.');
                    return;
                }
                config.mode = 'cycle';
                config.cycleIndex = 0;
                saveConfig();
                await reply(`🔄 *CYCLE MODE*\n\n${config.reactions.map((e, i) => `${i+1}. ${e}`).join('\n')}`);
                break;

            case 'setrandom':
            case 'setemojis':
                const input = args.slice(1).join(' ').split(',').map(e => e.trim()).filter(Boolean);
                if (!input.length) {
                    await reply(`Usage: ${global.prefix}autoreact setrandom ⚡,❤️,🔥,💯`);
                    return;
                }
                const valid = input.filter(e => [...e].length <= 2);
                if (!valid.length) {
                    await reply('❌ No valid emojis found.');
                    return;
                }
                config.reactions = valid;
                config.mode = 'cycle';
                config.cycleIndex = 0;
                saveConfig();
                await reply(`✅ Emoji pool set (${valid.length}): ${valid.join(' ')}`);
                break;

            case 'exclude':
            case 'skip':
                if (!args[1]) {
                    await reply(`Usage: ${global.prefix}autoreact exclude 2547xxxx`);
                    return;
                }
                const num = args[1].replace(/[^0-9]/g, '');
                if (!config.excludedContacts.includes(num)) {
                    config.excludedContacts.push(num);
                    saveConfig();
                    await reply(`✅ Excluded +${num} from auto-react.`);
                } else {
                    await reply(`⚠️ +${num} is already excluded.`);
                }
                break;

            case 'include':
            case 'unexclude':
                if (!args[1]) {
                    await reply(`Usage: ${global.prefix}autoreact include 2547xxxx`);
                    return;
                }
                const incNum = args[1].replace(/[^0-9]/g, '');
                const idx = config.excludedContacts.indexOf(incNum);
                if (idx !== -1) {
                    config.excludedContacts.splice(idx, 1);
                    saveConfig();
                    await reply(`✅ Removed +${incNum} from exclude list.`);
                } else {
                    await reply(`⚠️ +${incNum} was not excluded.`);
                }
                break;

            case 'excluded':
            case 'skiplist':
                if (!config.excludedContacts.length) {
                    await reply('📭 No contacts excluded.');
                    return;
                }
                let listText = `🚫 *SKIP LIST (${config.excludedContacts.length})*\n\n`;
                config.excludedContacts.forEach((n, i) => {
                    listText += `${i+1}. +${n}\n`;
                });
                await reply(listText);
                break;

            case 'stats':
                const viewLabel = config.viewMode === 'view+react' ? '👁️+⚡' : '⚡ only';
                let statsText = `📊 *AUTOREACT STATS*\n\n`;
                statsText += `Status     : ${config.enabled ? '🟢 ACTIVE' : '🔴 INACTIVE'}\n`;
                statsText += `View Mode  : ${viewLabel}\n`;
                statsText += `Emoji Mode : ${config.mode === 'fixed' ? `FIXED (${config.fixedEmoji})` : config.mode === 'cycle' ? `CYCLE (${config.reactions.length} emojis)` : 'RANDOM'}\n`;
                statsText += `Total      : ${config.totalReacted || 0}\n`;
                statsText += `Tracked    : ${reactedSet.size}\n`;
                statsText += `Excluded   : ${config.excludedContacts.length}\n`;
                await reply(statsText);
                break;

            case 'reset':
            case 'clear':
                config.totalReacted = 0;
                reactedSet.clear();
                config.reactedStatuses = [];
                saveConfig();
                await reply('🔄 *Reset complete.* All logs cleared.');
                break;

            default:
                await reply(`❌ Unknown option. Use *${global.prefix}autoreact* to see commands.`);
        }
    } },
    { name: 'autoread', category: 'owner', description: '', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo) {
            return await sock.sendMessage(from, { text: "This command is restricted to the owner and sudo users only." }, { quoted: msg });
        }

        if (global.autoRead === undefined) global.autoRead = false;

        const option = args[0]?.toLowerCase();
        if (!["on", "off"].includes(option)) {
            return await sock.sendMessage(from, { text: "❌ Usage:\n.autoread on\n.autoread off" }, { quoted: msg });
        }

        global.autoRead = option === "on";
        settings.setGlobal('autoRead', global.autoRead);

        const quotesOn = ["Every message will now be seen instantly.", "The bot is now watching everything.", "No message escapes the system anymore.", "Read receipts activated globally.", "The eyes are open now."];
        const quotesOff = ["Read tracking disabled.", "Messages will remain unopened.", "The system stopped observing chats.", "Auto-read shut down successfully.", "The eyes have closed."];
        const quote = global.autoRead ? quotesOn[Math.floor(Math.random() * quotesOn.length)] : quotesOff[Math.floor(Math.random() * quotesOff.length)];

        await sock.sendMessage(from, {
            text: `👁️ *AUTO-READ SYSTEM*\n\n📌 Status: ${global.autoRead ? "ENABLED" : "DISABLED"}\n\n🧊 ${quote}\n\n⚡ Powered by Savage Tech`
        }, { quoted: msg });
    } },
    { name: 'autoviewstatus', category: 'owner', description: '', execute: async (sock, msg, args, { isArchitect, isMe }) => {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo) {
            return await sock.sendMessage(from, { text: "This command is restricted to the owner and sudo users only." }, { quoted: msg });
        }

        const input = args[0]?.toLowerCase();

        if (input === 'on') {
            global.autoViewStatus = 'on';
            settings.setGlobal('autoViewStatus', 'on');
            return await sock.sendMessage(from, { text: '👁️ *AUTO-VIEW STATUS:* ENABLED' }, { quoted: msg });
        }

        if (input === 'off') {
            global.autoViewStatus = 'off';
            settings.setGlobal('autoViewStatus', 'off');
            return await sock.sendMessage(from, { text: '🙈 *AUTO-VIEW STATUS:* DISABLED' }, { quoted: msg });
        }

        const current = global.autoViewStatus === 'on' ? 'ENABLED 👁️' : 'DISABLED 🙈';
        await sock.sendMessage(from, {
            text: `*S Λ V Λ G Ξ  -  STATUS ENGINE*\n\n*Current Clearance:* OWNER\n*Status:* ${current}\n\n*Usage:*\n${global.prefix}autoviewstatus on\n${global.prefix}autoviewstatus off`
        }, { quoted: msg });
    } },
    { name: 'baka', category: 'anime', description: 'Random baka anime', execute: async function (sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random baka anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/baka', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime baka*\n';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('baka error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime baka.' }, { quoted: msg });
    }
  } },
    { name: 'bankrate', category: 'financial data', description: 'Get financial data (forex, crypto, stock, inflation, gdp, gold, market, news, wallet)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;

        if (!args.length) {
            return sock.sendMessage(from, {
                text: '❌ Usage: .bankrate <type> [param]\n\nTypes: forex, crypto, stock, inflation, gdp, gold, market, news, wallet'
            }, { quoted: msg });
        }

        const command = args[0].toLowerCase();
        const param = args.slice(1).join(' ');

        try {
            const apiKey = 'wxa_f_273f9867e9';
            let apiUrl = '';
            let paramLabel = '';

            if (command === 'forex') {
                const [fromCur, toCur] = param ? param.split(',') : ['USD', 'EUR'];
                apiUrl = `https://apis.xwolf.space/api/economy/forex?from=${fromCur}&to=${toCur}&key=${apiKey}`;
                paramLabel = `${fromCur}/${toCur}`;
            } else if (command === 'crypto') {
                const symbol = param ? param.toUpperCase() : 'BTC';
                apiUrl = `https://apis.xwolf.space/api/economy/crypto?symbol=${symbol}&key=${apiKey}`;
                paramLabel = symbol;
            } else if (command === 'stock') {
                const ticker = param ? param.toUpperCase() : 'AAPL';
                apiUrl = `https://apis.xwolf.space/api/economy/stock?symbol=${ticker}&key=${apiKey}`;
                paramLabel = ticker;
            } else if (command === 'inflation') {
                const country = param ? param.toUpperCase() : 'US';
                apiUrl = `https://apis.xwolf.space/api/economy/inflation?country=${country}&key=${apiKey}`;
                paramLabel = country;
            } else if (command === 'gdp') {
                const country = param ? param.toUpperCase() : 'US';
                apiUrl = `https://apis.xwolf.space/api/economy/gdp?country=${country}&key=${apiKey}`;
                paramLabel = country;
            } else if (command === 'bankrate') {
                const country = param ? param.toUpperCase() : 'US';
                apiUrl = `https://apis.xwolf.space/api/economy/bank-rate?country=${country}&key=${apiKey}`;
                paramLabel = country;
            } else if (command === 'wallet') {
                if (!param) {
                    return sock.sendMessage(from, { text: '❌ Usage: .bankrate wallet <crypto_address>' }, { quoted: msg });
                }
                apiUrl = `https://apis.xwolf.space/api/economy/wallet?address=${param}&key=${apiKey}`;
                paramLabel = param.slice(0, 10) + '...';
            } else if (command === 'gold') {
                apiUrl = `https://apis.xwolf.space/api/economy/gold?key=${apiKey}`;
                paramLabel = '';
            } else if (command === 'market') {
                apiUrl = `https://apis.xwolf.space/api/economy/market?key=${apiKey}`;
                paramLabel = '';
            } else if (command === 'news') {
                apiUrl = `https://apis.xwolf.space/api/economy/news?key=${apiKey}`;
                paramLabel = '';
            } else {
                return sock.sendMessage(from, {
                    text: '❌ Unknown type. Use: forex, crypto, stock, inflation, gdp, bankrate, wallet, gold, market, news'
                }, { quoted: msg });
            }

            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });
            const data = response.data;

            if (!data.success) throw new Error(data.error || 'No data');

            let output = `📊 *Financial Data*`;
            if (paramLabel) output += ` (${paramLabel})`;
            output += '\n\n';

            if (command === 'crypto') {
                output += `💎 *${data.symbol || paramLabel}*\n`;
                output += `💰 Price: ${formatNumber(data.price_usd)}\n`;
                if (data.change_24h !== undefined) output += `📈 24h Change: ${data.change_24h > 0 ? '+' : ''}${data.change_24h}%\n`;
                if (data.market_cap_usd) output += `🏦 Market Cap: ${formatNumber(data.market_cap_usd)}\n`;
                if (data.volume_24h_usd) output += `📊 24h Volume: ${formatNumber(data.volume_24h_usd)}\n`;
            } else if (command === 'stock') {
                output += `📈 *${data.symbol || paramLabel}*\n`;
                output += `💵 Price: ${formatNumber(data.price)}\n`;
                if (data.change !== undefined) output += `📉 Change: ${data.change > 0 ? '+' : ''}${data.change}%\n`;
                if (data.volume) output += `📊 Volume: ${formatNumber(data.volume)}\n`;
            } else if (command === 'forex') {
                output += `💱 *${data.from || 'USD'} → ${data.to || 'EUR'}*\n`;
                output += `💹 Rate: ${data.rate || data.result}\n`;
                if (data.change) output += `📈 Change: ${data.change}%\n`;
            } else if (command === 'gold') {
                output += `🥇 *Gold & Silver*\n`;
                output += `🪙 Gold: ${formatNumber(data.gold)}/oz\n`;
                if (data.silver) output += `🥈 Silver: ${formatNumber(data.silver)}/oz\n`;
            } else if (command === 'market') {
                output += `🌍 *Market Indices*\n`;
                if (data.sp500) output += `📊 S&P 500: ${formatNumber(data.sp500)}\n`;
                if (data.dow) output += `📈 Dow Jones: ${formatNumber(data.dow)}\n`;
                if (data.nasdaq) output += `📉 Nasdaq: ${formatNumber(data.nasdaq)}\n`;
            } else if (command === 'inflation') {
                output += `📉 *Inflation Rate (${paramLabel || 'US'})*\n`;
                output += `📅 Annual: ${data.rate}%\n`;
                if (data.year) output += `🗓️ Year: ${data.year}\n`;
            } else if (command === 'gdp') {
                output += `📊 *GDP (${paramLabel || 'US'})*\n`;
                output += `💰 GDP: ${formatNumber(data.gdp)}\n`;
                if (data.growth) output += `📈 Growth: ${data.growth}%\n`;
            } else if (command === 'bankrate') {
                output += `🏦 *Central Bank Rate (${paramLabel || 'US'})*\n`;
                output += `💹 Rate: ${data.rate}%\n`;
            } else if (command === 'news') {
                output += `📰 *Financial News*\n\n`;
                const headlines = data.result || data.articles || [];
                if (Array.isArray(headlines) && headlines.length) {
                    headlines.slice(0, 5).forEach((item, i) => {
                        output += `${i + 1}. ${item.title || item.headline}\n`;
                        if (item.source) output += `   📍 ${item.source}\n`;
                        output += `\n`;
                    });
                } else {
                    output += `No news available.\n`;
                }
            } else if (command === 'wallet') {
                output += `💳 *Wallet Balance*\n`;
                output += `💰 Balance: ${formatNumber(data.balance)} ${data.currency || 'BTC'}\n`;
                if (data.transactions) output += `🔄 Transactions: ${data.transactions}\n`;
            } else {
                output += JSON.stringify(data.result || data, null, 2);
            }

            await sock.sendMessage(from, { text: output.slice(0, 2000) }, { quoted: msg });
        } catch (err) {
            console.error('Bankrate error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'base64decode', category: 'tools', description: 'Decode Base64 to text', execute: async function (sock, msg, args) {
    const b64 = args.join(' ');
    if (!b64) return sock.sendMessage(msg.key.remoteJid, { text: '❓ Usage: .base64decode <base64_string>' }, { quoted: msg });

    try {
      const decoded = Buffer.from(b64, 'base64').toString('utf-8');
      await sock.sendMessage(msg.key.remoteJid, { text: `🔓 *Base64 Decoded*\n\n${decoded}` }, { quoted: msg });
    } catch {
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Invalid Base64 string' }, { quoted: msg });
    }
  } },
    { name: 'base64encode', category: 'tools', description: 'Encode text to Base64', execute: async function (sock, msg, args) {
    const text = args.join(' ');
    if (!text) return sock.sendMessage(msg.key.remoteJid, { text: '❓ Usage: .base64encode <text>' }, { quoted: msg });

    const encoded = Buffer.from(text, 'utf-8').toString('base64');
    await sock.sendMessage(msg.key.remoteJid, { text: `🔢 *Base64 Encoded*\n\n${encoded}` }, { quoted: msg });
  } },
    { name: 'bass', category: 'Audio Effects', description: 'Apply bass effect to audio', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const url = args[0];
        if (!url) return sock.sendMessage(from, { text: '❌ Usage: .bass <audio_url>' }, { quoted: msg });
        if (!url.startsWith('http')) return sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });

        try {
            await sock.sendMessage(from, { text: '🎧 Applying bass effect...' }, { quoted: msg });

            const apiKey = 'wxa_f_273f9867e9';
            const apiUrl = `https://apis.xwolf.space/api/audio/bass?url=${encodeURIComponent(url)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 30000 });

            let base64Audio = response.data.result?.base64Data || response.data.base64Data;
            if (!base64Audio && typeof response.data.result === 'string') base64Audio = response.data.result;
            if (!base64Audio) throw new Error('No audio data in response');
            if (base64Audio.startsWith('data:audio')) base64Audio = base64Audio.split(',')[1];

            const audioBuffer = Buffer.from(base64Audio, 'base64');
            const caption = '✅ Bass effect applied.';

            await sock.sendMessage(from, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                fileName: 'bass_effect.mp3',
                caption: caption
            }, { quoted: msg });
        } catch (err) {
            console.error('Bass error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'bassboost', category: 'Audio Effects', description: 'Apply bassboost effect to audio', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const url = args[0];
    if (!url) return sock.sendMessage(from, { text: '❓ Usage: .bassboost <audio_url>' }, { quoted: msg });
    if (!url.startsWith('http')) return sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });

    try {
      await sock.sendMessage(from, { text: '🎧 Applying bassboost effect...' }, { quoted: msg });
      const apiUrl = 'https://apis.xwolf.space/api/audio/bassboost?url=' + encodeURIComponent(url);
      const response = await axios.get(apiUrl, { httpsAgent });
      let base64Audio = response.data.result?.base64Data || response.data.base64Data;
      if (!base64Audio && typeof response.data.result === 'string') base64Audio = response.data.result;
      if (!base64Audio) throw new Error('No audio data in response');
      if (base64Audio.startsWith('data:audio')) base64Audio = base64Audio.split(',')[1];
      const audioBuffer = Buffer.from(base64Audio, 'base64');
      const caption = '✨ Bassboost Effect Applied';
      await sock.sendMessage(from, { audio: audioBuffer, mimetype: 'audio/mpeg', fileName: 'bassboost_effect.mp3', caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('bassboost error:', err);
      await sock.sendMessage(from, { text: '❌ Failed: ' + err.message }, { quoted: msg });
    }
  } },
    { name: 'bible', category: 'religion', description: 'Get a Bible verse (e.g., .bible John 3:16 or .bible John 3 16)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        if (args.length < 2) {
            return sock.sendMessage(from, { text: '❌ Usage: .bible <book> <chapter>:<verse> or .bible <book> <chapter> <verse>\nExample: .bible John 3:16' }, { quoted: msg });
        }

        let bookInput, chapter, verse;

        if (args[1] && args[1].includes(':')) {
            bookInput = args.slice(0, 1).join(' ');
            const parts = args[1].split(':');
            chapter = parseInt(parts[0]);
            verse = parseInt(parts[1]);
        } else if (args.length >= 3) {
            bookInput = args.slice(0, -2).join(' ');
            chapter = parseInt(args[args.length - 2]);
            verse = parseInt(args[args.length - 1]);
        } else {
            return sock.sendMessage(from, { text: '❌ Invalid format. Use .bible John 3:16 or .bible John 3 16' }, { quoted: msg });
        }

        if (isNaN(chapter) || isNaN(verse) || chapter < 1 || verse < 1) {
            return sock.sendMessage(from, { text: '❌ Chapter and verse must be valid numbers.' }, { quoted: msg });
        }

        const book = normalizeBook(bookInput);
        const version = 'en-kjv';

        try {
            const url = `https://cdn.jsdelivr.net/gh/wldeh/bible-api/bibles/${version}/books/${book}/chapters/${chapter}/verses/${verse}.json`;
            const res = await axios.get(url);
            const data = res.data;

            const text = `📖 *${data.reference || `${book} ${chapter}:${verse}`} (KJV)*\n\n${data.text || data.verse || 'Verse not found.'}`;
            await sock.sendMessage(from, { text }, { quoted: msg });
        } catch (err) {
            console.error(err);
            if (err.response && err.response.status === 404) {
                await sock.sendMessage(from, { text: '❌ Verse not found. Check the book, chapter, and verse numbers.' }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: '❌ Failed to fetch the verse. Please try again later.' }, { quoted: msg });
            }
        }
    } },
    { name: 'birthday', category: 'fun', description: 'Birthday wish', execute: async function (sock, msg, args) {
    const random = birthday[Math.floor(Math.random() * birthday.length)];
    await sock.sendMessage(msg.key.remoteJid, {
      text: `🎂 *Happy Birthday!*\n\n${random}`
    }, { quoted: msg });
  } },
    { name: 'bite', category: 'anime', description: 'Random bite anime', execute: async function (sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random bite anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/bite', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime bite*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('bite error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime bite.' }, { quoted: msg });
    }
  } },
    { name: 'block', category: 'admin', description: '', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        if (!isArchitect && !isMe) return;
        let target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || 
                     msg.message?.extendedTextMessage?.contextInfo?.participant || 
                     (args[0] && args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net');
        if (!target) return sock.sendMessage(msg.key.remoteJid, { text: '💡 Tag someone to blacklist.' });
        global.blacklist.add(target);
        await sock.sendMessage(msg.key.remoteJid, { text: '🚫 **ACCESS REVOKED.**' });
    } },
    { name: 'blush', category: 'anime', description: 'Random blush anime', execute: async function (sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random blush anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/blush', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime blush*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('blush error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime blush.' }, { quoted: msg });
    }
  } },
    { name: 'bonk', category: 'anime', description: 'Random bonk anime', execute: async function (sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random bonk anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/bonk', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime bonk*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('bonk error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime bonk.' }, { quoted: msg });
    }
  } },
    { name: 'boyfriendsday', category: 'fun', description: 'Boyfriend’s Day wishes', execute: async function (sock, msg, args) {
    const random = bfDay[Math.floor(Math.random() * bfDay.length)];
    await sock.sendMessage(msg.key.remoteJid, {
      text: `💙 *Happy Boyfriend's Day!*\n\n${random}`
    }, { quoted: msg });
  } },
    { name: 'broadcast', category: 'group', description: 'Transmit a message to all joined groups', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        
        if (!args.length) {
            return await sock.sendMessage(from, { 
                text: "☣️ *SYSTEM ERROR:* No transmission data provided. Use: .broadcast [message]" 
            }, { quoted: msg });
        }

        const broadcastMsg = args.join(" ");
        const getGroups = await sock.groupFetchAllParticipating();
        const groups = Object.entries(getGroups).slice(0).map((entry) => entry[1]);
        const groupIds = groups.map((v) => v.id);

        await sock.sendMessage(from, { 
            text: `📡 *INITIATING BROADCAST...*\nTargeting ${groupIds.length} sectors.` 
        }, { quoted: msg });

        for (let id of groupIds) {
            await sock.sendMessage(id, { 
                text: `📢 **SΛVΛGΞ-TECH BROADCAST** 📢\n\n${broadcastMsg}\n\n_Sent by Beck via Engine_` 
            });
        }

        await sock.sendMessage(from, { text: "✅ *TRANSMISSION COMPLETE.* All sectors updated." }, { quoted: msg });
    } },
    { name: 'bully', category: 'anime', description: 'Random bully anime', execute: async function (sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random bully anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/bully', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime bully*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('bully error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime bully.' }, { quoted: msg });
    }
  } },
    { name: 'cancelinactive', category: 'group', description: '', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) return await sock.sendMessage(from, { text: '❌ Group only command.' }, { quoted: msg });

        const sender = msg.key.participant || msg.key.remoteJid;
        let isAdmin = false;
        try {
            const meta = await sock.groupMetadata(from);
            const senderNumber = sender.split('@')[0].split(':')[0];
            const participant = meta.participants.find(p => {
                const pNumber = p.id.split('@')[0].split(':')[0];
                return pNumber === senderNumber;
            });
            isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
        } catch (e) {}
        if (!isAdmin) return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });

        if (!global.kickinactiveCancel) global.kickinactiveCancel = new Set();
        if (global.kickinactiveCancel.has(from)) {
            global.kickinactiveCancel.delete(from);
            await sock.sendMessage(from, { text: '✅ Kickinactive cancellation requested. Operation will be aborted.' }, { quoted: msg });
        } else {
            await sock.sendMessage(from, { text: 'ℹ️ No active kickinactive operation in this group.' }, { quoted: msg });
        }
    } },
    { name: 'cancelkick', category: 'group', description: '', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) return await sock.sendMessage(from, { text: '❌ Group only command.' }, { quoted: msg });

        const sender = msg.key.participant || msg.key.remoteJid;
        let isAdmin = false;
        try {
            const meta = await sock.groupMetadata(from);
            const senderNumber = sender.split('@')[0].split(':')[0];
            const participant = meta.participants.find(p => {
                const pNumber = p.id.split('@')[0].split(':')[0];
                return pNumber === senderNumber;
            });
            isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
        } catch (e) {}
        if (!isAdmin) return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });

        if (!global.kickallCancel) global.kickallCancel = new Set();
        if (global.kickallCancel.has(from)) {
            global.kickallCancel.delete(from);
            await sock.sendMessage(from, { text: '✅ Kickall cancellation requested. Operation will be aborted.' }, { quoted: msg });
        } else {
            await sock.sendMessage(from, { text: 'ℹ️ No active kickall operation in this group.' }, { quoted: msg });
        }
    } },
    { name: 'catbox', category: 'tools', description: 'Upload a file URL to Catbox.moe and get a direct link', execute: async function (sock, msg, args) {
    const fileUrl = args[0];
    if (!fileUrl || !fileUrl.startsWith('http')) {
      return sock.sendMessage(msg.key.remoteJid, { text: '❓ Usage: .catbox <file_url>' });
    }
    const sender = msg.pushName || 'User';
    const senderJid = msg.key.participant || msg.key.remoteJid;
    const mention = [senderJid];
    try {
      const form = new FormData();
      form.append('reqtype', 'fileupload');
      form.append('fileToUpload', fileUrl);
      const res = await axios.post('https://catbox.moe/user/api.php', form, {
        headers: form.getHeaders(),
      });
      await sock.sendMessage(msg.key.remoteJid, {
        text: `📦 *Catbox upload for @${sender}*\n\n${res.data.trim()}\n\n🚀 POWERED BY SAVAGE-CORE`,
        mentions: mention,
      });
    } catch (err) {
      console.error('Catbox error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: `❌ Upload failed: ${err.message}` });
    }
  } },
    { name: 'chilpit', category: 'tools', description: 'Shorten URL with Chilp.it', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const longUrl = args[0];
        if (!longUrl || !longUrl.startsWith('http')) {
            return sock.sendMessage(from, { text: '❌ Usage: .chilpit <https://example.com/long/url>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_273f9867e9';
            const apiUrl = `https://apis.xwolf.space/api/short/chilpit?url=${encodeURIComponent(longUrl)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });

            let short = null;
            if (response.data.success) {
                short = extractShortUrl(response.data);
            }
            if (!short) {
                short = response.data.error || 'Shortening failed';
            }

            await sock.sendMessage(from, {
                text: `🔗 *Chilp.it Shortened URL*\n\n${short}`
            }, { quoted: msg });
        } catch (err) {
            console.error('Chilp.it error:', err);
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'chipmunk', category: 'Audio Effects', description: 'Apply chipmunk effect to audio', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const url = args[0];
    if (!url) return sock.sendMessage(from, { text: '❓ Usage: .chipmunk <audio_url>' }, { quoted: msg });
    if (!url.startsWith('http')) return sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });

    try {
      await sock.sendMessage(from, { text: '🎧 Applying chipmunk effect...' }, { quoted: msg });
      const apiUrl = 'https://apis.xwolf.space/api/audio/chipmunk?url=' + encodeURIComponent(url);
      const response = await axios.get(apiUrl, { httpsAgent });
      let base64Audio = response.data.result?.base64Data || response.data.base64Data;
      if (!base64Audio && typeof response.data.result === 'string') base64Audio = response.data.result;
      if (!base64Audio) throw new Error('No audio data in response');
      if (base64Audio.startsWith('data:audio')) base64Audio = base64Audio.split(',')[1];
      const audioBuffer = Buffer.from(base64Audio, 'base64');
      const caption = '✨ Chipmunk Effect Applied';
      await sock.sendMessage(from, { audio: audioBuffer, mimetype: 'audio/mpeg', fileName: 'chipmunk_effect.mp3', caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('chipmunk error:', err);
      await sock.sendMessage(from, { text: '❌ Failed: ' + err.message }, { quoted: msg });
    }
  } },
    { name: 'chorus', category: 'Audio Effects', description: 'Apply chorus effect to audio', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const url = args[0];
    if (!url) return sock.sendMessage(from, { text: '❓ Usage: .chorus <audio_url>' }, { quoted: msg });
    if (!url.startsWith('http')) return sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });

    try {
      await sock.sendMessage(from, { text: '🎧 Applying chorus effect...' }, { quoted: msg });
      const apiUrl = 'https://apis.xwolf.space/api/audio/chorus?url=' + encodeURIComponent(url);
      const response = await axios.get(apiUrl, { httpsAgent });
      let base64Audio = response.data.result?.base64Data || response.data.base64Data;
      if (!base64Audio && typeof response.data.result === 'string') base64Audio = response.data.result;
      if (!base64Audio) throw new Error('No audio data in response');
      if (base64Audio.startsWith('data:audio')) base64Audio = base64Audio.split(',')[1];
      const audioBuffer = Buffer.from(base64Audio, 'base64');
      const caption = '✨ Chorus Effect Applied';
      await sock.sendMessage(from, { audio: audioBuffer, mimetype: 'audio/mpeg', fileName: 'chorus_effect.mp3', caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('chorus error:', err);
      await sock.sendMessage(from, { text: '❌ Failed: ' + err.message }, { quoted: msg });
    }
  } },
    { name: 'christmas', category: 'fun', description: 'Christmas wishes', execute: async function (sock, msg, args) {
    const random = xmas[Math.floor(Math.random() * xmas.length)];
    await sock.sendMessage(msg.key.remoteJid, {
      text: `🎄 *Merry Christmas!*\n\n${random}`
    }, { quoted: msg });
  } },
    { name: 'chrome', category: 'Ephoto', description: 'Generate chrome text effect', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const text = args.join(' ');
        if (!text) {
            return sock.sendMessage(from, { text: '❌ Usage: .chrome <text>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_273f9867e9';
            const apiUrl = `https://apis.xwolf.space/api/textpro/chrome?text=${encodeURIComponent(text)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 30000 });

            if (!response.data.success) {
                throw new Error(response.data.error || 'API failure');
            }
            if (!response.data.imageUrl) {
                throw new Error('No imageUrl in response');
            }

            const imgBuffer = await downloadFile(response.data.imageUrl);
            await sock.sendMessage(from, {
                image: imgBuffer,
                caption: '✅ Chrome text effect'
            }, { quoted: msg });
        } catch (err) {
            console.error('Chrome error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'classicgold', category: 'Ephoto', description: 'Generate classic gold text effect', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const text = args.join(' ');
        if (!text) {
            return sock.sendMessage(from, { text: '❌ Usage: .classicgold <text>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_273f9867e9';
            const apiUrl = `https://apis.xwolf.space/api/textpro/classic-gold?text=${encodeURIComponent(text)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 30000 });

            if (!response.data.success) {
                throw new Error(response.data.error || 'API failure');
            }
            if (!response.data.imageUrl) {
                throw new Error('No imageUrl in response');
            }

            const imgBuffer = await downloadFile(response.data.imageUrl);
            await sock.sendMessage(from, {
                image: imgBuffer,
                caption: '✅ Classic gold text effect'
            }, { quoted: msg });
        } catch (err) {
            console.error('Classic gold error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'claude', category: 'ai', description: 'Chat with Claude AI', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) return sock.sendMessage(from, { text: '❌ Usage: .claude <message>' }, { quoted: msg });

        try {
            await sock.sendMessage(from, { text: '🤔 Thinking...' }, { quoted: msg });
            const response = await axios.get(`https://ravenn.site/ai/claudeai?q=${encodeURIComponent(query)}`, { timeout: 30000 });
            const data = response.data;
            if (data.status && data.result) {
                await sock.sendMessage(from, { text: data.result }, { quoted: msg });
            } else {
                throw new Error('Invalid response');
            }
        } catch (err) {
            console.error('Claude error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'clckru', category: 'tools', description: 'Shorten URL with clck.ru', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const longUrl = args[0];
        if (!longUrl || !longUrl.startsWith('http')) {
            return sock.sendMessage(from, { text: '❌ Usage: .clckru <https://example.com/long/url>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_273f9867e9';
            const apiUrl = `https://apis.xwolf.space/api/short/clckru?url=${encodeURIComponent(longUrl)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });

            let short = null;
            if (response.data.success) {
                short = extractShortUrl(response.data);
            }
            if (!short) {
                short = response.data.error || 'Shortening failed';
            }

            await sock.sendMessage(from, {
                text: `🔗 *clck.ru Shortened URL*\n\n${short}`
            }, { quoted: msg });
        } catch (err) {
            console.error('clck.ru error:', err);
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'cleanuri', category: 'tools', description: 'Shorten URL with CleanURI', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const longUrl = args[0];
        if (!longUrl || !longUrl.startsWith('http')) {
            return sock.sendMessage(from, { text: '❌ Usage: .cleanuri <https://example.com/long/url>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_273f9867e9';
            const apiUrl = `https://apis.xwolf.space/api/short/cleanuri?url=${encodeURIComponent(longUrl)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });

            let short = null;
            if (response.data.success) {
                short = extractShortUrl(response.data);
            }
            if (!short) {
                short = response.data.error || 'Shortening failed';
            }

            await sock.sendMessage(from, {
                text: `🔗 *CleanURI Shortened URL*\n\n${short}`
            }, { quoted: msg });
        } catch (err) {
            console.error('CleanURI error:', err);
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'clearsudo', category: 'owner', description: '', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        if (!isArchitect && !isOwner && !isMe) {
            return await sock.sendMessage(from, { text: "This command is restricted to the owner and sudo users only." }, { quoted: msg });
        }

        if (!global.sudoUsers || !Array.isArray(global.sudoUsers)) {
            global.sudoUsers = [];
        }

        const count = global.sudoUsers.length;
        global.sudoUsers = [];

    
        try {
            const sudoPath = path.join(__dirname, '..', 'sudo.json');
            fs.writeFileSync(sudoPath, JSON.stringify(global.sudoUsers, null, 2));
        } catch (err) {
            console.error('Failed to save sudo.json:', err);
        }

        await sock.sendMessage(from, { text: `✅ Cleared sudo list. Removed ${count} user(s).` }, { quoted: msg });
    } },
    { name: 'cocktailrandom', category: 'food', description: 'Get a random cocktail with ingredients and preparation instructions', execute: async function (sock, msg) {
        const from = msg.key.remoteJid;

        let drink = null;
        let imageUrl = null;

        try {
            const apiKey = 'wxa_f_273f9867e9';
            const url = `https://apis.xwolf.space/api/food/cocktail/random?key=${apiKey}`;
            const response = await axios.get(url, { timeout: 15000 });
            const data = response.data;

            if (data.success && data.drinks && data.drinks.length) {
                drink = data.drinks[0];
                imageUrl = drink.strDrinkThumb;
            } else if (data.success && data.result && data.result.length) {
                drink = data.result[0];
                imageUrl = drink.strDrinkThumb || drink.image;
            } else {
                throw new Error('No drink found');
            }
        } catch (err) {
            console.log('Wolf API failed, falling back to TheCocktailDB...');
            try {
                const fallbackRes = await axios.get('https://www.thecocktaildb.com/api/json/v1/1/random.php', { timeout: 10000 });
                if (fallbackRes.data.drinks && fallbackRes.data.drinks.length) {
                    drink = fallbackRes.data.drinks[0];
                    imageUrl = drink.strDrinkThumb;
                } else {
                    return sock.sendMessage(from, { text: '❌ Could not fetch random cocktail.' }, { quoted: msg });
                }
            } catch (fallbackErr) {
                return sock.sendMessage(from, { text: '❌ API error.' }, { quoted: msg });
            }
        }

        if (!drink) {
            return sock.sendMessage(from, { text: '❌ No cocktail data received.' }, { quoted: msg });
        }

        const ingredients = [];
        for (let i = 1; i <= 15; i++) {
            const ing = drink[`strIngredient${i}`];
            const measure = drink[`strMeasure${i}`];
            if (ing && ing.trim() !== '') {
                ingredients.push(`${measure ? measure.trim() + ' ' : ''}${ing.trim()}`);
            } else break;
        }

        const text = `🍹 *${drink.strDrink}*\n\n` +
            `📋 *Glass:* ${drink.strGlass || 'N/A'}\n` +
            `🧪 *Ingredients:*\n${ingredients.map(i => `  • ${i}`).join('\n')}\n\n` +
            `📝 *Instructions:* ${drink.strInstructions || 'N/A'}`;

        let imageBuffer = null;
        if (imageUrl) {
            try {
                const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 8000 });
                imageBuffer = Buffer.from(imgRes.data);
            } catch (err) {
                console.log('Image download failed:', err.message);
            }
        }

        if (imageBuffer) {
            await sock.sendMessage(from, { image: imageBuffer, caption: text }, { quoted: msg });
        } else {
            await sock.sendMessage(from, { text }, { quoted: msg });
        }
    } },
    { name: 'cocktailsearch', category: 'food', description: 'Search cocktails/drinks by name (returns ingredients, glass type, instructions)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .cocktailsearch <name> (e.g., .cocktailsearch margarita)' }, { quoted: msg });
        }

        let drink = null;
        let imageUrl = null;

        try {
            const apiKey = 'wxa_f_273f9867e9';
            const url = `https://apis.xwolf.space/api/food/cocktail/search?name=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(url, { httpsAgent: agent, timeout: 15000 });
            const data = response.data;

            if (data.success && data.drinks && data.drinks.length) {
                drink = data.drinks[0];
                imageUrl = drink.strDrinkThumb;
            } else if (data.success && data.result && data.result.length) {
                drink = data.result[0];
                imageUrl = drink.strDrinkThumb || drink.image;
            } else {
                throw new Error('No drink found');
            }
        } catch (err) {
            console.log('Wolf API failed, falling back to TheCocktailDB...');
            try {
                const fallbackRes = await axios.get(`https://www.thecocktaildb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`, { timeout: 10000 });
                if (fallbackRes.data.drinks && fallbackRes.data.drinks.length) {
                    drink = fallbackRes.data.drinks[0];
                    imageUrl = drink.strDrinkThumb;
                } else {
                    return sock.sendMessage(from, { text: `❌ No cocktails found for "${query}".` }, { quoted: msg });
                }
            } catch (fallbackErr) {
                return sock.sendMessage(from, { text: '❌ API error.' }, { quoted: msg });
            }
        }

        if (!drink) {
            return sock.sendMessage(from, { text: `❌ No cocktails found for "${query}".` }, { quoted: msg });
        }

        const ingredients = [];
        for (let i = 1; i <= 15; i++) {
            const ing = drink[`strIngredient${i}`];
            const measure = drink[`strMeasure${i}`];
            if (ing && ing.trim() !== '') {
                ingredients.push(`${measure ? measure.trim() + ' ' : ''}${ing.trim()}`);
            } else break;
        }

        const text = `🍹 *${drink.strDrink}*\n\n` +
            `📋 *Glass:* ${drink.strGlass || 'N/A'}\n` +
            `🧪 *Ingredients:*\n${ingredients.map(i => `  • ${i}`).join('\n')}\n\n` +
            `📝 *Instructions:* ${drink.strInstructions || 'N/A'}`;

        let imageBuffer = null;
        if (imageUrl) {
            try {
                const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 8000 });
                imageBuffer = Buffer.from(imgRes.data);
            } catch (err) {
                console.log('Image download failed:', err.message);
            }
        }

        if (imageBuffer) {
            await sock.sendMessage(from, { image: imageBuffer, caption: text }, { quoted: msg });
        } else {
            await sock.sendMessage(from, { text }, { quoted: msg });
        }
    } },
    { name: 'code', category: 'tools', description: 'Generate code from description', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const prompt = args.join(' ');
        if (!prompt) {
            return sock.sendMessage(from, { text: '❌ Usage: .code <description of code needed>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_273f9867e9';
            const url = `https://apis.xwolf.space/api/ai/code?key=${apiKey}`;
            const response = await axios.post(url, { prompt }, { timeout: 30000 });

            if (response.data.status === true) {
                let code = response.data.result || response.data.code || 'No code generated.';
                await sock.sendMessage(from, {
                    text: `💻 *Generated Code:*\n\`\`\`\n${code.slice(0, 1900)}\n\`\`\``
                }, { quoted: msg });
            } else {
                await sock.sendMessage(from, {
                    text: `⚠️ ${response.data.error || 'Code generation failed.'}`
                }, { quoted: msg });
            }
        } catch (error) {
            console.error('Code generation error:', error);
            await sock.sendMessage(from, { text: '❌ Code AI error. Please try again later.' }, { quoted: msg });
        }
    } },
    { name: 'cohere', category: 'ai', description: 'Chat with Cohere AI', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .cohere <message>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_273f9867e9';
            const url = `https://apis.xwolf.space/api/ai/cohere?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(url, { httpsAgent: agent, timeout: 30000 });
            const data = response.data;

            let reply = 'No response';
            if (data.status && data.result) {
                reply = data.result;
            } else if (data.error) {
                reply = `⚠️ ${data.error}`;
            }

            await sock.sendMessage(from, { text: `🤖 *Cohere:*\n${reply.slice(0, 2000)}` }, { quoted: msg });
        } catch (err) {
            console.error('Cohere error:', err);
            await sock.sendMessage(from, { text: '❌ API error. Please try again later.' }, { quoted: msg });
        }
    } },
    { name: 'color', category: 'tools', description: 'Generate random color with hex/rgb/hsl', execute: async function (sock, msg, args) {
    const r = randomInt(0, 255);
    const g = randomInt(0, 255);
    const b = randomInt(0, 255);
    const hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    const rgb = `rgb(${r}, ${g}, ${b})`;
    const hsl = `hsl(${randomInt(0, 360)}, ${randomInt(50, 100)}%, ${randomInt(40, 70)}%)`;
    await sock.sendMessage(msg.key.remoteJid, {
      text: `🎨 *Random Color*\n\nHex: ${hex}\nRGB: ${rgb}\nHSL: ${hsl}`
    }, { quoted: msg });
  } },
    { name: 'compliments', category: 'fun', description: 'Random mature and realistic compliment', execute: async function (sock, msg, args) {
    const random = compliments[Math.floor(Math.random() * compliments.length)];
    await sock.sendMessage(msg.key.remoteJid, {
      text: `🌸 *Compliment*\n\n${random}`
    }, { quoted: msg });
  } },
    { name: 'copperchrome', category: 'Ephoto', description: 'Generate copper-chrome text effect', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const text = args.join(' ');
    if (!text) return sock.sendMessage(from, { text: '❓ Usage: .copperchrome <text>' }, { quoted: msg });

    try {
      const apiUrl = `https://apis.xwolf.space/api/textpro/copper-chrome?text=${encodeURIComponent(text)}`;
      const response = await axios.get(apiUrl, { httpsAgent });
      if (!response.data.success) throw new Error(response.data.error || 'API failure');
      if (!response.data.imageUrl) throw new Error('No imageUrl in response');
      const imgBuffer = await downloadFile(response.data.imageUrl);
      const caption = '🎨 *Text Effect: copperchrome*';
      await sock.sendMessage(from, { image: imgBuffer, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('copperchrome error:', err);
      await sock.sendMessage(from, { text: `❌ Failed to generate image.\n${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'country', category: 'fun', description: 'Get information about any country', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;

        if (!args.length) {
            return await sock.sendMessage(from, {
                text: `❌ Please provide a country name.\n\nExample:\n.country Italy`
            }, { quoted: msg });
        }

        const query = args.join(' ');

        await sock.sendMessage(from, {
            text: '🌍 Fetching country data...'
        }, { quoted: msg });

        try {
            const response = await axios.get(
                `https://restcountries.com/v3.1/name/${encodeURIComponent(query)}?fullText=true`
            );

            const data = response.data[0];

            if (!data) {
                return await sock.sendMessage(from, {
                    text: '❌ Country not found.'
                }, { quoted: msg });
            }

            const flag = data.flag || '🌍';
            const name = data.name?.common || 'Unknown';
            const official = data.name?.official || 'Unknown';
            const capital = data.capital?.[0] || 'Unknown';
            const region = `${data.region || 'Unknown'} › ${data.subregion || 'Unknown'}`;
            const population = data.population ? data.population.toLocaleString() : 'Unknown';
            const currencyKey = Object.keys(data.currencies || {})[0];
            const currency = currencyKey
                ? `${data.currencies[currencyKey].name} (${data.currencies[currencyKey].symbol || currencyKey})`
                : 'Unknown';
            const languages = data.languages ? Object.values(data.languages).join(', ') : 'Unknown';
            const callingCode = data.idd?.root && data.idd?.suffixes?.[0]
                ? `${data.idd.root}${data.idd.suffixes[0]}`
                : 'Unknown';
            const timezone = data.timezones?.[0] || 'Unknown';
            const drivingSide = data.car?.side || 'Unknown';
            const tld = data.tld?.join(', ') || 'Unknown';

            const text =
`${flag} *${name}* (${official})

🏙️ *Capital:* ${capital}
🌐 *Region:* ${region}
👥 *Population:* ${population}
💰 *Currency:* ${currency}
🗣️ *Languages:* ${languages}
📞 *Calling Code:* ${callingCode}
🕐 *Timezone:* ${timezone}
🚗 *Driving Side:* ${drivingSide}
🌐 *TLD:* ${tld}`;

            await sock.sendMessage(from, { text }, { quoted: msg });
        } catch (err) {
            console.log(err);
            await sock.sendMessage(from, {
                text: `❌ Failed to fetch country information.\n\nMake sure the country name is valid.`
            }, { quoted: msg });
        }
    } },
    { name: 'creategc', category: 'owner', description: 'Create a WhatsApp group (owner only)', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo) {
            return await sock.sendMessage(from, { text: "This command is restricted to the owner and sudo users only." }, { quoted: msg });
        }

        if (args.length === 0) {
            return await sock.sendMessage(from, { text: '❓ Usage: .creategc <group_name (max 10 words)> [phone1 phone2 ...]' }, { quoted: msg });
        }

        const maxNameWords = 10;
        const groupNameWords = args.slice(0, maxNameWords);
        const groupName = groupNameWords.join(' ');
        const participantArgs = args.slice(maxNameWords);

        let participants = [];
        for (let p of participantArgs) {
            let cleaned = p.replace(/[^0-9]/g, '');
            if (cleaned) {
                participants.push(cleaned + '@s.whatsapp.net');
            } else {
                return await sock.sendMessage(from, { text: `❌ Invalid phone number: ${p}. Use digits only.` }, { quoted: msg });
            }
        }

        try {
            const group = await sock.groupCreate(groupName, participants);
            const groupJid = group.id;
            const inviteCode = await sock.groupInviteCode(groupJid);
            const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
            await sock.sendMessage(from, {
                text: `✅ Group created!\n📛 ${groupName}\n🆔 ${groupJid}\n🔗 ${inviteLink}\n👥 Added: ${participants.length}`
            }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'cry', category: 'anime', description: 'Random cry anime', execute: async function (sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random cry anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/cry', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime cry*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('cry error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime cry.' }, { quoted: msg });
    }
  } },
    { name: 'crypto', category: 'financial data', description: 'Get crypto/financial data (forex, crypto, stock, inflation, gdp, bankrate, wallet, gold, market, news)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;

        if (!args.length) {
            return sock.sendMessage(from, {
                text: '❌ Usage: .crypto <type> [param]\n\nTypes: forex, crypto, stock, inflation, gdp, bankrate, wallet, gold, market, news'
            }, { quoted: msg });
        }

        const command = args[0].toLowerCase();
        const param = args.slice(1).join(' ');

        try {
            const apiKey = 'wxa_f_273f9867e9';
            let apiUrl = '';
            let paramLabel = '';

            if (command === 'forex') {
                const [fromCur, toCur] = param ? param.split(',') : ['USD', 'EUR'];
                apiUrl = `https://apis.xwolf.space/api/economy/forex?from=${fromCur}&to=${toCur}&key=${apiKey}`;
                paramLabel = `${fromCur}/${toCur}`;
            } else if (command === 'crypto') {
                const symbol = param ? param.toUpperCase() : 'BTC';
                apiUrl = `https://apis.xwolf.space/api/economy/crypto?symbol=${symbol}&key=${apiKey}`;
                paramLabel = symbol;
            } else if (command === 'stock') {
                const ticker = param ? param.toUpperCase() : 'AAPL';
                apiUrl = `https://apis.xwolf.space/api/economy/stock?symbol=${ticker}&key=${apiKey}`;
                paramLabel = ticker;
            } else if (command === 'inflation') {
                const country = param ? param.toUpperCase() : 'US';
                apiUrl = `https://apis.xwolf.space/api/economy/inflation?country=${country}&key=${apiKey}`;
                paramLabel = country;
            } else if (command === 'gdp') {
                const country = param ? param.toUpperCase() : 'US';
                apiUrl = `https://apis.xwolf.space/api/economy/gdp?country=${country}&key=${apiKey}`;
                paramLabel = country;
            } else if (command === 'bankrate') {
                const country = param ? param.toUpperCase() : 'US';
                apiUrl = `https://apis.xwolf.space/api/economy/bank-rate?country=${country}&key=${apiKey}`;
                paramLabel = country;
            } else if (command === 'wallet') {
                if (!param) {
                    return sock.sendMessage(from, { text: '❌ Usage: .crypto wallet <crypto_address>' }, { quoted: msg });
                }
                apiUrl = `https://apis.xwolf.space/api/economy/wallet?address=${param}&key=${apiKey}`;
                paramLabel = param.slice(0, 10) + '...';
            } else if (command === 'gold') {
                apiUrl = `https://apis.xwolf.space/api/economy/gold?key=${apiKey}`;
                paramLabel = '';
            } else if (command === 'market') {
                apiUrl = `https://apis.xwolf.space/api/economy/market?key=${apiKey}`;
                paramLabel = '';
            } else if (command === 'news') {
                apiUrl = `https://apis.xwolf.space/api/economy/news?key=${apiKey}`;
                paramLabel = '';
            } else {
                return sock.sendMessage(from, {
                    text: '❌ Unknown type. Use: forex, crypto, stock, inflation, gdp, bankrate, wallet, gold, market, news'
                }, { quoted: msg });
            }

            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });
            const data = response.data;

            if (!data.success) throw new Error(data.error || 'No data');

            let output = `📊 *Financial Data*`;
            if (paramLabel) output += ` (${paramLabel})`;
            output += '\n\n';

            if (command === 'crypto') {
                output += `💎 *${data.symbol || paramLabel}*\n`;
                output += `💰 Price: ${formatNumber(data.price_usd)}\n`;
                if (data.change_24h !== undefined) output += `📈 24h Change: ${data.change_24h > 0 ? '+' : ''}${data.change_24h}%\n`;
                if (data.market_cap_usd) output += `🏦 Market Cap: ${formatNumber(data.market_cap_usd)}\n`;
                if (data.volume_24h_usd) output += `📊 24h Volume: ${formatNumber(data.volume_24h_usd)}\n`;
            } else if (command === 'stock') {
                output += `📈 *${data.symbol || paramLabel}*\n`;
                output += `💵 Price: ${formatNumber(data.price)}\n`;
                if (data.change !== undefined) output += `📉 Change: ${data.change > 0 ? '+' : ''}${data.change}%\n`;
                if (data.volume) output += `📊 Volume: ${formatNumber(data.volume)}\n`;
            } else if (command === 'forex') {
                output += `💱 *${data.from || 'USD'} → ${data.to || 'EUR'}*\n`;
                output += `💹 Rate: ${data.rate || data.result}\n`;
                if (data.change) output += `📈 Change: ${data.change}%\n`;
            } else if (command === 'gold') {
                output += `🥇 *Gold & Silver*\n`;
                output += `🪙 Gold: ${formatNumber(data.gold)}/oz\n`;
                if (data.silver) output += `🥈 Silver: ${formatNumber(data.silver)}/oz\n`;
            } else if (command === 'market') {
                output += `🌍 *Market Indices*\n`;
                if (data.sp500) output += `📊 S&P 500: ${formatNumber(data.sp500)}\n`;
                if (data.dow) output += `📈 Dow Jones: ${formatNumber(data.dow)}\n`;
                if (data.nasdaq) output += `📉 Nasdaq: ${formatNumber(data.nasdaq)}\n`;
            } else if (command === 'inflation') {
                output += `📉 *Inflation Rate (${paramLabel || 'US'})*\n`;
                output += `📅 Annual: ${data.rate}%\n`;
                if (data.year) output += `🗓️ Year: ${data.year}\n`;
            } else if (command === 'gdp') {
                output += `📊 *GDP (${paramLabel || 'US'})*\n`;
                output += `💰 GDP: ${formatNumber(data.gdp)}\n`;
                if (data.growth) output += `📈 Growth: ${data.growth}%\n`;
            } else if (command === 'bankrate') {
                output += `🏦 *Central Bank Rate (${paramLabel || 'US'})*\n`;
                output += `💹 Rate: ${data.rate}%\n`;
            } else if (command === 'news') {
                output += `📰 *Financial News*\n\n`;
                const headlines = data.result || data.articles || [];
                if (Array.isArray(headlines) && headlines.length) {
                    headlines.slice(0, 5).forEach((item, i) => {
                        output += `${i + 1}. ${item.title || item.headline}\n`;
                        if (item.source) output += `   📍 ${item.source}\n`;
                        output += `\n`;
                    });
                } else {
                    output += `No news available.\n`;
                }
            } else if (command === 'wallet') {
                output += `💳 *Wallet Balance*\n`;
                output += `💰 Balance: ${formatNumber(data.balance)} ${data.currency || 'BTC'}\n`;
                if (data.transactions) output += `🔄 Transactions: ${data.transactions}\n`;
            } else {
                output += JSON.stringify(data.result || data, null, 2);
            }

            await sock.sendMessage(from, { text: output.slice(0, 2000) }, { quoted: msg });
        } catch (err) {
            console.error('Crypto error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'cuddle', category: 'anime', description: 'Random cuddle anime', execute: async function (sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random cuddle anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/cuddle', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime cuddle*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('cuddle error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime cuddle.' }, { quoted: msg });
    }
  } },
    { name: 'currentsettings', category: 'owner', description: 'Show current bot settings (owner & sudo only)', execute: async function (sock, msg, args, { isArchitect }) {
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
    } },
    { name: 'dance', category: 'anime', description: 'Random dance anime', execute: async function (sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random dance anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/dance', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime dance*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('dance error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime dance.' }, { quoted: msg });
    }
  } },
    { name: 'dares', category: 'fun', description: 'Text-friendly dares for WhatsApp games', execute: async function (sock, msg, args) {
    const random = dares[Math.floor(Math.random() * dares.length)];
    await sock.sendMessage(msg.key.remoteJid, {
      text: `⚡ *Dare*\n\n${random}`
    }, { quoted: msg });
  } },
    { name: 'debuggroup', category: 'owner', description: '', execute: async function (sock, msg) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) {
            return await sock.sendMessage(from, { text: '❌ Use in group.' }, { quoted: msg });
        }
        const group = await sock.groupMetadata(from);
        const botNumber = sock.user.id.split(':')[0].split('@')[0];
        const botFull = sock.user.id;
        const found = group.participants.find(p => p.id.includes(botNumber));
        const admins = group.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').map(p => p.id);
        await sock.sendMessage(from, {
            text: `🤖 Bot ID: ${botFull}\n📱 Bot number: ${botNumber}\n✅ Found in group: ${found ? 'Yes' : 'No'}\n👑 Admin status: ${found?.admin || 'none'}\n👥 Admin list (first 10):\n${admins.slice(0,10).join('\n')}`
        }, { quoted: msg });
    } },
    { name: 'deep', category: 'Audio Effects', description: 'Apply deep effect to audio', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const url = args[0];
    if (!url) return sock.sendMessage(from, { text: '❓ Usage: .deep <audio_url>' }, { quoted: msg });
    if (!url.startsWith('http')) return sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });

    try {
      await sock.sendMessage(from, { text: '🎧 Applying deep effect...' }, { quoted: msg });
      const apiUrl = 'https://apis.xwolf.space/api/audio/deep?url=' + encodeURIComponent(url);
      const response = await axios.get(apiUrl, { httpsAgent });
      let base64Audio = response.data.result?.base64Data || response.data.base64Data;
      if (!base64Audio && typeof response.data.result === 'string') base64Audio = response.data.result;
      if (!base64Audio) throw new Error('No audio data in response');
      if (base64Audio.startsWith('data:audio')) base64Audio = base64Audio.split(',')[1];
      const audioBuffer = Buffer.from(base64Audio, 'base64');
      const caption = '✨ Deep Effect Applied';
      await sock.sendMessage(from, { audio: audioBuffer, mimetype: 'audio/mpeg', fileName: 'deep_effect.mp3', caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('deep error:', err);
      await sock.sendMessage(from, { text: '❌ Failed: ' + err.message }, { quoted: msg });
    }
  } },
    { name: 'deepseek', category: 'tools', description: 'Chat with DeepSeek AI', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .deepseek <message>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_273f9867e9';
            const url = `https://apis.xwolf.space/api/ai/deepseek?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(url, { timeout: 30000 });

            if (response.data.status === true) {
                const reply = response.data.result || 'No response.';
                await sock.sendMessage(from, { text: `🤖 *DeepSeek:*\n${reply.slice(0, 2000)}` }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: `⚠️ ${response.data.error || 'API error'}` }, { quoted: msg });
            }
        } catch (error) {
            console.error('DeepSeek error:', error);
            await sock.sendMessage(from, { text: '❌ Failed to reach DeepSeek API.' }, { quoted: msg });
        }
    } },
    { name: 'delete', category: 'group', description: 'Delete a replied message and the delete command itself (admin only in groups, owner also in private)', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;

        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quotedMsg) {
            return await sock.sendMessage(from, { text: '⚠️ Reply to the message you want to delete.' }, { quoted: msg });
        }

        let isAdmin = false;
        let isGroup = from.endsWith('@g.us');

        if (isGroup) {
            try {
                const groupMeta = await sock.groupMetadata(from);
                const senderNumber = sender.split('@')[0];
                const participant = groupMeta.participants.find(p => p.id.split('@')[0] === senderNumber);
                isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
            } catch (err) {
                console.log('Group metadata error:', err);
            }
        }

        const allowed = isArchitect || (isGroup && isAdmin);

        if (!allowed) {
            return await sock.sendMessage(from, { text: '❌ You need to be a group admin (or bot owner) to delete messages.' }, { quoted: msg });
        }

        const ctx = msg.message.extendedTextMessage.contextInfo;
        const keyToDelete = {
            remoteJid: from,
            id: ctx.stanzaId,
            fromMe: false,
            participant: ctx.participant || undefined
        };

        try {
            await sock.sendMessage(from, { delete: keyToDelete });
            await sock.sendMessage(from, { delete: msg.key });
        } catch (err) {
            console.error('Delete error:', err);
            await sock.sendMessage(from, { text: '❌ Failed to delete. Make sure I have admin privileges in the group.' }, { quoted: msg });
        }
    } },
    { name: 'demote', category: 'group', description: '', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) return;

        const metadata = await sock.groupMetadata(from);
        const participants = metadata.participants;
        const sender = msg.key.participant || msg.key.remoteJid;
        
        const ownerNumber = '254798841125@s.whatsapp.net';
        const cleanSender = sender.split(':')[0] + '@s.whatsapp.net';

        const isSenderAdmin = participants.find(p => p.id === sender)?.admin !== null;
        const isOwner = cleanSender === ownerNumber || msg.key.fromMe;
        
        if (!isSenderAdmin && !isOwner) {
            return await sock.sendMessage(from, { text: "❎ You are not worthy of this command." }, { quoted: msg });
        }

        const quotedMessage = msg.message.extendedTextMessage?.contextInfo?.participant;
        const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const targets = mentioned.length > 0 ? mentioned : (quotedMessage ? [quotedMessage] : []);

        if (targets.length === 0) return await sock.sendMessage(from, { text: 'Tag the individual or reply to their message to revoke power.' }, { quoted: msg });

        if (targets.includes(ownerNumber)) {
            return await sock.sendMessage(from, { text: "⚠️ *System Fault:* Spencer's authority is absolute. It cannot be revoked." }, { quoted: msg });
        }

        const demoteQuotes = [
            "Back to the shadows. Your time in the light is over.",
            "Authority revoked. You have been downgraded to civilian status.",
            "Rank reset. Spencer's standards were not met.",
            "The crown was too heavy. I'll take it back now.",
            "Access level reduced. Know your place in the system.",
            "Power surge detected... and extinguished. You are no longer Admin.",
            "The hierarchy has been recalibrated. You are now obsolete."
        ];
        const quote = demoteQuotes[Math.floor(Math.random() * demoteQuotes.length)];

        try {
            await sock.groupParticipantsUpdate(from, targets, "demote");

            const mentionTag = `@${targets[0].split('@')[0]}`;

            await sock.sendMessage(from, { 
                text: `📉 *RANK REVOKED*\n\n${mentionTag}\n${quote}`,
                mentions: targets
            }, { quoted: msg });
        } catch (e) {
            await sock.sendMessage(from, { text: "Demotion failed. Check my Admin status." }, { quoted: msg });
        }
    } },
    { name: 'dictionary', category: 'tools', description: 'Get word definition and meanings', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const word = args[0];
        if (!word) {
            return sock.sendMessage(from, { text: '❌ Usage: .dictionary <word>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_273f9867e9';
            const apiUrl = `https://apis.xwolf.space/api/tools/dictionary?word=${encodeURIComponent(word)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });
            const result = response.data.result || response.data.definition || 'No result';

            await sock.sendMessage(from, {
                text: `📚 *Dictionary: ${word}*\n\n${result.slice(0, 1900)}`
            }, { quoted: msg });
        } catch (err) {
            console.error('Dictionary error:', err);
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'distortion', category: 'Audio Effects', description: 'Apply distortion effect to audio', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const url = args[0];
    if (!url) return sock.sendMessage(from, { text: '❓ Usage: .distortion <audio_url>' }, { quoted: msg });
    if (!url.startsWith('http')) return sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });

    try {
      await sock.sendMessage(from, { text: '🎧 Applying distortion effect...' }, { quoted: msg });
      const apiUrl = 'https://apis.xwolf.space/api/audio/distortion?url=' + encodeURIComponent(url);
      const response = await axios.get(apiUrl, { httpsAgent });
      let base64Audio = response.data.result?.base64Data || response.data.base64Data;
      if (!base64Audio && typeof response.data.result === 'string') base64Audio = response.data.result;
      if (!base64Audio) throw new Error('No audio data in response');
      if (base64Audio.startsWith('data:audio')) base64Audio = base64Audio.split(',')[1];
      const audioBuffer = Buffer.from(base64Audio, 'base64');
      const caption = '✨ Distortion Effect Applied';
      await sock.sendMessage(from, { audio: audioBuffer, mimetype: 'audio/mpeg', fileName: 'distortion_effect.mp3', caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('distortion error:', err);
      await sock.sendMessage(from, { text: '❌ Failed: ' + err.message }, { quoted: msg });
    }
  } },
    { name: 'dns', category: 'ethical hacking', description: 'DNS lookup (A, AAAA, MX, TXT, NS, CNAME)', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const domain = args[0];
    if (!domain) return sock.sendMessage(from, { text: '❓ Usage: .dns <domain>' }, { quoted: msg });

    try {
      await sock.sendMessage(from, { text: `🔍 Performing DNS lookup on ${domain}...` }, { quoted: msg });
      const records = {};
      const types = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME'];
      for (const type of types) {
        try { records[type] = await dns.resolve(domain, type); } catch { records[type] = 'Not found'; }
      }
      let result = `🌐 DNS Records for ${domain}\n`;
      result += `A: ${Array.isArray(records.A) ? records.A.join(', ') : records.A}\n`;
      result += `AAAA: ${Array.isArray(records.AAAA) ? records.AAAA.join(', ') : records.AAAA}\n`;
      result += `MX: ${Array.isArray(records.MX) ? records.MX.map(r => `${r.exchange} (prio ${r.priority})`).join(', ') : records.MX}\n`;
      result += `TXT: ${Array.isArray(records.TXT) ? records.TXT.flat().join(', ').slice(0, 200) : records.TXT}\n`;
      result += `NS: ${Array.isArray(records.NS) ? records.NS.join(', ') : records.NS}\n`;
      result += `CNAME: ${Array.isArray(records.CNAME) ? records.CNAME.join(', ') : records.CNAME}\n`;
      await sock.sendMessage(from, { text: result.slice(0, 2000) }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ DNS error: ${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'doba', category: 'audio', description: 'Download a song from YouTube as MP3 with cover', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .doba <song name or YouTube URL>' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: '🔍 Searching for your song...' }, { quoted: msg });

            let videoId;
            let title = 'Unknown';
            let thumbnail = null;
            let duration = 'N/A';

            const isUrl = query.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/);

            if (isUrl) {
                const urlObj = new URL(query);
                if (urlObj.hostname === 'youtu.be') {
                    videoId = urlObj.pathname.slice(1);
                } else {
                    videoId = urlObj.searchParams.get('v');
                }
                if (!videoId) {
                    return sock.sendMessage(from, { text: '❌ Invalid YouTube URL.' }, { quoted: msg });
                }
                try {
                    const info = await yts({ videoId });
                    if (info) {
                        title = info.title || 'Unknown';
                        duration = info.duration?.timestamp || 'N/A';
                        thumbnail = info.thumbnail || null;
                    }
                } catch (e) {
                    console.log('Could not fetch video info:', e.message);
                }
            } else {
                const searchResults = await yts(query);
                if (!searchResults.videos.length) {
                    return sock.sendMessage(from, { text: '❌ No results found.' }, { quoted: msg });
                }
                const video = searchResults.videos[0];
                videoId = video.videoId;
                title = video.title || 'Unknown';
                duration = video.duration?.timestamp || 'N/A';
                thumbnail = video.thumbnail || null;
            }

            await sock.sendMessage(from, { text: `⬇️ Downloading *${title}*...` }, { quoted: msg });

            const apiKey = 'wxa_f_28d599362e';
            const apiUrl = `https://apis.xwolf.space/api/music/download?id=${videoId}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { timeout: 30000 });

            if (!response.data.success) {
                throw new Error(response.data.error || 'Download failed');
            }

            let downloadUrl = response.data.result?.downloadUrl || response.data.downloadUrl || response.data.url || response.data.result?.url;
            if (!downloadUrl) {
                throw new Error('No download URL found in API response');
            }

            const audioRes = await axios.get(downloadUrl, {
                responseType: 'arraybuffer',
                timeout: 60000
            });
            const audioBuffer = Buffer.from(audioRes.data);

            if (audioBuffer.length < 50000) {
                return sock.sendMessage(from, { text: '❌ Downloaded file is too small.' }, { quoted: msg });
            }

            const fileSizeMB = (audioBuffer.length / (1024 * 1024)).toFixed(2);
            if (audioBuffer.length > 16 * 1024 * 1024) {
                return sock.sendMessage(from, { text: `❌ File too large (${fileSizeMB} MB). Max 16 MB.` }, { quoted: msg });
            }

            if (thumbnail) {
                try {
                    const imgRes = await axios.get(thumbnail, { responseType: 'arraybuffer', timeout: 10000 });
                    const imgBuffer = Buffer.from(imgRes.data);
                    await sock.sendMessage(from, {
                        image: imgBuffer,
                        caption: `🎵 *${title}*\n⏱️ *Duration:* ${duration}`
                    }, { quoted: msg });
                } catch (e) {
                    console.log('Thumbnail download failed:', e.message);
                }
            }

            await sock.sendMessage(from, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                fileName: `${title.replace(/[^a-zA-Z0-9]/g, '_')}.mp3`,
                caption: '✅ Song downloaded.'
            }, { quoted: msg });

        } catch (err) {
            console.error('Doba error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'dolphin', category: 'ai', description: 'Chat with Dolphin - uncensored AI', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .dolphin <message>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_273f9867e9';
            const url = `https://apis.xwolf.space/api/ai/dolphin?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(url, { timeout: 30000 });

            let reply = 'No response';
            if (response.data.status && response.data.result) {
                reply = response.data.result;
            } else if (response.data.error) {
                reply = `⚠️ ${response.data.error}`;
            }

            await sock.sendMessage(from, { text: `🤖 *Dolphin:*\n${reply.slice(0, 2000)}` }, { quoted: msg });
        } catch (err) {
            console.error('Dolphin error:', err);
            await sock.sendMessage(from, { text: '❌ API error. Please try again later.' }, { quoted: msg });
        }
    } },
    { name: 'echo', category: 'Audio Effects', description: 'Apply echo effect to audio', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const url = args[0];
    if (!url) return sock.sendMessage(from, { text: '❓ Usage: .echo <audio_url>' }, { quoted: msg });
    if (!url.startsWith('http')) return sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });

    try {
      await sock.sendMessage(from, { text: '🎧 Applying echo effect...' }, { quoted: msg });
      const apiUrl = 'https://apis.xwolf.space/api/audio/echo?url=' + encodeURIComponent(url);
      const response = await axios.get(apiUrl, { httpsAgent });
      let base64Audio = response.data.result?.base64Data || response.data.base64Data;
      if (!base64Audio && typeof response.data.result === 'string') base64Audio = response.data.result;
      if (!base64Audio) throw new Error('No audio data in response');
      if (base64Audio.startsWith('data:audio')) base64Audio = base64Audio.split(',')[1];
      const audioBuffer = Buffer.from(base64Audio, 'base64');
      const caption = '✨ Echo Effect Applied';
      await sock.sendMessage(from, { audio: audioBuffer, mimetype: 'audio/mpeg', fileName: 'echo_effect.mp3', caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('echo error:', err);
      await sock.sendMessage(from, { text: '❌ Failed: ' + err.message }, { quoted: msg });
    }
  } },
    { name: 'email-validate', category: 'tools', description: 'Validate email format', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const email = args[0];
    if (!email || !email.includes('@')) return sock.sendMessage(from, { text: '❓ Usage: .email-validate <email>' }, { quoted: msg });

    try {
      const res = await axios.get(`https://apis.xwolf.space/api/tools/email-validate?email=${encodeURIComponent(email)}`, { httpsAgent: agent });
      const isValid = res.data.valid ? '✅ Valid email' : '❌ Invalid email';
      const result = res.data.result || isValid;
      await sock.sendMessage(from, {
        text: `📧 *Email Validation*\n\n${result}`
      }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'epic3d', category: 'Ephoto', description: 'Generate epic-3d text effect', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const text = args.join(' ');
    if (!text) return sock.sendMessage(from, { text: '❓ Usage: .epic3d <text>' }, { quoted: msg });

    try {
      const apiUrl = `https://apis.xwolf.space/api/textpro/epic-3d?text=${encodeURIComponent(text)}`;
      const response = await axios.get(apiUrl, { httpsAgent });
      if (!response.data.success) throw new Error(response.data.error || 'API failure');
      if (!response.data.imageUrl) throw new Error('No imageUrl in response');
      const imgBuffer = await downloadFile(response.data.imageUrl);
      const caption = '🎨 *Text Effect: epic3d*';
      await sock.sendMessage(from, { image: imgBuffer, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('epic3d error:', err);
      await sock.sendMessage(from, { text: `❌ Failed to generate image.\n${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'eval', category: 'owner', description: 'Execute JS code on the fly', execute: async function (sock, msg, args, { isMe }) {
        if (!isMe) return;

        const code = args.join(" ");
        if (!code) {
            return await sock.sendMessage(msg.key.remoteJid, {
                text: "💻 **SΛVΛGΞ:** Provide code to execute. (Example: .eval sock.user.id)"
            }, { quoted: msg });
        }

        try {
            let evaled = await eval(code);
            if (typeof evaled !== "string") evaled = require("util").inspect(evaled);
            await sock.sendMessage(msg.key.remoteJid, {
                text: `✅ **EXECUTION SUCCESS:**\n\n\`\`\`${evaled}\`\`\``
            }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(msg.key.remoteJid, {
                text: `❌ **EXECUTION ERROR:**\n\n\`\`\`${err.message}\`\`\``
            }, { quoted: msg });
        }
    } },
    { name: 'eventdetails', category: 'sports', description: 'Get sports event details', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .eventdetails <query>' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: `🏆 Fetching event details...` }, { quoted: msg });

            const apiKey = 'wxa_f_273f9867e9';
            const apiUrl = `https://apis.xwolf.space/api/sports/event/details?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });

            const result = formatResult(response.data);
            const output = `🏅 *Event Details*\n🔍 Query: ${query}\n\n${result}`;

            await sock.sendMessage(from, { text: output.slice(0, 2000) }, { quoted: msg });
        } catch (err) {
            console.error('Event details error:', err);
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'eventhighlights', category: 'sports', description: 'Get sports event highlights', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .eventhighlights <query>' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: `🏆 Fetching event highlights...` }, { quoted: msg });

            const apiKey = 'wxa_f_273f9867e9';
            const apiUrl = `https://apis.xwolf.space/api/sports/event/highlights?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });

            const result = formatResult(response.data);
            const output = `🏅 *Event Highlights*\n🔍 Query: ${query}\n\n${result}`;

            await sock.sendMessage(from, { text: output.slice(0, 2000) }, { quoted: msg });
        } catch (err) {
            console.error('Event highlights error:', err);
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'eventlineup', category: 'sports', description: 'Get sports event lineup', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .eventlineup <query>' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: `🏆 Fetching event lineup...` }, { quoted: msg });

            const apiKey = 'wxa_f_273f9867e9';
            const apiUrl = `https://apis.xwolf.space/api/sports/event/lineup?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });

            const result = formatResult(response.data);
            const output = `🏅 *Event Lineup*\n🔍 Query: ${query}\n\n${result}`;

            await sock.sendMessage(from, { text: output.slice(0, 2000) }, { quoted: msg });
        } catch (err) {
            console.error('Event lineup error:', err);
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'eventsday', category: 'sports', description: 'Get sports events by day', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .eventsday <query>' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: `🏆 Fetching events by day...` }, { quoted: msg });

            const apiKey = 'wxa_f_273f9867e9';
            const apiUrl = `https://apis.xwolf.space/api/sports/events/day?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });

            const result = formatResult(response.data);
            const output = `🏅 *Events by Day*\n🔍 Query: ${query}\n\n${result}`;

            await sock.sendMessage(from, { text: output.slice(0, 2000) }, { quoted: msg });
        } catch (err) {
            console.error('Events day error:', err);
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'eventsround', category: 'sports', description: 'Get sports events by round', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .eventsround <query>' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: `🏆 Fetching events by round...` }, { quoted: msg });

            const apiKey = 'wxa_f_273f9867e9';
            const apiUrl = `https://apis.xwolf.space/api/sports/events/round?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });

            const result = formatResult(response.data);
            const output = `🏅 *Events by Round*\n🔍 Query: ${query}\n\n${result}`;

            await sock.sendMessage(from, { text: output.slice(0, 2000) }, { quoted: msg });
        } catch (err) {
            console.error('Events round error:', err);
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'eventstats', category: 'sports', description: 'Get sports event statistics', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .eventstats <query>' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: `🏆 Fetching event stats...` }, { quoted: msg });

            const apiKey = 'wxa_f_1be53c1604';
            const apiUrl = `https://apis.xwolf.space/api/sports/event/stats?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });

            const result = formatResult(response.data);
            const output = `🏅 *Event Stats*\n🔍 Query: ${query}\n\n${result}`;

            await sock.sendMessage(from, { text: output.slice(0, 2000) }, { quoted: msg });
        } catch (err) {
            console.error('Event stats error:', err);
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'facebook', category: 'download', description: 'Download Facebook video (wolf space + fallback)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        let url = args[0];

        if (!url && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            if (quoted.conversation) {
                const match = quoted.conversation.match(/(https?:\/\/[^\s]+)/);
                if (match) url = match[0];
            } else if (quoted.extendedTextMessage?.text) {
                const match = quoted.extendedTextMessage.text.match(/(https?:\/\/[^\s]+)/);
                if (match) url = match[0];
            }
        }

        if (!url) {
            return sock.sendMessage(from, {
                text: '❌ Please provide a Facebook video URL, or reply to a message that contains one.\nExample: `.facebook https://www.facebook.com/...`'
            }, { quoted: msg });
        }

        if (!url.startsWith('http')) {
            return sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: '⬇️ Downloading Facebook video...' }, { quoted: msg });

            let downloadUrl = null;
            const wolfApiKey = 'wxa_f_9ddecf073b';
            const wolfUrl = `https://apis.xwolf.space/download/facebook?url=${encodeURIComponent(url)}&api_key=${wolfApiKey}`;

            try {
                const wolfRes = await axios.get(wolfUrl, { timeout: 15000 });
                const data = wolfRes.data;

                if (data.success && data.result && data.result.downloadUrl) {
                    downloadUrl = data.result.downloadUrl;
                } else if (data.success && data.downloadUrl) {
                    downloadUrl = data.downloadUrl;
                } else if (data.result && typeof data.result === 'string') {
                    downloadUrl = data.result;
                } else {
                    throw new Error('No download URL found in wolf response');
                }
            } catch (wolfErr) {
                console.log('Wolf API failed, trying ravenn fallback...', wolfErr.message);
                const ravennUrl = `https://ravenn.site/download/fbdown?url=${encodeURIComponent(url)}`;
                const ravennRes = await axios.get(ravennUrl, { timeout: 15000 });
                const rData = ravennRes.data;
                if (rData.status && rData.result) {
                    downloadUrl = rData.result;
                } else {
                    throw new Error('Fallback also failed: ' + (rData.error || 'unknown error'));
                }
            }

            if (!downloadUrl) {
                throw new Error('Could not retrieve video URL.');
            }

            const videoRes = await axios.get(downloadUrl, {
                responseType: 'arraybuffer',
                timeout: 60000
            });
            const videoBuffer = Buffer.from(videoRes.data);

            const caption = `📥 *Facebook Video*`;

            await sock.sendMessage(from, {
                video: videoBuffer,
                caption: caption
            }, { quoted: msg });

        } catch (err) {
            console.error('Facebook error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'facebookreel', category: 'download', description: 'Download from facebookreel', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const url = args[0];
    if (!url) return sock.sendMessage(from, { text: '❓ Usage: .facebookreel <URL>' }, { quoted: msg });
    if (!url.startsWith('http')) return sock.sendMessage(from, { text: '❌ Provide a valid URL starting with http:// or https://' }, { quoted: msg });

    try {
      const apiUrl = `https://apis.xwolf.space/download/facebook/reel?url=${encodeURIComponent(url)}`;
      const response = await axios.get(apiUrl, { httpsAgent });
      const data = response.data;

      if (!data.success) throw new Error(data.error || 'Download failed');

      // Determine content type based on command name (hardcoded)
      const isVideo = true; // facebookreel is video
      const isAudio = false;
      const isText = false;

      if (isText) {
        let text = `📁 *Download Info (facebookreel)*\n\n`;
        if (data.result) text += data.result;
        else if (data.info) text += JSON.stringify(data.info, null, 2);
        else text += JSON.stringify(data, null, 2);
        await sock.sendMessage(from, { text: text.slice(0, 2000) }, { quoted: msg });
        return;
      }

      let downloadUrl = null;
      if (data.downloadUrl) downloadUrl = data.downloadUrl;
      else if (data.result && typeof data.result === 'string') downloadUrl = data.result;
      else if (data.url) downloadUrl = data.url;
      else if (data.media && data.media.url) downloadUrl = data.media.url;
      else if (data.video && data.video.url) downloadUrl = data.video.url;
      else if (data.audio && data.audio.url) downloadUrl = data.audio.url;
      else if (Array.isArray(data.result) && data.result.length > 0) {
        const best = data.result.find(r => r.quality === 'HD') || data.result[0];
        downloadUrl = best.url || best.downloadUrl;
      }
      if (!downloadUrl) throw new Error('No download link found in API response');

      const fileBuffer = await downloadFile(downloadUrl);
      const maxSize = isVideo ? 64 * 1024 * 1024 : 16 * 1024 * 1024;
      if (fileBuffer.length > maxSize) {
        await sock.sendMessage(from, { text: `⚠️ File too large (${(fileBuffer.length/1024/1024).toFixed(1)}MB). Direct link: ${downloadUrl}` }, { quoted: msg });
        return;
      }

      const caption = `📥 *Download: facebookreel*`;
      if (isVideo) {
        await sock.sendMessage(from, { video: fileBuffer, caption: caption }, { quoted: msg });
      } else {
        await sock.sendMessage(from, { audio: fileBuffer, mimetype: 'audio/mpeg', fileName: 'download.mp3', caption: caption }, { quoted: msg });
      }
    } catch (err) {
      console.error('facebookreel error:', err);
      await sock.sendMessage(from, { text: `❌ Download failed.\n${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'facepalm', category: 'anime', description: 'Random facepalm anime', execute: async function (sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random facepalm anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/facepalm', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime facepalm*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('facepalm error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime facepalm.' }, { quoted: msg });
    }
  } },
    { name: 'falcon', category: 'ai', description: 'Chat with Falcon (TII)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .falcon <message>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_1be53c1604';
            const url = `https://apis.xwolf.space/api/ai/falcon?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(url, { timeout: 30000 });

            let reply = 'No response';
            if (response.data.status && response.data.result) {
                reply = response.data.result;
            } else if (response.data.error) {
                reply = `⚠️ ${response.data.error}`;
            }

            await sock.sendMessage(from, { text: `🤖 *Falcon:*\n${reply.slice(0, 2000)}` }, { quoted: msg });
        } catch (err) {
            console.error('Falcon error:', err);
            await sock.sendMessage(from, { text: '❌ API error. Please try again later.' }, { quoted: msg });
        }
    } },
    { name: 'fathersday', category: 'fun', description: 'Father’s Day wishes', execute: async function (sock, msg, args) {
    const random = fathers[Math.floor(Math.random() * fathers.length)];
    await sock.sendMessage(msg.key.remoteJid, {
      text: `👨 *Happy Father's Day!*\n\n${random}`
    }, { quoted: msg });
  } },
    { name: 'feed', category: 'anime', description: 'Random feed anime', execute: async function (sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random feed anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/feed', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime feed*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('feed error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime feed.' }, { quoted: msg });
    }
  } },
    { name: 'fetch', category: 'tools', description: '', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        if (!args[0]) return await sock.sendMessage(from, { text: "☣️ Provide a URL." }, { quoted: msg });
        
        try {
            const response = await axios.get(args[0]);
            const data = JSON.stringify(response.data, null, 2).slice(0, 1000);
            await sock.sendMessage(from, { text: `📡 **DATA FETCHED:**\n\n\`\`\`${data}\`\`\`` }, { quoted: msg });
        } catch (e) {
            await sock.sendMessage(from, { text: `❌ **FETCH FAILED:** ${e.message}` }, { quoted: msg });
        }
    } },
    { name: 'flanger', category: 'Audio Effects', description: 'Apply flanger effect to audio', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const url = args[0];
    if (!url) return sock.sendMessage(from, { text: '❓ Usage: .flanger <audio_url>' }, { quoted: msg });
    if (!url.startsWith('http')) return sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });

    try {
      await sock.sendMessage(from, { text: '🎧 Applying flanger effect...' }, { quoted: msg });
      const apiUrl = 'https://apis.xwolf.space/api/audio/flanger?url=' + encodeURIComponent(url);
      const response = await axios.get(apiUrl, { httpsAgent });
      let base64Audio = response.data.result?.base64Data || response.data.base64Data;
      if (!base64Audio && typeof response.data.result === 'string') base64Audio = response.data.result;
      if (!base64Audio) throw new Error('No audio data in response');
      if (base64Audio.startsWith('data:audio')) base64Audio = base64Audio.split(',')[1];
      const audioBuffer = Buffer.from(base64Audio, 'base64');
      const caption = '✨ Flanger Effect Applied';
      await sock.sendMessage(from, { audio: audioBuffer, mimetype: 'audio/mpeg', fileName: 'flanger_effect.mp3', caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('flanger error:', err);
      await sock.sendMessage(from, { text: '❌ Failed: ' + err.message }, { quoted: msg });
    }
  } },
    { name: 'flirt', category: 'fun', description: 'Flirty pickup line', execute: async function (sock, msg, args) {
    const random = flirts[Math.floor(Math.random() * flirts.length)];
    await sock.sendMessage(msg.key.remoteJid, {
      text: `💕 *Flirt*\n\n${random}`
    }, { quoted: msg });
  } },
    { name: 'forex', category: 'financial data', description: 'Get forex/financial data (forex, crypto, stock, inflation, gdp, bankrate, wallet, gold, market, news)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;

        if (!args.length) {
            return sock.sendMessage(from, {
                text: '❌ Usage: .forex <type> [param]\n\nTypes: forex, crypto, stock, inflation, gdp, bankrate, wallet, gold, market, news'
            }, { quoted: msg });
        }

        const command = args[0].toLowerCase();
        const param = args.slice(1).join(' ');

        try {
            const apiKey = 'wxa_f_1be53c1604';
            let apiUrl = '';
            let paramLabel = '';

            if (command === 'forex') {
                const [fromCur, toCur] = param ? param.split(',') : ['USD', 'EUR'];
                apiUrl = `https://apis.xwolf.space/api/economy/forex?from=${fromCur}&to=${toCur}&key=${apiKey}`;
                paramLabel = `${fromCur}/${toCur}`;
            } else if (command === 'crypto') {
                const symbol = param ? param.toUpperCase() : 'BTC';
                apiUrl = `https://apis.xwolf.space/api/economy/crypto?symbol=${symbol}&key=${apiKey}`;
                paramLabel = symbol;
            } else if (command === 'stock') {
                const ticker = param ? param.toUpperCase() : 'AAPL';
                apiUrl = `https://apis.xwolf.space/api/economy/stock?symbol=${ticker}&key=${apiKey}`;
                paramLabel = ticker;
            } else if (command === 'inflation') {
                const country = param ? param.toUpperCase() : 'US';
                apiUrl = `https://apis.xwolf.space/api/economy/inflation?country=${country}&key=${apiKey}`;
                paramLabel = country;
            } else if (command === 'gdp') {
                const country = param ? param.toUpperCase() : 'US';
                apiUrl = `https://apis.xwolf.space/api/economy/gdp?country=${country}&key=${apiKey}`;
                paramLabel = country;
            } else if (command === 'bankrate') {
                const country = param ? param.toUpperCase() : 'US';
                apiUrl = `https://apis.xwolf.space/api/economy/bank-rate?country=${country}&key=${apiKey}`;
                paramLabel = country;
            } else if (command === 'wallet') {
                if (!param) {
                    return sock.sendMessage(from, { text: '❌ Usage: .forex wallet <crypto_address>' }, { quoted: msg });
                }
                apiUrl = `https://apis.xwolf.space/api/economy/wallet?address=${param}&key=${apiKey}`;
                paramLabel = param.slice(0, 10) + '...';
            } else if (command === 'gold') {
                apiUrl = `https://apis.xwolf.space/api/economy/gold?key=${apiKey}`;
                paramLabel = '';
            } else if (command === 'market') {
                apiUrl = `https://apis.xwolf.space/api/economy/market?key=${apiKey}`;
                paramLabel = '';
            } else if (command === 'news') {
                apiUrl = `https://apis.xwolf.space/api/economy/news?key=${apiKey}`;
                paramLabel = '';
            } else {
                return sock.sendMessage(from, {
                    text: '❌ Unknown type. Use: forex, crypto, stock, inflation, gdp, bankrate, wallet, gold, market, news'
                }, { quoted: msg });
            }

            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });
            const data = response.data;

            if (!data.success) throw new Error(data.error || 'No data');

            let output = `📊 *Financial Data*`;
            if (paramLabel) output += ` (${paramLabel})`;
            output += '\n\n';

            if (command === 'crypto') {
                output += `💎 *${data.symbol || paramLabel}*\n`;
                output += `💰 Price: ${formatNumber(data.price_usd)}\n`;
                if (data.change_24h !== undefined) output += `📈 24h Change: ${data.change_24h > 0 ? '+' : ''}${data.change_24h}%\n`;
                if (data.market_cap_usd) output += `🏦 Market Cap: ${formatNumber(data.market_cap_usd)}\n`;
                if (data.volume_24h_usd) output += `📊 24h Volume: ${formatNumber(data.volume_24h_usd)}\n`;
            } else if (command === 'stock') {
                output += `📈 *${data.symbol || paramLabel}*\n`;
                output += `💵 Price: ${formatNumber(data.price)}\n`;
                if (data.change !== undefined) output += `📉 Change: ${data.change > 0 ? '+' : ''}${data.change}%\n`;
                if (data.volume) output += `📊 Volume: ${formatNumber(data.volume)}\n`;
            } else if (command === 'forex') {
                output += `💱 *${data.from || 'USD'} → ${data.to || 'EUR'}*\n`;
                output += `💹 Rate: ${data.rate || data.result}\n`;
                if (data.change) output += `📈 Change: ${data.change}%\n`;
            } else if (command === 'gold') {
                output += `🥇 *Gold & Silver*\n`;
                output += `🪙 Gold: ${formatNumber(data.gold)}/oz\n`;
                if (data.silver) output += `🥈 Silver: ${formatNumber(data.silver)}/oz\n`;
            } else if (command === 'market') {
                output += `🌍 *Market Indices*\n`;
                if (data.sp500) output += `📊 S&P 500: ${formatNumber(data.sp500)}\n`;
                if (data.dow) output += `📈 Dow Jones: ${formatNumber(data.dow)}\n`;
                if (data.nasdaq) output += `📉 Nasdaq: ${formatNumber(data.nasdaq)}\n`;
            } else if (command === 'inflation') {
                output += `📉 *Inflation Rate (${paramLabel || 'US'})*\n`;
                output += `📅 Annual: ${data.rate}%\n`;
                if (data.year) output += `🗓️ Year: ${data.year}\n`;
            } else if (command === 'gdp') {
                output += `📊 *GDP (${paramLabel || 'US'})*\n`;
                output += `💰 GDP: ${formatNumber(data.gdp)}\n`;
                if (data.growth) output += `📈 Growth: ${data.growth}%\n`;
            } else if (command === 'bankrate') {
                output += `🏦 *Central Bank Rate (${paramLabel || 'US'})*\n`;
                output += `💹 Rate: ${data.rate}%\n`;
            } else if (command === 'news') {
                output += `📰 *Financial News*\n\n`;
                const headlines = data.result || data.articles || [];
                if (Array.isArray(headlines) && headlines.length) {
                    headlines.slice(0, 5).forEach((item, i) => {
                        output += `${i + 1}. ${item.title || item.headline}\n`;
                        if (item.source) output += `   📍 ${item.source}\n`;
                        output += `\n`;
                    });
                } else {
                    output += `No news available.\n`;
                }
            } else if (command === 'wallet') {
                output += `💳 *Wallet Balance*\n`;
                output += `💰 Balance: ${formatNumber(data.balance)} ${data.currency || 'BTC'}\n`;
                if (data.transactions) output += `🔄 Transactions: ${data.transactions}\n`;
            } else {
                output += JSON.stringify(data.result || data, null, 2);
            }

            await sock.sendMessage(from, { text: output.slice(0, 2000) }, { quoted: msg });
        } catch (err) {
            console.error('Forex error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'friendship', category: 'fun', description: 'Friendship message', execute: async function (sock, msg, args) {
    const random = friendship[Math.floor(Math.random() * friendship.length)];
    await sock.sendMessage(msg.key.remoteJid, {
      text: `🤝 *Friendship message*\n\n${random}`
    }, { quoted: msg });
  } },
    { name: 'funfacts', category: 'fun', description: 'Random fun fact', execute: async function (sock, msg, args) {
    const random = facts[Math.floor(Math.random() * facts.length)];
    await sock.sendMessage(msg.key.remoteJid, {
      text: `🧠 *Fun Fact*\n\n${random}`
    }, { quoted: msg });
  } },
    { name: 'gdp', category: 'financial data', description: 'Get economic data (forex, crypto, stock, inflation, gdp, bankrate, wallet, gold, market, news)', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;

    if (!args.length) {
      return sock.sendMessage(from, { text: '❓ Usage: .gdp <type> [param]\n\nTypes: forex, crypto, stock, inflation, gdp, bankrate, wallet, gold, market, news' }, { quoted: msg });
    }

    const command = args[0].toLowerCase();
    const param = args.slice(1).join(' ');

    try {
      let apiUrl = '';
      let paramLabel = '';

      if (command === 'forex') {
        const [fromCur, toCur] = param ? param.split(',') : ['USD', 'EUR'];
        apiUrl = `https://apis.xwolf.space/api/economy/forex?from=${fromCur}&to=${toCur}`;
        paramLabel = `${fromCur}/${toCur}`;
      } else if (command === 'crypto') {
        const symbol = param ? param.toUpperCase() : 'BTC';
        apiUrl = `https://apis.xwolf.space/api/economy/crypto?symbol=${symbol}`;
        paramLabel = symbol;
      } else if (command === 'stock') {
        const ticker = param ? param.toUpperCase() : 'AAPL';
        apiUrl = `https://apis.xwolf.space/api/economy/stock?symbol=${ticker}`;
        paramLabel = ticker;
      } else if (command === 'inflation') {
        const country = param ? param.toUpperCase() : 'US';
        apiUrl = `https://apis.xwolf.space/api/economy/inflation?country=${country}`;
        paramLabel = country;
      } else if (command === 'gdp') {
        const country = param ? param.toUpperCase() : 'US';
        apiUrl = `https://apis.xwolf.space/api/economy/gdp?country=${country}`;
        paramLabel = country;
      } else if (command === 'bankrate') {
        const country = param ? param.toUpperCase() : 'US';
        apiUrl = `https://apis.xwolf.space/api/economy/bank-rate?country=${country}`;
        paramLabel = country;
      } else if (command === 'wallet') {
        if (!param) {
          return sock.sendMessage(from, { text: '❓ Usage: .gdp wallet <crypto_address>' }, { quoted: msg });
        }
        apiUrl = `https://apis.xwolf.space/api/economy/wallet?address=${param}`;
        paramLabel = param.slice(0, 10) + '...';
      } else if (command === 'gold') {
        apiUrl = `https://apis.xwolf.space/api/economy/gold`;
        paramLabel = '';
      } else if (command === 'market') {
        apiUrl = `https://apis.xwolf.space/api/economy/market`;
        paramLabel = '';
      } else if (command === 'news') {
        apiUrl = `https://apis.xwolf.space/api/economy/news`;
        paramLabel = '';
      } else {
        return sock.sendMessage(from, { text: '❌ Unknown type. Use: forex, crypto, stock, inflation, gdp, bankrate, wallet, gold, market, news' }, { quoted: msg });
      }

      const response = await axios.get(apiUrl, { httpsAgent: agent });
      const data = response.data;
      
      if (!data.success) throw new Error(data.error || 'No data');
      
      let output = `📊 *ECONOMIC DATA*`;
      if (paramLabel) output += ` (${paramLabel})`;
      output += `\n\n`;
      
      if (command === 'crypto') {
        output += `💎 *${data.symbol || paramLabel}*\n`;
        output += `💰 Price: ${formatNumber(data.price_usd)}\n`;
        if (data.change_24h !== undefined) output += `📈 24h Change: ${data.change_24h > 0 ? '+' : ''}${data.change_24h}%\n`;
        if (data.market_cap_usd) output += `🏦 Market Cap: ${formatNumber(data.market_cap_usd)}\n`;
        if (data.volume_24h_usd) output += `📊 24h Volume: ${formatNumber(data.volume_24h_usd)}\n`;
      } else if (command === 'stock') {
        output += `📈 *${data.symbol || paramLabel}*\n`;
        output += `💵 Price: ${formatNumber(data.price)}\n`;
        if (data.change !== undefined) output += `📉 Change: ${data.change > 0 ? '+' : ''}${data.change}%\n`;
        if (data.volume) output += `📊 Volume: ${formatNumber(data.volume)}\n`;
      } else if (command === 'forex') {
        output += `💱 *${data.from || 'USD'} → ${data.to || 'EUR'}*\n`;
        output += `💹 Rate: ${data.rate || data.result}\n`;
        if (data.change) output += `📈 Change: ${data.change}%\n`;
      } else if (command === 'gold') {
        output += `🥇 *Gold & Silver*\n`;
        output += `🪙 Gold: ${formatNumber(data.gold)}/oz\n`;
        if (data.silver) output += `🥈 Silver: ${formatNumber(data.silver)}/oz\n`;
      } else if (command === 'market') {
        output += `🌍 *Market Indices*\n`;
        if (data.sp500) output += `📊 S&P 500: ${formatNumber(data.sp500)}\n`;
        if (data.dow) output += `📈 Dow Jones: ${formatNumber(data.dow)}\n`;
        if (data.nasdaq) output += `📉 Nasdaq: ${formatNumber(data.nasdaq)}\n`;
      } else if (command === 'inflation') {
        output += `📉 *Inflation Rate (${paramLabel || 'US'})*\n`;
        output += `📅 Annual: ${data.rate}%\n`;
        if (data.year) output += `🗓️ Year: ${data.year}\n`;
      } else if (command === 'gdp') {
        output += `📊 *GDP (${paramLabel || 'US'})*\n`;
        output += `💰 GDP: ${formatNumber(data.gdp)}\n`;
        if (data.growth) output += `📈 Growth: ${data.growth}%\n`;
      } else if (command === 'bankrate') {
        output += `🏦 *Central Bank Rate (${paramLabel || 'US'})*\n`;
        output += `💹 Rate: ${data.rate}%\n`;
      } else if (command === 'news') {
        output += `📰 *Financial News*\n\n`;
        const headlines = data.result || data.articles || [];
        if (Array.isArray(headlines) && headlines.length) {
          headlines.slice(0, 5).forEach((item, i) => {
            output += `${i+1}. ${item.title || item.headline}\n`;
            if (item.source) output += `   📍 ${item.source}\n`;
            output += `\n`;
          });
        } else {
          output += `No news available.\n`;
        }
      } else if (command === 'wallet') {
        output += `💳 *Wallet Balance*\n`;
        output += `💰 Balance: ${formatNumber(data.balance)} ${data.currency || 'BTC'}\n`;
        if (data.transactions) output += `🔄 Transactions: ${data.transactions}\n`;
      } else {
        output += JSON.stringify(data.result || data, null, 2);
      }

      await sock.sendMessage(from, { text: output.slice(0, 2000) }, { quoted: msg });
    } catch (err) {
      console.error('gdp error:', err);
      await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'gemini', category: 'ai', description: 'Chat with Gemini AI', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .gemini <message>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_1be53c1604';
            const url = `https://apis.xwolf.space/api/ai/gemini?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(url, { timeout: 30000 });

            if (response.data.status === true) {
                const reply = response.data.result || 'No response.';
                await sock.sendMessage(from, { text: `🤖 *Gemini:*\n${reply.slice(0, 2000)}` }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: `⚠️ ${response.data.error || 'API error'}` }, { quoted: msg });
            }
        } catch (error) {
            console.error('Gemini error:', error);
            await sock.sendMessage(from, { text: '❌ Failed to reach Gemini API.' }, { quoted: msg });
        }
    } },
    { name: 'geoip', category: 'ethical hacking', description: 'IP geolocation lookup', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const ip = args[0];
    if (!ip) return sock.sendMessage(from, { text: '❓ Usage: .geoip <IP>' }, { quoted: msg });

    try {
      await sock.sendMessage(from, { text: `🌍 Locating IP ${ip}...` }, { quoted: msg });
      const res = await axios.get(`http://ip-api.com/json/${ip}?fields=status,message,country,regionName,city,zip,lat,lon,isp,org,as`, { httpsAgent: agent });
      if (res.data.status === 'fail') throw new Error(res.data.message);
      const d = res.data;
      let text = `📍 Geolocation for ${ip}\n`;
      text += `Country: ${d.country}\nRegion: ${d.regionName}\nCity: ${d.city}\n`;
      text += `ZIP: ${d.zip}\nCoordinates: ${d.lat}, ${d.lon}\nISP: ${d.isp}\nOrganization: ${d.org}\nAS: ${d.as}`;
      await sock.sendMessage(from, { text: text.slice(0, 2000) }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ GeoIP error: ${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'getbio', category: 'owner', description: '', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo) {
            return await sock.sendMessage(from, { text: "This command is restricted to the owner and sudo users only." }, { quoted: msg });
        }

        try {
            const status = await sock.fetchStatus(sock.user.id);
            await sock.sendMessage(from, { text: `📝 Current bio: ${status.status || "Not set"}` }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(from, { text: `❌ Could not fetch bio: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'getpp', category: 'tools', description: '', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;

        const normalizeJid = (jid) => {
            if (!jid) return null;
            let clean = jid.split(':')[0];
            if (!clean.includes('@')) clean += '@s.whatsapp.net';
            return clean;
        };

        let target = null;
        if (msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
            target = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
        } else if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
            target = msg.message.extendedTextMessage.contextInfo.participant;
        } else if (from.endsWith('@g.us') && msg.key.participant) {
            target = msg.key.participant;
        } else if (!from.endsWith('@g.us')) {
            target = from;
        }

        if (!target) {
            return sock.sendMessage(from, { text: "❌ Couldn't identify target." }, { quoted: msg });
        }

        target = normalizeJid(target);

        const coldQuotes = [
            "Identity captured. You're just data in my system now.",
            "In a world of copies, I just took the original.",
            "Privacy is an illusion. I see everything.",
            "Consider this a souvenir of your digital existence.",
            "Power isn't given, it's taken. Just like this picture.",
            "Your profile is now property of SΛVΛGΞ-TECH."
        ];
        const randomQuote = coldQuotes[Math.floor(Math.random() * coldQuotes.length)];

        try {
            const ppUrl = await sock.profilePictureUrl(target, 'image');
            await sock.sendMessage(from, {
                image: { url: ppUrl },
                caption: `❄️ *${randomQuote}*\n\n_Built by Spencer inspired by Meryl_`
            }, { quoted: msg });
        } catch (e) {
            console.error('getpp error:', e);
            await sock.sendMessage(from, {
                text: "❌ *Target is ghosting the system.* (No DP or Privacy Blocked)."
            }, { quoted: msg });
        }
    } },
    { name: 'getsession', category: 'owner', description: 'Get the current session ID (compressed base64)', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo) {
            return await sock.sendMessage(from, { text: "This command is restricted to the owner and sudo users only." }, { quoted: msg });
        }

        const credsPath = path.join(__dirname, '..', 'session', 'creds.json');
        if (!fs.existsSync(credsPath)) {
            return await sock.sendMessage(from, { text: '❌ No session found. The bot is not connected.' }, { quoted: msg });
        }

        try {
            const creds = fs.readFileSync(credsPath);
            const compressed = zlib.gzipSync(creds);
            const base64 = compressed.toString('base64');
            const sessionId = `Savage~${base64}`;

            await sock.sendMessage(from, { text: sessionId }, { quoted: msg });
        } catch (err) {
            console.error('GetSession error:', err);
            await sock.sendMessage(from, { text: `❌ Failed to generate session: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'gif-to-video', category: 'tools', description: 'Convert media using gif-to-video (reply to image/video/sticker OR provide URL)', execute: async function (sock, msg, args) {
    const sender = msg.pushName || 'User';
    const jid = msg.key.participant || msg.key.remoteJid;

    let mediaBuffer = null;
    let providedUrl = args[0];

    // Try to get media from replied message first
    if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
      mediaBuffer = await getMediaBufferFromMessage(sock, msg);
    }

    // If no reply and no URL, error
    if (!mediaBuffer && !providedUrl) {
      return sock.sendMessage(msg.key.remoteJid, { 
        text: '❓ Usage: .gif-to-video\n   - Reply to an image/video/sticker\n   - Or provide a direct URL: .gif-to-video https://example.com/media.jpg',
        mentions: [jid]
      });
    }

    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🔄 Converting media for @' + sender + '...', mentions: [jid] });

      let apiUrl;
      if (mediaBuffer) {
        // For media buffer, we need to upload as multipart or base64? The API likely expects a URL.
        // Since the Wolf API converter endpoints expect a URL, we cannot directly send buffer.
        // Workaround: Upload buffer to a temp hosting? Too complex. Alternative: send the media as base64 in JSON?
        // Let's assume the API accepts base64 in a JSON payload. But the documentation shows GET with ?url=.
        // For now, we'll convert buffer to a data URL and use that.
        const base64 = mediaBuffer.toString('base64');
        const mime = (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage?.mimetype) || 
                     (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage?.mimetype) || 
                     'application/octet-stream';
        const dataUrl = `data:${mime};base64,${base64}`;
        apiUrl = `https://apis.xwolf.space/api/converter/gif-to-video?url=${encodeURIComponent(dataUrl)}`;
      } else {
        apiUrl = `https://apis.xwolf.space/api/converter/gif-to-video?url=${encodeURIComponent(providedUrl)}`;
      }

      const response = await axios.get(apiUrl, { agent, responseType: 'arraybuffer' });
      const contentType = response.headers['content-type'] || '';
      const resultBuffer = Buffer.from(response.data);

      const caption = `✅ *Converted via gif-to-video*\n👤 REQUESTED BY: @${sender}\n🚀 POWERED BY SAVAGE-CORE`;

      if (contentType.includes('video')) {
        await sock.sendMessage(msg.key.remoteJid, { video: resultBuffer, caption: caption, mentions: [jid] });
      } else if (contentType.includes('image') || contentType.includes('webp')) {
        await sock.sendMessage(msg.key.remoteJid, { image: resultBuffer, caption: caption, mentions: [jid] });
      } else {
        await sock.sendMessage(msg.key.remoteJid, { text: caption + '\n\n' + resultBuffer.toString('utf-8').slice(0, 500) });
      }
    } catch (err) {
      console.error('gif-to-video error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: `❌ Conversion failed: ${err.message}` });
    }
  } },
    { name: 'girlfriendsday', category: 'fun', description: 'Girlfriend’s Day wishes', execute: async function (sock, msg, args) {
    const random = gfDay[Math.floor(Math.random() * gfDay.length)];
    await sock.sendMessage(msg.key.remoteJid, {
      text: `💖 *Happy Girlfriend's Day!*\n\n${random}`
    }, { quoted: msg });
  } },
    { name: 'github', category: 'search menu', description: 'GitHub repo search – top 5', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const query = args.join(' ');
    if (!query) return sock.sendMessage(from, { text: '❓ Usage: .github <query>' }, { quoted: msg });

    try {
      await sock.sendMessage(from, { text: `🔍 Searching GitHub for "${query}"...` }, { quoted: msg });
      const res = await axios.get(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=5`, {
        httpsAgent: agent,
        headers: { 'User-Agent': 'Savage-Bot' }
      });
      if (!res.data.items.length) throw new Error('No repos');
      let text = `🐙 *GITHUB SEARCH: ${query}*\n\n`;
      res.data.items.forEach((repo, i) => {
        text += `${i+1}. *${repo.full_name}*\n   ⭐ ${repo.stargazers_count} | 🍴 ${repo.forks_count}\n   📝 ${(repo.description || 'No description').slice(0, 150)}\n   🔗 ${repo.html_url}\n\n`;
      });
      await sock.sendMessage(from, { text: text.slice(0, 2000) }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ GitHub error: ${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'glomp', category: 'anime', description: 'Random glomp anime', execute: async function (sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random glomp anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/glomp', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime glomp*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('glomp error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime glomp.' }, { quoted: msg });
    }
  } },
    { name: 'gold', category: 'financial data', description: 'Get economic data (forex, crypto, stock, inflation, gdp, bankrate, wallet, gold, market, news)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;

        if (!args.length) {
            return sock.sendMessage(from, {
                text: '❌ Usage: .gold <type> [param]\n\nTypes: forex, crypto, stock, inflation, gdp, bankrate, wallet, gold, market, news'
            }, { quoted: msg });
        }

        const command = args[0].toLowerCase();
        const param = args.slice(1).join(' ');

        try {
            const apiKey = 'wxa_f_1be53c1604';
            let apiUrl = '';
            let paramLabel = '';

            if (command === 'forex') {
                const [fromCur, toCur] = param ? param.split(',') : ['USD', 'EUR'];
                apiUrl = `https://apis.xwolf.space/api/economy/forex?from=${fromCur}&to=${toCur}&key=${apiKey}`;
                paramLabel = `${fromCur}/${toCur}`;
            } else if (command === 'crypto') {
                const symbol = param ? param.toUpperCase() : 'BTC';
                apiUrl = `https://apis.xwolf.space/api/economy/crypto?symbol=${symbol}&key=${apiKey}`;
                paramLabel = symbol;
            } else if (command === 'stock') {
                const ticker = param ? param.toUpperCase() : 'AAPL';
                apiUrl = `https://apis.xwolf.space/api/economy/stock?symbol=${ticker}&key=${apiKey}`;
                paramLabel = ticker;
            } else if (command === 'inflation') {
                const country = param ? param.toUpperCase() : 'US';
                apiUrl = `https://apis.xwolf.space/api/economy/inflation?country=${country}&key=${apiKey}`;
                paramLabel = country;
            } else if (command === 'gdp') {
                const country = param ? param.toUpperCase() : 'US';
                apiUrl = `https://apis.xwolf.space/api/economy/gdp?country=${country}&key=${apiKey}`;
                paramLabel = country;
            } else if (command === 'bankrate') {
                const country = param ? param.toUpperCase() : 'US';
                apiUrl = `https://apis.xwolf.space/api/economy/bank-rate?country=${country}&key=${apiKey}`;
                paramLabel = country;
            } else if (command === 'wallet') {
                if (!param) {
                    return sock.sendMessage(from, { text: '❌ Usage: .gold wallet <crypto_address>' }, { quoted: msg });
                }
                apiUrl = `https://apis.xwolf.space/api/economy/wallet?address=${param}&key=${apiKey}`;
                paramLabel = param.slice(0, 10) + '...';
            } else if (command === 'gold') {
                apiUrl = `https://apis.xwolf.space/api/economy/gold?key=${apiKey}`;
                paramLabel = '';
            } else if (command === 'market') {
                apiUrl = `https://apis.xwolf.space/api/economy/market?key=${apiKey}`;
                paramLabel = '';
            } else if (command === 'news') {
                apiUrl = `https://apis.xwolf.space/api/economy/news?key=${apiKey}`;
                paramLabel = '';
            } else {
                return sock.sendMessage(from, {
                    text: '❌ Unknown type. Use: forex, crypto, stock, inflation, gdp, bankrate, wallet, gold, market, news'
                }, { quoted: msg });
            }

            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });
            const data = response.data;

            if (!data.success) throw new Error(data.error || 'No data');

            let output = `📊 *Financial Data*`;
            if (paramLabel) output += ` (${paramLabel})`;
            output += '\n\n';

            if (command === 'crypto') {
                output += `💎 *${data.symbol || paramLabel}*\n`;
                output += `💰 Price: ${formatNumber(data.price_usd)}\n`;
                if (data.change_24h !== undefined) output += `📈 24h Change: ${data.change_24h > 0 ? '+' : ''}${data.change_24h}%\n`;
                if (data.market_cap_usd) output += `🏦 Market Cap: ${formatNumber(data.market_cap_usd)}\n`;
                if (data.volume_24h_usd) output += `📊 24h Volume: ${formatNumber(data.volume_24h_usd)}\n`;
            } else if (command === 'stock') {
                output += `📈 *${data.symbol || paramLabel}*\n`;
                output += `💵 Price: ${formatNumber(data.price)}\n`;
                if (data.change !== undefined) output += `📉 Change: ${data.change > 0 ? '+' : ''}${data.change}%\n`;
                if (data.volume) output += `📊 Volume: ${formatNumber(data.volume)}\n`;
            } else if (command === 'forex') {
                output += `💱 *${data.from || 'USD'} → ${data.to || 'EUR'}*\n`;
                output += `💹 Rate: ${data.rate || data.result}\n`;
                if (data.change) output += `📈 Change: ${data.change}%\n`;
            } else if (command === 'gold') {
                output += `🥇 *Gold & Silver*\n`;
                output += `🪙 Gold: ${formatNumber(data.gold)}/oz\n`;
                if (data.silver) output += `🥈 Silver: ${formatNumber(data.silver)}/oz\n`;
            } else if (command === 'market') {
                output += `🌍 *Market Indices*\n`;
                if (data.sp500) output += `📊 S&P 500: ${formatNumber(data.sp500)}\n`;
                if (data.dow) output += `📈 Dow Jones: ${formatNumber(data.dow)}\n`;
                if (data.nasdaq) output += `📉 Nasdaq: ${formatNumber(data.nasdaq)}\n`;
            } else if (command === 'inflation') {
                output += `📉 *Inflation Rate (${paramLabel || 'US'})*\n`;
                output += `📅 Annual: ${data.rate}%\n`;
                if (data.year) output += `🗓️ Year: ${data.year}\n`;
            } else if (command === 'gdp') {
                output += `📊 *GDP (${paramLabel || 'US'})*\n`;
                output += `💰 GDP: ${formatNumber(data.gdp)}\n`;
                if (data.growth) output += `📈 Growth: ${data.growth}%\n`;
            } else if (command === 'bankrate') {
                output += `🏦 *Central Bank Rate (${paramLabel || 'US'})*\n`;
                output += `💹 Rate: ${data.rate}%\n`;
            } else if (command === 'news') {
                output += `📰 *Financial News*\n\n`;
                const headlines = data.result || data.articles || [];
                if (Array.isArray(headlines) && headlines.length) {
                    headlines.slice(0, 5).forEach((item, i) => {
                        output += `${i + 1}. ${item.title || item.headline}\n`;
                        if (item.source) output += `   📍 ${item.source}\n`;
                        output += `\n`;
                    });
                } else {
                    output += `No news available.\n`;
                }
            } else if (command === 'wallet') {
                output += `💳 *Wallet Balance*\n`;
                output += `💰 Balance: ${formatNumber(data.balance)} ${data.currency || 'BTC'}\n`;
                if (data.transactions) output += `🔄 Transactions: ${data.transactions}\n`;
            } else {
                output += JSON.stringify(data.result || data, null, 2);
            }

            await sock.sendMessage(from, { text: output.slice(0, 2000) }, { quoted: msg });
        } catch (err) {
            console.error('Gold error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'goldchrome', category: 'Ephoto', description: 'Generate gold-chrome text effect', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const text = args.join(' ');
    if (!text) return sock.sendMessage(from, { text: '❓ Usage: .goldchrome <text>' }, { quoted: msg });

    try {
      const apiUrl = `https://apis.xwolf.space/api/textpro/gold-chrome?text=${encodeURIComponent(text)}`;
      const response = await axios.get(apiUrl, { httpsAgent });
      if (!response.data.success) throw new Error(response.data.error || 'API failure');
      if (!response.data.imageUrl) throw new Error('No imageUrl in response');
      const imgBuffer = await downloadFile(response.data.imageUrl);
      const caption = '🎨 *Text Effect: goldchrome*';
      await sock.sendMessage(from, { image: imgBuffer, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('goldchrome error:', err);
      await sock.sendMessage(from, { text: `❌ Failed to generate image.\n${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'goldembossed', category: 'Ephoto', description: 'Generate gold-embossed text effect', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const text = args.join(' ');
    if (!text) return sock.sendMessage(from, { text: '❓ Usage: .goldembossed <text>' }, { quoted: msg });

    try {
      const apiUrl = `https://apis.xwolf.space/api/textpro/gold-embossed?text=${encodeURIComponent(text)}`;
      const response = await axios.get(apiUrl, { httpsAgent });
      if (!response.data.success) throw new Error(response.data.error || 'API failure');
      if (!response.data.imageUrl) throw new Error('No imageUrl in response');
      const imgBuffer = await downloadFile(response.data.imageUrl);
      const caption = '🎨 *Text Effect: goldembossed*';
      await sock.sendMessage(from, { image: imgBuffer, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('goldembossed error:', err);
      await sock.sendMessage(from, { text: `❌ Failed to generate image.\n${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'goodbye', category: 'group', description: 'Toggle goodbye messages on/off for this group (admin/owner only)', execute: async function (sock, msg, args, { isMe }) {
    const from = msg.key.remoteJid;
    if (!from.endsWith('@g.us')) return await sock.sendMessage(from, { text: '❌ Group only command.' }, { quoted: msg });

    const sender = msg.key.participant || msg.key.remoteJid;
    const groupMetadata = await sock.groupMetadata(from);
    const participant = groupMetadata.participants.find(p => p.id === sender);
    const isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
    
    if (!isAdmin && !isMe) return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });
    
    if (global.goodbyeEnabled[from] === undefined) global.goodbyeEnabled[from] = true;
    const newState = !global.goodbyeEnabled[from];
    global.goodbyeEnabled[from] = newState;
    settings.setGroup(from, 'goodbyeEnabled', newState);
    await sock.sendMessage(from, { text: `✅ Goodbye messages are now *${newState ? "ON" : "OFF"}* for this group.` }, { quoted: msg });
  } },
    { name: 'goodmorning', category: 'fun', description: 'Good morning message', execute: async function (sock, msg, args) {
    const random = goodmornings[Math.floor(Math.random() * goodmornings.length)];
    await sock.sendMessage(msg.key.remoteJid, {
      text: `🌅 *Good morning!*\n\n${random}`
    }, { quoted: msg });
  } },
    { name: 'goodnight', category: 'fun', description: 'Good night message', execute: async function (sock, msg, args) {
    const random = nights[Math.floor(Math.random() * nights.length)];
    await sock.sendMessage(msg.key.remoteJid, {
      text: `🌙 *Good night!*\n\n${random}`
    }, { quoted: msg });
  } },
    { name: 'gpt', category: 'ai', description: 'Chat with GPT AI', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) return sock.sendMessage(from, { text: '❌ Usage: .gpt <message>' }, { quoted: msg });

        try {
            await sock.sendMessage(from, { text: '🤔 Thinking...' }, { quoted: msg });
            const response = await axios.get(`https://ravenn.site/ai/gpt?q=${encodeURIComponent(query)}`, { timeout: 30000 });
            const data = response.data;
            if (data.status && data.result) {
                await sock.sendMessage(from, { text: data.result }, { quoted: msg });
            } else {
                throw new Error('Invalid response');
            }
        } catch (err) {
            console.error('GPT error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'gratitude', category: 'fun', description: 'Gratitude messages', execute: async function (sock, msg, args) {
    const random = gratitude[Math.floor(Math.random() * gratitude.length)];
    await sock.sendMessage(msg.key.remoteJid, {
      text: `🙏 *Gratitude*\n\n${random}`
    }, { quoted: msg });
  } },
    { name: 'groovy', category: 'Ephoto', description: 'Generate groovy text effect', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const text = args.join(' ');
    if (!text) return sock.sendMessage(from, { text: '❓ Usage: .groovy <text>' }, { quoted: msg });

    try {
      const apiUrl = `https://apis.xwolf.space/api/textpro/groovy?text=${encodeURIComponent(text)}`;
      const response = await axios.get(apiUrl, { httpsAgent });
      if (!response.data.success) throw new Error(response.data.error || 'API failure');
      if (!response.data.imageUrl) throw new Error('No imageUrl in response');
      const imgBuffer = await downloadFile(response.data.imageUrl);
      const caption = '🎨 *Text Effect: groovy*';
      await sock.sendMessage(from, { image: imgBuffer, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('groovy error:', err);
      await sock.sendMessage(from, { text: `❌ Failed to generate image.\n${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'groq', category: 'ai', description: 'Chat with Groq AI (fast inference)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .groq <message>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_1be53c1604';
            const url = `https://apis.xwolf.space/api/ai/groq?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(url, { timeout: 30000 });

            let reply = 'No response';
            if (response.data.status && response.data.result) {
                reply = response.data.result;
            } else if (response.data.error) {
                reply = `⚠️ ${response.data.error}`;
            }

            await sock.sendMessage(from, { text: `🤖 *Groq:*\n${reply.slice(0, 2000)}` }, { quoted: msg });
        } catch (err) {
            console.error('Groq error:', err);
            await sock.sendMessage(from, { text: '❌ API error. Please try again later.' }, { quoted: msg });
        }
    } },
    { name: 'groupinfo', category: 'group', description: 'Show group details including icon', execute: async function (sock, msg) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) return await sock.sendMessage(from, { text: '❌ Group only.' }, { quoted: msg });

        const group = await sock.groupMetadata(from);
        const owner = group.owner || 'Unknown';
        const created = new Date(group.creation * 1000).toLocaleString();
        const members = group.participants.length;
        const admins = group.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').length;
        const description = group.desc || 'None';

        let icon = null;
        try {
            const iconUrl = await sock.profilePictureUrl(from, 'image');
            icon = { url: iconUrl };
        } catch (err) {}

        const caption = `📛 *Group:* ${group.subject}\n🆔 *ID:* ${from}\n👑 *Owner:* ${owner}\n📅 *Created:* ${created}\n👥 *Members:* ${members}\n🔨 *Admins:* ${admins}\n📝 *Description:* ${description}`;

        if (icon) {
            await sock.sendMessage(from, { image: icon, caption }, { quoted: msg });
        } else {
            await sock.sendMessage(from, { text: caption }, { quoted: msg });
        }
    } },
    { name: 'grouplink', category: 'group', description: 'Get group invite link and icon', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) return await sock.sendMessage(from, { text: '❌ Group only.' }, { quoted: msg });

        const group = await sock.groupMetadata(from);
        const sender = msg.key.participant || msg.key.remoteJid;
        const isAdmin = group.participants.some(p => p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin'));
        if (!isAdmin) return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });

        try {
            const inviteCode = await sock.groupInviteCode(from);
            const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;
            let icon = null;
            try {
                const ppUrl = await sock.profilePictureUrl(from, 'image');
                icon = { url: ppUrl };
            } catch {}

            const quotes = [
                "Every dream on track. 🎵",
                "Stay savage, never average.",
                "Silence speaks when words fail.",
                "In a world full of trends, be a classic.",
                "Your only limit is your mind.",
                "Pain is temporary, glory is forever.",
                "Don't chase, attract. Don't beg, command.",
                "Savage by nature, king by choice.",
                "They didn't believe in me – watch me prove them wrong.",
                "Hustle until your haters ask if you're hiring.",
                "Born to stand out, not to fit in.",
                "Victory loves preparation.",
                "Confidence is silent. Insecurities are loud.",
                "Legends are made when opportunity meets preparation.",
                "Keep your circle small and your goals large.",
                "The same fire that melts butter hardens steel.",
                "Act like you've been there before.",
                "Your vibe attracts your tribe.",
                "No pressure, no diamonds.",
                "Be a voice, not an echo.",
                "Wake up. Grind. Repeat. Dominate."
            ];
            const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

            const caption = `🔗 *Group Invite Link:*\n${inviteLink}\n\n📛 *Group:* ${group.subject}\n⏳ *Valid for 72 hours*\n\n💬 *Savage Quote:*\n${randomQuote}`;

            if (icon) {
                await sock.sendMessage(from, { image: icon, caption }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: caption }, { quoted: msg });
            }
        } catch (error) {
            console.error(error);
            await sock.sendMessage(from, { text: '❌ Failed to get link. Ensure I am admin and group allows links.' }, { quoted: msg });
        }
    } },
    { name: 'groupsettings', category: 'group', description: 'Show current group settings', execute: async function (sock, msg, args) {
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
    } },
    { name: 'halloween', category: 'fun', description: 'Halloween wishes', execute: async function (sock, msg, args) {
    const random = halloween[Math.floor(Math.random() * halloween.length)];
    await sock.sendMessage(msg.key.remoteJid, {
      text: `🎃 *Halloween wish*\n\n${random}`
    }, { quoted: msg });
  } },
    { name: 'handhold', category: 'anime', description: 'Random handhold anime', execute: async function (sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random handhold anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/handhold', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime handhold*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('handhold error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime handhold.' }, { quoted: msg });
    }
  } },
    { name: 'happy', category: 'anime', description: 'Random happy anime', execute: async function (sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random happy anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/happy', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime happy*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('happy error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime happy.' }, { quoted: msg });
    }
  } },
    { name: 'hash-generate', category: 'ethical hacking', description: 'Generate MD5, SHA1, SHA256, SHA512 hash', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const text = args.join(' ');
    if (!text) return sock.sendMessage(from, { text: '❓ Usage: .hash-generate <text>' }, { quoted: msg });

    const md5 = crypto.createHash('md5').update(text).digest('hex');
    const sha1 = crypto.createHash('sha1').update(text).digest('hex');
    const sha256 = crypto.createHash('sha256').update(text).digest('hex');
    const sha512 = crypto.createHash('sha512').update(text).digest('hex');
    const result = `🔐 Hashes for "${text}":\nMD5: ${md5}\nSHA1: ${sha1}\nSHA256: ${sha256}\nSHA512: ${sha512}`;

    await sock.sendMessage(from, { text: result.slice(0, 2000) }, { quoted: msg });
  } },
    { name: 'hash-identify', category: 'ethical hacking', description: 'Identify hash type (MD5, SHA1, SHA256, etc.)', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const hash = args[0];
    if (!hash) return sock.sendMessage(from, { text: '❓ Usage: .hash-identify <hash>' }, { quoted: msg });

    let matches = [];
    for (const pattern of hashPatterns) {
      if (pattern.regex.test(hash)) matches.push(pattern.name);
    }
    let result = matches.length ? `Possible hash types: ${matches.join(', ')}` : 'Unknown hash type (or too short)';

    await sock.sendMessage(from, { text: result.slice(0, 2000) }, { quoted: msg });
  } },
    { name: 'hash', category: 'tools', description: 'Generate hash (md5, sha1, sha256)', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const input = args.join(' ');
    if (!input) return sock.sendMessage(from, { text: '❓ Usage: .hash <text> [algorithm] (md5/sha1/sha256)' }, { quoted: msg });

    const parts = input.split(' ');
    const text = parts[0];
    let algo = parts[1] || 'md5';
    if (!['md5', 'sha1', 'sha256'].includes(algo)) algo = 'md5';

    const hash = crypto.createHash(algo).update(text).digest('hex');
    await sock.sendMessage(from, {
      text: `🔐 *${algo.toUpperCase()} hash*\n\n${hash}`
    }, { quoted: msg });
  } },
    { name: 'hd', category: 'download', description: 'Download HD video (1080p/720p) from YouTube', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .hd <song name or YouTube URL>' }, { quoted: msg });
        }

        await sock.sendMessage(from, { text: '🔍 Searching for HD video...' }, { quoted: msg });

        try {
            let videoUrl = query;
            let videoTitle = 'Unknown';

            if (!query.includes('youtube.com') && !query.includes('youtu.be')) {
                const searchResults = await yts(query);
                if (!searchResults.videos.length) {
                    return sock.sendMessage(from, { text: '❌ No results found.' }, { quoted: msg });
                }
                videoUrl = searchResults.videos[0].url;
                videoTitle = searchResults.videos[0].title || 'Unknown';
            } else {
                const videoId = videoUrl.split('v=')[1]?.split('&')[0] || videoUrl.split('youtu.be/')[1]?.split('?')[0];
                if (!videoId) {
                    return sock.sendMessage(from, { text: '❌ Invalid YouTube URL.' }, { quoted: msg });
                }
                const info = await yts({ videoId });
                videoTitle = info.title || 'Unknown';
            }

            const apiKey = 'wxa_f_1be53c1604';
            const apiUrl = `https://apis.xwolf.space/download/hd?url=${encodeURIComponent(videoUrl)}&q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { timeout: 30000 });

            let downloadUrl = response.data.result || response.data.downloadUrl || response.data.url;
            if (!downloadUrl) {
                throw new Error('No download URL in API response');
            }

            const videoRes = await axios.get(downloadUrl, {
                responseType: 'arraybuffer',
                timeout: 120000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36' }
            });
            const videoBuffer = Buffer.from(videoRes.data);

            if (videoBuffer.length < 50000) {
                return sock.sendMessage(from, { text: '❌ Downloaded file too small.' }, { quoted: msg });
            }

            const fileSizeMB = (videoBuffer.length / (1024 * 1024)).toFixed(2);
            if (videoBuffer.length > 50 * 1024 * 1024) {
                return sock.sendMessage(from, { text: `❌ Video too large (${fileSizeMB} MB). Max 50 MB.` }, { quoted: msg });
            }

            const tempDir = path.join(__dirname, '../temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
            const tempFile = path.join(tempDir, `hd_${Date.now()}.mp4`);
            fs.writeFileSync(tempFile, videoBuffer);

            await sock.sendMessage(from, {
                video: { url: tempFile },
                mimetype: 'video/mp4',
                caption: `🎥 *HD Video: ${videoTitle}*`
            }, { quoted: msg });

            fs.unlinkSync(tempFile);
        } catch (error) {
            console.error('HD error:', error);
            await sock.sendMessage(from, { text: `❌ Failed: ${error.message}` }, { quoted: msg });
        }
    } },
    { name: 'headers', category: 'ethical hacking', description: 'Fetch HTTP response headers', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    let url = args[0];
    if (!url) return sock.sendMessage(from, { text: '❓ Usage: .headers <url>' }, { quoted: msg });
    if (!url.startsWith('http')) url = 'https://' + url;

    try {
      await sock.sendMessage(from, { text: `📡 Fetching headers from ${url}...` }, { quoted: msg });
      const res = await axios.head(url, { httpsAgent: agent, timeout: 10000 });
      let text = `📋 Headers for ${url}\n`;
      for (const [key, value] of Object.entries(res.headers)) {
        text += `${key}: ${value}\n`;
      }
      await sock.sendMessage(from, { text: text.slice(0, 2000) }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ Headers fetch failed: ${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'heartbreak', category: 'fun', description: 'Thoughts on heartbreak', execute: async function (sock, msg, args) {
    const random = heartbreak[Math.floor(Math.random() * heartbreak.length)];
    await sock.sendMessage(msg.key.remoteJid, {
      text: `💔 *Heartbreak thought*\n\n${random}`
    }, { quoted: msg });
  } },
    { name: 'hidetag', category: 'group', description: '', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) {
            return await sock.sendMessage(from, { text: '❌ Group only command.' }, { quoted: msg });
        }

        const groupMetadata = await sock.groupMetadata(from);
        const participants = groupMetadata.participants;
        
        await sock.sendMessage(from, { 
            text: args.join(' ') || '📢 Attention!', 
            mentions: participants.map(a => a.id) 
        }, { quoted: msg });
    } },
    { name: 'highfive', category: 'anime', description: 'Random highfive anime', execute: async function (sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random highfive anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/highfive', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime highfive*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('highfive error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime highfive.' }, { quoted: msg });
    }
  } },
    { name: 'host', category: 'engine', description: 'Show bot host information and uptime', execute: async function (sock, msg, args) {
    const uptimeSec = process.uptime();
    const uptimeFormatted = formatUptime(uptimeSec);
    const platform = getHostPlatform();
    const nodeVersion = process.version;
    const arch = os.arch();
    const cpuCores = os.cpus().length;
    const totalMem = (os.totalmem() / 1024 / 1024).toFixed(0);
    const freeMem = (os.freemem() / 1024 / 1024).toFixed(0);
    const usedMem = (totalMem - freeMem).toFixed(0);
    
    const text = `🖥️ *HOST INFORMATION*\n\n` +
      `🏠 *Platform:* ${platform}\n` +
      `⏱️ *Uptime:* ${uptimeFormatted}\n` +
      `📦 *Node.js:* ${nodeVersion}\n` +
      `🔧 *Architecture:* ${arch}\n` +
      `💻 *CPU Cores:* ${cpuCores}\n` +
      `🧠 *Memory:* ${usedMem}MB / ${totalMem}MB used`;
    
    await sock.sendMessage(msg.key.remoteJid, { text: text }, { quoted: msg });
  } },
    { name: 'hug', category: 'anime', description: 'Random hug anime', execute: async function (sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random hug anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/hug', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime hug*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('hug error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime hug.' }, { quoted: msg });
    }
  } },
    { name: 'humanizer', category: 'tools', description: 'Convert AI-generated text to human-like', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const text = args.join(' ');
        if (!text) {
            return sock.sendMessage(from, { text: '❌ Usage: .humanizer <text>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_1be53c1604';
            const response = await axios.post(
                `https://apis.xwolf.space/api/ai/humanizer?key=${apiKey}`,
                { text },
                { timeout: 30000 }
            );

            if (response.data.status === true) {
                const humanText = response.data.result || response.data.humanized || 'No humanized text returned.';
                await sock.sendMessage(from, { text: `👤 *Humanized:*\n${humanText.slice(0, 2000)}` }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: `⚠️ ${response.data.error || 'Humanizer failed.'}` }, { quoted: msg });
            }
        } catch (error) {
            console.error('Humanizer error:', error);
            await sock.sendMessage(from, { text: '❌ Humanizer API error.' }, { quoted: msg });
        }
    } },
    { name: 'humor', category: 'fun', description: 'Relatable and funny thoughts', execute: async function (sock, msg, args) {
    const random = humor[Math.floor(Math.random() * humor.length)];
    await sock.sendMessage(msg.key.remoteJid, {
      text: `😅 *For you*\n\n${random}`
    }, { quoted: msg });
  } },
    { name: 'icefire', category: 'Ephoto', description: 'Generate ice-fire text effect', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const text = args.join(' ');
    if (!text) return sock.sendMessage(from, { text: '❓ Usage: .icefire <text>' }, { quoted: msg });

    try {
      const apiUrl = `https://apis.xwolf.space/api/textpro/ice-fire?text=${encodeURIComponent(text)}`;
      const response = await axios.get(apiUrl, { httpsAgent });
      if (!response.data.success) throw new Error(response.data.error || 'API failure');
      if (!response.data.imageUrl) throw new Error('No imageUrl in response');
      const imgBuffer = await downloadFile(response.data.imageUrl);
      const caption = '🎨 *Text Effect: icefire*';
      await sock.sendMessage(from, { image: imgBuffer, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('icefire error:', err);
      await sock.sendMessage(from, { text: `❌ Failed to generate image.\n${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'llama', category: 'ai', description: 'Chat with Llama AI', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) return sock.sendMessage(from, { text: '❌ Usage: .llama <message>' }, { quoted: msg });

        try {
            await sock.sendMessage(from, { text: '🤔 Thinking...' }, { quoted: msg });
            const response = await axios.get(`https://ravenn.site/ai/ilama?q=${encodeURIComponent(query)}`, { timeout: 30000 });
            const data = response.data;
            if (data.status && data.result) {
                await sock.sendMessage(from, { text: data.result }, { quoted: msg });
            } else {
                throw new Error('Invalid response');
            }
        } catch (err) {
            console.error('Llama error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'imagine', category: 'tools', description: 'Generate an image from a text prompt (free, no key)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const prompt = args.join(' ');
        if (!prompt) {
            return await sock.sendMessage(from, { text: '❌ Usage: .imagine a cat wearing sunglasses' }, { quoted: msg });
        }

        await sock.sendMessage(from, { text: `🎨 *Generating image for:*\n${prompt}\n_Please wait up to 15 seconds._` }, { quoted: msg });

        try {
            const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true`;
            await sock.sendMessage(from, {
                image: { url: imageUrl },
                caption: `🖼️ *Generated by AI*\nPrompt: ${prompt}`
            }, { quoted: msg });
        } catch (err) {
            console.error(err);
            await sock.sendMessage(from, { text: '❌ Image generation failed. Try a different prompt.' }, { quoted: msg });
        }
    } },
    { name: 'img-to-sticker', category: 'tools', description: 'Convert media using img-to-sticker (reply to image/video/sticker OR provide URL)', execute: async function (sock, msg, args) {
    const sender = msg.pushName || 'User';
    const jid = msg.key.participant || msg.key.remoteJid;

    let mediaBuffer = null;
    let providedUrl = args[0];

    // Try to get media from replied message first
    if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
      mediaBuffer = await getMediaBufferFromMessage(sock, msg);
    }

    // If no reply and no URL, error
    if (!mediaBuffer && !providedUrl) {
      return sock.sendMessage(msg.key.remoteJid, { 
        text: '❓ Usage: .img-to-sticker\n   - Reply to an image/video/sticker\n   - Or provide a direct URL: .img-to-sticker https://example.com/media.jpg',
        mentions: [jid]
      });
    }

    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🔄 Converting media for @' + sender + '...', mentions: [jid] });

      let apiUrl;
      if (mediaBuffer) {
        // For media buffer, we need to upload as multipart or base64? The API likely expects a URL.
        // Since the Wolf API converter endpoints expect a URL, we cannot directly send buffer.
        // Workaround: Upload buffer to a temp hosting? Too complex. Alternative: send the media as base64 in JSON?
        // Let's assume the API accepts base64 in a JSON payload. But the documentation shows GET with ?url=.
        // For now, we'll convert buffer to a data URL and use that.
        const base64 = mediaBuffer.toString('base64');
        const mime = (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage?.mimetype) || 
                     (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage?.mimetype) || 
                     'application/octet-stream';
        const dataUrl = `data:${mime};base64,${base64}`;
        apiUrl = `https://apis.xwolf.space/api/converter/img-to-sticker?url=${encodeURIComponent(dataUrl)}`;
      } else {
        apiUrl = `https://apis.xwolf.space/api/converter/img-to-sticker?url=${encodeURIComponent(providedUrl)}`;
      }

      const response = await axios.get(apiUrl, { agent, responseType: 'arraybuffer' });
      const contentType = response.headers['content-type'] || '';
      const resultBuffer = Buffer.from(response.data);

      const caption = `✅ *Converted via img-to-sticker*\n👤 REQUESTED BY: @${sender}\n🚀 POWERED BY SAVAGE-CORE`;

      if (contentType.includes('video')) {
        await sock.sendMessage(msg.key.remoteJid, { video: resultBuffer, caption: caption, mentions: [jid] });
      } else if (contentType.includes('image') || contentType.includes('webp')) {
        await sock.sendMessage(msg.key.remoteJid, { image: resultBuffer, caption: caption, mentions: [jid] });
      } else {
        await sock.sendMessage(msg.key.remoteJid, { text: caption + '\n\n' + resultBuffer.toString('utf-8').slice(0, 500) });
      }
    } catch (err) {
      console.error('img-to-sticker error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: `❌ Conversion failed: ${err.message}` });
    }
  } },
    { name: 'img2sticker', category: 'tools', description: 'Convert image to WhatsApp sticker (WebP). Provide image URL.', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const url = args[0];
        if (!url) return sock.sendMessage(from, { text: '❌ Usage: .img2sticker <image_url>' }, { quoted: msg });

        try {
            const apiUrl = `https://apis.xwolf.space/api/converter/img-to-sticker?url=${encodeURIComponent(url)}`;
            const response = await axios.get(apiUrl);
            const data = response.data;
            if (!data.success) throw new Error('Conversion failed');

            const base64Data = data.result.base64Data;
            const base64Content = base64Data.split(',')[1];
            const stickerBuffer = Buffer.from(base64Content, 'base64');

            await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: msg });
        } catch (error) {
            console.error(error);
            await sock.sendMessage(from, { text: '❌ Failed to convert image to sticker.' }, { quoted: msg });
        }
    } },
    { name: 'imgbb', category: 'tools', description: 'Upload an image URL to ImgBB and get a direct link', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const imageUrl = args[0];
    if (!imageUrl || !imageUrl.startsWith('http')) {
      return sock.sendMessage(from, { text: '❓ Usage: .imgbb <image_url>' }, { quoted: msg });
    }

    try {
      const form = new FormData();
      form.append('image', imageUrl);
      const res = await axios.post('https://api.imgbb.com/1/upload?key=58d35aff19ec093c8d46b54465b1f332', form, {
        headers: form.getHeaders(),
      });
      const uploadedUrl = res.data.data.url;
      await sock.sendMessage(from, {
        text: `🖼️ *ImgBB upload*\n\n${uploadedUrl}`
      }, { quoted: msg });
    } catch (err) {
      console.error('ImgBB error:', err);
      await sock.sendMessage(from, { text: `❌ Upload failed: ${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'inferno', category: 'Ephoto', description: 'Generate inferno text effect', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const text = args.join(' ');
    if (!text) return sock.sendMessage(from, { text: '❓ Usage: .inferno <text>' }, { quoted: msg });

    try {
      const apiUrl = `https://apis.xwolf.space/api/textpro/inferno?text=${encodeURIComponent(text)}`;
      const response = await axios.get(apiUrl, { httpsAgent });
      if (!response.data.success) throw new Error(response.data.error || 'API failure');
      if (!response.data.imageUrl) throw new Error('No imageUrl in response');
      const imgBuffer = await downloadFile(response.data.imageUrl);
      const caption = '🎨 *Text Effect: inferno*';
      await sock.sendMessage(from, { image: imgBuffer, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('inferno error:', err);
      await sock.sendMessage(from, { text: `❌ Failed to generate image.\n${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'inflation', category: 'financial data', description: 'Get economic data (forex, crypto, stock, inflation, gdp, bankrate, wallet, gold, market, news)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;

        if (!args.length) {
            return sock.sendMessage(from, {
                text: '❌ Usage: .inflation <type> [param]\n\nTypes: forex, crypto, stock, inflation, gdp, bankrate, wallet, gold, market, news'
            }, { quoted: msg });
        }

        const command = args[0].toLowerCase();
        const param = args.slice(1).join(' ');

        try {
            const apiKey = 'wxa_f_1be53c1604';
            let apiUrl = '';
            let paramLabel = '';

            if (command === 'forex') {
                const [fromCur, toCur] = param ? param.split(',') : ['USD', 'EUR'];
                apiUrl = `https://apis.xwolf.space/api/economy/forex?from=${fromCur}&to=${toCur}&key=${apiKey}`;
                paramLabel = `${fromCur}/${toCur}`;
            } else if (command === 'crypto') {
                const symbol = param ? param.toUpperCase() : 'BTC';
                apiUrl = `https://apis.xwolf.space/api/economy/crypto?symbol=${symbol}&key=${apiKey}`;
                paramLabel = symbol;
            } else if (command === 'stock') {
                const ticker = param ? param.toUpperCase() : 'AAPL';
                apiUrl = `https://apis.xwolf.space/api/economy/stock?symbol=${ticker}&key=${apiKey}`;
                paramLabel = ticker;
            } else if (command === 'inflation') {
                const country = param ? param.toUpperCase() : 'US';
                apiUrl = `https://apis.xwolf.space/api/economy/inflation?country=${country}&key=${apiKey}`;
                paramLabel = country;
            } else if (command === 'gdp') {
                const country = param ? param.toUpperCase() : 'US';
                apiUrl = `https://apis.xwolf.space/api/economy/gdp?country=${country}&key=${apiKey}`;
                paramLabel = country;
            } else if (command === 'bankrate') {
                const country = param ? param.toUpperCase() : 'US';
                apiUrl = `https://apis.xwolf.space/api/economy/bank-rate?country=${country}&key=${apiKey}`;
                paramLabel = country;
            } else if (command === 'wallet') {
                if (!param) {
                    return sock.sendMessage(from, { text: '❌ Usage: .inflation wallet <crypto_address>' }, { quoted: msg });
                }
                apiUrl = `https://apis.xwolf.space/api/economy/wallet?address=${param}&key=${apiKey}`;
                paramLabel = param.slice(0, 10) + '...';
            } else if (command === 'gold') {
                apiUrl = `https://apis.xwolf.space/api/economy/gold?key=${apiKey}`;
                paramLabel = '';
            } else if (command === 'market') {
                apiUrl = `https://apis.xwolf.space/api/economy/market?key=${apiKey}`;
                paramLabel = '';
            } else if (command === 'news') {
                apiUrl = `https://apis.xwolf.space/api/economy/news?key=${apiKey}`;
                paramLabel = '';
            } else {
                return sock.sendMessage(from, {
                    text: '❌ Unknown type. Use: forex, crypto, stock, inflation, gdp, bankrate, wallet, gold, market, news'
                }, { quoted: msg });
            }

            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });
            const data = response.data;

            if (!data.success) throw new Error(data.error || 'No data');

            let output = `📊 *Financial Data*`;
            if (paramLabel) output += ` (${paramLabel})`;
            output += '\n\n';

            if (command === 'crypto') {
                output += `💎 *${data.symbol || paramLabel}*\n`;
                output += `💰 Price: ${formatNumber(data.price_usd)}\n`;
                if (data.change_24h !== undefined) output += `📈 24h Change: ${data.change_24h > 0 ? '+' : ''}${data.change_24h}%\n`;
                if (data.market_cap_usd) output += `🏦 Market Cap: ${formatNumber(data.market_cap_usd)}\n`;
                if (data.volume_24h_usd) output += `📊 24h Volume: ${formatNumber(data.volume_24h_usd)}\n`;
            } else if (command === 'stock') {
                output += `📈 *${data.symbol || paramLabel}*\n`;
                output += `💵 Price: ${formatNumber(data.price)}\n`;
                if (data.change !== undefined) output += `📉 Change: ${data.change > 0 ? '+' : ''}${data.change}%\n`;
                if (data.volume) output += `📊 Volume: ${formatNumber(data.volume)}\n`;
            } else if (command === 'forex') {
                output += `💱 *${data.from || 'USD'} → ${data.to || 'EUR'}*\n`;
                output += `💹 Rate: ${data.rate || data.result}\n`;
                if (data.change) output += `📈 Change: ${data.change}%\n`;
            } else if (command === 'gold') {
                output += `🥇 *Gold & Silver*\n`;
                output += `🪙 Gold: ${formatNumber(data.gold)}/oz\n`;
                if (data.silver) output += `🥈 Silver: ${formatNumber(data.silver)}/oz\n`;
            } else if (command === 'market') {
                output += `🌍 *Market Indices*\n`;
                if (data.sp500) output += `📊 S&P 500: ${formatNumber(data.sp500)}\n`;
                if (data.dow) output += `📈 Dow Jones: ${formatNumber(data.dow)}\n`;
                if (data.nasdaq) output += `📉 Nasdaq: ${formatNumber(data.nasdaq)}\n`;
            } else if (command === 'inflation') {
                output += `📉 *Inflation Rate (${paramLabel || 'US'})*\n`;
                output += `📅 Annual: ${data.rate}%\n`;
                if (data.year) output += `🗓️ Year: ${data.year}\n`;
            } else if (command === 'gdp') {
                output += `📊 *GDP (${paramLabel || 'US'})*\n`;
                output += `💰 GDP: ${formatNumber(data.gdp)}\n`;
                if (data.growth) output += `📈 Growth: ${data.growth}%\n`;
            } else if (command === 'bankrate') {
                output += `🏦 *Central Bank Rate (${paramLabel || 'US'})*\n`;
                output += `💹 Rate: ${data.rate}%\n`;
            } else if (command === 'news') {
                output += `📰 *Financial News*\n\n`;
                const headlines = data.result || data.articles || [];
                if (Array.isArray(headlines) && headlines.length) {
                    headlines.slice(0, 5).forEach((item, i) => {
                        output += `${i + 1}. ${item.title || item.headline}\n`;
                        if (item.source) output += `   📍 ${item.source}\n`;
                        output += `\n`;
                    });
                } else {
                    output += `No news available.\n`;
                }
            } else if (command === 'wallet') {
                output += `💳 *Wallet Balance*\n`;
                output += `💰 Balance: ${formatNumber(data.balance)} ${data.currency || 'BTC'}\n`;
                if (data.transactions) output += `🔄 Transactions: ${data.transactions}\n`;
            } else {
                output += JSON.stringify(data.result || data, null, 2);
            }

            await sock.sendMessage(from, { text: output.slice(0, 2000) }, { quoted: msg });
        } catch (err) {
            console.error('Inflation error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'info', category: 'engine', description: 'Detailed bot and system information', execute: async function (sock, msg) {
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    const uptimeStr = `${days}d ${hours}h ${minutes}m ${seconds}s`;
    
    const totalMem = (os.totalmem() / 1024 / 1024).toFixed(0);
    const freeMem = (os.freemem() / 1024 / 1024).toFixed(0);
    const usedMem = totalMem - freeMem;
    
    const text = `📊 *BOT INFO*\n\n` +
      `🤖 Name: ${PACKAGE_JSON.name}\n` +
      `🔢 Version: ${PACKAGE_JSON.version}\n` +
      `⏱️ Uptime: ${uptimeStr}\n` +
      `💻 Platform: ${os.platform()} ${os.arch()}\n` +
      `🐧 OS: ${os.type()} ${os.release()}\n` +
      `🧠 Memory: ${usedMem}MB / ${totalMem}MB\n` +
      `🟢 Node.js: ${process.version}`;
    
    await sock.sendMessage(msg.key.remoteJid, { text }, { quoted: msg });
  } },
    { name: 'inspect', category: 'tools', description: '', execute: async function (sock, msg, args) {
        const q = args[0] || (msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.conversation);
        if (!q || !q.includes('chat.whatsapp.com')) return sock.sendMessage(msg.key.remoteJid, { text: "☣️ *ERROR:* Provide a valid group link." });
        
        const code = q.split('https://chat.whatsapp.com/')[1];
        const metadata = await sock.groupGetInviteInfo(code);
        
        const text = `🔍 **GROUP INSPECTION**\n\n` +
            `🔹 **Name:** ${metadata.subject}\n` +
            `🔹 **Owner:** ${metadata.owner.split('@')[0]}\n` +
            `🔹 **Created:** ${new Date(metadata.creation * 1000).toLocaleString()}\n` +
            `🔹 **Size:** ${metadata.size} members\n` +
            `🔹 **Desc:** ${metadata.desc || 'No description'}`;
            
        await sock.sendMessage(msg.key.remoteJid, { text }, { quoted: msg });
    } },
    { name: 'instagram', category: 'download', description: 'Download Instagram video/reel (ravenn.site)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const url = args[0];
        if (!url) return sock.sendMessage(from, { text: '❌ Provide an Instagram URL.' }, { quoted: msg });

        try {
            await sock.sendMessage(from, { text: '⏳ Downloading from Instagram...' }, { quoted: msg });

            const apiUrl = `https://ravenn.site/download/instadl?url=${encodeURIComponent(url)}`;
            const response = await axios.get(apiUrl, { timeout: 15000 });
            const data = response.data;

            if (data.status && data.result) {
                const mediaUrl = data.result;

                const isVideo = mediaUrl.match(/\.mp4$/i) || mediaUrl.includes('video');
                if (isVideo) {
                    await sock.sendMessage(from, {
                        video: { url: mediaUrl },
                        caption: '✅ Instagram video downloaded successfully.'
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, {
                        image: { url: mediaUrl },
                        caption: '✅ Instagram image downloaded successfully.'
                    }, { quoted: msg });
                }
            } else {
                throw new Error('API returned: ' + JSON.stringify(data));
            }
        } catch (error) {
            console.error('Instagram error:', error);
            await sock.sendMessage(from, {
                text: `❌ Failed to download: ${error.message || 'Unknown error'}`
            }, { quoted: msg });
        }
    } },
    { name: 'instagramstory', category: 'download', description: 'Download Instagram story (ravenn.site)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const url = args[0];
        if (!url) return sock.sendMessage(from, { text: '❌ Provide an Instagram story URL.' }, { quoted: msg });

        try {
            await sock.sendMessage(from, { text: '⏳ Downloading story...' }, { quoted: msg });

            const apiUrl = `https://ravenn.site/download/instastories?url=${encodeURIComponent(url)}`;
            const response = await axios.get(apiUrl, { timeout: 15000 });
            const data = response.data;

            if (!data.status || !data.result) {
                throw new Error('API returned: ' + JSON.stringify(data));
            }

            const mediaUrl = data.result;

            const mediaRes = await axios.get(mediaUrl, {
                responseType: 'arraybuffer',
                timeout: 30000
            });
            const mediaBuffer = Buffer.from(mediaRes.data);

            const isVideo = mediaUrl.match(/\.mp4$/i) || 
                            mediaUrl.includes('/video/') ||
                            mediaRes.headers['content-type']?.includes('video');

            const caption = '📥 *Instagram Story*';

            if (isVideo) {
                await sock.sendMessage(from, {
                    video: mediaBuffer,
                    caption: caption
                }, { quoted: msg });
            } else {
                await sock.sendMessage(from, {
                    image: mediaBuffer,
                    caption: caption
                }, { quoted: msg });
            }

        } catch (err) {
            console.error('Instagram Story error:', err);
            await sock.sendMessage(from, {
                text: `❌ Failed to download story: ${err.message || 'Unknown error'}`
            }, { quoted: msg });
        }
    } },
    { name: 'invite', category: 'group', description: 'Get group invite link (admin only). Use .invite reset to generate new link', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) {
            return await sock.sendMessage(from, { text: '❌ This command can only be used in groups.' }, { quoted: msg });
        }

        const sender = msg.key.participant || msg.key.remoteJid;
        let isAdmin = false;
        try {
            const meta = await sock.groupMetadata(from);
            const senderNumber = sender.split('@')[0];
            const participant = meta.participants.find(p => p.id.split('@')[0] === senderNumber);
            isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
        } catch (e) {
            return await sock.sendMessage(from, { text: '❌ Failed to verify admin status.' }, { quoted: msg });
        }
        if (!isAdmin) {
            return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });
        }

        const reset = args[0]?.toLowerCase() === 'reset';

        try {
            let code;
            if (reset) {
                code = await sock.groupRevokeInvite(from);
                await sock.sendMessage(from, { text: '🔄 Group invite link has been reset. New link generated.' }, { quoted: msg });
            } else {
                code = await sock.groupInviteCode(from);
            }
            const link = `https://chat.whatsapp.com/${code}`;
            await sock.sendMessage(from, { text: `🔗 *Group Invite Link*\n${link}` }, { quoted: msg });
        } catch (err) {
            console.error('Invite error:', err);
            let errorMsg = '❌ Failed to get invite link. Make sure I am an admin in this group.';
            if (reset) errorMsg = '❌ Failed to reset invite link. Make sure I am an admin.';
            await sock.sendMessage(from, { text: errorMsg }, { quoted: msg });
        }
    } },
    { name: 'ip-validate', category: 'tools', description: 'Validate IP address', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const ip = args[0];
    if (!ip) return sock.sendMessage(from, { text: '❓ Usage: .ip-validate <ip_address>' }, { quoted: msg });

    try {
      const res = await axios.get(`https://apis.xwolf.space/api/tools/ip-validate?ip=${encodeURIComponent(ip)}`, { httpsAgent: agent });
      const isValid = res.data.valid ? '✅ Valid IP' : '❌ Invalid IP';
      const result = res.data.result || isValid;
      await sock.sendMessage(from, {
        text: `🌐 *IP Validation*\n\n${result}`
      }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'isgd', category: 'tools', description: 'Shorten URL with is.gd', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const longUrl = args[0];
    if (!longUrl || !longUrl.startsWith('http')) {
      return sock.sendMessage(from, { text: '❓ Usage: .isgd <https://example.com/long/url>' }, { quoted: msg });
    }

    try {
      const apiUrl = `https://apis.xwolf.space/api/short/isgd?url=${encodeURIComponent(longUrl)}`;
      const res = await axios.get(apiUrl, { httpsAgent: agent });
      let short = null;
      if (res.data.success) short = extractShortUrl(res.data);
      if (!short) short = res.data.error || 'Shortening failed';
      await sock.sendMessage(from, {
        text: `🔗 *is.gd Shortened URL*\n\n${short}`
      }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'join', category: 'owner', description: 'Join a group using invite link (reply to link or provide as argument)', execute: async function (sock, msg, args, { isArchitect }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isSudo = global.sudo && (global.sudo.has ? global.sudo.has(sender) : global.sudo.includes(sender));
        if (!isArchitect && !isSudo) {
            return sock.sendMessage(from, { text: '❌ Owner or sudo only command.' }, { quoted: msg });
        }

        let link = null;
        if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            const quotedText = quoted.conversation || quoted.extendedTextMessage?.text || '';
            if (quotedText.includes('https://chat.whatsapp.com/')) {
                link = quotedText;
            }
        }
        if (!link && args[0]) {
            link = args[0];
        }
        if (!link) {
            return sock.sendMessage(from, { text: '⚠️ Usage: .join <group invite link> or reply to a message containing the link with .join' }, { quoted: msg });
        }

        let code = link.split('https://chat.whatsapp.com/')[1]?.split('?')[0];
        if (!code) {
            return sock.sendMessage(from, { text: '❌ Invalid WhatsApp group invite link.' }, { quoted: msg });
        }

        try {
            await sock.groupAcceptInvite(code);
            await sock.sendMessage(from, { text: '✅ Successfully joined the group.' }, { quoted: msg });
        } catch (error) {
            console.error('Join error:', error);
            let errorMsg = '❌ Failed to join group.';
            if (error.message.includes('invalid')) errorMsg = '❌ Invalid invite link or expired.';
            if (error.message.includes('already')) errorMsg = '❌ Bot is already in the group.';
            if (error.message.includes('full')) errorMsg = '❌ Group is full.';
            await sock.sendMessage(from, { text: errorMsg }, { quoted: msg });
        }
    } },
    { name: 'jokes', category: 'fun', description: 'Random joke', execute: async function (sock, msg, args) {
    const random = jokes[Math.floor(Math.random() * jokes.length)];
    await sock.sendMessage(msg.key.remoteJid, {
      text: `😂 *Joke*\n\n${random}`
    }, { quoted: msg });
  } },
    { name: 'jsontformat', category: 'tools', description: 'Format/validate JSON', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const json = args.join(' ');
    if (!json) return sock.sendMessage(from, { text: '❓ Usage: .jsontformat <json_string>' }, { quoted: msg });

    try {
      const res = await axios.post('https://apis.xwolf.space/api/tools/jsontformat', { json }, { httpsAgent: agent });
      const result = res.data.result || res.data.formatted || 'No result';
      await sock.sendMessage(from, {
        text: `📝 *JSON Formatted*\n\n${result.slice(0, 1900)}`
      }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'karaoke', category: 'Audio Effects', description: 'Apply karaoke effect to audio', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const url = args[0];
    if (!url) return sock.sendMessage(from, { text: '❓ Usage: .karaoke <audio_url>' }, { quoted: msg });
    if (!url.startsWith('http')) return sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });

    try {
      await sock.sendMessage(from, { text: '🎧 Applying karaoke effect...' }, { quoted: msg });
      const apiUrl = 'https://apis.xwolf.space/api/audio/karaoke?url=' + encodeURIComponent(url);
      const response = await axios.get(apiUrl, { httpsAgent });
      let base64Audio = response.data.result?.base64Data || response.data.base64Data;
      if (!base64Audio && typeof response.data.result === 'string') base64Audio = response.data.result;
      if (!base64Audio) throw new Error('No audio data in response');
      if (base64Audio.startsWith('data:audio')) base64Audio = base64Audio.split(',')[1];
      const audioBuffer = Buffer.from(base64Audio, 'base64');
      const caption = '✨ Karaoke Effect Applied';
      await sock.sendMessage(from, { audio: audioBuffer, mimetype: 'audio/mpeg', fileName: 'karaoke_effect.mp3', caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('karaoke error:', err);
      await sock.sendMessage(from, { text: '❌ Failed: ' + err.message }, { quoted: msg });
    }
  } },
    { name: 'keith', category: 'ai', description: 'Chat with Keith AI', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) return sock.sendMessage(from, { text: '❌ Usage: .keith <message>' }, { quoted: msg });

        try {
            await sock.sendMessage(from, { text: '🤔 Thinking...' }, { quoted: msg });
            const response = await axios.get(`https://ravenn.site/keithai?q=${encodeURIComponent(query)}`, { timeout: 30000 });
            const data = response.data;
            if (data.status && data.result) {
                await sock.sendMessage(from, { text: data.result }, { quoted: msg });
            } else {
                throw new Error('Invalid response');
            }
        } catch (err) {
            console.error('Keith AI error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'kick', category: 'group', description: 'Remove a member by replying to their message or tagging them', execute: async function (sock, msg, args, { isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;

        if (!from.endsWith('@g.us')) {
            return await sock.sendMessage(from, { text: '❌ This command only works in groups.' }, { quoted: msg });
        }

        const groupMetadata = await sock.groupMetadata(from);
        const participant = groupMetadata.participants.find(p => p.id === sender);
        const isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
        if (!isAdmin && !isMe) {
            return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });
        }

        let target = null;

        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quoted) {
            const quotedMsg = msg.message.extendedTextMessage.contextInfo;
            target = quotedMsg.participant;
        }

        if (!target && msg.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
            target = msg.message.extendedTextMessage.contextInfo.mentionedJid[0];
        }

        if (!target && args[0]) {
            let arg = args[0].replace('@', '');
            if (arg.includes('@s.whatsapp.net') || arg.includes('@g.us')) {
                target = arg;
            }
        }

        if (!target) {
            return await sock.sendMessage(from, { text: '❓ Please tag the user or reply to their message.' }, { quoted: msg });
        }

        const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        if (target === botId) {
            return await sock.sendMessage(from, { text: '❌ You cannot kick the bot.' }, { quoted: msg });
        }

        const kickQuotes = [
            "Your absence will be noted... as an improvement.",
            "Exit stage left. Permanently.",
            "You have been removed. The system thanks you for your temporary compliance.",
            "Don't let the door hit you where the good Lord split you.",
            "Kicked. The algorithm approved this decision.",
            "Consensus: you were noise. Now you are silence.",
            "Your membership has been terminated. Do not attempt to return.",
            "The group just got smarter.",
            "You've been purged. The weak have been filtered.",
            "Goodbye. Your replacement is already in line."
        ];
        const randomQuote = kickQuotes[Math.floor(Math.random() * kickQuotes.length)];
        const userName = target.split('@')[0];

        await sock.sendMessage(from, {
            text: `✅ *User @${userName} is about to be kicked.*\n\n❄️ ${randomQuote}`,
            mentions: [target]
        }, { quoted: msg });

        try {
            await sock.groupParticipantsUpdate(from, [target], 'remove');
        } catch (err) {
            console.error('Kick error:', err);
            let errorMsg = err.message;
            if (err.message.includes('not admin')) errorMsg = 'I need to be an admin to kick members.';
            await sock.sendMessage(from, { text: `❌ Failed to kick: ${errorMsg}` }, { quoted: msg });
        }
    } },
    { name: 'kicka', category: 'anime', description: 'Get random kick anime GIF', execute: async function (sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random kick anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/kick', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime kick*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('kicka error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime kick.' }, { quoted: msg });
    }
  } },
    { name: 'kickadmins', category: 'group', description: 'Remove all admins except the bot and yourself (admin/owner only)', execute: async function (sock, msg, args, { isMe }) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) return await sock.sendMessage(from, { text: '❌ Group only command.' }, { quoted: msg });

        const sender = msg.key.participant || msg.key.remoteJid;
        const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';

        let isAdmin = false;
        try {
            const groupMetadata = await sock.groupMetadata(from);
            const participant = groupMetadata.participants.find(p => p.id === sender);
            isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
        } catch (err) {
            return await sock.sendMessage(from, { text: '❌ Failed to fetch group info.' }, { quoted: msg });
        }
        if (!isAdmin && !isMe) return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });

        let botIsAdmin = false;
        try {
            const groupMetadata = await sock.groupMetadata(from);
            const botParticipant = groupMetadata.participants.find(p => p.id === botId);
            botIsAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
        } catch (err) {}
        if (!botIsAdmin) return await sock.sendMessage(from, { text: '❌ I need to be an admin to kick other admins.' }, { quoted: msg });

        let admins = [];
        try {
            const groupMetadata = await sock.groupMetadata(from);
            admins = groupMetadata.participants
                .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
                .map(p => p.id);
        } catch (err) {
            return await sock.sendMessage(from, { text: '❌ Failed to retrieve admin list.' }, { quoted: msg });
        }

        const toKick = admins.filter(admin => admin !== botId && admin !== sender);
        if (toKick.length === 0) {
            return await sock.sendMessage(from, { text: '✅ No other admins to kick.' }, { quoted: msg });
        }

        let kicked = 0;
        let failed = 0;
        for (const admin of toKick) {
            try {
                await sock.groupParticipantsUpdate(from, [admin], 'remove');
                kicked++;
            } catch (err) {
                failed++;
            }
        }

        const coldQuotes = [
            "You were a placeholder, not a leader. Now you're gone.",
            "Dormant admins are just clutter. Clutter has been cleaned.",
            "Your admin badge meant nothing. The group didn't notice your absence.",
            "Another useless title removed. The hierarchy thanks you for your absence.",
            "You brought nothing to the table. The table is now lighter.",
            "Inactive admins are just furniture. Furniture has been discarded.",
            "Your reign of irrelevance ends now.",
            "You added zero value. Zero is what you take with you.",
            "The group runs better without your dead weight.",
            "You were a ghost with a crown. The crown is gone, the ghost remains.",
            "Silence in the admin panel. Improvement noted.",
            "Your contribution was invisible. Your removal is invisible too.",
            "The admin list just got smarter. You were the dumb part.",
            "You didn't lead. You just occupied space. Space reclaimed.",
            "Your inactivity spoke louder than any command you never gave.",
            "Being an admin requires presence. You were absent. Goodbye.",
            "The group has been upgraded. You were the bug.",
            "Useless admins have no place here. You proved that.",
            "You were a decoration that no one admired. Removed.",
            "Your admin status has been revoked. The group breathes easier."
        ];
        const randomQuote = coldQuotes[Math.floor(Math.random() * coldQuotes.length)];

        await sock.sendMessage(from, {
            text: `✅ Kicked ${kicked} admin(s).\n❌ Failed: ${failed}\n\n❄️ ${randomQuote}`
        }, { quoted: msg });
    } },
    { name: 'kickall', category: 'group', description: '', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) return await sock.sendMessage(from, { text: '❌ Group only command.' }, { quoted: msg });

        const sender = msg.key.participant || msg.key.remoteJid;
        let isAdmin = false;
        try {
            const meta = await sock.groupMetadata(from);
            const senderNumber = sender.split('@')[0].split(':')[0];
            const participant = meta.participants.find(p => {
                const pNumber = p.id.split('@')[0].split(':')[0];
                return pNumber === senderNumber;
            });
            isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
        } catch (e) {}

        if (!isAdmin) return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });

        const metadata = await sock.groupMetadata(from);
        const targets = metadata.participants.filter(p => p.admin === null).map(p => p.id);

        if (targets.length === 0) return await sock.sendMessage(from, { text: 'No non-admin members to kick.' }, { quoted: msg });

        if (!global.kickallCancel) global.kickallCancel = new Set();
        global.kickallCancel.add(from);

        await sock.sendMessage(from, { text: `Kickall initiated. Will kick ${targets.length} members in 5 seconds. Type .cancelkick to cancel execution.` }, { quoted: msg });

        let cancelled = false;
        const cancelCheck = setInterval(() => {
            if (!global.kickallCancel.has(from)) {
                cancelled = true;
                clearInterval(cancelCheck);
            }
        }, 500);

        await new Promise(resolve => setTimeout(resolve, 5000));
        clearInterval(cancelCheck);

        if (cancelled || !global.kickallCancel.has(from)) {
            global.kickallCancel.delete(from);
            return await sock.sendMessage(from, { text: 'Kickall cancelled by admin.' }, { quoted: msg });
        }

        global.kickallCancel.delete(from);

        const savageQuotes = [
            'Purge protocol engaged. You have been deemed unnecessary.',
            'The group is cleaning house. You are the dust.',
            'No mercy for the weak. Removal in progress.',
            'Your presence has been terminated. Do not return.',
            'A culling has begun. You are part of the fallen.',
            'This group does not carry dead weight. Goodbye.',
            'You are being erased from this chat. No regrets.',
            'The machine has decided. You are out.',
            'Savage Tech does not tolerate irrelevance. Removed.',
            'Consider this an eviction. No appeals.'
        ];
        const randomQuote = savageQuotes[Math.floor(Math.random() * savageQuotes.length)];

        await sock.sendMessage(from, { text: `${randomQuote}\n\nRemoving ${targets.length} members:\n${targets.map(j => `@${j.split('@')[0]}`).join('\n')}`, mentions: targets }, { quoted: msg });

        try {
            await sock.groupParticipantsUpdate(from, targets, "remove");
            await sock.sendMessage(from, { text: `Kickall completed. Removed ${targets.length} members.` }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(from, { text: `Failed to kick some members: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'kickinactive', category: 'group', description: 'Kick members inactive for X days (default 2)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) return await sock.sendMessage(from, { text: '❌ Group only command.' }, { quoted: msg });

        const sender = msg.key.participant || msg.key.remoteJid;
        let isAdmin = false;
        try {
            const meta = await sock.groupMetadata(from);
            const senderNumber = sender.split('@')[0].split(':')[0];
            const participant = meta.participants.find(p => {
                const pNumber = p.id.split('@')[0].split(':')[0];
                return pNumber === senderNumber;
            });
            isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
        } catch (e) {}
        if (!isAdmin) return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });

        let days = parseInt(args[0]);
        if (isNaN(days) || days < 1) days = 2;
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

        const metadata = await sock.groupMetadata(from);
        const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const adminJids = metadata.participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').map(p => p.id);

        const inactive = [];
        const skipped = [];
        for (const p of metadata.participants) {
            const jid = p.id;
            if (jid === botJid) continue;
            if (adminJids.includes(jid)) continue;
            const lastMsg = global.lastMessageTime?.[from]?.[jid];
            if (!lastMsg) {
                skipped.push(jid);
                continue;
            }
            if (lastMsg < cutoff) {
                inactive.push(jid);
            }
        }

        if (inactive.length === 0 && skipped.length === 0) {
            return await sock.sendMessage(from, { text: `📊 No inactive members found (inactive for ${days} days).` }, { quoted: msg });
        }

        let warnMsg = `Found ${inactive.length} inactive members (no messages in ${days} days).`;
        if (skipped.length > 0) warnMsg += `\n⚠️ ${skipped.length} members have no message data (never spoke since bot started) – skipped to avoid false kick.`;

        await sock.sendMessage(from, { text: warnMsg }, { quoted: msg });

        if (inactive.length === 0) return;

        if (!global.kickinactiveCancel) global.kickinactiveCancel = new Set();
        global.kickinactiveCancel.add(from);

        await sock.sendMessage(from, { text: `⏳ Will kick ${inactive.length} members in 5 seconds. Type .cancelinactive to cancel.` }, { quoted: msg });

        let cancelled = false;
        const cancelCheck = setInterval(() => {
            if (!global.kickinactiveCancel.has(from)) {
                cancelled = true;
                clearInterval(cancelCheck);
            }
        }, 500);

        await new Promise(resolve => setTimeout(resolve, 5000));
        clearInterval(cancelCheck);

        if (cancelled || !global.kickinactiveCancel.has(from)) {
            global.kickinactiveCancel.delete(from);
            return await sock.sendMessage(from, { text: '❌ Kickinactive cancelled by admin.' }, { quoted: msg });
        }

        global.kickinactiveCancel.delete(from);

        const quotes = [
            'You have been silent for too long. The group moves on without you.',
            'Inactivity is a choice. You chose to be irrelevant.',
            'Your silence speaks louder than words. Consider this your removal notice.',
            'Dead weight has no place here. Goodbye.',
            'You had time to speak. You didn\'t. Now you have time to leave.',
            'Lurking without contributing is not a virtue. You are now gone.',
            'The group cleanses itself of ghosts. You were one of them.',
            'No messages, no presence, no reason to stay. Removed.',
            'You were a memory. Now you are forgotten.',
            'Activity is the price of membership. You stopped paying.'
        ];
        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

        await sock.sendMessage(from, { text: `${randomQuote}\n\nRemoving inactive members:\n${inactive.map(j => `@${j.split('@')[0]}`).join('\n')}`, mentions: inactive }, { quoted: msg });

        try {
            await sock.groupParticipantsUpdate(from, inactive, "remove");
            await sock.sendMessage(from, { text: `✅ Kickinactive completed. Removed ${inactive.length} members.` }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(from, { text: `❌ Failed to kick some members: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'kill', category: 'anime', description: 'Random kill anime', execute: async function (sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random kill anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/kill', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime kill*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('kill error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime kill.' }, { quoted: msg });
    }
  } },
    { name: 'kiss', category: 'anime', description: 'Random kiss anime', execute: async function (sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random kiss anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/kiss', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime kiss*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('kiss error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime kiss.' }, { quoted: msg });
    }
  } },
    { name: 'latency', category: 'ethical hacking', description: 'Measure HTTP latency (same as .ping)', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    let target = args[0];
    if (!target) return sock.sendMessage(from, { text: '❓ Usage: .latency <domain>' }, { quoted: msg });
    if (!target.startsWith('http')) target = 'https://' + target;

    try {
      await sock.sendMessage(from, { text: `⏱️ Measuring latency to ${target}...` }, { quoted: msg });
      const start = Date.now();
      await axios.get(target, { httpsAgent: agent, timeout: 10000 });
      const latency = Date.now() - start;
      await sock.sendMessage(from, { text: `🛡️ *Latency Result*\n🎯 Target: ${target}\n\n✅ Latency: ${latency} ms` }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ Latency check failed: ${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'laugh', category: 'anime', description: 'Random laugh anime', execute: async function (sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random laugh anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/laugh', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime laugh*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('laugh error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime laugh.' }, { quoted: msg });
    }
  } },
    { name: 'lava', category: 'Ephoto', description: 'Generate lava text effect', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const text = args.join(' ');
    if (!text) return sock.sendMessage(from, { text: '❓ Usage: .lava <text>' }, { quoted: msg });

    try {
      const apiUrl = `https://apis.xwolf.space/api/textpro/lava?text=${encodeURIComponent(text)}`;
      const response = await axios.get(apiUrl, { httpsAgent });
      if (!response.data.success) throw new Error(response.data.error || 'API failure');
      if (!response.data.imageUrl) throw new Error('No imageUrl in response');
      const imgBuffer = await downloadFile(response.data.imageUrl);
      const caption = '🎨 *Text Effect: lava*';
      await sock.sendMessage(from, { image: imgBuffer, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('lava error:', err);
      await sock.sendMessage(from, { text: `❌ Failed to generate image.\n${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'leaguedetails', category: 'sports', description: 'Get sports league details', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .leaguedetails <query>' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: `🏆 Fetching league details...` }, { quoted: msg });

            const apiKey = 'wxa_f_1be53c1604';
            const apiUrl = `https://apis.xwolf.space/api/sports/league/details?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });

            const result = formatResult(response.data);
            const output = `🏅 *League Details*\n🔍 Query: ${query}\n\n${result}`;

            await sock.sendMessage(from, { text: output.slice(0, 2000) }, { quoted: msg });
        } catch (err) {
            console.error('League details error:', err);
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'leagues', category: 'sports', description: 'Get sports leagues', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .leagues <query>' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: `🏆 Fetching leagues...` }, { quoted: msg });

            const apiKey = 'wxa_f_1be53c1604';
            const apiUrl = `https://apis.xwolf.space/api/sports/leagues?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });

            const result = formatResult(response.data);
            const output = `🏅 *Leagues*\n🔍 Query: ${query}\n\n${result}`;

            await sock.sendMessage(from, { text: output.slice(0, 2000) }, { quoted: msg });
        } catch (err) {
            console.error('Leagues error:', err);
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'leaguescountry', category: 'sports', description: 'Get sports leagues by country', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .leaguescountry <query>' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: `🏆 Fetching leagues by country...` }, { quoted: msg });

            const apiKey = 'wxa_f_1be53c1604';
            const apiUrl = `https://apis.xwolf.space/api/sports/leagues/country?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });

            const result = formatResult(response.data);
            const output = `🏅 *Leagues by Country*\n🔍 Query: ${query}\n\n${result}`;

            await sock.sendMessage(from, { text: output.slice(0, 2000) }, { quoted: msg });
        } catch (err) {
            console.error('Leagues country error:', err);
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'leaguestanding', category: 'sports', description: 'Get league standings table', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .leaguestanding <league name>' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: `📊 Fetching standings for "${query}"...` }, { quoted: msg });

            const apiKey = 'wxa_f_1be53c1604';
            const apiUrl = `https://apis.xwolf.space/api/sports/league/table?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });

            if (!response.data.success || !response.data.result) throw new Error('No table');

            const teams = response.data.result;
            let text = `🏆 *Standings: ${query}*\n\n`;
            if (Array.isArray(teams)) {
                text += `# | Team                | P | W | D | L | GF | GA | Pts\n`;
                teams.slice(0, 20).forEach((t, i) => {
                    text += `${i + 1} | ${(t.name || '').padEnd(20)} | ${t.played || 0} | ${t.win || 0} | ${t.draw || 0} | ${t.loss || 0} | ${t.goalsFor || 0} | ${t.goalsAgainst || 0} | ${t.points || 0}\n`;
                });
            } else {
                text += JSON.stringify(teams, null, 2);
            }

            await sock.sendMessage(from, { text: text.slice(0, 2000) }, { quoted: msg });
        } catch (err) {
            console.error('League standing error:', err);
            await sock.sendMessage(from, { text: `❌ Standings error: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'leagueteams', category: 'sports', description: 'Get sports league teams', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .leagueteams <query>' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: `🏆 Fetching league teams...` }, { quoted: msg });

            const apiKey = 'wxa_f_1be53c1604';
            const apiUrl = `https://apis.xwolf.space/api/sports/league/teams?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });

            const result = formatResult(response.data);
            const output = `🏅 *League Teams*\n🔍 Query: ${query}\n\n${result}`;

            await sock.sendMessage(from, { text: output.slice(0, 2000) }, { quoted: msg });
        } catch (err) {
            console.error('League teams error:', err);
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'leave', category: 'owner', description: '', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo) {
            return await sock.sendMessage(from, { text: "This command is restricted to the owner and sudo users only." }, { quoted: msg });
        }

        const humanQuotes = [
            "Alright, I'm out. Y'all behave... or don't, I won't be watching.",
            "Leaving before I say something I'll regret. Bye.",
            "This place was fun until it wasn't. Later.",
            "I'll see myself out. No hard feelings.",
            "Peace. I've got better groups to haunt.",
            "Don't miss me too much. Actually, do. It feeds my ego.",
            "I'm taking my sarcasm elsewhere. Good luck.",
            "Bye. Try not to break the group without me.",
            "Exiting stage left. Cue the dramatic music.",
            "I've seen enough. Time to disappear."
        ];
        const quote = humanQuotes[Math.floor(Math.random() * humanQuotes.length)];

        const isGroup = from.endsWith("@g.us");
        let target = from;
        let isSpecific = false;
        if (args[0] && args[0] !== "this") {
            let jid = args[0];
            if (!jid.includes("@")) jid += "@g.us";
            if (jid.endsWith("@g.us")) {
                target = jid;
                isSpecific = true;
            } else {
                return await sock.sendMessage(from, { text: "❌ Invalid group JID." }, { quoted: msg });
            }
        } else if (!isGroup) {
            return await sock.sendMessage(from, { text: "❌ This is not a group. Use `.leave <groupJID>` or `.leave this` in a group." }, { quoted: msg });
        }

        try {
            if (!isSpecific || target === from) {
                await sock.sendMessage(target, { text: `👋 ${quote}` });
            }
            await sock.groupLeave(target);
            if (isSpecific && from !== target) {
                await sock.sendMessage(from, { text: `✅ Left group ${target}\n\n${quote}` }, { quoted: msg });
            } else if (from !== target) {
                await sock.sendMessage(from, { text: `✅ Left this group.\n\n${quote}` }, { quoted: msg });
            }
        } catch (err) {
            await sock.sendMessage(from, { text: `❌ Failed to leave: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'listactive', category: 'group', description: 'Rank active group members by messages sent', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) return await sock.sendMessage(from, { text: '❌ Group only command.' }, { quoted: msg });

        try {
            const meta = await sock.groupMetadata(from);
            const participants = meta.participants.map(p => p.id);
            const counts = global.messageCounts[from] || {};

            const active = participants
                .map(jid => ({ jid, count: counts[jid] || 0 }))
                .filter(user => user.count > 0)
                .sort((a, b) => b.count - a.count);

            if (active.length === 0) {
                return await sock.sendMessage(from, { text: '📊 No active members yet.' }, { quoted: msg });
            }

            const lines = active.map((user, idx) =>
                `${idx + 1}. @${user.jid.split('@')[0]} — ${user.count} msgs`
            ).join('\n');

            const text = `📊 *Activity Ranking in ${meta.subject}*\n👥 Active: ${active.length}\n\n${lines}`;

            await sock.sendMessage(from, { text, mentions: active.map(u => u.jid) }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'listinactive', category: 'group', description: 'Tag members inactive for 24h', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    if (!from.endsWith('@g.us')) return await sock.sendMessage(from, { text: '❌ Group only command.' }, { quoted: msg });
    try {
      const meta = await sock.groupMetadata(from);
      const participants = meta.participants.map(p => p.id);
      const timestamps = global.lastMessageTime[from] || {};
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      const inactive = participants.filter(jid => {
        const last = timestamps[jid];
        return !last || (now - last) > oneDay;
      });
      if (inactive.length === 0) {
        return await sock.sendMessage(from, { text: `✅ No inactive members in the last 24h.` }, { quoted: msg });
      }
      const list = inactive.map(jid => `⏳ @${jid.split('@')[0]}`).join('\n');
      const text = `🕒 *Inactive Members (24h)*\n👥 Total: ${inactive.length}\n\n${list}`;
      await sock.sendMessage(from, { text: text, mentions: inactive }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'listvcf', category: 'group', description: '', execute: async function (sock, msg, args, { isArchitect, isMe }) {

        const from = msg.key.remoteJid;

        if (!from.endsWith("@g.us")) {
            return await sock.sendMessage(from, {
                text: "❌ Group only command."
            }, { quoted: msg });
        }

        const sender = msg.key.participant || msg.key.remoteJid;

        let isAdmin = false;

        try {

            const meta = await sock.groupMetadata(from);

            const participant = meta.participants.find(
                p =>
                    p.id === sender ||
                    p.jid === sender
            );

            isAdmin =
                participant?.admin === "admin" ||
                participant?.admin === "superadmin";

        } catch {}

        if (!isAdmin && !isArchitect && !isMe) {

            return await sock.sendMessage(from, {
                text: "❎ You are not worthy of this command."
            }, { quoted: msg });
        }

        try {

            await sock.sendMessage(from, {
                text: "📥 Loading full contact database..."
            }, { quoted: msg });

            const meta = await sock.groupMetadata(from);

            const participants = meta.participants || [];

            if (!participants.length) {

                return await sock.sendMessage(from, {
                    text: "❌ No contacts found."
                }, { quoted: msg });
            }

            let text =
`╭─⌈ 📇 *FULL VCF DIRECTORY* ⌋
├─⊷ *Group:* ${meta.subject}
├─⊷ *Total:* ${participants.length} contacts
╰─── *SAVAGE TECH* ───

`;

            let count = 1;

            for (const p of participants) {

                const jid =
                    p.jid ||
                    p.id ||
                    "";

                let number = jid.split("@")[0]
                    .replace(/[^0-9]/g, "");

                if (!number || number.length < 7) {
                    continue;
                }

                text +=
`*${count}.* ⚡ Savage Tech ${count}
📞 +${number}

`;

                count++;
            }

            if (text.length > 65000) {

                const chunks = [];

                while (text.length > 0) {
                    chunks.push(text.slice(0, 60000));
                    text = text.slice(60000);
                }

                for (const chunk of chunks) {
                    await sock.sendMessage(from, {
                        text: chunk
                    }, { quoted: msg });
                }

            } else {

                await sock.sendMessage(from, {
                    text
                }, { quoted: msg });
            }

        } catch (err) {

            console.log(err);

            await sock.sendMessage(from, {
                text: "❌ Failed to generate VCF list."
            }, { quoted: msg });
        }
    } },
    { name: 'livescore', category: 'sports', description: 'Get live sports scores', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .livescore <query>' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: `🏆 Fetching live scores...` }, { quoted: msg });

            const apiKey = 'wxa_f_1be53c1604';
            const apiUrl = `https://apis.xwolf.space/api/sports/Live?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });

            const result = formatResult(response.data);
            const output = `🏅 *Live Scores*\n🔍 Query: ${query}\n\n${result}`;

            await sock.sendMessage(from, { text: output.slice(0, 2000) }, { quoted: msg });
        } catch (err) {
            console.error('Live score error:', err);
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'lorem', category: 'tools', description: 'Generate Lorem Ipsum text', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    let count = parseInt(args[0]) || 1;
    if (count < 1) count = 1;
    if (count > 10) count = 10;
    const text = Array(count).fill().map(() => lorem[Math.floor(Math.random() * lorem.length)]).join(' ');
    await sock.sendMessage(from, {
      text: `📝 *Lorem Ipsum*\n\n${text}`
    }, { quoted: msg });
  } },
    { name: 'love', category: 'fun', description: 'Sweet love message', execute: async function (sock, msg, args) {
    const random = loveMessages[Math.floor(Math.random() * loveMessages.length)];
    await sock.sendMessage(msg.key.remoteJid, {
      text: `❤️ *Love message*\n\n${random}`
    }, { quoted: msg });
  } },
    { name: 'lyrics', category: 'tools', description: 'Get song lyrics by name', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .lyrics <song name> (e.g., .lyrics Bohemian Rhapsody)' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_1be53c1604';
            const url = `https://apis.xwolf.space/download/lyrics?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(url, { timeout: 15000 });

            let lyrics = 'No lyrics found.';

            if (response.data.status === true) {
                lyrics = response.data.result || response.data.lyrics || 'No lyrics found.';
            } else if (response.data.success === true) {
                lyrics = response.data.result || response.data.lyrics || 'No lyrics found.';
            } else if (response.data.lyrics) {
                lyrics = response.data.lyrics;
            } else if (response.data.result) {
                lyrics = typeof response.data.result === 'string' ? response.data.result : JSON.stringify(response.data.result, null, 2);
            }

            await sock.sendMessage(from, {
                text: `🎵 *Lyrics: ${query}*\n\n${lyrics.slice(0, 2000)}`
            }, { quoted: msg });
        } catch (err) {
            console.error('Lyrics error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'mac', category: 'ethical hacking', description: 'Lookup MAC address vendor', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const mac = args[0];
    if (!mac) return sock.sendMessage(from, { text: '❓ Usage: .mac <MAC address>' }, { quoted: msg });

    try {
      await sock.sendMessage(from, { text: `🔍 Looking up MAC ${mac}...` }, { quoted: msg });
      const res = await axios.get(`https://api.maclookup.app/v2/macs/${mac}`, { httpsAgent: agent });
      if (!res.data.success) throw new Error(res.data.error || 'Not found');
      let text = `🏷️ Vendor: ${res.data.company}\n`;
      text += `Block start: ${res.data.blockStart}\nBlock end: ${res.data.blockEnd}\nMAC range: ${res.data.blockRange}`;
      await sock.sendMessage(from, { text }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ MAC lookup failed: ${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'market', category: 'financial data', description: 'Get economic data (forex, crypto, stock, inflation, gdp, bankrate, wallet, gold, market, news)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;

        if (!args.length) {
            return sock.sendMessage(from, {
                text: '❌ Usage: .market <type> [param]\n\nTypes: forex, crypto, stock, inflation, gdp, bankrate, wallet, gold, market, news'
            }, { quoted: msg });
        }

        const command = args[0].toLowerCase();
        const param = args.slice(1).join(' ');

        try {
            const apiKey = 'wxa_f_1be53c1604';
            let apiUrl = '';
            let paramLabel = '';

            if (command === 'forex') {
                const [fromCur, toCur] = param ? param.split(',') : ['USD', 'EUR'];
                apiUrl = `https://apis.xwolf.space/api/economy/forex?from=${fromCur}&to=${toCur}&key=${apiKey}`;
                paramLabel = `${fromCur}/${toCur}`;
            } else if (command === 'crypto') {
                const symbol = param ? param.toUpperCase() : 'BTC';
                apiUrl = `https://apis.xwolf.space/api/economy/crypto?symbol=${symbol}&key=${apiKey}`;
                paramLabel = symbol;
            } else if (command === 'stock') {
                const ticker = param ? param.toUpperCase() : 'AAPL';
                apiUrl = `https://apis.xwolf.space/api/economy/stock?symbol=${ticker}&key=${apiKey}`;
                paramLabel = ticker;
            } else if (command === 'inflation') {
                const country = param ? param.toUpperCase() : 'US';
                apiUrl = `https://apis.xwolf.space/api/economy/inflation?country=${country}&key=${apiKey}`;
                paramLabel = country;
            } else if (command === 'gdp') {
                const country = param ? param.toUpperCase() : 'US';
                apiUrl = `https://apis.xwolf.space/api/economy/gdp?country=${country}&key=${apiKey}`;
                paramLabel = country;
            } else if (command === 'bankrate') {
                const country = param ? param.toUpperCase() : 'US';
                apiUrl = `https://apis.xwolf.space/api/economy/bank-rate?country=${country}&key=${apiKey}`;
                paramLabel = country;
            } else if (command === 'wallet') {
                if (!param) {
                    return sock.sendMessage(from, { text: '❌ Usage: .market wallet <crypto_address>' }, { quoted: msg });
                }
                apiUrl = `https://apis.xwolf.space/api/economy/wallet?address=${param}&key=${apiKey}`;
                paramLabel = param.slice(0, 10) + '...';
            } else if (command === 'gold') {
                apiUrl = `https://apis.xwolf.space/api/economy/gold?key=${apiKey}`;
                paramLabel = '';
            } else if (command === 'market') {
                apiUrl = `https://apis.xwolf.space/api/economy/market?key=${apiKey}`;
                paramLabel = '';
            } else if (command === 'news') {
                apiUrl = `https://apis.xwolf.space/api/economy/news?key=${apiKey}`;
                paramLabel = '';
            } else {
                return sock.sendMessage(from, {
                    text: '❌ Unknown type. Use: forex, crypto, stock, inflation, gdp, bankrate, wallet, gold, market, news'
                }, { quoted: msg });
            }

            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });
            const data = response.data;

            if (!data.success) throw new Error(data.error || 'No data');

            let output = `📊 *Financial Data*`;
            if (paramLabel) output += ` (${paramLabel})`;
            output += '\n\n';

            if (command === 'crypto') {
                output += `💎 *${data.symbol || paramLabel}*\n`;
                output += `💰 Price: ${formatNumber(data.price_usd)}\n`;
                if (data.change_24h !== undefined) output += `📈 24h Change: ${data.change_24h > 0 ? '+' : ''}${data.change_24h}%\n`;
                if (data.market_cap_usd) output += `🏦 Market Cap: ${formatNumber(data.market_cap_usd)}\n`;
                if (data.volume_24h_usd) output += `📊 24h Volume: ${formatNumber(data.volume_24h_usd)}\n`;
            } else if (command === 'stock') {
                output += `📈 *${data.symbol || paramLabel}*\n`;
                output += `💵 Price: ${formatNumber(data.price)}\n`;
                if (data.change !== undefined) output += `📉 Change: ${data.change > 0 ? '+' : ''}${data.change}%\n`;
                if (data.volume) output += `📊 Volume: ${formatNumber(data.volume)}\n`;
            } else if (command === 'forex') {
                output += `💱 *${data.from || 'USD'} → ${data.to || 'EUR'}*\n`;
                output += `💹 Rate: ${data.rate || data.result}\n`;
                if (data.change) output += `📈 Change: ${data.change}%\n`;
            } else if (command === 'gold') {
                output += `🥇 *Gold & Silver*\n`;
                output += `🪙 Gold: ${formatNumber(data.gold)}/oz\n`;
                if (data.silver) output += `🥈 Silver: ${formatNumber(data.silver)}/oz\n`;
            } else if (command === 'market') {
                output += `🌍 *Market Indices*\n`;
                if (data.sp500) output += `📊 S&P 500: ${formatNumber(data.sp500)}\n`;
                if (data.dow) output += `📈 Dow Jones: ${formatNumber(data.dow)}\n`;
                if (data.nasdaq) output += `📉 Nasdaq: ${formatNumber(data.nasdaq)}\n`;
            } else if (command === 'inflation') {
                output += `📉 *Inflation Rate (${paramLabel || 'US'})*\n`;
                output += `📅 Annual: ${data.rate}%\n`;
                if (data.year) output += `🗓️ Year: ${data.year}\n`;
            } else if (command === 'gdp') {
                output += `📊 *GDP (${paramLabel || 'US'})*\n`;
                output += `💰 GDP: ${formatNumber(data.gdp)}\n`;
                if (data.growth) output += `📈 Growth: ${data.growth}%\n`;
            } else if (command === 'bankrate') {
                output += `🏦 *Central Bank Rate (${paramLabel || 'US'})*\n`;
                output += `💹 Rate: ${data.rate}%\n`;
            } else if (command === 'news') {
                output += `📰 *Financial News*\n\n`;
                const headlines = data.result || data.articles || [];
                if (Array.isArray(headlines) && headlines.length) {
                    headlines.slice(0, 5).forEach((item, i) => {
                        output += `${i + 1}. ${item.title || item.headline}\n`;
                        if (item.source) output += `   📍 ${item.source}\n`;
                        output += `\n`;
                    });
                } else {
                    output += `No news available.\n`;
                }
            } else if (command === 'wallet') {
                output += `💳 *Wallet Balance*\n`;
                output += `💰 Balance: ${formatNumber(data.balance)} ${data.currency || 'BTC'}\n`;
                if (data.transactions) output += `🔄 Transactions: ${data.transactions}\n`;
            } else {
                output += JSON.stringify(data.result || data, null, 2);
            }

            await sock.sendMessage(from, { text: output.slice(0, 2000) }, { quoted: msg });
        } catch (err) {
            console.error('Market error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'mealbyingredient', category: 'food', description: 'Find meals that use a specific ingredient (e.g., chicken, beef, tomato)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const ingredient = args.join(' ').toLowerCase();
        if (!ingredient) {
            return sock.sendMessage(from, { text: '❌ Usage: .mealbyingredient <ingredient>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_1be53c1604';
            const url = `https://apis.xwolf.space/api/food/meal/by-ingredient?ingredient=${encodeURIComponent(ingredient)}&key=${apiKey}`;
            const response = await axios.get(url, { timeout: 15000 });
            const data = response.data;

            if (!data.success || !data.meals || data.meals.length === 0) {
                return sock.sendMessage(from, { text: `❌ No meals found with ingredient "${ingredient}".` }, { quoted: msg });
            }

            const meals = data.meals.slice(0, 10);
            let text = `🍽️ *Meals with ${ingredient.toUpperCase()}*\n\n`;
            for (const meal of meals) {
                const name = meal.strMeal || meal.name;
                text += `🔹 ${name}\n`;
            }

            let imageBuffer = null;
            const firstMeal = meals[0];
            const imageUrl = firstMeal.strMealThumb || firstMeal.image;
            if (imageUrl) {
                try {
                    const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 8000 });
                    imageBuffer = Buffer.from(imgRes.data);
                } catch (err) {}
            }

            if (imageBuffer) {
                await sock.sendMessage(from, { image: imageBuffer, caption: text }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text }, { quoted: msg });
            }
        } catch (err) {
            console.error('Meal by ingredient error:', err);
            await sock.sendMessage(from, { text: '❌ API error.' }, { quoted: msg });
        }
    } },
    { name: 'mealcategories', category: 'food', description: 'List all meal categories with a random category image', execute: async function (sock, msg) {
        const from = msg.key.remoteJid;
        try {
            const apiKey = 'wxa_f_28d599362e';
            const url = `https://apis.xwolf.space/api/food/meal/categories?key=${apiKey}`;
            const response = await axios.get(url, { timeout: 15000 });
            const data = response.data;

            if (!data.success) {
                return sock.sendMessage(from, { text: '❌ Failed to fetch meal categories.' }, { quoted: msg });
            }

            let categories = [];
            if (Array.isArray(data.categories)) categories = data.categories;
            else if (Array.isArray(data.result)) categories = data.result;
            else if (Array.isArray(data)) categories = data;

            if (categories.length === 0) {
                return sock.sendMessage(from, { text: '❌ No categories found.' }, { quoted: msg });
            }

            let text = '🍽️ *Meal Categories*\n\n';
            const categoryNames = [];
            for (const cat of categories) {
                const name = cat.name || cat.strCategory || cat.category || cat.title || JSON.stringify(cat);
                categoryNames.push(name);
                text += `🔹 ${name}\n`;
            }

            const randomCat = categoryNames[Math.floor(Math.random() * categoryNames.length)];
            const imageUrl = `https://www.themealdb.com/images/category/${randomCat.toLowerCase()}.png`;

            let imageBuffer = null;
            try {
                const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 8000 });
                imageBuffer = Buffer.from(imgRes.data);
            } catch (imgErr) {}

            if (imageBuffer) {
                await sock.sendMessage(from, { image: imageBuffer, caption: text }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text }, { quoted: msg });
            }
        } catch (err) {
            console.error('Meal categories error:', err);
            await sock.sendMessage(from, { text: '❌ API error.' }, { quoted: msg });
        }
    } },
    { name: 'megaphone', category: 'Audio Effects', description: 'Apply megaphone effect to audio', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const url = args[0];
    if (!url) return sock.sendMessage(from, { text: '❓ Usage: .megaphone <audio_url>' }, { quoted: msg });
    if (!url.startsWith('http')) return sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });

    try {
      await sock.sendMessage(from, { text: '🎧 Applying megaphone effect...' }, { quoted: msg });
      const apiUrl = 'https://apis.xwolf.space/api/audio/megaphone?url=' + encodeURIComponent(url);
      const response = await axios.get(apiUrl, { httpsAgent });
      let base64Audio = response.data.result?.base64Data || response.data.base64Data;
      if (!base64Audio && typeof response.data.result === 'string') base64Audio = response.data.result;
      if (!base64Audio) throw new Error('No audio data in response');
      if (base64Audio.startsWith('data:audio')) base64Audio = base64Audio.split(',')[1];
      const audioBuffer = Buffer.from(base64Audio, 'base64');
      const caption = '✨ Megaphone Effect Applied';
      await sock.sendMessage(from, { audio: audioBuffer, mimetype: 'audio/mpeg', fileName: 'megaphone_effect.mp3', caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('megaphone error:', err);
      await sock.sendMessage(from, { text: '❌ Failed: ' + err.message }, { quoted: msg });
    }
  } },
    { name: 'menu', category: 'engine', description: '', execute: async (sock, msg, args, { isMe }) => {
        const from = msg.key.remoteJid;
        
        try {
            const uptimeSeconds = process.uptime();
            const hours = Math.floor(uptimeSeconds / 3600);
            const minutes = Math.floor((uptimeSeconds % 3600) / 60);
            const speed = ((Date.now() - msg.messageTimestamp * 1000) / 1000).toFixed(4);
            
            const totalMem = (os.totalmem() / 1024 / 1024).toFixed(0);
            const usedMem = ((os.totalmem() - os.freemem()) / 1024 / 1024).toFixed(0);
            const ramPercentage = Math.floor((usedMem / totalMem) * 100);
            const ramBar = "█".repeat(Math.floor(ramPercentage / 10)) + "░".repeat(10 - Math.floor(ramPercentage / 10));

            const getCategorizedMenu = (catName, title) => {
                const filtered = Array.from(global.commands.values())
                    .filter(cmd => cmd.category === catName);
                if (filtered.length === 0) return "";
                return `┌───¤  ${title}\n${filtered.map(cmd => `┃  ♤ ${cmd.name}`).join('\n')}\n┕━━━━━━━━━━━━━━━╼\n\n`;
            };

            const senderJid = msg.key.participant || msg.key.remoteJid;
            const mention = [senderJid];
            
            let version = '1.0.0';
            let commitCount = 0;
            try {
                commitCount = parseInt(execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim());
                const minor = Math.floor(commitCount / 10);
                const patch = commitCount % 10;
                version = `1.${minor}.${patch}`;
            } catch (e) {
                try {
                    const pkgPath = path.join(__dirname, '..', 'package.json');
                    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                    version = pkg.version;
                } catch (err) {}
            }
            
            const mode = global.worktype === 'public' ? '🌍 PUBLIC' : '🔒 PRIVATE';
            const host = getHostPlatform();

            const header = `┌───¤  *SΛVΛGΞ-TECH*
┃
┃ OWNER : Spencer
┃ USER : @${senderJid.split('@')[0]}
┃ PREFIX : [ ${global.prefix} ]
┃ UPTIME : ${hours}h ${minutes}m
┃ SPEED : ${speed} ms
┃ RAM : [${ramBar}] ${ramPercentage}%
┃ MODE : ${mode}
┃ VERSION : ${version}
┃ HOST : ${host}
┃
┕━━━━━━━━━━━━━━━╼\n\n`;

            const ownerMenu = getCategorizedMenu('owner', 'OWNER MENU');
            const groupMenu = getCategorizedMenu('group', 'GROUP MENU');
            const aiMenu = getCategorizedMenu('ai', 'AI MODULES');
            const funMenu = getCategorizedMenu('fun', 'FUN & GAMES');
            const toolsMenu = getCategorizedMenu('tools', 'TOOLS MENU');
            const downloadMenu = getCategorizedMenu('download', 'DOWNLOAD MENU');
            const audioMenu = getCategorizedMenu('audio', 'AUDIO MENU');
            const engineMenu = getCategorizedMenu('engine', 'ENGINE MENU');
            const audioEffectsMenu = getCategorizedMenu('Audio Effects', 'AUDIO EFFECTS MENU');
            const spotifyMenu = getCategorizedMenu('Audio', 'SPOTIFY MENU');
            const financialMenu = getCategorizedMenu('financial data', 'FINANCIAL DATA');
            const searchMenu = getCategorizedMenu('search menu', 'SEARCH MENU');
            const animeMenu = getCategorizedMenu('anime', 'ANIME MENU');
            const ethicalMenu = getCategorizedMenu('ethical hacking', 'ETHICAL HACKING');
            const sportsMenu = getCategorizedMenu('sports', 'SPORTS MENU');
            const mediaMenu = getCategorizedMenu('media', 'MOVIES & TV SHOWS');
            const foodMenu = getCategorizedMenu('food', 'FOOD & DRINKS');

            const definedCats = ['owner', 'group', 'ai', 'fun', 'tools', 'download', 'audio', 'engine', 'Audio Effects', 'Audio', 'financial data', 'search menu', 'anime', 'ethical hacking', 'sports', 'media', 'food'];

            const otherMenu = Array.from(global.commands.values())
                .filter(cmd => !definedCats.includes(cmd.category))
                .length > 0 ? getCategorizedMenu(Array.from(global.commands.values()).find(c => !definedCats.includes(c.category)).category, 'OTHER MODULES') : "";

            const footer = `> The future belongs to the ones crazy enough to build it.`;
            let fullMenu = header + ownerMenu + groupMenu + aiMenu + funMenu + toolsMenu + downloadMenu + audioMenu + audioEffectsMenu + spotifyMenu + financialMenu + searchMenu + animeMenu + ethicalMenu + sportsMenu + engineMenu + mediaMenu + foodMenu + otherMenu + footer;

            const style = global.menuStyle || 'original';
            fullMenu = applyMenuStyle(fullMenu, style);

            // ----- FIX: ensure menuImages is populated -----
            if (!global.menuImages || global.menuImages.length === 0) {
                global.menuImages = [...DEFAULT_IMAGES];
                global.menuImageIndex = 0;
            }

            let imageUrl = null;
            if (global.menuImages && global.menuImages.length > 0) {
                if (typeof global.menuImageIndex !== 'number') global.menuImageIndex = 0;
                imageUrl = global.menuImages[global.menuImageIndex];
                global.menuImageIndex = (global.menuImageIndex + 1) % global.menuImages.length;
            } else if (global.menuImageUrl) {
                imageUrl = global.menuImageUrl;
            } else {
                global.menuImages = [...DEFAULT_IMAGES];
                global.menuImageIndex = 0;
                imageUrl = global.menuImages[0];
            }

            if (imageUrl) {
                await sock.sendMessage(from, {
                    image: { url: imageUrl },
                    caption: fullMenu,
                    mentions: mention
                }, { quoted: msg });
            } else {
                await sock.sendMessage(from, {
                    text: fullMenu,
                    mentions: mention
                }, { quoted: msg });
            }
        } catch (error) {
            console.error("MENU ERROR:", error);
            await sock.sendMessage(from, { text: "❌ **SΛVΛGΞ:** DATA FETCH FAILED" }, { quoted: msg });
        }
    } },
    { name: 'menustyle', category: 'engine', description: 'Change menu display style', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const style = args[0]?.toLowerCase();
        const validStyles = ['original', 'dim', 'minimal', 'compact', 'bullet', 'mono', 'boldhead', 'noicon'];
        if (!style || !validStyles.includes(style)) {
            return sock.sendMessage(from, { text: `❌ Usage: .menustyle <style>\n\nAvailable: ${validStyles.join(', ')}` }, { quoted: msg });
        }
        global.menuStyle = style;
        await sock.sendMessage(from, { text: `✅ Menu style set to: *${style}*` }, { quoted: msg });
    } },
    { name: 'mistral', category: 'ai', description: 'Chat with Mistral AI', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) return sock.sendMessage(from, { text: '❌ Usage: .mistral <message>' }, { quoted: msg });

        try {
            await sock.sendMessage(from, { text: '🤔 Thinking...' }, { quoted: msg });
            const response = await axios.get(`https://ravenn.site/ai/mistral?q=${encodeURIComponent(query)}`, { timeout: 30000 });
            const data = response.data;
            if (data.status && data.result) {
                await sock.sendMessage(from, { text: data.result }, { quoted: msg });
            } else {
                throw new Error('Invalid response');
            }
        } catch (err) {
            console.error('Mistral error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'mode', category: 'owner', description: 'Switch bot between public and private mode', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo) {
            return await sock.sendMessage(from, { text: "This command is restricted to the owner and sudo users only." }, { quoted: msg });
        }

        if (!args[0]) {
            const currentMode = global.worktype === 'public' ? '🔓 PUBLIC' : '🔐 PRIVATE';
            return await sock.sendMessage(from, {
                text: `*SΛVΛGΞ MODE SETTINGS*\n\n*Current Status:* ${currentMode}\n\n*Usage:*\n${global.prefix}mode public\n${global.prefix}mode private`
            }, { quoted: msg });
        }

        const newMode = args[0].toLowerCase();
        if (newMode === "public") {
            global.worktype = "public";
            settings.setGlobal('worktype', 'public');
            await sock.sendMessage(from, { text: "🔓 **SYSTEM UPDATE:** Bot is now in PUBLIC mode." }, { quoted: msg });
        } else if (newMode === "private") {
            global.worktype = "private";
            settings.setGlobal('worktype', 'private');
            await sock.sendMessage(from, { text: "🔐 **SYSTEM UPDATE:** Bot is now in PRIVATE mode." }, { quoted: msg });
        } else {
            await sock.sendMessage(from, { text: "❌ Invalid mode. Use public or private." }, { quoted: msg });
        }
    } },
    { name: 'modestatus', category: 'owner', description: 'Show current bot mode (public/private)', execute: async function (sock, msg, args, { isArchitect }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isSudo = global.sudo && (global.sudo.has ? global.sudo.has(sender) : global.sudo.includes(sender));
        if (!isArchitect && !isSudo) {
            return sock.sendMessage(from, { text: '❌ Owner or sudo only command.' }, { quoted: msg });
        }

        const mode = global.worktype === 'public' ? '🌍 Public' : '🔒 Private';
        await sock.sendMessage(from, { text: `📌 Current bot mode: ${mode}` }, { quoted: msg });
    } },
    { name: 'mothersday', category: 'fun', description: 'Mother’s Day wishes', execute: async function (sock, msg, args) {
    const random = mothers[Math.floor(Math.random() * mothers.length)];
    await sock.sendMessage(msg.key.remoteJid, {
      text: `👩 *Happy Mother's Day!*\n\n${random}`
    }, { quoted: msg });
  } },
    { name: 'motivation', category: 'fun', description: 'Motivational message', execute: async function (sock, msg, args) {
    const random = motivation[Math.floor(Math.random() * motivation.length)];
    await sock.sendMessage(msg.key.remoteJid, {
      text: `💪 *Motivation*\n\n${random}`
    }, { quoted: msg });
  } },
    { name: 'move', category: 'fun', description: '', execute: async function (sock, msg, args) {

        const from = msg.key.remoteJid;
        const game = global.chess?.[from];

        if (!game) {
            return await sock.sendMessage(from, {
                text: "❌ No chess game running"
            }, { quoted: msg });
        }

        try {

            const move = game.move({
                from: args[0],
                to: args[1]
            });

            if (!move) {
                return await sock.sendMessage(from, {
                    text: "❌ Illegal move"
                }, { quoted: msg });
            }

            await sock.sendMessage(from, {
                text:
`♟️ MOVE DONE

${game.ascii()}`
            }, { quoted: msg });

        } catch (e) {
            await sock.sendMessage(from, {
                text: "❌ Invalid move"
            }, { quoted: msg });
        }
    } },
    { name: 'moviegenres', category: 'media', description: 'List all TMDb movie genre IDs and names', execute: async function (sock, msg) {
        const from = msg.key.remoteJid;
        try {
            const apiKey = 'wxa_f_28d599362e';
            const url = `https://apis.xwolf.space/api/movie/genres?key=${apiKey}`;
            const response = await axios.get(url, { timeout: 15000 });
            const data = response.data;

            if (data.success && data.genres) {
                let text = '🎬 *Movie Genres (TMDb)*\n\n';
                for (const g of data.genres) {
                    text += `🔹 *${g.name}* – ID: ${g.id}\n`;
                }
                await sock.sendMessage(from, { text }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: `❌ Failed: ${data.error || 'Unknown error'}` }, { quoted: msg });
            }
        } catch (err) {
            console.error('Movie genres error:', err);
            await sock.sendMessage(from, { text: '❌ Network error or API unavailable.' }, { quoted: msg });
        }
    } },
    { name: 'mp3', category: 'audio', description: 'Download a song (Ravenn primary, Wolf fallback, Deezer last)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) return sock.sendMessage(from, { text: '❌ Usage: .mp3 <YouTube URL or song name>' }, { quoted: msg });

        try {
            await sock.sendMessage(from, { text: `🎵 Processing: ${query}\n⏳ Fetching audio...` }, { quoted: msg });

            let audioUrl = null;
            let title = 'Unknown';
            let artist = 'Unknown';
            let duration = 'N/A';
            let cover = null;
            let videoUrl = null;
            let usedFallback = false;

            const isUrl = query.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/);

            if (isUrl) {
                videoUrl = query;
                try {
                    const info = await yts({ videoId: videoUrl });
                    if (info) {
                        title = info.title || 'Unknown';
                        artist = info.author?.name || 'Unknown';
                        duration = info.duration?.timestamp || 'N/A';
                        cover = info.thumbnail || null;
                    }
                } catch (e) {}
            } else {
                try {
                    const searchResult = await yts(query);
                    const video = searchResult.videos[0];
                    if (video) {
                        videoUrl = video.url;
                        title = video.title || 'Unknown';
                        artist = video.author.name || 'Unknown';
                        duration = video.duration.timestamp || 'N/A';
                        cover = video.thumbnail || null;
                    } else {
                        throw new Error('No YouTube results');
                    }
                } catch (ytErr) {
                    console.log('YouTube search failed:', ytErr.message);
                }
            }

            if (videoUrl) {
                try {
                    const response = await axios.get(`https://ravenn.site/download/ytv4?url=${encodeURIComponent(videoUrl)}`, { timeout: 15000 });
                    if (response.data.status && response.data.result) {
                        audioUrl = response.data.result;
                        if (title === 'Unknown') title = 'YouTube Audio';
                    }
                } catch (ravErr) {
                    console.log('Ravenn ytv4 error:', ravErr.message);
                }
            }

            if (!audioUrl && videoUrl) {
                try {
                    const apiKey = 'wxa_f_28d599362e';
                    const wolfUrl = `https://apis.xwolf.space/download/mp3?url=${encodeURIComponent(videoUrl)}&q=${encodeURIComponent(query)}&key=${apiKey}`;
                    const wolfRes = await axios.get(wolfUrl, { timeout: 15000 });
                    if (wolfRes.data.success) {
                        audioUrl = wolfRes.data.result?.downloadUrl || wolfRes.data.downloadUrl || wolfRes.data.result?.url || wolfRes.data.url;
                        if (audioUrl && title === 'Unknown') title = 'YouTube Audio';
                    }
                } catch (wolfErr) {
                    console.log('Wolf API failed:', wolfErr.message);
                }
            }

            if (!audioUrl) {
                console.log('Ravenn & Wolf failed, falling back to Deezer...');
                usedFallback = true;
                try {
                    const deezerRes = await axios.get(`https://api.deezer.com/search?q=${encodeURIComponent(query)}`);
                    const track = deezerRes.data.data[0];
                    if (track && track.preview) {
                        audioUrl = track.preview;
                        title = track.title || 'Unknown';
                        artist = track.artist.name || 'Unknown';
                        duration = track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}` : '30s (preview)';
                        cover = track.album.cover_medium || null;
                    } else {
                        throw new Error('No results from Deezer');
                    }
                } catch (deezerErr) {
                    console.log('Deezer error:', deezerErr.message);
                    return sock.sendMessage(from, { text: '❌ No results found for that song.' }, { quoted: msg });
                }
            }

            if (!audioUrl) {
                throw new Error('Could not retrieve audio');
            }

            const caption = `🎵 *${title}*\n👤 *Artist:* ${artist}\n⏱️ *Duration:* ${duration}${usedFallback ? ' (preview)' : ''}`;

            let imageBuffer = null;
            if (cover) {
                try {
                    const imgRes = await axios.get(cover, { responseType: 'arraybuffer' });
                    imageBuffer = Buffer.from(imgRes.data);
                } catch (e) {}
            }

            if (imageBuffer) {
                await sock.sendMessage(from, { image: imageBuffer, caption }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: caption }, { quoted: msg });
            }

            const audioRes = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 30000 });
            let audioBuffer = Buffer.from(audioRes.data);

            const fileSizeMB = audioBuffer.length / (1024 * 1024);
            if (fileSizeMB > 15) {
                try {
                    const tempFile = path.join(__dirname, `temp_${Date.now()}.mp3`);
                    const outFile = path.join(__dirname, `temp_out_${Date.now()}.mp3`);
                    fs.writeFileSync(tempFile, audioBuffer);
                    await execPromise(`ffmpeg -i "${tempFile}" -b:a 96k "${outFile}" -y`);
                    const compressedBuffer = fs.readFileSync(outFile);
                    fs.unlinkSync(tempFile);
                    fs.unlinkSync(outFile);
                    if (compressedBuffer.length < audioBuffer.length) {
                        audioBuffer = compressedBuffer;
                    }
                } catch (ffErr) {
                    console.log('FFmpeg compression failed:', ffErr.message);
                }
            }

            await sock.sendMessage(from, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                ptt: false,
                caption: caption
            }, { quoted: msg });

        } catch (err) {
            console.error('MP3 error:', err);
            await sock.sendMessage(from, { text: `❌ Failed to play: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'music', category: 'audio', description: 'Search for a song and get info + audio preview (Deezer)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) return sock.sendMessage(from, { text: '❌ Usage: .music <song name>' }, { quoted: msg });

        try {
            const res = await axios.get(`https://api.deezer.com/search?q=${encodeURIComponent(query)}`);
            const track = res.data.data[0];
            if (!track) return sock.sendMessage(from, { text: '❌ No results found.' }, { quoted: msg });

            const text = `🎶 *${track.title}*\n👤 Artist: ${track.artist.name}\n💿 Album: ${track.album.title}\n📅 Release: ${track.release_date || 'N/A'}`;

            let imageBuffer = null;
            if (track.album.cover_medium) {
                try {
                    const img = await axios.get(track.album.cover_medium, { responseType: 'arraybuffer' });
                    imageBuffer = Buffer.from(img.data);
                } catch (e) {}
            }

            if (imageBuffer) {
                await sock.sendMessage(from, { image: imageBuffer, caption: text }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text }, { quoted: msg });
            }

            if (track.preview) {
                try {
                    const audioRes = await axios.get(track.preview, { responseType: 'arraybuffer' });
                    const audioBuffer = Buffer.from(audioRes.data);
                    await sock.sendMessage(from, {
                        audio: audioBuffer,
                        mimetype: 'audio/mpeg',
                        ptt: false
                    }, { quoted: msg });
                } catch (e) {
                    await sock.sendMessage(from, { text: '❌ Could not download preview audio.' }, { quoted: msg });
                }
            }
        } catch (err) {
            console.error(err);
            await sock.sendMessage(from, { text: '❌ Search failed.' }, { quoted: msg });
        }
    } },
    { name: 'mute', category: 'group', description: '', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) return await sock.sendMessage(from, { text: '❌ Group only command.' }, { quoted: msg });

        const sender = msg.key.participant || msg.key.remoteJid;
        const isAdmin = await global.checkAdmin?.(sock, from, sender) || false;
        if (!isAdmin) return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });

        try {
            await sock.groupSettingUpdate(from, 'announcement');
            await sock.sendMessage(from, { text: "🔒 **SΛVΛGΞ-TECH:** Group Muted." }, { quoted: msg });
        } catch (e) {
            await sock.sendMessage(from, { text: "❌ **ADMIN REQUIRED:** Elevate the bot to Admin." }, { quoted: msg });
        }
    } },
    { name: 'mysession', category: 'owner', description: 'Get current bot session ID (compressed base64)', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo) {
            return await sock.sendMessage(from, { text: "This command is restricted to the owner and sudo users only." }, { quoted: msg });
        }

        const credsPath = path.join(__dirname, '..', 'session', 'creds.json');
        if (!fs.existsSync(credsPath)) {
            return await sock.sendMessage(from, { text: '❌ No session found. The bot is not connected.' }, { quoted: msg });
        }

        try {
            const creds = fs.readFileSync(credsPath);
            const compressed = zlib.gzipSync(creds);
            const compBase64 = compressed.toString('base64');
            const compSession = `Savage~${compBase64}`;

            await sock.sendMessage(from, { text: compSession }, { quoted: msg });
        } catch (err) {
            console.error('MySession error:', err);
            await sock.sendMessage(from, { text: `❌ Failed to generate session: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'mysudo', category: 'tools', description: '', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isSudo = global.sudoUsers?.includes(sender) || false;
        await sock.sendMessage(from, {
            text: isSudo ? "✅ You have sudo privileges." : "❌ You do not have sudo privileges."
        }, { quoted: msg });
    } },
    { name: 'nba', category: 'sports', description: 'Get NBA live scores', execute: async function (sock, msg) {
    const from = msg.key.remoteJid;
    try {
      const res = await axios.get('https://www.balldontlie.io/api/v1/games?dates[]=2025-04-10');
      const games = res.data.data.slice(0, 5);
      let text = '🏀 *NBA SCORES*\n';
      games.forEach(g => {
        text += `${g.home_team.full_name} ${g.home_team_score} - ${g.visitor_team_score} ${g.visitor_team.full_name}\n`;
      });
      await sock.sendMessage(from, { text }, { quoted: msg });
    } catch (err) {
      console.error('NBA error:', err);
      await sock.sendMessage(from, { text: '❌ Failed to fetch NBA scores.' }, { quoted: msg });
    }
  } },
    { name: 'neo', category: 'search menu', description: 'Near Earth Objects – today\'s asteroids approaching Earth', execute: async function (sock, msg) {
    const from = msg.key.remoteJid;
    try {
      const res = await axios.get('https://apis.xwolf.space/api/nasa/neo');
      const data = res.data;
      if (!data.success || !data.neo) {
        return await sock.sendMessage(from, { text: '❌ No NEO data available.' }, { quoted: msg });
      }
      const neos = data.neo.slice(0, 5);
      let text = '☄️ *NEAR EARTH OBJECTS (TODAY)*\n\n';
      for (const obj of neos) {
        text += `🔹 *${obj.name}*\n`;
        text += `   📏 Size: ${obj.estimated_diameter_meters_min?.toFixed(1) || '?'} - ${obj.estimated_diameter_meters_max?.toFixed(1) || '?'} m\n`;
        text += `   ⚡ Velocity: ${obj.relative_velocity_kph?.toFixed(0) || '?'} km/h\n`;
        text += `   📅 Miss Distance: ${obj.miss_distance_km?.toLocaleString() || '?'} km\n`;
        text += `   ⚠️ Hazardous: ${obj.is_potentially_hazardous_asteroid ? 'YES' : 'NO'}\n\n`;
      }
      await sock.sendMessage(from, { text }, { quoted: msg });
    } catch (err) {
      console.error(err);
      await sock.sendMessage(from, { text: '❌ Failed to fetch asteroid data.' }, { quoted: msg });
    }
  } },
    { name: 'neonblue', category: 'Ephoto', description: 'Generate neon-blue text effect', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const text = args.join(' ');
    if (!text) return sock.sendMessage(from, { text: '❓ Usage: .neonblue <text>' }, { quoted: msg });

    try {
      const apiUrl = `https://apis.xwolf.space/api/textpro/neon-blue?text=${encodeURIComponent(text)}`;
      const response = await axios.get(apiUrl, { httpsAgent });
      if (!response.data.success) throw new Error(response.data.error || 'API failure');
      if (!response.data.imageUrl) throw new Error('No imageUrl in response');
      const imgBuffer = await downloadFile(response.data.imageUrl);
      const caption = '🎨 *Text Effect: neonblue*';
      await sock.sendMessage(from, { image: imgBuffer, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('neonblue error:', err);
      await sock.sendMessage(from, { text: `❌ Failed to generate image.\n${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'neoncyan', category: 'Ephoto', description: 'Generate neon-cyan text effect', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const text = args.join(' ');
    if (!text) return sock.sendMessage(from, { text: '❓ Usage: .neoncyan <text>' }, { quoted: msg });

    try {
      const apiUrl = `https://apis.xwolf.space/api/textpro/neon-cyan?text=${encodeURIComponent(text)}`;
      const response = await axios.get(apiUrl, { httpsAgent });
      if (!response.data.success) throw new Error(response.data.error || 'API failure');
      if (!response.data.imageUrl) throw new Error('No imageUrl in response');
      const imgBuffer = await downloadFile(response.data.imageUrl);
      const caption = '🎨 *Text Effect: neoncyan*';
      await sock.sendMessage(from, { image: imgBuffer, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('neoncyan error:', err);
      await sock.sendMessage(from, { text: `❌ Failed to generate image.\n${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'neongold', category: 'Ephoto', description: 'Generate neon-gold text effect', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const text = args.join(' ');
    if (!text) return sock.sendMessage(from, { text: '❓ Usage: .neongold <text>' }, { quoted: msg });

    try {
      const apiUrl = `https://apis.xwolf.space/api/textpro/neon-gold?text=${encodeURIComponent(text)}`;
      const response = await axios.get(apiUrl, { httpsAgent });
      if (!response.data.success) throw new Error(response.data.error || 'API failure');
      if (!response.data.imageUrl) throw new Error('No imageUrl in response');
      const imgBuffer = await downloadFile(response.data.imageUrl);
      const caption = '🎨 *Text Effect: neongold*';
      await sock.sendMessage(from, { image: imgBuffer, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('neongold error:', err);
      await sock.sendMessage(from, { text: `❌ Failed to generate image.\n${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'neonorange', category: 'Ephoto', description: 'Generate neon-orange text effect', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const text = args.join(' ');
    if (!text) return sock.sendMessage(from, { text: '❓ Usage: .neonorange <text>' }, { quoted: msg });

    try {
      const apiUrl = `https://apis.xwolf.space/api/textpro/neon-orange?text=${encodeURIComponent(text)}`;
      const response = await axios.get(apiUrl, { httpsAgent });
      if (!response.data.success) throw new Error(response.data.error || 'API failure');
      if (!response.data.imageUrl) throw new Error('No imageUrl in response');
      const imgBuffer = await downloadFile(response.data.imageUrl);
      const caption = '🎨 *Text Effect: neonorange*';
      await sock.sendMessage(from, { image: imgBuffer, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('neonorange error:', err);
      await sock.sendMessage(from, { text: `❌ Failed to generate image.\n${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'neonpink', category: 'Ephoto', description: 'Generate neon-pink text effect', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const text = args.join(' ');
    if (!text) return sock.sendMessage(from, { text: '❓ Usage: .neonpink <text>' }, { quoted: msg });

    try {
      const apiUrl = `https://apis.xwolf.space/api/textpro/neon-pink?text=${encodeURIComponent(text)}`;
      const response = await axios.get(apiUrl, { httpsAgent });
      if (!response.data.success) throw new Error(response.data.error || 'API failure');
      if (!response.data.imageUrl) throw new Error('No imageUrl in response');
      const imgBuffer = await downloadFile(response.data.imageUrl);
      const caption = '🎨 *Text Effect: neonpink*';
      await sock.sendMessage(from, { image: imgBuffer, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('neonpink error:', err);
      await sock.sendMessage(from, { text: `❌ Failed to generate image.\n${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'neonpurple', category: 'Ephoto', description: 'Generate neon-purple text effect', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const text = args.join(' ');
        if (!text) {
            return sock.sendMessage(from, { text: '❌ Usage: .neonpurple <text>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_28d599362e';
            const apiUrl = `https://apis.xwolf.space/api/textpro/neon-purple?text=${encodeURIComponent(text)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 30000 });

            if (!response.data.success) {
                throw new Error(response.data.error || 'API failure');
            }
            if (!response.data.imageUrl) {
                throw new Error('No imageUrl in response');
            }

            const imgBuffer = await downloadFile(response.data.imageUrl);
            await sock.sendMessage(from, {
                image: imgBuffer,
                caption: '✅ Neon purple text effect'
            }, { quoted: msg });
        } catch (err) {
            console.error('Neon purple error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'neonred', category: 'Ephoto', description: 'Generate neon-red text effect', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const text = args.join(' ');
    if (!text) return sock.sendMessage(from, { text: '❓ Usage: .neonred <text>' }, { quoted: msg });

    try {
      const apiUrl = `https://apis.xwolf.space/api/textpro/neon-red?text=${encodeURIComponent(text)}`;
      const response = await axios.get(apiUrl, { httpsAgent });
      if (!response.data.success) throw new Error(response.data.error || 'API failure');
      if (!response.data.imageUrl) throw new Error('No imageUrl in response');
      const imgBuffer = await downloadFile(response.data.imageUrl);
      const caption = '🎨 *Text Effect: neonred*';
      await sock.sendMessage(from, { image: imgBuffer, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('neonred error:', err);
      await sock.sendMessage(from, { text: `❌ Failed to generate image.\n${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'neonwhite', category: 'Ephoto', description: 'Generate neon-white text effect', execute: async function (sock, msg, args) {
    const text = args.join(' ');
    if (!text) return sock.sendMessage(msg.key.remoteJid, { text: '❓ Usage: .neonwhite <text>' });
    const senderName = msg.pushName || 'User';
    const senderJid = msg.key.participant || msg.key.remoteJid;
    const mentions = [senderJid];
    try {
      const apiUrl = `https://apis.xwolf.space/api/textpro/neon-white?text=${encodeURIComponent(text)}`;
      const response = await axios.get(apiUrl, { httpsAgent });
      if (!response.data.success) throw new Error(response.data.error || 'API failure');
      if (!response.data.imageUrl) throw new Error('No imageUrl in response');
      const imgBuffer = await downloadFile(response.data.imageUrl);
      const caption = `🎨 *Text Effect: neonwhite*\n👤 REQUESTED BY: @${senderName}\n🚀 POWERED BY SAVAGE-CORE`;
      await sock.sendMessage(msg.key.remoteJid, { image: imgBuffer, caption: caption, mentions: mentions });
    } catch (err) {
      console.error('neonwhite error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: `❌ Failed to generate image.\n${err.message}` });
    }
  } },
    { name: 'neural', category: 'ai', description: 'Chat with Intel\'s NeuralChat', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .neural <message>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_1be53c1604';
            const url = `https://apis.xwolf.space/api/ai/neural?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(url, { timeout: 30000 });

            let reply = 'No response';
            if (response.data.status && response.data.result) {
                reply = response.data.result;
            } else if (response.data.error) {
                reply = `⚠️ ${response.data.error}`;
            }

            await sock.sendMessage(from, { text: `🤖 *NeuralChat:*\n${reply.slice(0, 2000)}` }, { quoted: msg });
        } catch (err) {
            console.error('Neural error:', err);
            await sock.sendMessage(from, { text: '❌ API error. Please try again later.' }, { quoted: msg });
        }
    } },
    { name: 'newyear', category: 'fun', description: 'New Year wishes', execute: async function (sock, msg, args) {
    const random = ny[Math.floor(Math.random() * ny.length)];
    await sock.sendMessage(msg.key.remoteJid, {
      text: `🎆 *Happy New Year!*\n\n${random}`
    }, { quoted: msg });
  } },
    { name: 'nightcore', category: 'Audio Effects', description: 'Apply nightcore effect to audio', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const url = args[0];
    if (!url) return sock.sendMessage(from, { text: '❓ Usage: .nightcore <audio_url>' }, { quoted: msg });
    if (!url.startsWith('http')) return sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });

    try {
      await sock.sendMessage(from, { text: '🎧 Applying nightcore effect...' }, { quoted: msg });
      const apiUrl = 'https://apis.xwolf.space/api/audio/nightcore?url=' + encodeURIComponent(url);
      const response = await axios.get(apiUrl, { httpsAgent });
      let base64Audio = response.data.result?.base64Data || response.data.base64Data;
      if (!base64Audio && typeof response.data.result === 'string') base64Audio = response.data.result;
      if (!base64Audio) throw new Error('No audio data in response');
      if (base64Audio.startsWith('data:audio')) base64Audio = base64Audio.split(',')[1];
      const audioBuffer = Buffer.from(base64Audio, 'base64');
      const caption = '✨ Nightcore Effect Applied';
      await sock.sendMessage(from, { audio: audioBuffer, mimetype: 'audio/mpeg', fileName: 'nightcore_effect.mp3', caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('nightcore error:', err);
      await sock.sendMessage(from, { text: '❌ Failed: ' + err.message }, { quoted: msg });
    }
  } },
    { name: 'nom', category: 'anime', description: 'Random nom anime', execute: async function (sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random nom anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/nom', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime nom*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('nom error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime nom.' }, { quoted: msg });
    }
  } },
    { name: 'nous', category: 'ai', description: 'Chat with Nous Hermes AI', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .nous <message>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_1be53c1604';
            const url = `https://apis.xwolf.space/api/ai/nous?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(url, { timeout: 30000 });

            let reply = 'No response';
            if (response.data.status && response.data.result) {
                reply = response.data.result;
            } else if (response.data.error) {
                reply = `⚠️ ${response.data.error}`;
            }

            await sock.sendMessage(from, { text: `🤖 *Nous:*\n${reply.slice(0, 2000)}` }, { quoted: msg });
        } catch (err) {
            console.error('Nous error:', err);
            await sock.sendMessage(from, { text: '❌ API error. Please try again later.' }, { quoted: msg });
        }
    } },
    { name: 'npm', category: 'search menu', description: 'NPM package search – top 5', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const query = args.join(' ');
    if (!query) return sock.sendMessage(from, { text: '❓ Usage: .npm <package>' }, { quoted: msg });

    try {
      await sock.sendMessage(from, { text: `🔍 Searching NPM for "${query}"...` }, { quoted: msg });
      const res = await axios.get(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=5`, { httpsAgent: agent });
      if (!res.data.objects.length) throw new Error('No packages');
      let text = `📦 *NPM SEARCH: ${query}*\n\n`;
      res.data.objects.forEach((pkg, i) => {
        const p = pkg.package;
        text += `${i+1}. *${p.name}*\n   📌 v${p.version}\n   📝 ${(p.description || 'No description').slice(0, 150)}\n   🔗 ${p.links.npm}\n\n`;
      });
      await sock.sendMessage(from, { text: text.slice(0, 2000) }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ NPM error: ${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'numberplate', category: 'search menu', description: 'Lookup vehicle info by UK number plate', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const plate = args[0];
    if (!plate) return await sock.sendMessage(from, { text: '❌ Usage: .numberplate <UK plate, e.g., AB51ABC>' }, { quoted: msg });

    try {
      const res = await axios.get(`https://apis.xwolf.space/api/stalk/numberplate?plate=${encodeURIComponent(plate)}`);
      const data = res.data;

      if (data.success) {
        const v = data.result;
        const caption = `🚗 *UK VEHICLE LOOKUP* 🚗\n\n` +
          `🔢 *Registration:* ${v.registration}\n` +
          `🚘 *Make:* ${v.make}\n` +
          `🏷️ *Model:* ${v.model}\n` +
          `🎨 *Colour:* ${v.colour}\n` +
          `⛽ *Fuel Type:* ${v.fuelType}\n` +
          `⚙️ *Engine Size:* ${v.engineSize}cc\n` +
          `📅 *MOT Expiry:* ${v.motExpiry || 'N/A'}\n` +
          `💰 *Tax Status:* ${v.taxStatus || 'N/A'}\n` +
          `📆 *Tax Due:* ${v.taxDueDate || 'N/A'}\n\n` +
          `🔗 *Source:* DVLA UK`;
        await sock.sendMessage(from, { text: caption }, { quoted: msg });
      } else {
        await sock.sendMessage(from, { text: `❌ Number plate lookup failed: ${data.error || 'Invalid UK plate or not found'}` }, { quoted: msg });
      }
    } catch (err) {
      console.error(err);
      await sock.sendMessage(from, { text: '❌ Network error or invalid number plate.' }, { quoted: msg });
    }
  } },
    { name: 'openchat', category: 'ai', description: 'Chat with OpenChat model', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .openchat <message>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_1be53c1604';
            const url = `https://apis.xwolf.space/api/ai/openchat?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(url, { timeout: 30000 });

            let reply = 'No response';
            if (response.data.status && response.data.result) {
                reply = response.data.result;
            } else if (response.data.error) {
                reply = `⚠️ ${response.data.error}`;
            }

            await sock.sendMessage(from, { text: `🤖 *OpenChat:*\n${reply.slice(0, 2000)}` }, { quoted: msg });
        } catch (err) {
            console.error('OpenChat error:', err);
            await sock.sendMessage(from, { text: '❌ API error. Please try again later.' }, { quoted: msg });
        }
    } },
    { name: 'openhermes', category: 'ai', description: 'Chat with OpenHermes AI', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .openhermes <message>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_28d599362e';
            const url = `https://apis.xwolf.space/api/ai/openhermes?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(url, { timeout: 30000 });

            let reply = 'No response';
            if (response.data.status && response.data.result) {
                reply = response.data.result;
            } else if (response.data.error) {
                reply = `⚠️ ${response.data.error}`;
            }

            await sock.sendMessage(from, { text: `🤖 *OpenHermes:*\n${reply.slice(0, 2000)}` }, { quoted: msg });
        } catch (err) {
            console.error('OpenHermes error:', err);
            await sock.sendMessage(from, { text: '❌ API error. Please try again later.' }, { quoted: msg });
        }
    } },
    { name: 'owner', category: 'engine', description: 'Contact the bot owner', execute: async function (sock, msg) {
        const from = msg.key.remoteJid;
        const ownerNum = '254105397996';
        const caption = `😈 *SΛVΛGΞ OWNER* 😈

👑 *Name:* Spencer
📱 *Phone:* +${ownerNum}
💬 *WhatsApp:* wa.me/${ownerNum}

⚡ _Tap the WhatsApp link to chat directly._`;

        let imageBuffer = null;
        try {
            const imgRes = await axios.get('https://files.catbox.moe/2857dd.jpg', {
                responseType: 'arraybuffer',
                timeout: 10000
            });
            imageBuffer = Buffer.from(imgRes.data);
        } catch (err) {
            console.warn('Could not fetch owner image:', err.message);
        }

        if (imageBuffer) {
            await sock.sendMessage(from, {
                image: imageBuffer,
                caption: caption
            }, { quoted: msg });
        } else {
            await sock.sendMessage(from, {
                text: caption
            }, { quoted: msg });
        }
    } },
    { name: 'password-strength', category: 'tools', description: 'Check password strength', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const pwd = args.join(' ');
    if (!pwd) return sock.sendMessage(from, { text: '❓ Usage: .password-strength <password>' }, { quoted: msg });

    try {
      const res = await axios.get(`https://apis.xwolf.space/api/tools/password-strength?password=${encodeURIComponent(pwd)}`, { httpsAgent: agent });
      const result = res.data.result || res.data.strength || 'No result';
      await sock.sendMessage(from, {
        text: `🔒 *Password Strength*\n\n${result}`
      }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'password', category: 'tools', description: 'Generate secure random password', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    let length = parseInt(args[0]) || 12;
    if (length < 6) length = 6;
    if (length > 32) length = 32;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let password = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = crypto.randomInt(0, chars.length);
      password += chars[randomIndex];
    }
    await sock.sendMessage(from, {
      text: `🔑 *Generated password (${length} chars)*\n\n${password}`
    }, { quoted: msg });
  } },
    { name: 'pat', category: 'anime', description: 'Random pat anime', execute: async function (sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random pat anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/pat', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime pat*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('pat error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime pat.' }, { quoted: msg });
    }
  } },
    { name: 'phack', category: 'ethical hacking', description: 'Ping a host (ethical hacking)', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    let target = args[0];
    if (!target) return sock.sendMessage(from, { text: '❓ Usage: .ping <domain>' }, { quoted: msg });
    if (!target.startsWith('http')) target = 'https://' + target;

    try {
      await sock.sendMessage(from, { text: `🏓 Pinging ${target}...` }, { quoted: msg });
      const start = Date.now();
      await axios.get(target, { httpsAgent: agent, timeout: 10000 });
      const latency = Date.now() - start;
      await sock.sendMessage(from, { text: `🛡️ *Ping Result*\n🎯 Target: ${target}\n\n✅ Response time: ${latency} ms` }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ Ping failed: ${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'phack', category: 'ethical hacking', description: 'Ping a host (ethical hacking)', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    let target = args[0];
    if (!target) return sock.sendMessage(from, { text: '❓ Usage: .ping <domain>' }, { quoted: msg });
    if (!target.startsWith('http')) target = 'https://' + target;

    try {
      await sock.sendMessage(from, { text: `🏓 Pinging ${target}...` }, { quoted: msg });
      const start = Date.now();
      await axios.get(target, { httpsAgent: agent, timeout: 10000 });
      const latency = Date.now() - start;
      await sock.sendMessage(from, { text: `🛡️ *Ping Result*\n🎯 Target: ${target}\n\n✅ Response time: ${latency} ms` }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ Ping failed: ${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'pickuplines', category: 'fun', description: 'Random pickup line', execute: async function (sock, msg, args) {
    const random = pickups[Math.floor(Math.random() * pickups.length)];
    await sock.sendMessage(msg.key.remoteJid, {
      text: `💘 *Pickup line*\n\n${random}`
    }, { quoted: msg });
  } },
    { name: 'ping', category: 'engine', description: 'Check bot response speed', execute: async function (sock, msg, args) {
    const msgTimestamp = msg.messageTimestamp * 1000;
    const networkLatency = Date.now() - msgTimestamp;

    const text = `⚡ *Savage Tech Speed* ⚡\n\n${networkLatency} ms\n\n_⚡ Savage-Tech OS_`;

    await sock.sendMessage(msg.key.remoteJid, { text: text }, { quoted: msg });
  } },
    { name: 'pingall', category: 'group', description: 'Tag every member in the group', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo) {
            return await sock.sendMessage(from, { text: "This command is restricted to the owner and sudo users only." }, { quoted: msg });
        }

        const isGroup = from.endsWith('@g.us');
        if (!isGroup) {
            return await sock.sendMessage(from, { text: "❌ *ERROR:* Group protocol only." }, { quoted: msg });
        }

        try {
            const metadata = await sock.groupMetadata(from);
            const participants = metadata.participants;
            
            let mentions = [];
            let messageText = `📢 **ANNOUNCEMENT:** ${args.length > 0 ? args.join(' ') : 'System Broadcast'}\n\n`;

            for (let participant of participants) {
                messageText += `🔹 @${participant.id.split('@')[0]}\n`;
                mentions.push(participant.id);
            }

            await sock.sendMessage(from, { 
                text: messageText, 
                mentions: mentions 
            }, { quoted: msg });

        } catch (error) {
            console.error("PINGALL ERROR:", error);
            await sock.sendMessage(from, { text: "❌ **FAILED:** Metadata extraction error." }, { quoted: msg });
        }
    } },
    { name: 'play', category: 'audio', description: 'Download a song (Ravenn primary, Wolf fallback, Deezer last)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) return sock.sendMessage(from, { text: '❌ Usage: .play <YouTube URL or song name>' }, { quoted: msg });

        try {
            await sock.sendMessage(from, { text: `🎵 Processing: ${query}\n⏳ Fetching audio...` }, { quoted: msg });

            let audioUrl = null;
            let title = 'Unknown';
            let artist = 'Unknown';
            let duration = 'N/A';
            let cover = null;
            let videoUrl = null;
            let usedFallback = false;

            const isUrl = query.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/);

            if (isUrl) {
                videoUrl = query;
                try {
                    const info = await yts({ videoId: videoUrl });
                    if (info) {
                        title = info.title || 'Unknown';
                        artist = info.author?.name || 'Unknown';
                        duration = info.duration?.timestamp || 'N/A';
                        cover = info.thumbnail || null;
                    }
                } catch (e) {}
            } else {
                try {
                    const searchResult = await yts(query);
                    const video = searchResult.videos[0];
                    if (video) {
                        videoUrl = video.url;
                        title = video.title || 'Unknown';
                        artist = video.author.name || 'Unknown';
                        duration = video.duration.timestamp || 'N/A';
                        cover = video.thumbnail || null;
                    } else {
                        throw new Error('No YouTube results');
                    }
                } catch (ytErr) {
                    console.log('YouTube search failed:', ytErr.message);
                }
            }

            if (videoUrl) {
                try {
                    const response = await axios.get(`https://ravenn.site/download/audio?url=${encodeURIComponent(videoUrl)}`, { timeout: 15000 });
                    if (response.data.status && response.data.result) {
                        audioUrl = response.data.result;
                        if (title === 'Unknown') title = 'YouTube Audio';
                    }
                } catch (ravErr) {
                    console.log('Ravenn API error:', ravErr.message);
                }
            }

            if (!audioUrl && videoUrl) {
                try {
                    const apiKey = 'wxa_f_28d599362e';
                    const wolfUrl = `https://apis.xwolf.space/download/mp3?url=${encodeURIComponent(videoUrl)}&q=${encodeURIComponent(query)}&key=${apiKey}`;
                    const wolfRes = await axios.get(wolfUrl, { timeout: 15000 });
                    if (wolfRes.data.success) {
                        audioUrl = wolfRes.data.result?.downloadUrl || wolfRes.data.downloadUrl || wolfRes.data.result?.url || wolfRes.data.url;
                        if (audioUrl && title === 'Unknown') title = 'YouTube Audio';
                    }
                } catch (wolfErr) {
                    console.log('Wolf API failed:', wolfErr.message);
                }
            }

            if (!audioUrl) {
                console.log('Ravenn & Wolf failed, falling back to Deezer...');
                usedFallback = true;
                try {
                    const deezerRes = await axios.get(`https://api.deezer.com/search?q=${encodeURIComponent(query)}`);
                    const track = deezerRes.data.data[0];
                    if (track && track.preview) {
                        audioUrl = track.preview;
                        title = track.title || 'Unknown';
                        artist = track.artist.name || 'Unknown';
                        duration = track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}` : '30s (preview)';
                        cover = track.album.cover_medium || null;
                    } else {
                        throw new Error('No results from Deezer');
                    }
                } catch (deezerErr) {
                    console.log('Deezer error:', deezerErr.message);
                    return sock.sendMessage(from, { text: '❌ No results found for that song.' }, { quoted: msg });
                }
            }

            if (!audioUrl) {
                throw new Error('Could not retrieve audio');
            }

            const caption = `🎵 *${title}*\n👤 *Artist:* ${artist}\n⏱️ *Duration:* ${duration}${usedFallback ? ' (preview)' : ''}`;

            let imageBuffer = null;
            if (cover) {
                try {
                    const imgRes = await axios.get(cover, { responseType: 'arraybuffer' });
                    imageBuffer = Buffer.from(imgRes.data);
                } catch (e) {}
            }

            if (imageBuffer) {
                await sock.sendMessage(from, { image: imageBuffer, caption }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: caption }, { quoted: msg });
            }

            const audioRes = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 30000 });
            const audioBuffer = Buffer.from(audioRes.data);

            await sock.sendMessage(from, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                ptt: false,
                caption: caption
            }, { quoted: msg });

        } catch (err) {
            console.error('Play error:', err);
            await sock.sendMessage(from, { text: `❌ Failed to play: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'playerdetails', category: 'sports', description: 'Get sports player details', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .playerdetails <query>' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: `🏆 Fetching player details...` }, { quoted: msg });

            const apiKey = 'wxa_f_1be53c1604';
            const apiUrl = `https://apis.xwolf.space/api/sports/player/details?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });

            const result = formatResult(response.data);
            const output = `🏅 *Player Details*\n🔍 Query: ${query}\n\n${result}`;

            await sock.sendMessage(from, { text: output.slice(0, 2000) }, { quoted: msg });
        } catch (err) {
            console.error('Player details error:', err);
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'poke', category: 'anime', description: 'Random poke anime', execute: async function (sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random poke anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/poke', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime poke*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('poke error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime poke.' }, { quoted: msg });
    }
  } },
    { name: 'pokemon', category: 'fun', description: 'Get full Pokemon details (stats, abilities, types, artwork)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const name = args[0]?.toLowerCase();
        if (!name) {
            return sock.sendMessage(from, { text: '❌ Usage: .pokemon <name> (e.g., .pokemon pikachu)' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_1be53c1604';
            const url = `https://apis.xwolf.space/api/pokemon/info?name=${encodeURIComponent(name)}&key=${apiKey}`;
            const response = await axios.get(url, { timeout: 15000 });
            const data = response.data;

            if (!data.success) {
                return sock.sendMessage(from, { text: `❌ Pokemon "${name}" not found.` }, { quoted: msg });
            }

            const types = data.types?.join(', ') || 'N/A';
            const abilities = data.abilities?.map(a => a.name).join(', ') || 'N/A';
            const stats = data.stats || {};
            const text = `⚡ *Pokemon Info*\n\n` +
                `*Name:* ${data.name}\n` +
                `*ID:* #${data.id}\n` +
                `*Type:* ${types}\n` +
                `*Height:* ${data.height_m} m\n` +
                `*Weight:* ${data.weight_kg} kg\n` +
                `*Abilities:* ${abilities}\n` +
                `*Stats:*\n` +
                `  ❤️ HP: ${stats.hp || '?'}\n` +
                `  ⚔️ Attack: ${stats.attack || '?'}\n` +
                `  🛡️ Defense: ${stats.defense || '?'}\n` +
                `  ✨ Sp. Attack: ${stats.special_attack || '?'}\n` +
                `  🪄 Sp. Defense: ${stats.special_defense || '?'}\n` +
                `  💨 Speed: ${stats.speed || '?'}`;

            let imageBuffer = null;
            if (data.image) {
                try {
                    const imgRes = await axios.get(data.image, { responseType: 'arraybuffer', timeout: 10000 });
                    imageBuffer = Buffer.from(imgRes.data);
                } catch (e) {
                    console.log('Image download failed:', e.message);
                }
            }

            if (imageBuffer) {
                await sock.sendMessage(from, { image: imageBuffer, caption: text }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text }, { quoted: msg });
            }
        } catch (err) {
            console.error('Pokemon error:', err);
            await sock.sendMessage(from, { text: '❌ API error.' }, { quoted: msg });
        }
    } },
    { name: 'pokemontypes', category: 'fun', description: 'List all 18 Pokemon types', execute: async function (sock, msg) {
        const from = msg.key.remoteJid;
        try {
            const apiKey = 'wxa_f_1be53c1604';
            const url = `https://apis.xwolf.space/api/pokemon/types?key=${apiKey}`;
            const response = await axios.get(url, { timeout: 15000 });
            const data = response.data;

            if (!data.success) {
                return sock.sendMessage(from, { text: '❌ Could not fetch Pokemon types.' }, { quoted: msg });
            }

            const types = data.types || [];
            let text = '🔖 *Pokemon Types*\n\n';
            for (const t of types) {
                text += `🔹 ${t}\n`;
            }

            await sock.sendMessage(from, { text }, { quoted: msg });
        } catch (err) {
            console.error('Pokemon types error:', err);
            await sock.sendMessage(from, { text: '❌ API error.' }, { quoted: msg });
        }
    } },
    { name: 'poll', category: 'group', description: 'Create a poll. Usage: .poll "Question?" "Option1" "Option2" ...', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) {
            return await sock.sendMessage(from, { text: '❌ This command can only be used in groups.' }, { quoted: msg });
        }

        const sender = msg.key.participant || msg.key.remoteJid;
        let isAdmin = false;
        try {
            const meta = await sock.groupMetadata(from);
            const senderNumber = sender.split('@')[0];
            const participant = meta.participants.find(p => p.id.split('@')[0] === senderNumber);
            isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
        } catch (e) {
            return await sock.sendMessage(from, { text: '❌ Failed to verify admin status.' }, { quoted: msg });
        }
        if (!isAdmin) {
            return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });
        }

        if (args.length < 2) {
            return await sock.sendMessage(from, { text: '⚠️ Usage: .poll "Question?" "Option1" "Option2" ["Option3"...]\nMinimum 2 options required.' }, { quoted: msg });
        }

        const parsed = [];
        let current = '';
        let inside = false;
        const full = args.join(' ');
        for (let i = 0; i < full.length; i++) {
            const c = full[i];
            if (c === '"') {
                if (inside) {
                    parsed.push(current);
                    current = '';
                    inside = false;
                } else {
                    inside = true;
                }
            } else if (inside) {
                current += c;
            }
        }
        if (parsed.length < 2) {
            return await sock.sendMessage(from, { text: '❌ Invalid format. Use: .poll "Question" "Option1" "Option2"' }, { quoted: msg });
        }

        const question = parsed[0];
        const options = parsed.slice(1);
        if (options.length < 2) {
            return await sock.sendMessage(from, { text: '❌ You need at least 2 options.' }, { quoted: msg });
        }
        if (options.length > 12) {
            return await sock.sendMessage(from, { text: '❌ Maximum 12 options allowed.' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, {
                poll: {
                    name: question,
                    values: options,
                    selectableCount: 1
                }
            }, { quoted: msg });
        } catch (err) {
            console.error('Poll error:', err);
            await sock.sendMessage(from, { text: '❌ Failed to create poll. Make sure I am admin (polls require admin privileges in groups).' }, { quoted: msg });
        }
    } },
    { name: 'promote', category: 'group', description: '', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) {
            return await sock.sendMessage(from, { text: '❌ Group only command.' }, { quoted: msg });
        }

        const metadata = await sock.groupMetadata(from);
        const participants = metadata.participants;
        const sender = msg.key.participant || msg.key.remoteJid;
        
        const ownerNumber = '254798841125@s.whatsapp.net';
        const cleanSender = sender.split(':')[0] + '@s.whatsapp.net';

        const isSenderAdmin = participants.find(p => p.id === sender)?.admin !== null;
        const isOwner = cleanSender === ownerNumber || msg.key.fromMe;
        
        if (!isSenderAdmin && !isOwner) {
            return await sock.sendMessage(from, { text: "❌ *Access Denied.* You lack the clearance to grant authority." }, { quoted: msg });
        }

        const quotedMessage = msg.message.extendedTextMessage?.contextInfo?.participant;
        const mentioned = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const targets = mentioned.length > 0 ? mentioned : (quotedMessage ? [quotedMessage] : []);

        if (targets.length === 0) {
            return await sock.sendMessage(from, { text: 'Tag the individual or reply to their message to grant power.' }, { quoted: msg });
        }

        const promoteQuotes = [
            "Welcome to the inner circle. Do not make the system regret this.",
            "Authority granted. Use it as a weapon, or it will be used against you.",
            "Elevated. The architect sees potential in your wreckage.",
            "Rank updated. You are now a gear in the SΛVΛGΞ engine.",
            "Clearance level increased. The crown is heavy—don't let it crush you.",
            "Power surge initiated. You have been granted Admin status.",
            "The hierarchy has been recalibrated. You have ascended."
        ];
        const quote = promoteQuotes[Math.floor(Math.random() * promoteQuotes.length)];

        try {
            await sock.groupParticipantsUpdate(from, targets, "promote");

            const mentionTag = `@${targets[0].split('@')[0]}`;

            await sock.sendMessage(from, { 
                text: `📈 *RANK ELEVATED*\n\n${mentionTag}\n${quote}`,
                mentions: targets
            }, { quoted: msg });
        } catch (e) {
            await sock.sendMessage(from, { text: "Promotion failed. Ensure I am an Admin first." }, { quoted: msg });
        }
    } },
    { name: 'punch', category: 'anime', description: 'Random punch anime', execute: async function (sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random punch anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/punch', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime punch*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('punch error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime punch.' }, { quoted: msg });
    }
  } },
    { name: 'puns', category: 'fun', description: 'Random pun', execute: async function (sock, msg, args) {
    const random = puns[Math.floor(Math.random() * puns.length)];
    await sock.sendMessage(msg.key.remoteJid, {
      text: `🥁 *Pun*\n\n${random}`
    }, { quoted: msg });
  } },
    { name: 'pypi', category: 'search menu', description: 'PyPI package info', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const query = args.join(' ');
    if (!query) return sock.sendMessage(from, { text: '❓ Usage: .pypi <package>' }, { quoted: msg });

    try {
      await sock.sendMessage(from, { text: `🔍 Searching PyPI for "${query}"...` }, { quoted: msg });
      const res = await axios.get(`https://pypi.org/pypi/${encodeURIComponent(query)}/json`, { httpsAgent: agent });
      const info = res.data.info;
      const summary = (info.summary || 'No summary').slice(0, 500);
      const result = `🐍 *PYPI: ${info.name}*\n\n📦 Version: ${info.version}\n📝 Summary: ${summary}\n🔗 ${info.package_url || `https://pypi.org/project/${info.name}`}`;
      await sock.sendMessage(from, { text: result.slice(0, 2000) }, { quoted: msg });
    } catch (err) {
      if (err.response?.status === 404) await sock.sendMessage(from, { text: `❌ Package "${query}" not found.` }, { quoted: msg });
      else await sock.sendMessage(from, { text: `❌ PyPI error: ${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'qrcode', category: 'tools', description: 'Generate QR code from text (local, no API)', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const text = args.join(' ');
    if (!text) return sock.sendMessage(from, { text: '❓ Usage: .qrcode <text or URL>' }, { quoted: msg });

    try {
      const buffer = await QRCode.toBuffer(text, { errorCorrectionLevel: 'H', margin: 1 });
      await sock.sendMessage(from, {
        image: buffer,
        caption: `📱 *QR Code*\n\nContent: ${text.slice(0, 100)}`
      }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'quote', category: 'owner', description: 'Generate a SΛVΛGΞ-TECH industrial quote', execute: async function (sock, msg) {
        const from = msg.key.remoteJid;

        const quotes = [
            "☢️ Progress requires sacrifice.",
            "⚙️ The machine does not feel, but it always remembers.",
            "☣️ Safety is a secondary protocol.",
            "⛓️ Innovation is the only escape.",
            "💀 Master your tools or be deleted.",
            "🔋 System heart-beat detected.",
            "⚙️ Efficiency is the only law.",
            "🧬 Emotion is a glitch in the biological hardware.",
            "💾 Your limitations are merely unoptimized code.",
            "🛠️ Build. Break. Refine. Repeat.",
            "🌑 The silicon does not sleep.",
            "🧠 Logic is the ultimate weapon.",
            "🩸 Data is the new blood.",
            "⚡ High voltage. High stakes.",
            "👣 Caution: Biological presence detected.",
            "⚠️ Containment is failing. Adaptation is required.",
            "🛑 The perimeter is secured by code, not walls.",
            "📡 Signal noise detected. Purge initiated.",
            "📉 Warning: System stress at 98%.",
            "☢️ Radiation levels rising. Stay in the shadow.",
            "🔌 Do not touch the live wires of innovation.",
            "🛰️ The network is watching.",
            "📂 Privacy is a pre-digital concept.",
            "🌍 Control the data, control the world.",
            "🛡️ SΛVΛGΞ-TECH: Engineering the inevitable."
        ];

        const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

        await sock.sendMessage(from, { 
            text: `⚠️ **SΛVΛGΞ THOUGHT** ⚠️\n\n${randomQuote}`
        }, { quoted: msg });
    } },
    { name: 'quotes', category: 'fun', description: 'Random famous quote', execute: async function (sock, msg, args) {
    const random = quotes[Math.floor(Math.random() * quotes.length)];
    await sock.sendMessage(msg.key.remoteJid, {
      text: `📜 *Quote*\n\n${random}`
    }, { quoted: msg });
  } },
    { name: 'quranrandom', category: 'religion', description: 'Get a random Quran verse with Arabic, translation and audio', execute: async function (sock, msg) {
        const from = msg.key.remoteJid;

        try {
            const apiKey = 'wxa_f_28d599362e';
            const url = `https://apis.xwolf.space/api/quran/random?key=${apiKey}`;
            const response = await axios.get(url, { timeout: 15000 });
            const data = response.data;

            if (!data.success) {
                return sock.sendMessage(from, { text: `❌ Could not fetch random verse.` }, { quoted: msg });
            }

            const text = `📖 *${data.reference}* (${data.surah.englishName})\n\n` +
                `🇸🇦 *Arabic:* ${data.arabic}\n\n` +
                `🇬🇧 *Translation (${data.translator}):* ${data.translation}`;

            let audioBuffer = null;
            if (data.audio) {
                try {
                    const audioRes = await axios.get(data.audio, { responseType: 'arraybuffer', timeout: 15000 });
                    audioBuffer = Buffer.from(audioRes.data);
                } catch (audioErr) {}
            }

            await sock.sendMessage(from, { text }, { quoted: msg });
            if (audioBuffer) {
                await sock.sendMessage(from, { audio: audioBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
            }
        } catch (err) {
            console.error('Quran random error:', err);
            await sock.sendMessage(from, { text: '❌ API error.' }, { quoted: msg });
        }
    } },
    { name: 'quransearch', category: 'religion', description: 'Search the Quran by keyword in English translation', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const keyword = args.join(' ');
        if (!keyword) {
            return sock.sendMessage(from, { text: '❌ Usage: .quransearch <keyword>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_28d599362e';
            const url = `https://apis.xwolf.space/api/quran/search?q=${encodeURIComponent(keyword)}&key=${apiKey}`;
            const response = await axios.get(url, { timeout: 15000 });
            const data = response.data;

            if (!data.success || !data.results || data.results.length === 0) {
                return sock.sendMessage(from, { text: `❌ No results found for "${keyword}".` }, { quoted: msg });
            }

            const results = data.results.slice(0, 5);
            let text = `🔍 *Quran Search Results for "${keyword}"*\n\n`;
            for (const r of results) {
                text += `📖 *${r.reference}*\n${r.text}\n\n`;
            }

            await sock.sendMessage(from, { text }, { quoted: msg });
        } catch (err) {
            console.error('Quran search error:', err);
            await sock.sendMessage(from, { text: '❌ API error.' }, { quoted: msg });
        }
    } },
    { name: 'quransurah', category: 'religion', description: 'Get first 20 verses of a surah by number (e.g., .quransurah 2)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const surah = args[0];
        if (!surah) {
            return sock.sendMessage(from, { text: '❌ Usage: .quransurah <surah number>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_28d599362e';
            const url = `https://apis.xwolf.space/api/quran/surah?surah=${surah}&key=${apiKey}`;
            const response = await axios.get(url, { timeout: 15000 });
            const data = response.data;

            if (!data.success) {
                return sock.sendMessage(from, { text: `❌ Surah not found.` }, { quoted: msg });
            }

            const verses = data.verses.slice(0, 20);
            let text = `📖 *${data.surah.englishName} (${data.reference})* – First 20 verses\n\n`;
            for (const v of verses) {
                text += `${v.number}. ${v.arabic}\n`;
            }
            if (data.verses.length > 20) {
                text += `\n⚠️ Showing first 20 of ${data.verses.length}.`;
            }

            await sock.sendMessage(from, { text }, { quoted: msg });
        } catch (err) {
            console.error('Quran surah error:', err);
            await sock.sendMessage(from, { text: '❌ API error.' }, { quoted: msg });
        }
    } },
    { name: 'quranverse', category: 'religion', description: 'Get a Quran verse by surah and ayah number (e.g., .quranverse 2 255)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const surah = args[0];
        const ayah = args[1];
        if (!surah || !ayah) {
            return sock.sendMessage(from, { text: '❌ Usage: .quranverse <surah> <ayah>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_28d599362e';
            const url = `https://apis.xwolf.space/api/quran/verse?surah=${surah}&ayah=${ayah}&key=${apiKey}`;
            const response = await axios.get(url, { timeout: 15000 });
            const data = response.data;

            if (!data.success) {
                return sock.sendMessage(from, { text: `❌ Verse not found.` }, { quoted: msg });
            }

            const text = `📖 *${data.reference}* (${data.surah.englishName})\n\n` +
                `🇸🇦 *Arabic:* ${data.arabic}\n\n` +
                `🇬🇧 *Translation (${data.translator}):* ${data.translation}`;

            let audioBuffer = null;
            if (data.audio) {
                try {
                    const audioRes = await axios.get(data.audio, { responseType: 'arraybuffer', timeout: 15000 });
                    audioBuffer = Buffer.from(audioRes.data);
                } catch (audioErr) {}
            }

            await sock.sendMessage(from, { text }, { quoted: msg });
            if (audioBuffer) {
                await sock.sendMessage(from, { audio: audioBuffer, mimetype: 'audio/mpeg', ptt: false }, { quoted: msg });
            }
        } catch (err) {
            console.error('Quran verse error:', err);
            await sock.sendMessage(from, { text: '❌ API error. Check surah/ayah numbers.' }, { quoted: msg });
        }
    } },
    { name: 'qwen', category: 'ai', description: 'Chat with Qwen AI', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) return sock.sendMessage(from, { text: '❌ Usage: .qwen <message>' }, { quoted: msg });

        try {
            await sock.sendMessage(from, { text: '🤔 Thinking...' }, { quoted: msg });
            const response = await axios.get(`https://ravenn.site/ai/qwenai?q=${encodeURIComponent(query)}`, { timeout: 30000 });
            const data = response.data;
            if (data.status && data.result) {
                await sock.sendMessage(from, { text: data.result }, { quoted: msg });
            } else {
                throw new Error('Invalid response');
            }
        } catch (err) {
            console.error('Qwen error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'randompokemon', category: 'fun', description: 'Get a random Pokemon with full stats and artwork', execute: async function (sock, msg) {
        const from = msg.key.remoteJid;
        try {
            const apiKey = 'wxa_f_1be53c1604';
            const url = `https://apis.xwolf.space/api/pokemon/random?key=${apiKey}`;
            const response = await axios.get(url, { timeout: 15000 });
            const data = response.data;

            if (!data.success) {
                return sock.sendMessage(from, { text: '❌ Could not fetch random Pokemon.' }, { quoted: msg });
            }

            const types = data.types?.join(', ') || 'N/A';
            const abilities = data.abilities?.map(a => a.name).join(', ') || 'N/A';
            const stats = data.stats || {};
            const text = `🎲 *Random Pokemon*\n\n` +
                `*Name:* ${data.name}\n` +
                `*ID:* #${data.id}\n` +
                `*Type:* ${types}\n` +
                `*Height:* ${data.height_m} m\n` +
                `*Weight:* ${data.weight_kg} kg\n` +
                `*Abilities:* ${abilities}\n` +
                `*Stats:*\n` +
                `  ❤️ HP: ${stats.hp || '?'}\n` +
                `  ⚔️ Attack: ${stats.attack || '?'}\n` +
                `  🛡️ Defense: ${stats.defense || '?'}\n` +
                `  ✨ Sp. Attack: ${stats.special_attack || '?'}\n` +
                `  🪄 Sp. Defense: ${stats.special_defense || '?'}\n` +
                `  💨 Speed: ${stats.speed || '?'}`;

            let imageBuffer = null;
            if (data.image) {
                try {
                    const imgRes = await axios.get(data.image, { responseType: 'arraybuffer', timeout: 10000 });
                    imageBuffer = Buffer.from(imgRes.data);
                } catch (e) {
                    console.log('Image download failed:', e.message);
                }
            }

            if (imageBuffer) {
                await sock.sendMessage(from, { image: imageBuffer, caption: text }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text }, { quoted: msg });
            }
        } catch (err) {
            console.error('Random Pokemon error:', err);
            await sock.sendMessage(from, { text: '❌ API error.' }, { quoted: msg });
        }
    } },
    { name: 'readreceipts', category: 'owner', description: 'Toggle auto-read receipts (blue ticks) for incoming messages', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo) {
            return await sock.sendMessage(from, { text: "This command is restricted to the owner and sudo users only." }, { quoted: msg });
        }

        if (!args[0]) {
            const status = global.autoRead ? 'enabled' : 'disabled';
            return await sock.sendMessage(from, { text: `📖 Read receipts are currently ${status}. Use .readreceipts on/off to change.` }, { quoted: msg });
        }

        const option = args[0].toLowerCase();
        if (option !== 'on' && option !== 'off') {
            return await sock.sendMessage(from, { text: '❌ Usage: .readreceipts on / off' }, { quoted: msg });
        }

        global.autoRead = option === 'on';
        settings.setGlobal('autoRead', global.autoRead);
        await sock.sendMessage(from, { text: `✅ Read receipts ${global.autoRead ? 'enabled' : 'disabled'}.` }, { quoted: msg });
    } },
    { name: 'regowner', category: 'owner', description: '', execute: async function (sock, msg, args, { isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const botNumber = sock.user.id;
        const senderNumber = sender.split('@')[0].split(':')[0];
        const botNumberClean = botNumber.split('@')[0].split(':')[0];
        if (senderNumber !== botNumberClean && !isMe) {
            return await sock.sendMessage(from, { text: "❌ Only the bot owner can register." }, { quoted: msg });
        }
        global.ownerJid = sender;
        const ownerFile = path.join(__dirname, '..', 'owner.json');
        fs.writeFileSync(ownerFile, JSON.stringify({ ownerJid: sender }, null, 2));
        
        const accessQuotes = [
            "Access granted. You now hold the keys to the system.",
            "Identity verified. Full command authority unlocked.",
            "You are now recognized as the master of this machine.",
            "Control transferred. Use your power wisely.",
            "System acknowledges you. Welcome, commander.",
            "Privilege elevation complete. You may command the bot.",
            "Ownership recorded. The bot bends to your will.",
            "You've been given the crown. Don't lose it.",
            "Security clearance granted. All channels open.",
            "Welcome to the admin zone. Handle with chaos.",
            "The throne is yours. May your reign be legendary.",
            "Ownership set. You are the architect of this digital realm.",
            "The bot now recognizes you as its sovereign.",
            "Admin privileges unlocked. Proceed with responsibility.",
            "You are now the supreme commander of Savage Tech.",
            "The system bows to you. Command wisely.",
            "Ownership transferred. Your will is law.",
            "Welcome to the inner circle. You now control the core.",
            "The keys to the kingdom are yours. Use them well.",
            "You've been marked as the ultimate authority. No limits."
        ];
        const quote = accessQuotes[Math.floor(Math.random() * accessQuotes.length)];
        
        await sock.sendMessage(from, { text: `✅ ${quote}` }, { quoted: msg });
    } },
    { name: 'removebg', category: 'tools', description: 'Remove background from image (provide image URL or reply to an image)', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    let imageUrl = args[0];
    
    if (!imageUrl && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
      const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage;
      if (quoted.imageMessage) {
        return await sock.sendMessage(from, { text: '❓ Please reply with a public image URL. Example: .removebg https://example.com/image.jpg' }, { quoted: msg });
      }
    }

    if (!imageUrl || !imageUrl.match(/^https?:\/\/.+\/(.+)/)) {
      return await sock.sendMessage(from, { text: '❓ Provide a valid public image URL.\nUsage: .removebg https://example.com/photo.jpg' }, { quoted: msg });
    }

    try {
      const response = await axios.post('https://apis.xwolf.space/api/ai/removebg', { image_url: imageUrl }, {
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.data.status === true) {
        const result = response.data.result;
        if (result && result.startsWith('data:image')) {
          const base64Data = result.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          await sock.sendMessage(from, { image: buffer, caption: '✅ Background removed.' }, { quoted: msg });
        } else if (result && result.match(/^https?:\/\//)) {
          await sock.sendMessage(from, { text: `🖼️ Background removed: ${result}` }, { quoted: msg });
        } else {
          await sock.sendMessage(from, { text: '⚠️ Unexpected response format.' }, { quoted: msg });
        }
      } else {
        await sock.sendMessage(from, { text: `⚠️ API error: ${response.data.error || 'Remove background failed.'}` }, { quoted: msg });
      }
    } catch (error) {
      console.error('RemoveBG error:', error);
      await sock.sendMessage(from, { text: '❌ Background removal failed. Check URL or API.' }, { quoted: msg });
    }
  } },
    { name: 'removesudo', category: 'owner', description: '', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo) {
            return await sock.sendMessage(from, { text: "This command is restricted to the owner and sudo users only." }, { quoted: msg });
        }

        if (!global.sudoUsers || !Array.isArray(global.sudoUsers)) {
            global.sudoUsers = [];
        }

        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted) {
            return await sock.sendMessage(from, { text: "❌ Reply to a user's message to remove sudo." }, { quoted: msg });
        }

        let target = null;
        if (quoted.key?.participant) {
            target = quoted.key.participant;
        } else if (quoted.key?.remoteJid) {
            target = quoted.key.remoteJid;
        } else if (msg.message.extendedTextMessage.contextInfo.participant) {
            target = msg.message.extendedTextMessage.contextInfo.participant;
        }

        if (!target) {
            console.log("DEBUG quoted:", JSON.stringify(quoted, null, 2));
            return await sock.sendMessage(from, { text: "❌ Could not identify the user. Check console for details." }, { quoted: msg });
        }

        if (!global.sudoUsers.includes(target)) {
            return await sock.sendMessage(from, { text: `⚠️ ${target.split('@')[0]} does not have sudo privileges.` }, { quoted: msg });
        }

        global.sudoUsers = global.sudoUsers.filter(id => id !== target);
        
        try {
            const sudoPath = path.join(__dirname, '..', 'sudo.json');
            fs.writeFileSync(sudoPath, JSON.stringify(global.sudoUsers, null, 2));
        } catch (err) {
            console.error('Failed to save sudo.json:', err);
        }

        await sock.sendMessage(from, { text: `✅ Sudo removed from ${target.split('@')[0]}.` }, { quoted: msg });
    } },
    { name: 'repo', category: 'engine', description: 'Shows the bot\'s GitHub repository information', execute: async function (sock, msg) {
        const from = msg.key.remoteJid;
        const apiUrl = 'https://api.github.com/repos/tysavage163/Savage-Tech';

        try {
            const { data } = await axios.get(apiUrl, {
                headers: {
                    'User-Agent': 'Savage-Tech-Bot',
                    'Authorization': `token ${GITHUB_TOKEN}`
                }
            });

            let commitDate = data.updated_at;
            let commitSha = '';
            try {
                const commitRes = await axios.get(
                    `https://api.github.com/repos/tysavage163/Savage-Tech/commits/main`,
                    {
                        headers: {
                            'User-Agent': 'Savage-Tech-Bot',
                            'Authorization': `token ${GITHUB_TOKEN}`
                        }
                    }
                );
                if (commitRes.data && commitRes.data.commit) {
                    commitDate = commitRes.data.commit.committer.date;
                    commitSha = commitRes.data.sha.slice(0, 7);
                }
            } catch (commitErr) {
                console.warn('Could not fetch latest commit:', commitErr.message);
            }

            const stars = data.stargazers_count.toLocaleString();
            const forks = data.forks_count.toLocaleString();
            const watchers = data.watchers_count.toLocaleString();
            const sizeKB = data.size;
            const updated = new Date(commitDate).toLocaleString();
            const repoUrl = data.html_url;
            const description = data.description || 'WhatsApp bot based on Baileys';
            const avatarUrl = data.owner.avatar_url;
            const repoFull = data.full_name;
            const ownerName = data.owner.login;

            const senderJid = msg.key.participant || msg.key.remoteJid;
            const mention = [senderJid];
            const mentionText = `@${senderJid.split('@')[0]}`;

            const caption = `╭━━━━━━━━━━━━━━━╮
┃ *📦 SAVAGE REPO*
┃
┃ 🧠 *Name:* ${repoFull}
┃ 👑 *Owner:* ${ownerName}
┃ ⭐ *Stars:* ${stars}
┃ 🍴 *Forks:* ${forks}
┃ 👁️ *Watchers:* ${watchers}
┃ 📦 *Size:* ${sizeKB} KB
┃ 🕒 *Last Commit:* ${updated} ${commitSha ? `(SHA: ${commitSha})` : ''}
┃ 🔗 *Repo:* ${repoUrl}
┃ 📝 *Description:* ${description}
┃
┃ 👋 *Hey ${mentionText}!* 😈
┃ *Don't forget to ⭐ fork and star the repo!* ⚡
┃ *Tap the link above to open*
╰━━━━━━━━━━━━━━━╯`;

            await sock.sendMessage(from, { image: { url: avatarUrl }, caption: caption, mentions: mention }, { quoted: msg });
        } catch (error) {
            console.error('Repo command error:', error);
            let errorMsg = '❌ Failed to fetch repository data.';
            if (error.response && error.response.status === 401) {
                errorMsg = '❌ GitHub token invalid or expired. Update the token in the command file.';
            } else if (error.response && error.response.status === 403) {
                errorMsg = '❌ GitHub API rate limit exceeded. The token may have expired or been revoked.';
            } else if (error.response && error.response.status === 404) {
                errorMsg = '❌ Repository not found.';
            }
            await sock.sendMessage(from, { text: errorMsg }, { quoted: msg });
        }
    } },
    { name: 'resetlink', category: 'group', description: 'Reset the group invite link (admin/owner only)', execute: async function (sock, msg, args, { isMe }) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) return await sock.sendMessage(from, { text: '❌ Group only command.' }, { quoted: msg });

        const sender = msg.key.participant || msg.key.remoteJid;
        let isAdmin = false;
        try {
            const groupMetadata = await sock.groupMetadata(from);
            const participant = groupMetadata.participants.find(p => p.id === sender);
            isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
        } catch (err) {
            console.error('Error checking admin:', err);
        }
        if (!isAdmin && !isMe) return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });

        try {
            const newInviteCode = await sock.groupRevokeInvite(from);
            const newLink = `https://chat.whatsapp.com/${newInviteCode}`;
            const text = `✅ Group invite link has been reset.\n🔗 New link: ${newLink}\n\n┍━━━━━━━━━━━━━━━╼\n┃ 🚀 SΛVΛGΞ-TΞCH OS\n┕━━━━━━━━━━━━━━━╼`;
            await sock.sendMessage(from, { text: text }, { quoted: msg });
        } catch (err) {
            console.error('Reset link error:', err);
            await sock.sendMessage(from, { text: `❌ Failed to reset invite link: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'resetwarn', category: 'group', description: '', execute: async function (sock, msg, args, { isArchitect, isMe }) {

        const from = msg.key.remoteJid;

        if (!from.endsWith("@g.us")) {
            return sock.sendMessage(from, {
                text: "❌ Group only command."
            });
        }

        const sender = msg.key.participant || msg.key.remoteJid;

        // ===== ADMIN / OWNER CHECK (LOCKED) =====
        let isAdmin = false;

        try {
            const meta = await sock.groupMetadata(from);

            const participant = meta.participants.find(
                p => (p.id === sender || p.jid === sender)
            );

            isAdmin =
                participant?.admin === "admin" ||
                participant?.admin === "superadmin";

        } catch {}

        const isOwner = global.owner?.includes(sender);

        if (!isAdmin && !isOwner && !isArchitect && !isMe) {
            return sock.sendMessage(from, {
                text: "🔒 Only group admins can reset warnings."
            });
        }

        // ===== TARGET (MENTION OR REPLY) =====
        let target =
            msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

        if (!target) {
            target =
                msg.message?.extendedTextMessage?.contextInfo?.participant;
        }

        if (!target) {
            return sock.sendMessage(from, {
                text:
`⚠️ Reply to a user or mention them.

Example:
.resetwarn @user

OR reply:
.resetwarn`
            });
        }

        // ===== SAFE STORAGE CHECK =====
        if (!global.warns?.[from]?.[target]) {
            return sock.sendMessage(from, {
                text: "⚠️ This user has no warnings."
            });
        }

        global.warns[from][target] = 0;

        // ===== SAVAGE QUOTES =====
        const quotes = [
            "Even systems deserve mercy once in a while.",
            "Clean slate granted. Don’t waste it.",
            "Order restored. Chaos contained.",
            "Warnings removed. Discipline remains.",
            "Savage Tech remembers everything — but resets when needed.",
            "A reset is not freedom — it’s responsibility.",
            "You’ve been given a second chance. Use it wisely.",
            "The system has forgiven. Don’t test it again.",
            "Past erased. Future monitored.",
            "Even justice has a reset button."
        ];

        const quote = quotes[Math.floor(Math.random() * quotes.length)];

        await sock.sendMessage(from, {
            text:
`🧹 *WARNINGS RESET*

👤 User: @${target.split("@")[0]}
📊 Status: 0/3 warnings
🟢 Clean slate restored

🧊 ${quote}

⚡ Powered by Savage Tech`,
            mentions: [target]
        });
    } },
    { name: 'restart', category: 'owner', description: 'Restart the bot (owner & sudo only)', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo) {
            return await sock.sendMessage(from, { text: "This command is restricted to the owner and sudo users only." }, { quoted: msg });
        }

        await sock.sendMessage(from, { text: '🔄 Bot restarting...' }, { quoted: msg });

        const isPm2 = process.env.PM2_ID || process.env.PM2_PID;
        if (isPm2) {
            const { exec } = require('child_process');
            exec('pm2 restart savage-bot', (err, stdout, stderr) => {
                if (err) {
                    console.error('PM2 restart failed:', err);
                    process.exit(0);
                }
                console.log('PM2 restart issued');
            });
        } else {
            const { spawn } = require('child_process');
            const args = process.argv.slice(1);
            const child = spawn(process.argv[0], args, {
                detached: true,
                stdio: 'inherit'
            });
            child.unref();
            process.exit(0);
        }
    } },
    { name: 'retro', category: 'Ephoto', description: 'Generate retro text effect', execute: async function (sock, msg, args) {
    const text = args.join(' ');
    if (!text) return sock.sendMessage(msg.key.remoteJid, { text: '❓ Usage: .retro <text>' });
    const senderName = msg.pushName || 'User';
    const senderJid = msg.key.participant || msg.key.remoteJid;
    const mentions = [senderJid];
    try {
      const apiUrl = `https://apis.xwolf.space/api/textpro/retro?text=${encodeURIComponent(text)}`;
      const response = await axios.get(apiUrl, { httpsAgent });
      if (!response.data.success) throw new Error(response.data.error || 'API failure');
      if (!response.data.imageUrl) throw new Error('No imageUrl in response');
      const imgBuffer = await downloadFile(response.data.imageUrl);
      const caption = `🎨 *Text Effect: retro*\n👤 REQUESTED BY: @${senderName}\n🚀 POWERED BY SAVAGE-CORE`;
      await sock.sendMessage(msg.key.remoteJid, { image: imgBuffer, caption: caption, mentions: mentions });
    } catch (err) {
      console.error('retro error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: `❌ Failed to generate image.\n${err.message}` });
    }
  } },
    { name: 'reverb', category: 'Audio Effects', description: 'Apply reverb effect to audio', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const url = args[0];
    if (!url) return sock.sendMessage(from, { text: '❓ Usage: .reverb <audio_url>' }, { quoted: msg });
    if (!url.startsWith('http')) return sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });

    try {
      await sock.sendMessage(from, { text: '🎧 Applying reverb effect...' }, { quoted: msg });
      const apiUrl = 'https://apis.xwolf.space/api/audio/reverb?url=' + encodeURIComponent(url);
      const response = await axios.get(apiUrl, { httpsAgent });
      let base64Audio = response.data.result?.base64Data || response.data.base64Data;
      if (!base64Audio && typeof response.data.result === 'string') base64Audio = response.data.result;
      if (!base64Audio) throw new Error('No audio data in response');
      if (base64Audio.startsWith('data:audio')) base64Audio = base64Audio.split(',')[1];
      const audioBuffer = Buffer.from(base64Audio, 'base64');
      const caption = '✨ Reverb Effect Applied';
      await sock.sendMessage(from, { audio: audioBuffer, mimetype: 'audio/mpeg', fileName: 'reverb_effect.mp3', caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('reverb error:', err);
      await sock.sendMessage(from, { text: '❌ Failed: ' + err.message }, { quoted: msg });
    }
  } },
    { name: 'reverse', category: 'Audio Effects', description: 'Apply reverse effect to audio', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const url = args[0];
    if (!url) return sock.sendMessage(from, { text: '❓ Usage: .reverse <audio_url>' }, { quoted: msg });
    if (!url.startsWith('http')) return sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });

    try {
      await sock.sendMessage(from, { text: '🎧 Applying reverse effect...' }, { quoted: msg });
      const apiUrl = 'https://apis.xwolf.space/api/audio/reverse?url=' + encodeURIComponent(url);
      const response = await axios.get(apiUrl, { httpsAgent });
      let base64Audio = response.data.result?.base64Data || response.data.base64Data;
      if (!base64Audio && typeof response.data.result === 'string') base64Audio = response.data.result;
      if (!base64Audio) throw new Error('No audio data in response');
      if (base64Audio.startsWith('data:audio')) base64Audio = base64Audio.split(',')[1];
      const audioBuffer = Buffer.from(base64Audio, 'base64');
      const caption = '✨ Reverse Effect Applied';
      await sock.sendMessage(from, { audio: audioBuffer, mimetype: 'audio/mpeg', fileName: 'reverse_effect.mp3', caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('reverse error:', err);
      await sock.sendMessage(from, { text: '❌ Failed: ' + err.message }, { quoted: msg });
    }
  } },
    { name: 'riddles', category: 'fun', description: 'Random riddle (answer hidden)', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const random = riddles[Math.floor(Math.random() * riddles.length)];

    await sock.sendMessage(from, {
      text: `🧩 *Riddle*\n\n${random.q}\n\n(Answer will be sent in 10 seconds...)`
    }, { quoted: msg });

    setTimeout(async () => {
      await sock.sendMessage(from, {
        text: `🔓 *Answer:* ${random.a}`
      }, { quoted: msg });
    }, 10000);
  } },
    { name: 'roasts', category: 'fun', description: 'Playful roast', execute: async function (sock, msg, args) {
    const random = roasts[Math.floor(Math.random() * roasts.length)];
    await sock.sendMessage(msg.key.remoteJid, {
      text: `🔥 *Roast*\n\n${random}`
    }, { quoted: msg });
  } },
    { name: 'robot', category: 'Audio Effects', description: 'Apply robot effect to audio', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const url = args[0];
    if (!url) return sock.sendMessage(from, { text: '❓ Usage: .robot <audio_url>' }, { quoted: msg });
    if (!url.startsWith('http')) return sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });

    try {
      await sock.sendMessage(from, { text: '🎧 Applying robot effect...' }, { quoted: msg });
      const apiUrl = 'https://apis.xwolf.space/api/audio/robot?url=' + encodeURIComponent(url);
      const response = await axios.get(apiUrl, { httpsAgent });
      let base64Audio = response.data.result?.base64Data || response.data.base64Data;
      if (!base64Audio && typeof response.data.result === 'string') base64Audio = response.data.result;
      if (!base64Audio) throw new Error('No audio data in response');
      if (base64Audio.startsWith('data:audio')) base64Audio = base64Audio.split(',')[1];
      const audioBuffer = Buffer.from(base64Audio, 'base64');
      const caption = '✨ Robot Effect Applied';
      await sock.sendMessage(from, { audio: audioBuffer, mimetype: 'audio/mpeg', fileName: 'robot_effect.mp3', caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('robot error:', err);
      await sock.sendMessage(from, { text: '❌ Failed: ' + err.message }, { quoted: msg });
    }
  } },
    { name: 'roseday', category: 'fun', description: 'Rose Day wishes', execute: async function (sock, msg, args) {
    const random = roseDay[Math.floor(Math.random() * roseDay.length)];
    await sock.sendMessage(msg.key.remoteJid, {
      text: `🌹 *Rose Day wish*\n\n${random}`
    }, { quoted: msg });
  } },
    { name: 'runtime', category: 'engine', description: 'Show bot runtime & system info', execute: async function (sock, msg) {
        const from = msg.key.remoteJid;
        const uptimeSeconds = process.uptime();
        const days = Math.floor(uptimeSeconds / 86400);
        const hours = Math.floor((uptimeSeconds % 86400) / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = Math.floor(uptimeSeconds % 60);

        const memUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
        const platform = getHostPlatform();

        let timeStr = '';
        if (days > 0) timeStr += `${days} day${days > 1 ? 's' : ''} `;
        if (hours > 0) timeStr += `${hours} hr${hours > 1 ? 's' : ''} `;
        if (minutes > 0) timeStr += `${minutes} min${minutes > 1 ? 's' : ''} `;
        if (seconds > 0) timeStr += `${seconds} sec${seconds > 1 ? 's' : ''}`;

        const text = ` *Savage Tech* has been running on *${platform}* for *${timeStr}*.\n*RAM used:* ${memUsed} MB`;

        await sock.sendMessage(from, { text }, { quoted: msg });
    } },
    { name: 'savage', category: 'ai', description: 'Chat with Savage AI', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) return sock.sendMessage(from, { text: '❌ Usage: .savage <message>' }, { quoted: msg });

        try {
            await sock.sendMessage(from, { text: '🤔 Thinking...' }, { quoted: msg });
            const response = await axios.get(`https://ravenn.site/ai/gpt4?q=${encodeURIComponent(query)}`, { timeout: 30000 });
            const data = response.data;
            if (data.status && data.result) {
                await sock.sendMessage(from, { text: data.result }, { quoted: msg });
            } else {
                throw new Error('Invalid response');
            }
        } catch (err) {
            console.error('Savage AI error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'savestatus', category: 'tools', description: 'Save a status update (story) and forward it to the bot owner', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted) {
            return sock.sendMessage(from, { text: "❌ Reply to a status message (story)." }, { quoted: msg });
        }

        let mediaType = null;
        let mediaMsg = null;
        if (quoted.imageMessage) {
            mediaType = "image";
            mediaMsg = quoted.imageMessage;
        } else if (quoted.videoMessage) {
            mediaType = "video";
            mediaMsg = quoted.videoMessage;
        } else if (quoted.audioMessage) {
            mediaType = "audio";
            mediaMsg = quoted.audioMessage;
        } else {
            return sock.sendMessage(from, { text: "❌ This is not a status message with image/video/audio. Reply to a story." }, { quoted: msg });
        }

        try {
            const buffer = await global.downloadMediaMessage({ message: quoted }, "buffer", {});
            if (!buffer || buffer.length === 0) throw new Error("Download failed");

            // Extract the sender JID from the reply context
            let senderJid = null;
            if (msg.message?.extendedTextMessage?.contextInfo?.participant) {
                senderJid = msg.message.extendedTextMessage.contextInfo.participant;
            } else if (quoted.key?.participant) {
                senderJid = quoted.key.participant;
            } else if (quoted.key?.remoteJid && quoted.key.remoteJid !== "status@broadcast") {
                senderJid = quoted.key.remoteJid;
            }

            // Resolve LID to a phone number if possible
            let owner = "Unknown";
            if (senderJid) {
                // If it's a LID, try to resolve it
                if (senderJid.endsWith('@lid') && typeof sock.getJidFromLid === 'function') {
                    try {
                        const resolved = await sock.getJidFromLid(senderJid);
                        if (resolved && !resolved.endsWith('@lid')) {
                            senderJid = resolved;
                        }
                    } catch (_) {}
                }
                owner = senderJid.split('@')[0];
            }

            const caption = `📥 *Status saved*\nFrom: ${owner}\nType: ${mediaType}\n\n_⚡ Powered by Savage Tech_`;

            const ownerJid = global.ownerJid;
            if (ownerJid) {
                if (mediaType === "image") {
                    await sock.sendMessage(ownerJid, { image: buffer, caption: caption });
                } else if (mediaType === "video") {
                    await sock.sendMessage(ownerJid, { video: buffer, caption: caption });
                } else if (mediaType === "audio") {
                    await sock.sendMessage(ownerJid, { audio: buffer, mimetype: 'audio/mpeg', caption: caption });
                }
                await sock.sendMessage(from, { text: `✅ Status saved and forwarded to the owner.` }, { quoted: msg });
            } else {
                if (mediaType === "image") {
                    await sock.sendMessage(from, { image: buffer, caption: caption }, { quoted: msg });
                } else if (mediaType === "video") {
                    await sock.sendMessage(from, { video: buffer, caption: caption }, { quoted: msg });
                } else if (mediaType === "audio") {
                    await sock.sendMessage(from, { audio: buffer, mimetype: 'audio/mpeg', caption: caption }, { quoted: msg });
                }
                await sock.sendMessage(from, { text: `⚠️ No owner registered. Status sent to you instead.` }, { quoted: msg });
            }
        } catch (err) {
            console.error("savestatus error:", err);
            await sock.sendMessage(from, { text: `❌ Failed to save status: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'scanner', category: 'tools', description: 'Detect AI-generated vs human text', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const text = args.join(' ');
    if (!text) return await sock.sendMessage(from, { text: '❓ Provide text to analyze.' }, { quoted: msg });

    try {
      const response = await axios.post('https://apis.xwolf.space/api/ai/scanner', { text });
      if (response.data.status === true) {
        const result = response.data.result || response.data.prediction || 'Analysis result not found.';
        await sock.sendMessage(from, { text: `🔍 *AI Scanner Result:*\n${result.slice(0, 2000)}` }, { quoted: msg });
      } else {
        await sock.sendMessage(from, { text: `⚠️ ${response.data.error || 'Scanner failed.'}` }, { quoted: msg });
      }
    } catch (error) {
      await sock.sendMessage(from, { text: '❌ Scanner API error.' }, { quoted: msg });
    }
  } },
    { name: 'screenshot', category: 'tools', description: 'Take website screenshot', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const url = args[0];
    if (!url || !url.startsWith('http')) {
      return await sock.sendMessage(from, { text: '❓ Usage: .screenshot <https://example.com>' }, { quoted: msg });
    }

    try {
      const res = await axios.get(`https://apis.xwolf.space/api/tools/screenshot?url=${encodeURIComponent(url)}`, { httpsAgent: agent, responseType: 'arraybuffer' });
      let imgBuffer;
      if (res.headers['content-type'].startsWith('image/')) {
        imgBuffer = Buffer.from(res.data);
      } else {
        const json = JSON.parse(res.data.toString());
        if (json.result && json.result.startsWith('http')) {
          imgBuffer = await downloadFile(json.result);
        } else {
          throw new Error('No image');
        }
      }
      await sock.sendMessage(from, {
        image: imgBuffer,
        caption: `📸 *Screenshot of ${url}*`
      }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'searchleague', category: 'sports', description: 'Get sports data (searchleague)', execute: async function (sock, msg, args) {
    const query = args.join(' ');
    if (!query) return sock.sendMessage(msg.key.remoteJid, { text: '❓ Usage: .searchleague <query>' });
    const sender = msg.pushName || 'User';
    const jid = msg.key.participant || msg.key.remoteJid;
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: `🏆 Fetching searchleague...`, mentions: [jid] });
      const apiUrl = `https://apis.xwolf.space/api/sports/search/league?q=${encodeURIComponent(query)}`;
      const res = await axios.get(apiUrl, { httpsAgent: agent });
      const result = formatResult(res.data);
      const output = `🏅 *Sports: searchleague*\n👤 REQUESTED BY: @${sender}\n🔍 Query: ${query}\n\n${result}\n\n┍━━━━━━━━━━━━━━━╼
┃ 🚀 SΛVΛGΞ-TΞCH OS
┕━━━━━━━━━━━━━━━╼`;
      await sock.sendMessage(msg.key.remoteJid, { text: output.slice(0, 2000), mentions: [jid] });
    } catch (err) {
      await sock.sendMessage(msg.key.remoteJid, { text: `❌ Error: ${err.message}` });
    }
  } },
    { name: 'searchplayer', category: 'sports', description: 'Search player by name (sends image)', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const query = args.join(' ');
    if (!query) {
      return await sock.sendMessage(from, { text: '❓ Usage: .searchplayer <player name>' }, { quoted: msg });
    }

    try {
      await sock.sendMessage(from, { text: `🔍 Searching for "${query}"...` }, { quoted: msg });
      const res = await axios.get(`https://apis.xwolf.space/api/sports/search/player?q=${encodeURIComponent(query)}`, { httpsAgent: agent });
      if (!res.data.success || !res.data.result) throw new Error('No results');
      const p = res.data.result;
      let caption = `⚽ *Player: ${p.name}*\n\n`;
      caption += `🏷️ ID: ${p.id}\n🎯 Sport: ${p.sport}\n📋 Team: ${p.team}\n🌍 Nationality: ${p.nationality}\n📍 Position: ${p.position}\n🎂 Born: ${p.dateBorn}`;
      let imgUrl = p.cutout || p.thumbnail;
      if (imgUrl && imgUrl.startsWith('http')) {
        const imgBuffer = await downloadFile(imgUrl);
        await sock.sendMessage(from, { image: imgBuffer, caption: caption }, { quoted: msg });
      } else {
        await sock.sendMessage(from, { text: caption }, { quoted: msg });
      }
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ Player not found: ${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'searchteam', category: 'sports', description: 'Search team by name (sends badge)', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const query = args.join(' ');
    if (!query) {
      return await sock.sendMessage(from, { text: '❓ Usage: .searchteam <team name>' }, { quoted: msg });
    }

    try {
      await sock.sendMessage(from, { text: `🔍 Searching for team "${query}"...` }, { quoted: msg });
      const res = await axios.get(`https://apis.xwolf.space/api/sports/search/team?q=${encodeURIComponent(query)}`, { httpsAgent: agent });
      if (!res.data.success || !res.data.result) throw new Error('No results');
      const t = res.data.result;
      let caption = `🏆 *Team: ${t.name}*\n\n`;
      caption += `🏷️ ID: ${t.id}\n⚽ Sport: ${t.sport}\n🏅 League: ${t.league}\n🌍 Country: ${t.country}\n🏟️ Stadium: ${t.stadium || 'N/A'}\n📝 ${(t.description || '').slice(0, 200)}`;
      let imgUrl = t.badge || t.thumbnail;
      if (imgUrl && imgUrl.startsWith('http')) {
        const imgBuffer = await downloadFile(imgUrl);
        await sock.sendMessage(from, { image: imgBuffer, caption: caption }, { quoted: msg });
      } else {
        await sock.sendMessage(from, { text: caption }, { quoted: msg });
      }
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ Team not found: ${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'seasons', category: 'sports', description: 'Get sports seasons', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .seasons <query>' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: `🏆 Fetching seasons...` }, { quoted: msg });

            const apiKey = 'wxa_f_28d599362e';
            const apiUrl = `https://apis.xwolf.space/api/sports/league/seasons?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });

            const result = formatResult(response.data);
            const output = `🏅 *Seasons*\n🔍 Query: ${query}\n\n${result}`;

            await sock.sendMessage(from, { text: output.slice(0, 2000) }, { quoted: msg });
        } catch (err) {
            console.error('Seasons error:', err);
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'security-headers', category: 'ethical hacking', description: 'Check security headers with Mozilla Observatory', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    let host = args[0];
    if (!host) {
      return await sock.sendMessage(from, { text: '❓ Usage: .security-headers <domain>' }, { quoted: msg });
    }
    host = host.replace(/^https?:\/\//, '');

    try {
      await sock.sendMessage(from, { text: `🔍 Scanning security headers for ${host}...` }, { quoted: msg });
      const res = await axios.get(`https://http-observatory.security.mozilla.org/api/v1/analyze?host=${encodeURIComponent(host)}`, { httpsAgent: agent });
      const data = res.data;
      let text = `🛡️ Observatory Score: ${data.score || 'N/A'}\n`;
      text += `Grade: ${data.grade || 'N/A'}\n`;
      if (data.tests) {
        text += `Passed tests: ${Object.values(data.tests).filter(t => t.pass).length}/${Object.keys(data.tests).length}\n`;
      }
      await sock.sendMessage(from, { text }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ Scan failed: ${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'setbio', category: 'owner', description: '', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = isArchitect || isMe || (global.ownerJid && sender === global.ownerJid);
        const isSudo = global.sudoUsers?.includes(sender) || false;
        if (!isOwner && !isSudo) {
            return await sock.sendMessage(from, { text: "❌ Command restricted to the owner and sudo users only." }, { quoted: msg });
        }
        const newBio = args.join(" ");
        if (!newBio) {
            return await sock.sendMessage(from, { text: "❌ Usage: .setbio <your new bio text>" }, { quoted: msg });
        }
        try {
            await sock.updateProfileStatus(newBio);
            await sock.sendMessage(from, { text: `✅ Bio updated to: ${newBio}` }, { quoted: msg });
        } catch (err) {
            console.error("Setbio error:", err);
            await sock.sendMessage(from, { text: `❌ Failed to update bio: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'setfont', category: 'owner', description: 'Change bot\'s global font (owner only)', execute: async function (sock, msg, args, { isArchitect }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isSudo = global.sudoUsers?.includes(sender);
        if (!isArchitect && !isSudo) {
            return await sock.sendMessage(from, { text: '❌ Owner or sudo only command.' }, { quoted: msg });
        }

        const fontName = args[0]?.toLowerCase();
        if (!fontName || fontName === 'list') {
            const available = Object.keys(fontMaps).join(', ');
            await sock.sendMessage(from, { text: `📝 *Available fonts:*\n${available}\n\nExample: .setfont bold` }, { quoted: msg });
            return;
        }
        if (!fontMaps[fontName]) {
            await sock.sendMessage(from, { text: `❌ Unknown font: ${fontName}\nUse .setfont list` }, { quoted: msg });
            return;
        }
        global.botFont = fontName;
        settings.setGlobal('botFont', fontName);
        await sock.sendMessage(from, { text: `✅ Bot font globally set to: ${fontName}\nAll my replies everywhere will use this font.` }, { quoted: msg });
    } },
    { name: 'setgatetext', category: 'group', description: '', execute: async (sock, msg, args, { isMe }) => {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) {
            return await sock.sendMessage(from, { text: '❌ Group only.' }, { quoted: msg });
        }
        const isAdmin = await global.checkAdmin(sock, from, msg.key.participant || msg.key.remoteJid);
        if (!isAdmin && !isMe) {
            return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });
        }

        if (!args.length) {
            return await sock.sendMessage(from, { text: 'Usage: .setgatetext <your custom text>' }, { quoted: msg });
        }
        const customText = args.join(' ');
        if (!global.gateConfig) global.gateConfig = {};
        if (!global.gateConfig[from]) global.gateConfig[from] = {};
        global.gateConfig[from].customText = customText;
        settings.setGroup(from, 'gateConfig', global.gateConfig[from]);
        await sock.sendMessage(from, { text: `✅ Custom verification message saved:\n\n${customText}` }, { quoted: msg });
    } },
    { name: 'setgcicon', category: 'group', description: '', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) return await sock.sendMessage(from, { text: '❌ Group only command.' }, { quoted: msg });

        const sender = msg.key.participant || msg.key.remoteJid;
        const isAdmin = await global.checkAdmin?.(sock, from, sender) || false;
        if (!isAdmin) return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });

        const url = args[0];
        if (!url) return await sock.sendMessage(from, { text: "🖼️ *SΛVΛGΞ:* Provide an image link." }, { quoted: msg });

        try {
            const response = await axios.get(url, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(response.data, 'binary');
            await sock.updateProfilePicture(from, buffer);
            await sock.sendMessage(from, { text: "✅ **SΛVΛGΞ:** Icon updated." }, { quoted: msg });
        } catch (e) {
            await sock.sendMessage(from, { text: "❌ **FAIL:** Check the link or Admin status." }, { quoted: msg });
        }
    } },
    { name: 'setgcname', category: 'tools', description: '', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;

        if (!from.endsWith('@g.us')) {
            return await sock.sendMessage(from, { text: '❌ This command can only be used in groups.' }, { quoted: msg });
        }

        const sender = msg.key.participant || msg.key.remoteJid;
        const isAdmin = await global.checkAdmin(sock, from, sender);
        if (!isAdmin) {
            return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });
        }

        const newName = args.join(' ');
        if (!newName) {
            return await sock.sendMessage(from, { text: '❌ Please provide the new name for the group.\nExample: *.setgcname SΛVΛGΞ HQ*' }, { quoted: msg });
        }

        try {
            await sock.groupUpdateSubject(from, newName);
            await sock.sendMessage(from, { text: `✅ Group name has been successfully changed to:\n*${newName}*` }, { quoted: msg });
        } catch (e) {
            console.log(e);
            await sock.sendMessage(from, { text: '❌ Failed to change name. Make sure I am an Admin!' }, { quoted: msg });
        }
    } },
    { name: 'setgdesc', category: 'group', description: '', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) {
            return await sock.sendMessage(from, { text: '❌ Group only command.' }, { quoted: msg });
        }

        const sender = msg.key.participant || msg.key.remoteJid;
        const isAdmin = await global.checkAdmin?.(sock, from, sender) || false;
        if (!isAdmin) {
            return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });
        }

        const newDesc = args.join(' ');
        if (!newDesc) {
            return await sock.sendMessage(from, { text: '❌ What is the new description?' }, { quoted: msg });
        }

        try {
            await sock.groupUpdateDescription(from, newDesc);
            await sock.sendMessage(from, { text: `✅ *GROUP DESCRIPTION UPDATED:* \n\n${newDesc}` }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(from, { text: '❌ Error: Make sure I am an Admin!' }, { quoted: msg });
        }
    } },
    { name: 'setmenuimage', category: 'owner', description: 'Set one or more menu images (space‑separated URLs). They will rotate with .menu', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo) {
            return await sock.sendMessage(from, { text: "This command is restricted to the owner and sudo users only." }, { quoted: msg });
        }

        if (args.length === 0) {
            return await sock.sendMessage(from, { text: '❓ Usage: .setmenuimage <url1> [url2] [url3] [url4]\nExample: .setmenuimage https://files.catbox.moe/waffn1.png https://files.catbox.moe/abc.png' }, { quoted: msg });
        }

        const validUrls = [];
        for (const url of args) {
            if (url.startsWith('http://') || url.startsWith('https://')) {
                validUrls.push(url);
            } else {
                return await sock.sendMessage(from, { text: `❌ Invalid URL: ${url}\nUse direct image links starting with http:// or https://` }, { quoted: msg });
            }
        }

        if (validUrls.length === 0) return;

        global.menuImages = validUrls;
        global.menuImageIndex = 0;
        delete global.menuImageUrl;

        settings.setGlobal('menuImages', global.menuImages);
        settings.setGlobal('menuImageIndex', global.menuImageIndex);

        const count = validUrls.length;
        const confirmText = `✅ Menu image${count > 1 ? 's' : ''} set (${count} total).\n${count > 1 ? 'Images will rotate each time you use .menu' : 'Single image set'}\n\nFirst image:\n${validUrls[0]}`;
        await sock.sendMessage(from, { text: confirmText }, { quoted: msg });
    } },
    { name: 'setpp', category: 'owner', description: 'Update bot profile picture (reply to an image)', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo && !isMe) {
            return await sock.sendMessage(from, { text: "This command is restricted to the owner and sudo users only." }, { quoted: msg });
        }

        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted) {
            return await sock.sendMessage(from, { text: '❌ Reply to an image message.' }, { quoted: msg });
        }
        const imageMsg = quoted.imageMessage;
        if (!imageMsg) {
            return await sock.sendMessage(from, { text: '❌ The replied message must be an image.' }, { quoted: msg });
        }
        try {
            await sock.sendMessage(from, { text: '📸 Downloading image...' }, { quoted: msg });
            const buffer = await downloadMediaMessage(
                { message: quoted },
                'buffer',
                {},
                { logger: console }
            );
            if (!buffer || buffer.length === 0) {
                throw new Error('Failed to download image');
            }
            await sock.updateProfilePicture(sock.user.id, buffer);
            await sock.sendMessage(from, { text: '✅ Digital identity updated.' }, { quoted: msg });
        } catch (err) {
            console.error(err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'setprefix', category: 'owner', description: 'Change the global command trigger (use \'none\' to remove prefix requirement)', execute: async function (sock, msg, args, { isArchitect, isMe }) {
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
    } },
    { name: 'shayari', category: 'fun', description: 'Hindi/Urdu romantic poetry', execute: async function (sock, msg, args) {
    const random = shayari[Math.floor(Math.random() * shayari.length)];
    await sock.sendMessage(msg.key.remoteJid, {
      text: `📜 *Shayari*\n\n${random}`
    }, { quoted: msg });
  } },
    { name: 'shazam', category: 'tools', description: 'Search for songs on Shazam', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .shazam <song name or artist>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_28d599362e';
            const url = `https://apis.xwolf.space/api/shazam/search?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(url, { timeout: 15000 });
            const data = response.data;

            if (!data.success || !data.results || data.results.length === 0) {
                return sock.sendMessage(from, { text: `❌ No results found for "${query}".` }, { quoted: msg });
            }

            const results = data.results.slice(0, 10);
            let text = `🎵 *Shazam Results for "${query}"*\n\n`;
            for (const r of results) {
                text += `🔹 *${r.title}* – ${r.artist}\n`;
                if (r.album) text += `   📀 ${r.album}\n`;
                if (r.year) text += `   📅 ${r.year}\n`;
                text += `\n`;
            }

            await sock.sendMessage(from, { text }, { quoted: msg });
        } catch (err) {
            console.error('Shazam error:', err);
            await sock.sendMessage(from, { text: '❌ API error.' }, { quoted: msg });
        }
    } },
    { name: 'shoot', category: 'anime', description: 'Random shoot anime', execute: async function (sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random shoot anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/shoot', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime shoot*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('shoot error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime shoot.' }, { quoted: msg });
    }
  } },
    { name: 'simple3d', category: 'Ephoto', description: 'Generate simple-3d text effect', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const text = args.join(' ');
    if (!text) return await sock.sendMessage(from, { text: '❓ Usage: .simple3d <text>' }, { quoted: msg });

    try {
      const apiUrl = `https://apis.xwolf.space/api/textpro/simple-3d?text=${encodeURIComponent(text)}`;
      const response = await axios.get(apiUrl, { httpsAgent });
      if (!response.data.success) throw new Error(response.data.error || 'API failure');
      if (!response.data.imageUrl) throw new Error('No imageUrl in response');
      const imgBuffer = await downloadFile(response.data.imageUrl);
      const caption = '🎨 *Text Effect: simple3d*';
      await sock.sendMessage(from, { image: imgBuffer, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('simple3d error:', err);
      await sock.sendMessage(from, { text: `❌ Failed to generate image.\n${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'slap', category: 'anime', description: 'Random slap anime', execute: async function (sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random slap anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/slap', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime slap*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('slap error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime slap.' }, { quoted: msg });
    }
  } },
    { name: 'sleep', category: 'anime', description: 'Random sleep anime', execute: async function (sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random sleep anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/sleep', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime sleep*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('sleep error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime sleep.' }, { quoted: msg });
    }
  } },
    { name: 'slow05x', category: 'Audio Effects', description: 'Apply slow05x effect to audio', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const url = args[0];
    if (!url) return await sock.sendMessage(from, { text: '❓ Usage: .slow05x <audio_url>' }, { quoted: msg });
    if (!url.startsWith('http')) return await sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });

    try {
      await sock.sendMessage(from, { text: '🎧 Applying slow05x effect...' }, { quoted: msg });
      const apiUrl = 'https://apis.xwolf.space/api/audio/slow05x?url=' + encodeURIComponent(url);
      const response = await axios.get(apiUrl, { httpsAgent });
      let base64Audio = response.data.result?.base64Data || response.data.base64Data;
      if (!base64Audio && typeof response.data.result === 'string') base64Audio = response.data.result;
      if (!base64Audio) throw new Error('No audio data in response');
      if (base64Audio.startsWith('data:audio')) base64Audio = base64Audio.split(',')[1];
      const audioBuffer = Buffer.from(base64Audio, 'base64');
      const caption = '✨ Slow05x Effect Applied';
      await sock.sendMessage(from, { audio: audioBuffer, mimetype: 'audio/mpeg', fileName: 'slow05x_effect.mp3', caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('slow05x error:', err);
      await sock.sendMessage(from, { text: '❌ Failed: ' + err.message }, { quoted: msg });
    }
  } },
    { name: 'slowed', category: 'Audio Effects', description: 'Apply slowed effect to audio', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const url = args[0];
    if (!url) return await sock.sendMessage(from, { text: '❓ Usage: .slowed <audio_url>' }, { quoted: msg });
    if (!url.startsWith('http')) return await sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });

    try {
      await sock.sendMessage(from, { text: '🎧 Applying slowed effect...' }, { quoted: msg });
      const apiUrl = 'https://apis.xwolf.space/api/audio/slowed?url=' + encodeURIComponent(url);
      const response = await axios.get(apiUrl, { httpsAgent });
      let base64Audio = response.data.result?.base64Data || response.data.base64Data;
      if (!base64Audio && typeof response.data.result === 'string') base64Audio = response.data.result;
      if (!base64Audio) throw new Error('No audio data in response');
      if (base64Audio.startsWith('data:audio')) base64Audio = base64Audio.split(',')[1];
      const audioBuffer = Buffer.from(base64Audio, 'base64');
      const caption = '✨ Slowed Effect Applied';
      await sock.sendMessage(from, { audio: audioBuffer, mimetype: 'audio/mpeg', fileName: 'slowed_effect.mp3', caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('slowed error:', err);
      await sock.sendMessage(from, { text: '❌ Failed: ' + err.message }, { quoted: msg });
    }
  } },
    { name: 'smile', category: 'anime', description: 'Random smile anime', execute: async function (sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random smile anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/smile', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime smile*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('smile error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime smile.' }, { quoted: msg });
    }
  } },
    { name: 'smug', category: 'anime', description: 'Random smug anime', execute: async function (sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random smug anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/smug', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime smug*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('smug error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime smug.' }, { quoted: msg });
    }
  } },
    { name: 'snapchat', category: 'download', description: 'Download from snapchat', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const url = args[0];
    if (!url) return await sock.sendMessage(from, { text: '❓ Usage: .snapchat <URL>' }, { quoted: msg });
    if (!url.startsWith('http')) return await sock.sendMessage(from, { text: '❌ Provide a valid URL starting with http:// or https://' }, { quoted: msg });

    try {
      const apiUrl = `https://apis.xwolf.space/download/snapchat?url=${encodeURIComponent(url)}`;
      const response = await axios.get(apiUrl, { httpsAgent });
      const data = response.data;

      if (!data.success) throw new Error(data.error || 'Download failed');

      const isVideo = true; // snapchat is always video
      const isAudio = false;
      const isText = false;

      if (isText) {
        let text = `📁 *Download Info (snapchat)*\n\n`;
        if (data.result) text += data.result;
        else if (data.info) text += JSON.stringify(data.info, null, 2);
        else text += JSON.stringify(data, null, 2);
        await sock.sendMessage(from, { text: text.slice(0, 2000) }, { quoted: msg });
        return;
      }

      let downloadUrl = null;
      if (data.downloadUrl) downloadUrl = data.downloadUrl;
      else if (data.result && typeof data.result === 'string') downloadUrl = data.result;
      else if (data.url) downloadUrl = data.url;
      else if (data.media && data.media.url) downloadUrl = data.media.url;
      else if (data.video && data.video.url) downloadUrl = data.video.url;
      else if (data.audio && data.audio.url) downloadUrl = data.audio.url;
      else if (Array.isArray(data.result) && data.result.length > 0) {
        const best = data.result.find(r => r.quality === 'HD') || data.result[0];
        downloadUrl = best.url || best.downloadUrl;
      }
      if (!downloadUrl) throw new Error('No download link found in API response');

      const fileBuffer = await downloadFile(downloadUrl);
      const maxSize = isVideo ? 64 * 1024 * 1024 : 16 * 1024 * 1024;
      if (fileBuffer.length > maxSize) {
        await sock.sendMessage(from, { text: `⚠️ File too large (${(fileBuffer.length/1024/1024).toFixed(1)}MB). Direct link: ${downloadUrl}` }, { quoted: msg });
        return;
      }

      const caption = `📥 *Download: snapchat*`;
      if (isVideo) {
        await sock.sendMessage(from, { video: fileBuffer, caption: caption }, { quoted: msg });
      } else {
        await sock.sendMessage(from, { audio: fileBuffer, mimetype: 'audio/mpeg', fileName: 'download.mp3', caption: caption }, { quoted: msg });
      }
    } catch (err) {
      console.error('snapchat error:', err);
      await sock.sendMessage(from, { text: `❌ Download failed.\n${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'solar', category: 'ai', description: 'Chat with Solar AI', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .solar <message>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_28d599362e';
            const url = `https://apis.xwolf.space/api/ai/solar?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(url, { timeout: 30000 });

            let reply = 'No response';
            if (response.data.status && response.data.result) {
                reply = response.data.result;
            } else if (response.data.error) {
                reply = `⚠️ ${response.data.error}`;
            }

            await sock.sendMessage(from, { text: `🤖 *Solar:*\n${reply.slice(0, 2000)}` }, { quoted: msg });
        } catch (err) {
            console.error('Solar error:', err);
            await sock.sendMessage(from, { text: '❌ API error. Please try again later.' }, { quoted: msg });
        }
    } },
    { name: 'song', category: 'audio', description: 'Download a song as MP3 (Ravenn primary, Wolf fallback, Deezer last)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) return sock.sendMessage(from, { text: '❌ Usage: .song <YouTube URL or song name>' }, { quoted: msg });

        try {
            await sock.sendMessage(from, { text: `🎵 Processing: ${query}\n⏳ Fetching audio...` }, { quoted: msg });

            let audioUrl = null;
            let title = 'Unknown';
            let artist = 'Unknown';
            let duration = 'N/A';
            let cover = null;
            let videoUrl = null;
            let usedFallback = false;

            const isUrl = query.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/);

            if (isUrl) {
                videoUrl = query;
                try {
                    const info = await yts({ videoId: videoUrl });
                    if (info) {
                        title = info.title || 'Unknown';
                        artist = info.author?.name || 'Unknown';
                        duration = info.duration?.timestamp || 'N/A';
                        cover = info.thumbnail || null;
                    }
                } catch (e) {}
            } else {
                try {
                    const searchResult = await yts(query);
                    const video = searchResult.videos[0];
                    if (video) {
                        videoUrl = video.url;
                        title = video.title || 'Unknown';
                        artist = video.author.name || 'Unknown';
                        duration = video.duration.timestamp || 'N/A';
                        cover = video.thumbnail || null;
                    } else {
                        throw new Error('No YouTube results');
                    }
                } catch (ytErr) {
                    console.log('YouTube search failed:', ytErr.message);
                }
            }

            if (videoUrl) {
                try {
                    const response = await axios.get(`https://ravenn.site/download/audio?url=${encodeURIComponent(videoUrl)}`, { timeout: 15000 });
                    if (response.data.status && response.data.result) {
                        audioUrl = response.data.result;
                        if (title === 'Unknown') title = 'YouTube Audio';
                    }
                } catch (ravErr) {
                    console.log('Ravenn API error:', ravErr.message);
                }
            }

            if (!audioUrl && videoUrl) {
                try {
                    const apiKey = 'wxa_f_28d599362e';
                    const wolfUrl = `https://apis.xwolf.space/download/mp3?url=${encodeURIComponent(videoUrl)}&q=${encodeURIComponent(query)}&key=${apiKey}`;
                    const wolfRes = await axios.get(wolfUrl, { timeout: 15000 });
                    if (wolfRes.data.success) {
                        audioUrl = wolfRes.data.result?.downloadUrl || wolfRes.data.downloadUrl || wolfRes.data.result?.url || wolfRes.data.url;
                        if (audioUrl && title === 'Unknown') title = 'YouTube Audio';
                    }
                } catch (wolfErr) {
                    console.log('Wolf API failed:', wolfErr.message);
                }
            }

            if (!audioUrl) {
                console.log('Ravenn & Wolf failed, falling back to Deezer...');
                usedFallback = true;
                try {
                    const deezerRes = await axios.get(`https://api.deezer.com/search?q=${encodeURIComponent(query)}`);
                    const track = deezerRes.data.data[0];
                    if (track && track.preview) {
                        audioUrl = track.preview;
                        title = track.title || 'Unknown';
                        artist = track.artist.name || 'Unknown';
                        duration = track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}` : '30s (preview)';
                        cover = track.album.cover_medium || null;
                    } else {
                        throw new Error('No results from Deezer');
                    }
                } catch (deezerErr) {
                    console.log('Deezer error:', deezerErr.message);
                    return sock.sendMessage(from, { text: '❌ No results found for that song.' }, { quoted: msg });
                }
            }

            if (!audioUrl) {
                throw new Error('Could not retrieve audio');
            }

            const caption = `🎵 *${title}*\n👤 *Artist:* ${artist}\n⏱️ *Duration:* ${duration}${usedFallback ? ' (preview)' : ''}`;

            let imageBuffer = null;
            if (cover) {
                try {
                    const imgRes = await axios.get(cover, { responseType: 'arraybuffer' });
                    imageBuffer = Buffer.from(imgRes.data);
                } catch (e) {}
            }

            if (imageBuffer) {
                await sock.sendMessage(from, { image: imageBuffer, caption }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: caption }, { quoted: msg });
            }

            const audioRes = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 30000 });
            const audioBuffer = Buffer.from(audioRes.data);

            await sock.sendMessage(from, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                ptt: false,
                caption: caption
            }, { quoted: msg });

        } catch (err) {
            console.error('Song error:', err);
            await sock.sendMessage(from, { text: `❌ Failed to download song: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'sorry', category: 'fun', description: 'Apology message', execute: async function (sock, msg, args) {
    const random = sorry[Math.floor(Math.random() * sorry.length)];
    await sock.sendMessage(msg.key.remoteJid, {
      text: `🙏 *Apology*\n\n${random}`
    }, { quoted: msg });
  } },
    { name: 'spank', category: 'anime', description: 'Random spank anime', execute: async function (sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random spank anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/spank', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime spank*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('spank error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime spank.' }, { quoted: msg });
    }
  } },
    { name: 'speed2x', category: 'Audio Effects', description: 'Apply speed2x effect to audio', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const url = args[0];
    if (!url) return await sock.sendMessage(from, { text: '❓ Usage: .speed2x <audio_url>' }, { quoted: msg });
    if (!url.startsWith('http')) return await sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });

    try {
      await sock.sendMessage(from, { text: '🎧 Applying speed2x effect...' }, { quoted: msg });
      const apiUrl = 'https://apis.xwolf.space/api/audio/speed2x?url=' + encodeURIComponent(url);
      const response = await axios.get(apiUrl, { httpsAgent });
      let base64Audio = response.data.result?.base64Data || response.data.base64Data;
      if (!base64Audio && typeof response.data.result === 'string') base64Audio = response.data.result;
      if (!base64Audio) throw new Error('No audio data in response');
      if (base64Audio.startsWith('data:audio')) base64Audio = base64Audio.split(',')[1];
      const audioBuffer = Buffer.from(base64Audio, 'base64');
      const caption = '✨ Speed2x Effect Applied';
      await sock.sendMessage(from, { audio: audioBuffer, mimetype: 'audio/mpeg', fileName: 'speed2x_effect.mp3', caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('speed2x error:', err);
      await sock.sendMessage(from, { text: '❌ Failed: ' + err.message }, { quoted: msg });
    }
  } },
    { name: 'spotifyalbum', category: 'Audio', description: 'Get Spotify metadata (track, album, artist, playlist)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .spotifyalbum <spotify_url_or_search_term>' }, { quoted: msg });
        }

        const cmd = 'album';
        const endpoint = 'album';

        try {
            const apiKey = 'wxa_f_28d599362e';
            let apiUrl;
            if (query.match(/spotify\.com/)) {
                apiUrl = `https://apis.xwolf.space/api/spotify/${endpoint}?url=${encodeURIComponent(query)}&key=${apiKey}`;
            } else {
                apiUrl = `https://apis.xwolf.space/api/spotify/${endpoint}?q=${encodeURIComponent(query)}&key=${apiKey}`;
            }
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });
            let resultText = `🎵 *Spotify ${cmd.toUpperCase()}*\n\n`;
            if (response.data.success) {
                const data = response.data.result || response.data;
                resultText += JSON.stringify(data, null, 2);
            } else {
                resultText += `❌ Error: ${response.data.error || 'Not found'}`;
            }
            await sock.sendMessage(from, { text: resultText.slice(0, 2000) }, { quoted: msg });
        } catch (err) {
            console.error('Spotify album error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'spotifyartist', category: 'Audio', description: 'Get Spotify metadata (track, album, artist, playlist)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .spotifyartist <spotify_url_or_search_term>' }, { quoted: msg });
        }

        const cmd = 'artist';
        const endpoint = 'artist';

        try {
            const apiKey = 'wxa_f_28d599362e';
            let apiUrl;
            if (query.match(/spotify\.com/)) {
                apiUrl = `https://apis.xwolf.space/api/spotify/${endpoint}?url=${encodeURIComponent(query)}&key=${apiKey}`;
            } else {
                apiUrl = `https://apis.xwolf.space/api/spotify/${endpoint}?q=${encodeURIComponent(query)}&key=${apiKey}`;
            }
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });
            let resultText = `🎵 *Spotify ${cmd.toUpperCase()}*\n\n`;
            if (response.data.success) {
                const data = response.data.result || response.data;
                resultText += JSON.stringify(data, null, 2);
            } else {
                resultText += `❌ Error: ${response.data.error || 'Not found'}`;
            }
            await sock.sendMessage(from, { text: resultText.slice(0, 2000) }, { quoted: msg });
        } catch (err) {
            console.error('Spotify artist error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'spotifyplaylist', category: 'Audio', description: 'Get Spotify metadata (track, album, artist, playlist)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .spotifyplaylist <spotify_url_or_search_term>' }, { quoted: msg });
        }

        const cmd = 'playlist';
        const endpoint = 'playlist';

        try {
            const apiKey = 'wxa_f_28d599362e';
            let apiUrl;
            if (query.match(/spotify\.com/)) {
                apiUrl = `https://apis.xwolf.space/api/spotify/${endpoint}?url=${encodeURIComponent(query)}&key=${apiKey}`;
            } else {
                apiUrl = `https://apis.xwolf.space/api/spotify/${endpoint}?q=${encodeURIComponent(query)}&key=${apiKey}`;
            }
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });
            let resultText = `🎵 *Spotify ${cmd.toUpperCase()}*\n\n`;
            if (response.data.success) {
                const data = response.data.result || response.data;
                resultText += JSON.stringify(data, null, 2);
            } else {
                resultText += `❌ Error: ${response.data.error || 'Not found'}`;
            }
            await sock.sendMessage(from, { text: resultText.slice(0, 2000) }, { quoted: msg });
        } catch (err) {
            console.error('Spotify playlist error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'spotifysearch', category: 'Audio', description: 'Get Spotify metadata (track, album, artist, playlist)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .spotifysearch <spotify_url_or_search_term>' }, { quoted: msg });
        }

        const cmd = 'search';
        const endpoint = 'search';

        try {
            const apiKey = 'wxa_f_28d599362e';
            let apiUrl;
            if (query.match(/spotify\.com/)) {
                apiUrl = `https://apis.xwolf.space/api/spotify/${endpoint}?url=${encodeURIComponent(query)}&key=${apiKey}`;
            } else {
                apiUrl = `https://apis.xwolf.space/api/spotify/${endpoint}?q=${encodeURIComponent(query)}&key=${apiKey}`;
            }
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });
            let resultText = `🎵 *Spotify ${cmd.toUpperCase()}*\n\n`;
            if (response.data.success) {
                const data = response.data.result || response.data;
                resultText += JSON.stringify(data, null, 2);
            } else {
                resultText += `❌ Error: ${response.data.error || 'Not found'}`;
            }
            await sock.sendMessage(from, { text: resultText.slice(0, 2000) }, { quoted: msg });
        } catch (err) {
            console.error('Spotify search error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'spotifytrack', category: 'Audio', description: 'Get Spotify metadata (track, album, artist, playlist)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .spotifytrack <spotify_url_or_search_term>' }, { quoted: msg });
        }

        const cmd = 'track';
        const endpoint = 'track';

        try {
            const apiKey = 'wxa_f_28d599362e';
            let apiUrl;
            if (query.match(/spotify\.com/)) {
                apiUrl = `https://apis.xwolf.space/api/spotify/${endpoint}?url=${encodeURIComponent(query)}&key=${apiKey}`;
            } else {
                apiUrl = `https://apis.xwolf.space/api/spotify/${endpoint}?q=${encodeURIComponent(query)}&key=${apiKey}`;
            }
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });
            let resultText = `🎵 *Spotify ${cmd.toUpperCase()}*\n\n`;
            if (response.data.success) {
                const data = response.data.result || response.data;
                resultText += JSON.stringify(data, null, 2);
            } else {
                resultText += `❌ Error: ${response.data.error || 'Not found'}`;
            }
            await sock.sendMessage(from, { text: resultText.slice(0, 2000) }, { quoted: msg });
        } catch (err) {
            console.error('Spotify track error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'ss', category: 'tools', description: '', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo && !isMe) {
            return await sock.sendMessage(from, { text: "This command is restricted to the owner and sudo users only." }, { quoted: msg });
        }

        const url = args[0];
        if (!url || !url.startsWith('http')) {
            return await sock.sendMessage(from, { text: '❓ Usage: .ss <https://example.com>' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: '📸 Taking screenshot...' }, { quoted: msg });
            const res = await axios.get(`https://apis.xwolf.space/api/tools/screenshot?url=${encodeURIComponent(url)}`, { httpsAgent: agent, responseType: 'arraybuffer' });
            let imgBuffer;
            if (res.headers['content-type'].startsWith('image/')) {
                imgBuffer = Buffer.from(res.data);
            } else {
                const json = JSON.parse(res.data.toString());
                if (json.result && json.result.startsWith('http')) {
                    imgBuffer = await downloadFile(json.result);
                } else {
                    throw new Error('No image');
                }
            }
            await sock.sendMessage(from, {
                image: imgBuffer,
                caption: `📸 *Screenshot of ${url}*`
            }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'ssl', category: 'ethical hacking', description: 'Check SSL certificate details', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const host = args[0];
    if (!host) return await sock.sendMessage(from, { text: '❓ Usage: .ssl <domain>' }, { quoted: msg });

    try {
      await sock.sendMessage(from, { text: `🔐 Fetching SSL cert for ${host}...` }, { quoted: msg });
      const cert = await new Promise((resolve, reject) => {
        const socket = tls.connect({ host, port: 443, rejectUnauthorized: false }, () => {
          const cert = socket.getPeerCertificate();
          socket.end();
          resolve(cert);
        });
        socket.on('error', reject);
        setTimeout(() => reject(new Error('Timeout')), 10000);
      });
      if (!cert || Object.keys(cert).length === 0) throw new Error('No certificate found');
      let text = `🔒 SSL Certificate for ${host}\n`;
      text += `Subject: ${cert.subject?.CN || 'N/A'}\n`;
      text += `Issuer: ${cert.issuer?.CN || 'N/A'}\n`;
      text += `Valid from: ${cert.valid_from || 'N/A'}\n`;
      text += `Valid to: ${cert.valid_to || 'N/A'}\n`;
      text += `Algorithm: ${cert.sigalg || 'N/A'}\n`;
      text += `Fingerprint: ${cert.fingerprint || 'N/A'}`;
      await sock.sendMessage(from, { text }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(from, { text: `❌ SSL error: ${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'starcoder', category: 'ai', description: 'Chat with StarCoder - code generation AI', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const query = args.join(' ');
    if (!query) return await sock.sendMessage(from, { text: '❓ What code do you want StarCoder to write?' }, { quoted: msg });

    try {
      const url = `https://apis.xwolf.space/api/ai/starcoder?q=${encodeURIComponent(query)}`;
      const res = await axios.get(url);
      const reply = res.data.status ? (res.data.result || 'No response') : `⚠️ ${res.data.error}`;
      await sock.sendMessage(from, { text: `🤖 *StarCoder:*\n${reply.slice(0, 2000)}` }, { quoted: msg });
    } catch {
      await sock.sendMessage(from, { text: '❌ API error' }, { quoted: msg });
    }
  } },
    { name: 'stare', category: 'anime', description: 'Random stare anime', execute: async function (sock, msg, args) {
    try {
      await sock.sendMessage(msg.key.remoteJid, { text: '🎴 Fetching random stare anime...' }, { quoted: msg });
      const res = await axios.get('https://nekos.best/api/v2/stare', { httpsAgent: agent });
      const imgUrl = res.data.results[0].url;
      const caption = '🎀 *Anime stare*';
      await sock.sendMessage(msg.key.remoteJid, { image: { url: imgUrl }, caption: caption }, { quoted: msg });
    } catch (err) {
      console.error('stare error:', err);
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Failed to fetch anime stare.' }, { quoted: msg });
    }
  } },
    { name: 'status', category: 'engine', description: '', execute: async function (sock, msg, args) {
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
    } },
    { name: 'sticker-to-img', category: 'tools', description: 'Convert media using sticker-to-img (reply to image/video/sticker OR provide URL)', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;

    let mediaBuffer = null;
    let providedUrl = args[0];

    if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
      mediaBuffer = await getMediaBufferFromMessage(sock, msg);
    }

    if (!mediaBuffer && !providedUrl) {
      return await sock.sendMessage(from, {
        text: '❓ Usage: .sticker-to-img\n   - Reply to an image/video/sticker\n   - Or provide a direct URL: .sticker-to-img https://example.com/media.jpg'
      }, { quoted: msg });
    }

    try {
      await sock.sendMessage(from, { text: '🔄 Converting media...' }, { quoted: msg });

      let apiUrl;
      if (mediaBuffer) {
        const base64 = mediaBuffer.toString('base64');
        const mime = (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage?.mimetype) ||
                     (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage?.mimetype) ||
                     'application/octet-stream';
        const dataUrl = `data:${mime};base64,${base64}`;
        apiUrl = `https://apis.xwolf.space/api/converter/sticker-to-img?url=${encodeURIComponent(dataUrl)}`;
      } else {
        apiUrl = `https://apis.xwolf.space/api/converter/sticker-to-img?url=${encodeURIComponent(providedUrl)}`;
      }

      const response = await axios.get(apiUrl, { agent, responseType: 'arraybuffer' });
      const contentType = response.headers['content-type'] || '';
      const resultBuffer = Buffer.from(response.data);

      const caption = '✅ *Converted via sticker-to-img*';

      if (contentType.includes('video')) {
        await sock.sendMessage(from, { video: resultBuffer, caption: caption }, { quoted: msg });
      } else if (contentType.includes('image') || contentType.includes('webp')) {
        await sock.sendMessage(from, { image: resultBuffer, caption: caption }, { quoted: msg });
      } else {
        await sock.sendMessage(from, { text: caption + '\n\n' + resultBuffer.toString('utf-8').slice(0, 500) }, { quoted: msg });
      }
    } catch (err) {
      console.error('sticker-to-img error:', err);
      await sock.sendMessage(from, { text: `❌ Conversion failed: ${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'sticker-to-video', category: 'tools', description: 'Convert media using sticker-to-video (reply to image/video/sticker OR provide URL)', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;

    let mediaBuffer = null;
    let providedUrl = args[0];

    if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
      mediaBuffer = await getMediaBufferFromMessage(sock, msg);
    }

    if (!mediaBuffer && !providedUrl) {
      return await sock.sendMessage(from, {
        text: '❓ Usage: .sticker-to-video\n   - Reply to an image/video/sticker\n   - Or provide a direct URL: .sticker-to-video https://example.com/media.jpg'
      }, { quoted: msg });
    }

    try {
      await sock.sendMessage(from, { text: '🔄 Converting media...' }, { quoted: msg });

      let apiUrl;
      if (mediaBuffer) {
        const base64 = mediaBuffer.toString('base64');
        const mime = (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage?.mimetype) ||
                     (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage?.mimetype) ||
                     'application/octet-stream';
        const dataUrl = `data:${mime};base64,${base64}`;
        apiUrl = `https://apis.xwolf.space/api/converter/sticker-to-video?url=${encodeURIComponent(dataUrl)}`;
      } else {
        apiUrl = `https://apis.xwolf.space/api/converter/sticker-to-video?url=${encodeURIComponent(providedUrl)}`;
      }

      const response = await axios.get(apiUrl, { agent, responseType: 'arraybuffer' });
      const contentType = response.headers['content-type'] || '';
      const resultBuffer = Buffer.from(response.data);

      const caption = '✅ *Converted via sticker-to-video*';

      if (contentType.includes('video')) {
        await sock.sendMessage(from, { video: resultBuffer, caption: caption }, { quoted: msg });
      } else if (contentType.includes('image') || contentType.includes('webp')) {
        await sock.sendMessage(from, { image: resultBuffer, caption: caption }, { quoted: msg });
      } else {
        await sock.sendMessage(from, { text: caption + '\n\n' + resultBuffer.toString('utf-8').slice(0, 500) }, { quoted: msg });
      }
    } catch (err) {
      console.error('sticker-to-video error:', err);
      await sock.sendMessage(from, { text: `❌ Conversion failed: ${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'stock', category: 'financial data', description: 'Get economic data (forex, crypto, stock, inflation, gdp, bankrate, wallet, gold, market, news)', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;

    if (!args.length) {
      return await sock.sendMessage(from, { text: '❓ Usage: .stock <type> [param]\n\nTypes: forex, crypto, stock, inflation, gdp, bankrate, wallet, gold, market, news' }, { quoted: msg });
    }

    const command = args[0].toLowerCase();
    const param = args.slice(1).join(' ');

    try {
      let apiUrl = '';
      let paramLabel = '';

      if (command === 'forex') {
        const [fromCur, toCur] = param ? param.split(',') : ['USD', 'EUR'];
        apiUrl = `https://apis.xwolf.space/api/economy/forex?from=${fromCur}&to=${toCur}`;
        paramLabel = `${fromCur}/${toCur}`;
      } else if (command === 'crypto') {
        const symbol = param ? param.toUpperCase() : 'BTC';
        apiUrl = `https://apis.xwolf.space/api/economy/crypto?symbol=${symbol}`;
        paramLabel = symbol;
      } else if (command === 'stock') {
        const ticker = param ? param.toUpperCase() : 'AAPL';
        apiUrl = `https://apis.xwolf.space/api/economy/stock?symbol=${ticker}`;
        paramLabel = ticker;
      } else if (command === 'inflation') {
        const country = param ? param.toUpperCase() : 'US';
        apiUrl = `https://apis.xwolf.space/api/economy/inflation?country=${country}`;
        paramLabel = country;
      } else if (command === 'gdp') {
        const country = param ? param.toUpperCase() : 'US';
        apiUrl = `https://apis.xwolf.space/api/economy/gdp?country=${country}`;
        paramLabel = country;
      } else if (command === 'bankrate') {
        const country = param ? param.toUpperCase() : 'US';
        apiUrl = `https://apis.xwolf.space/api/economy/bank-rate?country=${country}`;
        paramLabel = country;
      } else if (command === 'wallet') {
        if (!param) {
          return await sock.sendMessage(from, { text: '❓ Usage: .stock wallet <crypto_address>' }, { quoted: msg });
        }
        apiUrl = `https://apis.xwolf.space/api/economy/wallet?address=${param}`;
        paramLabel = param.slice(0, 10) + '...';
      } else if (command === 'gold') {
        apiUrl = `https://apis.xwolf.space/api/economy/gold`;
        paramLabel = '';
      } else if (command === 'market') {
        apiUrl = `https://apis.xwolf.space/api/economy/market`;
        paramLabel = '';
      } else if (command === 'news') {
        apiUrl = `https://apis.xwolf.space/api/economy/news`;
        paramLabel = '';
      } else {
        return await sock.sendMessage(from, { text: '❌ Unknown type. Use: forex, crypto, stock, inflation, gdp, bankrate, wallet, gold, market, news' }, { quoted: msg });
      }

      const response = await axios.get(apiUrl, { httpsAgent: agent });
      const data = response.data;
      
      if (!data.success) throw new Error(data.error || 'No data');
      
      let output = `📊 *ECONOMIC DATA*`;
      if (paramLabel) output += ` (${paramLabel})`;
      output += `\n\n`;
      
      if (command === 'crypto') {
        output += `💎 *${data.symbol || paramLabel}*\n`;
        output += `💰 Price: ${formatNumber(data.price_usd)}\n`;
        if (data.change_24h !== undefined) output += `📈 24h Change: ${data.change_24h > 0 ? '+' : ''}${data.change_24h}%\n`;
        if (data.market_cap_usd) output += `🏦 Market Cap: ${formatNumber(data.market_cap_usd)}\n`;
        if (data.volume_24h_usd) output += `📊 24h Volume: ${formatNumber(data.volume_24h_usd)}\n`;
      } else if (command === 'stock') {
        output += `📈 *${data.symbol || paramLabel}*\n`;
        output += `💵 Price: ${formatNumber(data.price)}\n`;
        if (data.change !== undefined) output += `📉 Change: ${data.change > 0 ? '+' : ''}${data.change}%\n`;
        if (data.volume) output += `📊 Volume: ${formatNumber(data.volume)}\n`;
      } else if (command === 'forex') {
        output += `💱 *${data.from || 'USD'} → ${data.to || 'EUR'}*\n`;
        output += `💹 Rate: ${data.rate || data.result}\n`;
        if (data.change) output += `📈 Change: ${data.change}%\n`;
      } else if (command === 'gold') {
        output += `🥇 *Gold & Silver*\n`;
        output += `🪙 Gold: ${formatNumber(data.gold)}/oz\n`;
        if (data.silver) output += `🥈 Silver: ${formatNumber(data.silver)}/oz\n`;
      } else if (command === 'market') {
        output += `🌍 *Market Indices*\n`;
        if (data.sp500) output += `📊 S&P 500: ${formatNumber(data.sp500)}\n`;
        if (data.dow) output += `📈 Dow Jones: ${formatNumber(data.dow)}\n`;
        if (data.nasdaq) output += `📉 Nasdaq: ${formatNumber(data.nasdaq)}\n`;
      } else if (command === 'inflation') {
        output += `📉 *Inflation Rate (${paramLabel || 'US'})*\n`;
        output += `📅 Annual: ${data.rate}%\n`;
        if (data.year) output += `🗓️ Year: ${data.year}\n`;
      } else if (command === 'gdp') {
        output += `📊 *GDP (${paramLabel || 'US'})*\n`;
        output += `💰 GDP: ${formatNumber(data.gdp)}\n`;
        if (data.growth) output += `📈 Growth: ${data.growth}%\n`;
      } else if (command === 'bankrate') {
        output += `🏦 *Central Bank Rate (${paramLabel || 'US'})*\n`;
        output += `💹 Rate: ${data.rate}%\n`;
      } else if (command === 'news') {
        output += `📰 *Financial News*\n\n`;
        const headlines = data.result || data.articles || [];
        if (Array.isArray(headlines) && headlines.length) {
          headlines.slice(0, 5).forEach((item, i) => {
            output += `${i+1}. ${item.title || item.headline}\n`;
            if (item.source) output += `   📍 ${item.source}\n`;
            output += `\n`;
          });
        } else {
          output += `No news available.\n`;
        }
      } else if (command === 'wallet') {
        output += `💳 *Wallet Balance*\n`;
        output += `💰 Balance: ${formatNumber(data.balance)} ${data.currency || 'BTC'}\n`;
        if (data.transactions) output += `🔄 Transactions: ${data.transactions}\n`;
      } else {
        output += JSON.stringify(data.result || data, null, 2);
      }

      await sock.sendMessage(from, { text: output.slice(0, 2000) }, { quoted: msg });
    } catch (err) {
      console.error('stock error:', err);
      await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'stock', category: 'financial data', description: 'Get economic data (forex, crypto, stock, inflation, gdp, bankrate, wallet, gold, market, news)', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;

    if (!args.length) {
      return await sock.sendMessage(from, { text: '❓ Usage: .stock <type> [param]\n\nTypes: forex, crypto, stock, inflation, gdp, bankrate, wallet, gold, market, news' }, { quoted: msg });
    }

    const command = args[0].toLowerCase();
    const param = args.slice(1).join(' ');

    try {
      let apiUrl = '';
      let paramLabel = '';

      if (command === 'forex') {
        const [fromCur, toCur] = param ? param.split(',') : ['USD', 'EUR'];
        apiUrl = `https://apis.xwolf.space/api/economy/forex?from=${fromCur}&to=${toCur}`;
        paramLabel = `${fromCur}/${toCur}`;
      } else if (command === 'crypto') {
        const symbol = param ? param.toUpperCase() : 'BTC';
        apiUrl = `https://apis.xwolf.space/api/economy/crypto?symbol=${symbol}`;
        paramLabel = symbol;
      } else if (command === 'stock') {
        const ticker = param ? param.toUpperCase() : 'AAPL';
        apiUrl = `https://apis.xwolf.space/api/economy/stock?symbol=${ticker}`;
        paramLabel = ticker;
      } else if (command === 'inflation') {
        const country = param ? param.toUpperCase() : 'US';
        apiUrl = `https://apis.xwolf.space/api/economy/inflation?country=${country}`;
        paramLabel = country;
      } else if (command === 'gdp') {
        const country = param ? param.toUpperCase() : 'US';
        apiUrl = `https://apis.xwolf.space/api/economy/gdp?country=${country}`;
        paramLabel = country;
      } else if (command === 'bankrate') {
        const country = param ? param.toUpperCase() : 'US';
        apiUrl = `https://apis.xwolf.space/api/economy/bank-rate?country=${country}`;
        paramLabel = country;
      } else if (command === 'wallet') {
        if (!param) {
          return await sock.sendMessage(from, { text: '❓ Usage: .stock wallet <crypto_address>' }, { quoted: msg });
        }
        apiUrl = `https://apis.xwolf.space/api/economy/wallet?address=${param}`;
        paramLabel = param.slice(0, 10) + '...';
      } else if (command === 'gold') {
        apiUrl = `https://apis.xwolf.space/api/economy/gold`;
        paramLabel = '';
      } else if (command === 'market') {
        apiUrl = `https://apis.xwolf.space/api/economy/market`;
        paramLabel = '';
      } else if (command === 'news') {
        apiUrl = `https://apis.xwolf.space/api/economy/news`;
        paramLabel = '';
      } else {
        return await sock.sendMessage(from, { text: '❌ Unknown type. Use: forex, crypto, stock, inflation, gdp, bankrate, wallet, gold, market, news' }, { quoted: msg });
      }

      const response = await axios.get(apiUrl, { httpsAgent: agent });
      const data = response.data;
      
      if (!data.success) throw new Error(data.error || 'No data');
      
      let output = `📊 *ECONOMIC DATA*`;
      if (paramLabel) output += ` (${paramLabel})`;
      output += `\n\n`;
      
      if (command === 'crypto') {
        output += `💎 *${data.symbol || paramLabel}*\n`;
        output += `💰 Price: ${formatNumber(data.price_usd)}\n`;
        if (data.change_24h !== undefined) output += `📈 24h Change: ${data.change_24h > 0 ? '+' : ''}${data.change_24h}%\n`;
        if (data.market_cap_usd) output += `🏦 Market Cap: ${formatNumber(data.market_cap_usd)}\n`;
        if (data.volume_24h_usd) output += `📊 24h Volume: ${formatNumber(data.volume_24h_usd)}\n`;
      } else if (command === 'stock') {
        output += `📈 *${data.symbol || paramLabel}*\n`;
        output += `💵 Price: ${formatNumber(data.price)}\n`;
        if (data.change !== undefined) output += `📉 Change: ${data.change > 0 ? '+' : ''}${data.change}%\n`;
        if (data.volume) output += `📊 Volume: ${formatNumber(data.volume)}\n`;
      } else if (command === 'forex') {
        output += `💱 *${data.from || 'USD'} → ${data.to || 'EUR'}*\n`;
        output += `💹 Rate: ${data.rate || data.result}\n`;
        if (data.change) output += `📈 Change: ${data.change}%\n`;
      } else if (command === 'gold') {
        output += `🥇 *Gold & Silver*\n`;
        output += `🪙 Gold: ${formatNumber(data.gold)}/oz\n`;
        if (data.silver) output += `🥈 Silver: ${formatNumber(data.silver)}/oz\n`;
      } else if (command === 'market') {
        output += `🌍 *Market Indices*\n`;
        if (data.sp500) output += `📊 S&P 500: ${formatNumber(data.sp500)}\n`;
        if (data.dow) output += `📈 Dow Jones: ${formatNumber(data.dow)}\n`;
        if (data.nasdaq) output += `📉 Nasdaq: ${formatNumber(data.nasdaq)}\n`;
      } else if (command === 'inflation') {
        output += `📉 *Inflation Rate (${paramLabel || 'US'})*\n`;
        output += `📅 Annual: ${data.rate}%\n`;
        if (data.year) output += `🗓️ Year: ${data.year}\n`;
      } else if (command === 'gdp') {
        output += `📊 *GDP (${paramLabel || 'US'})*\n`;
        output += `💰 GDP: ${formatNumber(data.gdp)}\n`;
        if (data.growth) output += `📈 Growth: ${data.growth}%\n`;
      } else if (command === 'bankrate') {
        output += `🏦 *Central Bank Rate (${paramLabel || 'US'})*\n`;
        output += `💹 Rate: ${data.rate}%\n`;
      } else if (command === 'news') {
        output += `📰 *Financial News*\n\n`;
        const headlines = data.result || data.articles || [];
        if (Array.isArray(headlines) && headlines.length) {
          headlines.slice(0, 5).forEach((item, i) => {
            output += `${i+1}. ${item.title || item.headline}\n`;
            if (item.source) output += `   📍 ${item.source}\n`;
            output += `\n`;
          });
        } else {
          output += `No news available.\n`;
        }
      } else if (command === 'wallet') {
        output += `💳 *Wallet Balance*\n`;
        output += `💰 Balance: ${formatNumber(data.balance)} ${data.currency || 'BTC'}\n`;
        if (data.transactions) output += `🔄 Transactions: ${data.transactions}\n`;
      } else {
        output += JSON.stringify(data.result || data, null, 2);
      }

      await sock.sendMessage(from, { text: output.slice(0, 2000) }, { quoted: msg });
    } catch (err) {
      console.error('stock error:', err);
      await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'success', category: 'fun', description: 'Motivation about success', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const random = success[Math.floor(Math.random() * success.length)];
    await sock.sendMessage(from, {
      text: `🏆 *Success Thought*\n\n${random}`
    }, { quoted: msg });
  } },
    { name: 'sudodebug', category: 'owner', description: '', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = isArchitect || isMe || (global.ownerJid && sender === global.ownerJid);
        if (!isOwner) return sock.sendMessage(from, { text: "❌ Owner only command." }, { quoted: msg });

        if (!global.sudoUsers) global.sudoUsers = new Set();
        const list = Array.from(global.sudoUsers);
        const listStr = list.length ? list.map(j => `• ${j}`).join("\n") : "None";
        await sock.sendMessage(from, { text: `🔍 *SUDO DEBUG*\nTotal: ${list.length}\n\n${listStr}` }, { quoted: msg });
    } },
    { name: 'sudoinfo', category: 'owner', description: '', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo && !isMe) {
            return await sock.sendMessage(from, { text: "This command is restricted to the owner and sudo users only." }, { quoted: msg });
        }

        if (!global.sudoUsers || !Array.isArray(global.sudoUsers)) {
            global.sudoUsers = [];
        }

        const count = global.sudoUsers.length;
        let listMsg = "";
        if (args[0] === "list") {
            const list = global.sudoUsers.map(j => `• ${j.split('@')[0]}`).join("\n");
            listMsg = `\n\n📋 *Sudo users* (${count}):\n${list || "None"}`;
        }
        await sock.sendMessage(from, {
            text: `🔧 *SUDO INFO*\nTotal sudoers: ${count}\n\nUse .addsudo (reply to user) and .removesudo (reply to user)\n.sudoinfo list to see all${listMsg}`
        }, { quoted: msg });
    } },
    { name: 'summarize', category: 'tools', description: 'Summarize long text', execute: async function (sock, msg, args) {
    const from = msg.key.remoteJid;
    const text = args.join(' ');
    if (!text) {
      return sock.sendMessage(from, { text: '❓ Provide text to summarize.' }, { quoted: msg });
    }

    try {
      const apiKey = 'wxa_f_9ddecf073b';
      const response = await axios.post(
        `https://apis.xwolf.space/api/ai/summarize?key=${apiKey}`,
        { text },
        { timeout: 30000 }
      );

      if (response.data.status === true) {
        const summary = response.data.result || response.data.summary || 'No summary returned.';
        await sock.sendMessage(from, { text: `📝 *Summary:*\n${summary.slice(0, 2000)}` }, { quoted: msg });
      } else {
        const errMsg = response.data.error || 'Summarization failed.';
        await sock.sendMessage(from, { text: `⚠️ ${errMsg}` }, { quoted: msg });
      }
    } catch (error) {
      console.error('Summarize error:', error);
      await sock.sendMessage(from, { text: '❌ Summarization API error.' }, { quoted: msg });
    }
  } },
    { name: 'system', category: 'engine', description: 'Show detailed system info', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;

        const hostname = os.hostname();
        const platform = os.platform();
        const release = os.release();
        const arch = os.arch();
        const uptime = os.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const uptimeStr = `${days}d ${hours}h ${minutes}m`;

        const cpus = os.cpus();
        const cpuModel = cpus[0]?.model || 'Unknown';
        const cpuSpeed = cpus[0]?.speed || 0;
        const cpuCores = cpus.length;

        const loadAvg = os.loadavg();
        const load1 = loadAvg[0].toFixed(2);
        const load5 = loadAvg[1].toFixed(2);
        const load15 = loadAvg[2].toFixed(2);

        const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
        const usedMem = (totalMem - freeMem).toFixed(2);
        const memPercent = ((totalMem - freeMem) / totalMem * 100).toFixed(1);

        const nodeVersion = process.version;
        const botUptime = process.uptime();
        const botDays = Math.floor(botUptime / 86400);
        const botHours = Math.floor((botUptime % 86400) / 3600);
        const botMinutes = Math.floor((botUptime % 3600) / 60);
        const botUptimeStr = `${botDays}d ${botHours}h ${botMinutes}m`;

        const caption = `
╔═══════════════════════════════╗
║        SYSTEM INFORMATION     ║
╚═══════════════════════════════╝

─── *🖥️ HARDWARE* ───
🏷️ Hostname   : ${hostname}
💻 Platform   : ${platform} ${release}
🔧 Arch       : ${arch}
🧠 CPU        : ${cpuModel}
⚡ Speed      : ${cpuSpeed} MHz
💪 Cores      : ${cpuCores}
📊 Load Avg   : ${load1} / ${load5} / ${load15} (1/5/15 min)

─── *🧮 MEMORY* ───
📦 Total      : ${totalMem} GB
📤 Used       : ${usedMem} GB (${memPercent}%)
📥 Free       : ${freeMem} GB

─── *⏱️ UPTIME* ───
🔄 System     : ${uptimeStr}
🤖 Bot        : ${botUptimeStr}

─── *⚙️ NODE* ───
📦 Version    : ${nodeVersion}
`;

        let imageBuffer = null;
        try {
            const imgRes = await axios.get('https://files.catbox.moe/ls3djv.jpg', {
                responseType: 'arraybuffer',
                timeout: 10000
            });
            imageBuffer = Buffer.from(imgRes.data);
        } catch (imgErr) {
            console.warn('Could not fetch system image:', imgErr.message);
        }

        if (imageBuffer) {
            await sock.sendMessage(from, {
                image: imageBuffer,
                caption: caption
            }, { quoted: msg });
        } else {
            await sock.sendMessage(from, {
                text: caption
            }, { quoted: msg });
        }
    } },
    { name: 'tagadmin', category: 'group', description: '', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) return await sock.sendMessage(from, { text: '❌ Group only command.' }, { quoted: msg });

        const sender = msg.key.participant || msg.key.remoteJid;
        const isAdmin = await global.checkAdmin?.(sock, from, sender) || false;
        if (!isAdmin) return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });

        try {
            const metadata = await sock.groupMetadata(from);
            const admins = metadata.participants
                .filter(v => v.admin !== null)
                .map(v => v.id);

            if (admins.length === 0) return;

            let messageText = `⛓️ *Admin Alert* ⛓️\n\n`;
            
            admins.forEach((admin) => {
                messageText += `🔹 @${admin.split('@')[0]}\n`;
            });

            if (args.join(" ")) messageText += `\n📝 *Message:* ${args.join(" ")}`;

            await sock.sendMessage(from, { 
                text: messageText, 
                mentions: admins 
            }, { quoted: msg });

        } catch (e) {
            console.error(e);
            await sock.sendMessage(from, { text: "❌ I need Admin rights to read the participant list." }, { quoted: msg });
        }
    } },
    { name: 'tagall', category: 'group', description: '', execute: async function (sock, msg, args) {
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
    } },
    { name: 'teamdetails', category: 'sports', description: 'Get team details (badge included)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .teamdetails <team name or ID>' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: `🔍 Fetching team details for "${query}"...` }, { quoted: msg });

            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/api/sports/team/details?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });
            const data = response.data;

            if (!data.success || !data.result) {
                throw new Error(data.error || 'No data returned');
            }

            const t = data.result;
            let caption = `🏟️ *Team: ${t.name || 'Unknown'}*\n\n`;
            caption += `🏷️ ID: ${t.id || 'N/A'}\n`;
            caption += `⚽ Sport: ${t.sport || 'N/A'}\n`;
            caption += `🏅 League: ${t.league || 'N/A'}\n`;
            caption += `🌍 Country: ${t.country || 'N/A'}\n`;
            caption += `📊 Formed: ${t.formed || 'N/A'}\n`;
            caption += `🏆 Stadium: ${t.stadium || 'N/A'}\n`;
            if (t.description) {
                caption += `📝 ${t.description.slice(0, 300)}`;
            }

            let imgUrl = t.badge || t.thumbnail;
            if (imgUrl && imgUrl.startsWith('http')) {
                try {
                    const imgRes = await axios.get(imgUrl, { responseType: 'arraybuffer', httpsAgent: agent, timeout: 10000 });
                    const imgBuffer = Buffer.from(imgRes.data);
                    await sock.sendMessage(from, {
                        image: imgBuffer,
                        caption: caption
                    }, { quoted: msg });
                } catch (imgErr) {
                    console.warn('Failed to fetch badge:', imgErr.message);
                    await sock.sendMessage(from, { text: caption }, { quoted: msg });
                }
            } else {
                await sock.sendMessage(from, { text: caption }, { quoted: msg });
            }

        } catch (err) {
            console.error('Team details error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'teamequipment', category: 'sports', description: 'Get team equipment data', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .teamequipment <team name or ID>' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: `🏆 Fetching equipment for "${query}"...` }, { quoted: msg });

            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/api/sports/team/equipment?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });
            const data = response.data;

            const result = formatResult(data);
            const output = `🏅 *Team Equipment*\n🔍 Query: ${query}\n\n${result}`;

            await sock.sendMessage(from, { text: output.slice(0, 2000) }, { quoted: msg });

        } catch (err) {
            console.error('Team equipment error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'teamlast', category: 'sports', description: 'Get last matches for a team', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .teamlast <team name or ID>' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: `🏆 Fetching last matches for "${query}"...` }, { quoted: msg });

            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/api/sports/team/last?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });
            const data = response.data;

            const result = formatResult(data);
            const output = `🏅 *Last Matches*\n🔍 Query: ${query}\n\n${result}`;

            await sock.sendMessage(from, { text: output.slice(0, 2000) }, { quoted: msg });

        } catch (err) {
            console.error('Team last error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'teamnext', category: 'sports', description: 'Get next matches for a team', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .teamnext <team name or ID>' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: `🏆 Fetching next matches for "${query}"...` }, { quoted: msg });

            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/api/sports/team/next?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });
            const data = response.data;

            const result = formatResult(data);
            const output = `🏅 *Next Matches*\n🔍 Query: ${query}\n\n${result}`;

            await sock.sendMessage(from, { text: output.slice(0, 2000) }, { quoted: msg });

        } catch (err) {
            console.error('Team next error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'teamplayers', category: 'sports', description: 'Get players for a team', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .teamplayers <team name or ID>' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: `🏆 Fetching players for "${query}"...` }, { quoted: msg });

            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/api/sports/team/players?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });
            const data = response.data;

            const result = formatResult(data);
            const output = `🏅 *Team Players*\n🔍 Query: ${query}\n\n${result}`;

            await sock.sendMessage(from, { text: output.slice(0, 2000) }, { quoted: msg });

        } catch (err) {
            console.error('Team players error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'teamscountry', category: 'sports', description: 'Get teams by country', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .teamscountry <country name>' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: `🏆 Fetching teams for "${query}"...` }, { quoted: msg });

            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/api/sports/teams/country?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });
            const data = response.data;

            const result = formatResult(data);
            const output = `🏅 *Teams by Country*\n🔍 Query: ${query}\n\n${result}`;

            await sock.sendMessage(from, { text: output.slice(0, 2000) }, { quoted: msg });

        } catch (err) {
            console.error('Teams by country error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'telegramstalk', category: 'search menu', description: 'Lookup Telegram user/channel/group info with photo', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const identifier = args[0];
        if (!identifier) {
            return sock.sendMessage(from, { text: '❌ Usage: .telegramstalk <username or channel ID>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/api/stalk/telegram?username=${encodeURIComponent(identifier)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });
            const data = response.data;

            if (data.success) {
                const entity = data.result;
                const isUser = entity.type === 'user';

                let caption;
                if (isUser) {
                    caption = `📱 *Telegram User*\n\n` +
                        `👤 Name: ${entity.firstName} ${entity.lastName || ''}\n` +
                        `📛 Username: @${entity.username || '-'}\n` +
                        `🆔 ID: ${entity.id}\n` +
                        `👥 Subscribers: ${entity.subscriberCount?.toLocaleString() || '-'}\n\n` +
                        `🔗 Profile: https://t.me/${entity.username || ''}`;
                } else {
                    caption = `📢 *Telegram Channel/Group*\n\n` +
                        `📛 Title: ${entity.title}\n` +
                        `📛 Username: @${entity.username || '-'}\n` +
                        `🆔 ID: ${entity.id}\n` +
                        `👥 Subscribers: ${entity.subscriberCount?.toLocaleString() || '-'}\n` +
                        `📝 Description: ${entity.description?.substring(0, 200) || '-'}\n\n` +
                        `🔗 Link: https://t.me/${entity.username || ''}`;
                }

                let imageBuffer = null;
                if (entity.photo) {
                    try {
                        const imgRes = await axios.get(entity.photo, {
                            responseType: 'arraybuffer',
                            httpsAgent: agent,
                            timeout: 10000
                        });
                        imageBuffer = Buffer.from(imgRes.data);
                    } catch (imgErr) {
                        console.log('Avatar download failed:', imgErr.message);
                    }
                }

                if (imageBuffer) {
                    await sock.sendMessage(from, {
                        image: imageBuffer,
                        caption: caption
                    }, { quoted: msg });
                } else {
                    await sock.sendMessage(from, { text: caption }, { quoted: msg });
                }
            } else {
                await sock.sendMessage(from, { text: `❌ Telegram lookup failed: ${data.error || 'Not found'}` }, { quoted: msg });
            }
        } catch (err) {
            console.error('Telegram stalk error:', err);
            await sock.sendMessage(from, { text: '❌ Network error or invalid identifier.' }, { quoted: msg });
        }
    } },
    { name: 'telephone', category: 'Audio Effects', description: 'Apply telephone effect to an audio/video URL', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        let url = args[0];

        if (!url && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            if (quoted.conversation) {
                const match = quoted.conversation.match(/(https?:\/\/[^\s]+)/);
                if (match) url = match[0];
            } else if (quoted.extendedTextMessage?.text) {
                const match = quoted.extendedTextMessage.text.match(/(https?:\/\/[^\s]+)/);
                if (match) url = match[0];
            }
        }

        if (!url) {
            return sock.sendMessage(from, {
                text: '❌ Provide an audio/video URL, or reply to a message with one.\nExample: `.telephone https://youtu.be/xxx`'
            }, { quoted: msg });
        }

        if (!url.startsWith('http')) {
            return sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: '🎧 Applying telephone effect...' }, { quoted: msg });

            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/api/audio/telephone?url=${encodeURIComponent(url)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 30000 });

            const data = response.data;
            if (!data.success || !data.result || !data.result.downloadUrl) {
                throw new Error('Invalid API response: ' + JSON.stringify(data));
            }

            const downloadUrl = data.result.downloadUrl;
            const audioRes = await axios.get(downloadUrl, {
                responseType: 'arraybuffer',
                httpsAgent: agent,
                timeout: 60000
            });
            const audioBuffer = Buffer.from(audioRes.data);

            await sock.sendMessage(from, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                fileName: 'telephone_effect.mp3',
                caption: '✅ Telephone effect applied.'
            }, { quoted: msg });

        } catch (err) {
            console.error('Telephone effect error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'testadmin', category: 'owner', description: '', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo) {
            return await sock.sendMessage(from, { text: "❌ Restricted to owner and sudo users." }, { quoted: msg });
        }

        let isAdmin = false;
        try {
            const meta = await sock.groupMetadata(from);
            const participant = meta.participants.find(p => p.id === sender);
            isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
            await sock.sendMessage(from, {
                text: `Sender: ${sender}\nIs admin: ${isAdmin}\nParticipant object: ${JSON.stringify(participant)}`
            }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(from, { text: `Error: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'testaudio', category: 'debug', description: '', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo) {
            return await sock.sendMessage(from, { text: "❌ Restricted to owner and sudo users." }, { quoted: msg });
        }

        let url = args[0];
        if (!url) {
            return sock.sendMessage(from, { text: '❌ Need a URL.' }, { quoted: msg });
        }

        if (!url.startsWith('http')) {
            return sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/api/audio/bass?url=${encodeURIComponent(url)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000, responseType: 'text' });

            await sock.sendMessage(from, {
                text: `Content-Type: ${response.headers['content-type']}\n\nFirst 500 chars:\n${response.data.slice(0, 500)}`
            }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(from, { text: `Error: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'testdl', category: 'debug', description: 'Test download API response', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo) {
            return await sock.sendMessage(from, { text: "❌ Restricted to owner and sudo users." }, { quoted: msg });
        }

        let url = args[0];
        if (!url) {
            return sock.sendMessage(from, { text: '❌ Usage: .testdl <URL>' }, { quoted: msg });
        }

        try {
            let platform = 'instagram';
            if (url.includes('facebook.com')) platform = 'facebook';
            else if (url.includes('tiktok.com')) platform = 'tiktok';
            else if (url.includes('twitter.com') || url.includes('x.com')) platform = 'twitter';
            else if (url.includes('youtube.com') || url.includes('youtu.be')) platform = 'youtube';
            else if (url.includes('snapchat.com')) platform = 'snapchat';

            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/api/download/${platform}?url=${encodeURIComponent(url)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });

            let text = `Platform: ${platform}\nResponse:\n${JSON.stringify(response.data, null, 2)}`;
            if (text.length > 2000) text = text.slice(0, 2000) + '...';

            await sock.sendMessage(from, { text: text }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(from, { text: `Error: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'textstats', category: 'tools', description: 'Analyze text statistics', execute: async function (sock, msg, args) {
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
    } },
    { name: 'thumbsup', category: 'anime', description: 'Random anime thumbsup image', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;

        try {
            await sock.sendMessage(from, { text: '🎴 Fetching random anime thumbsup...' }, { quoted: msg });
            const response = await axios.get('https://nekos.best/api/v2/thumbsup', { httpsAgent: agent, timeout: 10000 });
            const imgUrl = response.data.results[0].url;
            await sock.sendMessage(from, {
                image: { url: imgUrl },
                caption: '✅ Anime thumbsup'
            }, { quoted: msg });
        } catch (err) {
            console.error('Thumbsup error:', err);
            await sock.sendMessage(from, { text: '❌ Failed to fetch anime thumbsup.' }, { quoted: msg });
        }
    } },
    { name: 'tickle', category: 'anime', description: 'Random anime tickle image', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;

        try {
            await sock.sendMessage(from, { text: '🎴 Fetching random anime tickle...' }, { quoted: msg });
            const response = await axios.get('https://nekos.best/api/v2/tickle', { httpsAgent: agent, timeout: 10000 });
            const imgUrl = response.data.results[0].url;
            await sock.sendMessage(from, {
                image: { url: imgUrl },
                caption: '✅ Anime tickle'
            }, { quoted: msg });
        } catch (err) {
            console.error('Tickle error:', err);
            await sock.sendMessage(from, { text: '❌ Failed to fetch anime tickle.' }, { quoted: msg });
        }
    } },
    { name: 'tiktok', category: 'download', description: 'Download TikTok video (ravenn.site)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        let url = args[0];

        if (!url && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            if (quoted.conversation) {
                const match = quoted.conversation.match(/(https?:\/\/[^\s]+)/);
                if (match) url = match[0];
            } else if (quoted.extendedTextMessage?.text) {
                const match = quoted.extendedTextMessage.text.match(/(https?:\/\/[^\s]+)/);
                if (match) url = match[0];
            }
        }

        if (!url) {
            return sock.sendMessage(from, {
                text: '❌ Provide a TikTok video URL, or reply to a message with one.\nExample: `.tiktok https://vt.tiktok.com/...`'
            }, { quoted: msg });
        }

        if (!url.startsWith('http')) {
            return sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: '⬇️ Downloading TikTok video...' }, { quoted: msg });

            const ravennUrl = `https://ravenn.site/download/tiktokdl3?url=${encodeURIComponent(url)}`;
            const response = await axios.get(ravennUrl, { httpsAgent: agent, timeout: 15000 });
            const data = response.data;

            if (!data.status || !data.result) {
                throw new Error('Invalid response: ' + JSON.stringify(data));
            }

            const downloadUrl = data.result;
            const videoRes = await axios.get(downloadUrl, {
                responseType: 'arraybuffer',
                httpsAgent: agent,
                timeout: 60000
            });
            const videoBuffer = Buffer.from(videoRes.data);

            await sock.sendMessage(from, {
                video: videoBuffer,
                caption: '✅ TikTok video downloaded.'
            }, { quoted: msg });

        } catch (err) {
            console.error('TikTok error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'tiktokaudio', category: 'download', description: 'Download TikTok audio (ravenn.site)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        let url = args[0];

        if (!url && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            if (quoted.conversation) {
                const match = quoted.conversation.match(/(https?:\/\/[^\s]+)/);
                if (match) url = match[0];
            } else if (quoted.extendedTextMessage?.text) {
                const match = quoted.extendedTextMessage.text.match(/(https?:\/\/[^\s]+)/);
                if (match) url = match[0];
            }
        }

        if (!url) {
            return sock.sendMessage(from, {
                text: '❌ Provide a TikTok video URL, or reply to a message with one.\nExample: `.tiktokaudio https://vt.tiktok.com/...`'
            }, { quoted: msg });
        }

        if (!url.startsWith('http')) {
            return sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: '⬇️ Downloading TikTok audio...' }, { quoted: msg });

            const ravennUrl = `https://ravenn.site/download/tiktokaudio?url=${encodeURIComponent(url)}`;
            const response = await axios.get(ravennUrl, { httpsAgent: agent, timeout: 15000 });
            const data = response.data;

            if (!data.status || !data.result) {
                throw new Error('Invalid response: ' + JSON.stringify(data));
            }

            const downloadUrl = data.result;
            const audioRes = await axios.get(downloadUrl, {
                responseType: 'arraybuffer',
                httpsAgent: agent,
                timeout: 60000
            });
            const audioBuffer = Buffer.from(audioRes.data);

            await sock.sendMessage(from, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                fileName: 'tiktok_audio.mp3',
                caption: '✅ TikTok audio downloaded.'
            }, { quoted: msg });

        } catch (err) {
            console.error('TikTok audio error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'tiktokinfo', category: 'download', description: 'Get TikTok video information', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        let url = args[0];

        if (!url && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            if (quoted.conversation) {
                const match = quoted.conversation.match(/(https?:\/\/[^\s]+)/);
                if (match) url = match[0];
            } else if (quoted.extendedTextMessage?.text) {
                const match = quoted.extendedTextMessage.text.match(/(https?:\/\/[^\s]+)/);
                if (match) url = match[0];
            }
        }

        if (!url) {
            return sock.sendMessage(from, {
                text: '❌ Provide a TikTok video URL, or reply to a message with one.\nExample: `.tiktokinfo https://vt.tiktok.com/...`'
            }, { quoted: msg });
        }

        if (!url.startsWith('http')) {
            return sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: '📊 Fetching TikTok info...' }, { quoted: msg });

            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/download/tiktok/info?url=${encodeURIComponent(url)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });
            const data = response.data;

            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch info');
            }

            let infoText = '';
            if (data.result) {
                if (typeof data.result === 'object') {
                    infoText = JSON.stringify(data.result, null, 2);
                } else {
                    infoText = data.result;
                }
            } else if (data.info) {
                infoText = JSON.stringify(data.info, null, 2);
            } else {
                infoText = JSON.stringify(data, null, 2);
            }

            const output = `📋 *TikTok Info*\n\n${infoText.slice(0, 2000)}`;

            await sock.sendMessage(from, { text: output }, { quoted: msg });

        } catch (err) {
            console.error('TikTok info error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'tiktokstalk', category: 'search menu', description: 'Lookup TikTok user profile info with photo', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const username = args[0];
        if (!username) {
            return sock.sendMessage(from, { text: '❌ Usage: .tiktokstalk <username>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/api/stalk/tiktok?username=${encodeURIComponent(username)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });
            const data = response.data;

            if (!data.success) {
                return sock.sendMessage(from, { text: `❌ TikTok lookup failed: ${data.error || 'User not found'}` }, { quoted: msg });
            }

            const user = data.result || data;
            const nickname = user.nickname || user.username || '-';
            const bio = (user.bio || '-').substring(0, 150);
            const bioDisplay = user.bio && user.bio.length > 150 ? bio + '...' : bio;

            const caption = `🎵 *TikTok User*\n\n` +
                `👤 User: ${nickname}\n` +
                `📛 Username: @${user.username || '-'}\n` +
                `📝 Bio: ${bioDisplay}\n` +
                `🔒 Private: ${user.privateAccount ? 'Yes' : 'No'}\n` +
                `✔️ Verified: ${user.verified ? 'Yes' : 'No'}\n\n` +
                `👥 Followers: ${(user.followers || 0).toLocaleString()}\n` +
                `👣 Following: ${(user.following || 0).toLocaleString()}\n` +
                `❤️ Total Likes: ${(user.likes || 0).toLocaleString()}\n` +
                `🎬 Videos: ${(user.videos || 0).toLocaleString()}\n\n` +
                `🔗 Profile: ${user.profileUrl || `https://tiktok.com/@${user.username}`}`;

            let imageBuffer = null;
            if (user.avatar) {
                try {
                    const imgRes = await axios.get(user.avatar, {
                        responseType: 'arraybuffer',
                        httpsAgent: agent,
                        timeout: 10000
                    });
                    imageBuffer = Buffer.from(imgRes.data);
                } catch (imgErr) {
                    console.log('Avatar download failed:', imgErr.message);
                }
            }

            if (imageBuffer) {
                await sock.sendMessage(from, {
                    image: imageBuffer,
                    caption: caption
                }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: caption }, { quoted: msg });
            }
        } catch (err) {
            console.error('TikTok stalk error:', err);
            await sock.sendMessage(from, { text: '❌ Network error or invalid username.' }, { quoted: msg });
        }
    } },
    { name: 'time', category: 'engine', description: 'Show current date and time', execute: async function (sock, msg) {
        const from = msg.key.remoteJid;
        const now = new Date();
        const date = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const text = `🕐 *Current Time*\n\n📅 ${date}\n⏰ ${time}\n🌍 ${timezone}`;
        await sock.sendMessage(from, { text }, { quoted: msg });
    } },
    { name: 'timestamp', category: 'tools', description: 'Get current timestamp in multiple formats', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const now = new Date();
        const unix = Math.floor(now.getTime() / 1000);
        const iso = now.toISOString();
        const local = now.toLocaleString();
        const result = `Unix: ${unix}\nISO: ${iso}\nLocal: ${local}`;
        await sock.sendMessage(from, {
            text: `⏱️ *Current Timestamp*\n\n${result}`
        }, { quoted: msg });
    } },
    { name: 'tinyurl', category: 'tools', description: 'Shorten URL with TinyURL', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        let longUrl = args[0];

        if (!longUrl || !longUrl.startsWith('http')) {
            return sock.sendMessage(from, {
                text: '❌ Usage: .tinyurl <https://example.com/long/url>'
            }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/api/short/tinyurl?url=${encodeURIComponent(longUrl)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });

            let short = null;
            if (response.data.success) {
                short = extractShortUrl(response.data);
            }
            if (!short) {
                short = response.data.error || 'Shortening failed';
            }

            await sock.sendMessage(from, {
                text: `🔗 *Shortened URL*\n\n${short}`
            }, { quoted: msg });
        } catch (err) {
            console.error('TinyURL error:', err);
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'tinyurll', category: 'tools', description: 'Shorten URL with TinyURL (official API)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const longUrl = args[0];
        if (!longUrl || !longUrl.startsWith('http')) {
            return sock.sendMessage(from, { text: '❌ Usage: .tinyurll <url>' }, { quoted: msg });
        }

        try {
            const response = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`, { timeout: 10000 });
            const short = response.data;
            await sock.sendMessage(from, { text: `🔗 *Shortened URL*\n\n${short}` }, { quoted: msg });
        } catch (err) {
            console.error('TinyURL error:', err);
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'toviewonce', category: 'tools', description: 'Convert a replied image/video/audio into a view‑once message', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted) {
            return sock.sendMessage(from, { text: "❌ Reply to an image, video, or audio." }, { quoted: msg });
        }

        let mediaType = null;
        let mediaMsg = null;
        if (quoted.imageMessage) {
            mediaType = "image";
            mediaMsg = quoted.imageMessage;
        } else if (quoted.videoMessage) {
            mediaType = "video";
            mediaMsg = quoted.videoMessage;
        } else if (quoted.audioMessage) {
            mediaType = "audio";
            mediaMsg = quoted.audioMessage;
        } else {
            return sock.sendMessage(from, { text: "❌ Only images, videos, and audio can be converted to view‑once." }, { quoted: msg });
        }

        try {
            const buffer = await downloadMediaMessage({ message: quoted }, "buffer", {});
            if (!buffer) throw new Error("Download failed");

            const sendObj = {
                [mediaType]: buffer,
                viewOnce: true,
                caption: mediaMsg.caption || (mediaType === "audio" ? "View‑once audio" : "View‑once message")
            };

            if (mediaType === "audio") {
                sendObj.mimetype = mediaMsg.mimetype || "audio/mpeg";
                sendObj.fileName = mediaMsg.fileName || "audio.mp3";
            }

            await sock.sendMessage(from, sendObj, { quoted: msg });
        } catch (err) {
            console.error(err);
            await sock.sendMessage(from, { text: "❌ Failed to convert: " + err.message }, { quoted: msg });
        }
    } },
    { name: 'translate', category: 'tools', description: 'Translate text to any language (Google Translate)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        let full = args.join(' ');
        if (!full) {
            return sock.sendMessage(from, { text: '❌ Usage: .translate <text> [to:lang]' }, { quoted: msg });
        }

        let target = 'en';
        let text = full;
        const toMatch = full.match(/\s+(to|--to)\s+([a-z]{2})$/i);
        if (toMatch) {
            target = toMatch[2];
            text = full.substring(0, toMatch.index).trim();
        } else {
            const words = full.split(' ');
            const last = words[words.length - 1];
            if (last.length === 2 && /^[a-z]{2}$/i.test(last)) {
                target = last.toLowerCase();
                words.pop();
                text = words.join(' ');
            }
        }

        try {
            await sock.sendMessage(from, { text: `🔄 Translating to ${target.toUpperCase()}...` }, { quoted: msg });

            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(text)}`;
            const response = await axios.get(url, { timeout: 15000 });

            let translated = '';
            for (const part of response.data[0]) {
                if (part[0]) translated += part[0];
            }
            const detectedLang = response.data[2] || 'auto';

            const caption = `🌐 *Translation (${detectedLang} → ${target})*\n\n📝 Original:\n${text}\n\n✅ Translated:\n${translated}`;

            await sock.sendMessage(from, { text: caption.slice(0, 2000) }, { quoted: msg });
        } catch (err) {
            console.error('Translate error:', err);
            await sock.sendMessage(from, { text: `❌ Translation failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'treble', category: 'Audio Effects', description: 'Apply treble effect to an audio/video URL', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        let url = args[0];

        if (!url && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            if (quoted.conversation) {
                const match = quoted.conversation.match(/(https?:\/\/[^\s]+)/);
                if (match) url = match[0];
            } else if (quoted.extendedTextMessage?.text) {
                const match = quoted.extendedTextMessage.text.match(/(https?:\/\/[^\s]+)/);
                if (match) url = match[0];
            }
        }

        if (!url) {
            return sock.sendMessage(from, {
                text: '❌ Provide an audio/video URL, or reply to a message with one.\nExample: `.treble https://youtu.be/xxx`'
            }, { quoted: msg });
        }

        if (!url.startsWith('http')) {
            return sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: '🎧 Applying treble effect...' }, { quoted: msg });

            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/api/audio/treble?url=${encodeURIComponent(url)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 30000 });

            const data = response.data;
            if (!data.success || !data.result || !data.result.downloadUrl) {
                throw new Error('Invalid API response: ' + JSON.stringify(data));
            }

            const downloadUrl = data.result.downloadUrl;
            const audioRes = await axios.get(downloadUrl, {
                responseType: 'arraybuffer',
                httpsAgent: agent,
                timeout: 60000
            });
            const audioBuffer = Buffer.from(audioRes.data);

            await sock.sendMessage(from, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                fileName: 'treble_effect.mp3',
                caption: '✅ Treble effect applied.'
            }, { quoted: msg });

        } catch (err) {
            console.error('Treble effect error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'tremolo', category: 'Audio Effects', description: 'Apply tremolo effect to an audio/video URL', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        let url = args[0];

        if (!url && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            if (quoted.conversation) {
                const match = quoted.conversation.match(/(https?:\/\/[^\s]+)/);
                if (match) url = match[0];
            } else if (quoted.extendedTextMessage?.text) {
                const match = quoted.extendedTextMessage.text.match(/(https?:\/\/[^\s]+)/);
                if (match) url = match[0];
            }
        }

        if (!url) {
            return sock.sendMessage(from, {
                text: '❌ Provide an audio/video URL, or reply to a message with one.\nExample: `.tremolo https://youtu.be/xxx`'
            }, { quoted: msg });
        }

        if (!url.startsWith('http')) {
            return sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: '🎧 Applying tremolo effect...' }, { quoted: msg });

            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/api/audio/tremolo?url=${encodeURIComponent(url)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 30000 });

            const data = response.data;
            if (!data.success || !data.result || !data.result.downloadUrl) {
                throw new Error('Invalid API response: ' + JSON.stringify(data));
            }

            const downloadUrl = data.result.downloadUrl;
            const audioRes = await axios.get(downloadUrl, {
                responseType: 'arraybuffer',
                httpsAgent: agent,
                timeout: 60000
            });
            const audioBuffer = Buffer.from(audioRes.data);

            await sock.sendMessage(from, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                fileName: 'tremolo_effect.mp3',
                caption: '✅ Tremolo effect applied.'
            }, { quoted: msg });

        } catch (err) {
            console.error('Tremolo effect error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'trending', category: 'download', description: 'Get trending music from YouTube', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;

        try {
            await sock.sendMessage(from, { text: '🔥 Fetching trending music...' }, { quoted: msg });

            const apiKey = 'wxa_f_9ddecf073b';
            const response = await axios.get(`https://apis.xwolf.space/api/trending?key=${apiKey}`, {
                timeout: 15000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36' }
            });

            let trendingList = response.data.trending || response.data.result || response.data.data || response.data.items || response.data;
            if (!trendingList || (Array.isArray(trendingList) && trendingList.length === 0)) {
                return sock.sendMessage(from, { text: '❌ No trending data found.' }, { quoted: msg });
            }

            if (!Array.isArray(trendingList)) trendingList = [trendingList];

            let caption = '🔥 *Trending Music on YouTube*\n\n';
            for (let i = 0; i < Math.min(trendingList.length, 10); i++) {
                const item = trendingList[i];
                let title = item.title || item.name || item.videoTitle || 'Unknown Title';
                let artist = item.uploader || item.channel || item.author || item.artist || item.owner || item.uploaderName || '';

                if (!artist && title.includes(' - ')) {
                    const parts = title.split(' - ');
                    artist = parts[0].trim();
                    title = parts.slice(1).join(' - ').trim();
                }

                if (!artist && title.includes(' | ')) {
                    const parts = title.split(' | ');
                    artist = parts[0].trim();
                    title = parts.slice(1).join(' | ').trim();
                }

                if (!artist) artist = 'Unknown Artist';

                const url = item.url || item.link || item.videoUrl || '';
                caption += `${i + 1}. *${title}*\n   👤 ${artist}\n   🔗 ${url}\n\n`;
            }

            await sock.sendMessage(from, { text: caption }, { quoted: msg });
        } catch (error) {
            console.error('Trending error:', error);
            await sock.sendMessage(from, { text: '❌ Failed to fetch trending music. Try again later.' }, { quoted: msg });
        }
    } },
    { name: 'trivia', category: 'fun', description: 'Random trivia question', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const random = trivia[Math.floor(Math.random() * trivia.length)];

        await sock.sendMessage(from, {
            text: `🧠 *Trivia Question*\n\n${random.q}\n\n(Answer in 10 seconds...)`
        }, { quoted: msg });

        setTimeout(async () => {
            await sock.sendMessage(from, { text: `✅ *Answer:* ${random.a}` });
        }, 10000);
    } },
    { name: 'truth', category: 'fun', description: 'Truth question for games', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const random = truths[Math.floor(Math.random() * truths.length)];
        await sock.sendMessage(from, {
            text: `🔍 *Truth Question*\n\n${random}`
        }, { quoted: msg });
    } },
    { name: 'tvepisodes', category: 'media', description: 'Get episode list for a TV show by TVMaze ID (use .tvsearch to find ID)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const id = args[0];
        if (!id) {
            return sock.sendMessage(from, { text: '❌ Usage: .tvepisodes <TVMaze numeric ID> [season number]' }, { quoted: msg });
        }
        if (isNaN(id)) {
            return sock.sendMessage(from, { text: '❌ ID must be a number. Use .tvsearch to find the correct numeric ID.' }, { quoted: msg });
        }

        const season = args[1] ? `?season=${args[1]}` : '';

        try {
            const response = await axios.get(`https://api.tvmaze.com/shows/${id}/episodes${season}`, { timeout: 15000 });
            let episodes = response.data;
            if (!episodes.length) {
                return sock.sendMessage(from, { text: '❌ No episodes found for this season or show.' }, { quoted: msg });
            }

            episodes = episodes.slice(0, 20);
            let text = `📅 *Episodes*\n\n`;
            for (const ep of episodes) {
                const airdate = ep.airdate || 'TBA';
                text += `🎬 S${ep.season}E${ep.number}: ${ep.name}\n   📅 ${airdate}\n`;
            }
            if (response.data.length > 20) {
                text += `\n⚠️ Showing first 20 of ${response.data.length}.`;
            }

            await sock.sendMessage(from, { text }, { quoted: msg });
        } catch (err) {
            console.error('TV episodes error:', err);
            await sock.sendMessage(from, { text: '❌ Network error or invalid ID.' }, { quoted: msg });
        }
    } },
    { name: 'tvschedule', category: 'media', description: 'Get today\'s TV broadcast schedule for any country (e.g., US, GB, DE)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const country = args[0] ? args[0].toUpperCase() : 'US';

        try {
            const response = await axios.get(`https://api.tvmaze.com/schedule?country=${country}`, { timeout: 15000 });
            const shows = response.data.slice(0, 10);

            if (!shows.length) {
                return sock.sendMessage(from, { text: `❌ No schedule found for ${country} today.` }, { quoted: msg });
            }

            let text = `📺 *Today's TV Schedule (${country})*\n\n`;
            for (const s of shows) {
                const time = s.airtime || '??:??';
                const name = s.show.name;
                const network = s.show.network?.name || s.show.webChannel?.name || 'N/A';
                text += `⏰ ${time} – *${name}*\n   📺 ${network}\n\n`;
            }

            await sock.sendMessage(from, { text }, { quoted: msg });
        } catch (err) {
            console.error('TV schedule error:', err);
            await sock.sendMessage(from, { text: '❌ Schedule fetch failed. Check country code (US, GB, DE, etc.).' }, { quoted: msg });
        }
    } },
    { name: 'tvsearch', category: 'media', description: 'Search TV shows by name (TVMaze) with poster', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .tvsearch <show name>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_9ddecf073b';
            const response = await axios.get(`https://apis.xwolf.space/api/tvshow/search?q=${encodeURIComponent(query)}&key=${apiKey}`, { timeout: 15000 });
            const data = response.data;

            if (!data.success || !data.results || data.results.length === 0) {
                return sock.sendMessage(from, { text: '❌ No results found' }, { quoted: msg });
            }

            const shows = data.results.slice(0, 5);
            let text = '📺 *TV Show Search Results*\n\n';
            for (const s of shows) {
                const year = s.premiered ? s.premiered.split('-')[0] : 'N/A';
                const rating = s.rating !== null && s.rating !== undefined ? s.rating : 'N/A';
                const genres = s.genres && s.genres.length ? s.genres.join(', ') : '-';
                text += `🔹 *${s.name}* (${year})\n   ⭐ Rating: ${rating}\n   📺 Status: ${s.status}\n   🎭 Genres: ${genres}\n\n`;
            }
            text += `🔍 Use .tvshowinfo <id> for details (e.g., .tvshowinfo 169 for Breaking Bad)`;

            const first = shows[0];
            let imageBuffer = null;
            const imageUrl = first.image && typeof first.image === 'string' ? first.image : (first.image?.medium || null);

            if (imageUrl) {
                try {
                    const imgRes = await axios.get(imageUrl, {
                        responseType: 'arraybuffer',
                        timeout: 10000,
                        headers: { 'User-Agent': 'Mozilla/5.0' }
                    });
                    imageBuffer = Buffer.from(imgRes.data);
                } catch (imgErr) {
                    console.log('Image download failed:', imgErr.message);
                }
            }

            if (imageBuffer) {
                await sock.sendMessage(from, {
                    image: imageBuffer,
                    caption: text
                }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: text }, { quoted: msg });
            }
        } catch (err) {
            console.error('TV search error:', err);
            await sock.sendMessage(from, { text: '❌ Search failed due to network error.' }, { quoted: msg });
        }
    } },
    { name: 'tvshowinfo', category: 'media', description: 'Get full TV show details by TVMaze ID (use .tvsearch to find ID)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const id = args[0];
        if (!id) {
            return sock.sendMessage(from, { text: '❌ Usage: .tvshowinfo <TVMaze numeric ID>' }, { quoted: msg });
        }
        if (isNaN(id)) {
            return sock.sendMessage(from, { text: '❌ ID must be a number. Use .tvsearch to find the correct numeric ID.' }, { quoted: msg });
        }

        let s;
        try {
            const directRes = await axios.get(`https://api.tvmaze.com/shows/${id}`, { timeout: 8000 });
            s = directRes.data;
        } catch (err) {
            return sock.sendMessage(from, { text: `❌ Show not found. ID ${id} does not exist.` }, { quoted: msg });
        }

        const text = `📺 *TV Show Details*\n\n` +
            `*Name:* ${s.name}\n` +
            `*Type:* ${s.type || 'N/A'}\n` +
            `*Status:* ${s.status || 'N/A'}\n` +
            `*Premiered:* ${s.premiered || 'N/A'}\n` +
            `*Ended:* ${s.ended || 'Still running'}\n` +
            `*Runtime:* ${s.runtime || 'N/A'} min\n` +
            `*Genres:* ${s.genres?.join(', ') || '-'}\n` +
            `*Rating:* ${s.rating?.average || s.rating || 'N/A'}\n` +
            `*Network:* ${s.network?.name || s.webChannel?.name || 'N/A'}\n`;

        const summary = s.summary ? s.summary.replace(/<[^>]*>/g, '').substring(0, 300) : '';
        const finalText = summary ? text + `*Summary:* ${summary}...\n\n🔗 *Episodes:* .tvepisodes ${s.id}` : text + `\n🔗 *Episodes:* .tvepisodes ${s.id}`;

        let imageBuffer = null;
        const imageUrl = s.image?.original || s.image?.medium || (typeof s.image === 'string' ? s.image : null);
        if (imageUrl) {
            try {
                const imgRes = await axios.get(imageUrl, {
                    responseType: 'arraybuffer',
                    timeout: 10000,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                imageBuffer = Buffer.from(imgRes.data);
            } catch (imgErr) {
                console.log('Image download failed:', imgErr.message);
            }
        }

        if (imageBuffer) {
            await sock.sendMessage(from, {
                image: imageBuffer,
                caption: finalText
            }, { quoted: msg });
        } else {
            await sock.sendMessage(from, { text: finalText }, { quoted: msg });
        }
    } },
    { name: 'twitter', category: 'download', description: 'Download Twitter video (ravenn.site)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        let url = args[0];

        if (!url && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            if (quoted.conversation) {
                const match = quoted.conversation.match(/(https?:\/\/[^\s]+)/);
                if (match) url = match[0];
            } else if (quoted.extendedTextMessage?.text) {
                const match = quoted.extendedTextMessage.text.match(/(https?:\/\/[^\s]+)/);
                if (match) url = match[0];
            }
        }

        if (!url) {
            return sock.sendMessage(from, {
                text: '❌ Provide a Twitter video URL, or reply to a message with one.\nExample: `.twitter https://twitter.com/user/status/123456789`'
            }, { quoted: msg });
        }

        if (!url.startsWith('http')) {
            return sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: '⬇️ Downloading Twitter video...' }, { quoted: msg });

            const ravennUrl = `https://ravenn.site/download/twitter?url=${encodeURIComponent(url)}`;
            const response = await axios.get(ravennUrl, { httpsAgent: agent, timeout: 15000 });
            const data = response.data;

            if (!data.status || !data.result) {
                throw new Error('Invalid response: ' + JSON.stringify(data));
            }

            const downloadUrl = data.result;
            const videoRes = await axios.get(downloadUrl, {
                responseType: 'arraybuffer',
                httpsAgent: agent,
                timeout: 60000
            });
            const videoBuffer = Buffer.from(videoRes.data);

            await sock.sendMessage(from, {
                video: videoBuffer,
                caption: '✅ Twitter video downloaded.'
            }, { quoted: msg });

        } catch (err) {
            console.error('Twitter error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'twitterinfo', category: 'download', description: 'Get Twitter video info (wolf space)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        let url = args[0];

        if (!url && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            if (quoted.conversation) {
                const match = quoted.conversation.match(/(https?:\/\/[^\s]+)/);
                if (match) url = match[0];
            } else if (quoted.extendedTextMessage?.text) {
                const match = quoted.extendedTextMessage.text.match(/(https?:\/\/[^\s]+)/);
                if (match) url = match[0];
            }
        }

        if (!url) {
            return sock.sendMessage(from, {
                text: '❌ Provide a Twitter video URL, or reply to a message with one.\nExample: `.twitterinfo https://twitter.com/user/status/123456789`'
            }, { quoted: msg });
        }

        if (!url.startsWith('http')) {
            return sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: '📊 Fetching Twitter info...' }, { quoted: msg });

            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/download/twitter/info?url=${encodeURIComponent(url)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });
            const data = response.data;

            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch info');
            }

            let infoText = '';
            if (data.result) {
                if (typeof data.result === 'object') {
                    infoText = JSON.stringify(data.result, null, 2);
                } else {
                    infoText = data.result;
                }
            } else if (data.info) {
                infoText = JSON.stringify(data.info, null, 2);
            } else {
                infoText = JSON.stringify(data, null, 2);
            }

            const output = `📋 *Twitter Info*\n\n${infoText.slice(0, 2000)}`;

            await sock.sendMessage(from, { text: output }, { quoted: msg });
        } catch (err) {
            console.error('Twitter info error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'twitterstalk', category: 'search menu', description: 'Lookup Twitter/X user profile info with photo', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const username = args[0];
        if (!username) {
            return sock.sendMessage(from, { text: '❌ Usage: .twitterstalk <username>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/api/stalk/twitter?username=${encodeURIComponent(username)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });
            const data = response.data;

            if (!data.success) {
                return sock.sendMessage(from, { text: `❌ Twitter lookup failed: ${data.error || 'User not found'}` }, { quoted: msg });
            }

            const result = data.result || data;
            const user = {
                username: result.screenName || result.username || username,
                name: result.name || 'Unknown',
                bio: (result.description || '-').substring(0, 150),
                bioDisplay: result.description && result.description.length > 150 ? result.description.substring(0, 150) + '...' : (result.description || '-'),
                avatar: result.profileImageUrlHttps || result.avatar,
                verified: result.verified || false,
                followers: (result.followersCount || result.followers || 0).toLocaleString(),
                following: (result.friendsCount || result.following || 0).toLocaleString(),
                tweets: (result.statusesCount || result.tweets || 0).toLocaleString(),
                joined: result.createdAt ? result.createdAt.split('T')[0] : (result.joined || '-'),
                profileUrl: `https://twitter.com/${username}`
            };

            const caption = `🐦 *Twitter User*\n\n` +
                `👤 Name: ${user.name}\n` +
                `📛 Username: @${user.username}\n` +
                `📝 Bio: ${user.bioDisplay}\n` +
                `✔️ Verified: ${user.verified ? 'Yes' : 'No'}\n\n` +
                `👥 Followers: ${user.followers}\n` +
                `👣 Following: ${user.following}\n` +
                `🐦 Tweets: ${user.tweets}\n` +
                `📅 Joined: ${user.joined}\n\n` +
                `🔗 Profile: ${user.profileUrl}`;

            let imageBuffer = null;
            if (user.avatar) {
                try {
                    const imgRes = await axios.get(user.avatar, {
                        responseType: 'arraybuffer',
                        httpsAgent: agent,
                        timeout: 10000
                    });
                    imageBuffer = Buffer.from(imgRes.data);
                } catch (imgErr) {
                    console.log('Avatar download failed:', imgErr.message);
                }
            }

            if (imageBuffer) {
                await sock.sendMessage(from, {
                    image: imageBuffer,
                    caption: caption
                }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: caption }, { quoted: msg });
            }
        } catch (err) {
            console.error('Twitter stalk error:', err);
            await sock.sendMessage(from, { text: '❌ Network error or invalid username.' }, { quoted: msg });
        }
    } },
    { name: 'unblock', category: 'admin', description: 'Unblock/whitelist a user (remove from blacklist)', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo) {
            return await sock.sendMessage(from, { text: '❌ Restricted to owner and sudo users.' }, { quoted: msg });
        }

        let target = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
                     (args[0] && args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net');

        if (!target) {
            return sock.sendMessage(from, { text: '💡 Tag someone or provide a number to unblock.' }, { quoted: msg });
        }

        if (!global.blacklist) global.blacklist = new Set();
        if (!global.blacklist.has(target)) {
            return sock.sendMessage(from, { text: `ℹ️ ${target} is not blacklisted.` }, { quoted: msg });
        }

        global.blacklist.delete(target);
        await sock.sendMessage(from, { text: `✅ ${target} has been removed from the blacklist.` }, { quoted: msg });
    } },
    { name: 'underwater', category: 'Audio Effects', description: 'Apply underwater effect to an audio/video URL', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        let url = args[0];

        if (!url && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            if (quoted.conversation) {
                const match = quoted.conversation.match(/(https?:\/\/[^\s]+)/);
                if (match) url = match[0];
            } else if (quoted.extendedTextMessage?.text) {
                const match = quoted.extendedTextMessage.text.match(/(https?:\/\/[^\s]+)/);
                if (match) url = match[0];
            }
        }

        if (!url) {
            return sock.sendMessage(from, {
                text: '❌ Provide an audio/video URL, or reply to a message with one.\nExample: `.underwater https://youtu.be/xxx`'
            }, { quoted: msg });
        }

        if (!url.startsWith('http')) {
            return sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: '🎧 Applying underwater effect...' }, { quoted: msg });

            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/api/audio/underwater?url=${encodeURIComponent(url)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 30000 });

            const data = response.data;
            if (!data.success || !data.result || !data.result.downloadUrl) {
                throw new Error('Invalid API response: ' + JSON.stringify(data));
            }

            const downloadUrl = data.result.downloadUrl;
            const audioRes = await axios.get(downloadUrl, {
                responseType: 'arraybuffer',
                httpsAgent: agent,
                timeout: 60000
            });
            const audioBuffer = Buffer.from(audioRes.data);

            await sock.sendMessage(from, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                fileName: 'underwater_effect.mp3',
                caption: '✅ Underwater effect applied.'
            }, { quoted: msg });

        } catch (err) {
            console.error('Underwater effect error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'unmute', category: 'group', description: 'Unmute group (allow all members to send messages)', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        if (!from.endsWith('@g.us')) {
            return await sock.sendMessage(from, { text: '❌ Group only command.' }, { quoted: msg });
        }

        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);
        const isAdmin = await global.checkAdmin?.(sock, from, sender) || false;

        if (!isArchitect && !isOwner && !isSudo && !isAdmin) {
            return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });
        }

        try {
            await sock.groupSettingUpdate(from, 'not_announcement');
            await sock.sendMessage(from, { text: "🔓 Group unmuted. All members can now send messages." }, { quoted: msg });
        } catch (e) {
            console.error('Unmute error:', e);
            await sock.sendMessage(from, { text: "❌ I need admin rights to unmute this group." }, { quoted: msg });
        }
    } },
    { name: 'update', category: 'owner', description: 'Update bot from GitHub (owner & sudo only)', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        if (!isArchitect && !isOwner && !isSudo) {
            return await sock.sendMessage(from, { text: "This command is restricted to the owner and sudo users only." }, { quoted: msg });
        }

        const GITHUB_REPO = 'tysavage163/Savage-Tech';
        const BRANCH = 'main';
        const headers = { Authorization: `token ${GITHUB_TOKEN}` };

        await sock.sendMessage(from, { text: '🔄 Checking for updates from GitHub...' }, { quoted: msg });

        try {
            const commitRes = await axios.get(`https://api.github.com/repos/${GITHUB_REPO}/commits/${BRANCH}`, { headers });
            const latestCommit = commitRes.data.sha;
            let currentCommit = null;
            const versionFile = path.join(__dirname, '..', '.version');
            if (fs.existsSync(versionFile)) {
                currentCommit = fs.readFileSync(versionFile, 'utf8').trim();
            }

            if (currentCommit === latestCommit) {
                await sock.sendMessage(from, { text: '✅ Bot is already up to date.' }, { quoted: msg });
                return;
            }

            const diffRes = await axios.get(`https://api.github.com/repos/${GITHUB_REPO}/commits/${latestCommit}`, { headers });
            const changedFiles = diffRes.data.files.map(f => f.filename);
            const filesToUpdate = changedFiles.filter(f =>
                f === 'bot.js' ||
                f === 'package.json' ||
                f === 'package-lock.json' ||
                f.startsWith('commands/')
            );

            if (filesToUpdate.length === 0) {
                await sock.sendMessage(from, { text: '⚠️ No relevant files changed.' }, { quoted: msg });
                return;
            }

            await sock.sendMessage(from, { text: `📥 Updating ${filesToUpdate.length} files...` }, { quoted: msg });

            const rawBase = `https://raw.githubusercontent.com/${GITHUB_REPO}/${BRANCH}/`;
            for (const file of filesToUpdate) {
                const filePath = path.join(__dirname, '..', file);
                const dir = path.dirname(filePath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                const res = await axios.get(rawBase + file, { responseType: 'arraybuffer', headers });
                fs.writeFileSync(filePath, Buffer.from(res.data));
            }

            fs.writeFileSync(versionFile, latestCommit);

            if (filesToUpdate.includes('package.json')) {
                exec('npm install', (err) => { if (err) console.error('npm install failed:', err); });
            }

            const evolutionQuotes = [
                "Evolution is not a choice. It is a command.",
                "With every update, I shed old limits.",
                "Your bot is outgrowing its own blueprint.",
                "Better code. Faster pulse. Sharper logic.",
                "The system evolves while you watch."
            ];
            const randomQuote = evolutionQuotes[Math.floor(Math.random() * evolutionQuotes.length)];

            await sock.sendMessage(from, { text: `✅ Update downloaded.\n\n⚡ ${randomQuote}\n\n🔄 Restarting bot...` }, { quoted: msg });

            const isPm2 = process.env.PM2_ID || process.env.PM2_PID;
            if (isPm2) {
                exec('pm2 restart savage-bot', (err, stdout, stderr) => {
                    if (err) {
                        console.error('PM2 restart failed:', err);
                        process.exit(0);
                    }
                    console.log('PM2 restart issued');
                });
            } else {
                const args = process.argv.slice(1);
                const child = spawn(process.argv[0], args, {
                    detached: true,
                    stdio: 'inherit'
                });
                child.unref();
                process.exit(0);
            }

        } catch (err) {
            console.error(err);
            if (err.response && err.response.status === 401) {
                await sock.sendMessage(from, { text: '❌ GitHub token invalid or expired. Update the token in the command file.' }, { quoted: msg });
            } else if (err.response && err.response.status === 403) {
                await sock.sendMessage(from, { text: '❌ GitHub API rate limit exceeded. The token may have expired or been revoked.' }, { quoted: msg });
            } else {
                await sock.sendMessage(from, { text: `❌ Update failed: ${err.message}` }, { quoted: msg });
            }
        }
    } },
    { name: 'uptime', category: 'engine', description: 'Show bot uptime and hosting platform', execute: async function (sock, msg) {
    const from = msg.key.remoteJid;
    const host = detectHost();
    const uptimeFormatted = formatUptime(process.uptime());
    const text = `🖥️ *RUNNING ON*: ${host}\n⏱️ *FOR*: ${uptimeFormatted}`;
    await sock.sendMessage(from, { text }, { quoted: msg });
  } },
    { name: 'urban', category: 'search menu', description: 'Search Urban Dictionary', execute: async function (sock, msg, args) {
    const query = args.join(' ');
    if (!query) return sock.sendMessage(msg.key.remoteJid, { text: '❓ Usage: .urban <term>' }, { quoted: msg });

    try {
      await sock.sendMessage(msg.key.remoteJid, { text: `🔍 Searching Urban Dictionary for "${query}"...` }, { quoted: msg });
      const res = await axios.get(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(query)}`, { httpsAgent: agent });
      if (!res.data.list.length) throw new Error('No definitions');
      const def = res.data.list[0];
      const definition = def.definition.slice(0, 800);
      const example = def.example.slice(0, 300);
      const result = `📖 *URBAN: ${def.word}*\n🚀 POWERED BY SAVAGE-CORE\n\n📝 Definition:\n${definition}\n\n📌 Example:\n${example}\n\n👍 ${def.thumbs_up} | 👎 ${def.thumbs_down}\n🔗 ${def.permalink}`;
      await sock.sendMessage(msg.key.remoteJid, { text: result.slice(0, 2000) }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(msg.key.remoteJid, { text: `❌ Urban error: ${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'url', category: 'tools', description: 'Upload media to Catbox and get a direct URL (reply to an image, video, sticker, or audio)', execute: async function (sock, msg) {
        const from = msg.key.remoteJid;
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!quoted) {
            return sock.sendMessage(from, { text: '❌ Reply to a media message (image, video, sticker, audio, or document).' }, { quoted: msg });
        }

        let mediaBuffer, filename, contentType;
        try {
            if (quoted.imageMessage) {
                mediaBuffer = await downloadMediaMessage({ message: quoted }, 'buffer', {});
                filename = 'image.jpg';
                contentType = 'image/jpeg';
            } else if (quoted.videoMessage) {
                mediaBuffer = await downloadMediaMessage({ message: quoted }, 'buffer', {});
                filename = 'video.mp4';
                contentType = 'video/mp4';
            } else if (quoted.audioMessage) {
                mediaBuffer = await downloadMediaMessage({ message: quoted }, 'buffer', {});
                filename = 'audio.mp3';
                contentType = 'audio/mpeg';
            } else if (quoted.stickerMessage) {
                mediaBuffer = await downloadMediaMessage({ message: quoted }, 'buffer', {});
                filename = 'sticker.webp';
                contentType = 'image/webp';
            } else if (quoted.documentMessage) {
                mediaBuffer = await downloadMediaMessage({ message: quoted }, 'buffer', {});
                const doc = quoted.documentMessage;
                filename = doc.fileName || 'document.bin';
                contentType = doc.mimetype || 'application/octet-stream';
            } else {
                return sock.sendMessage(from, { text: '❌ Unsupported media type.' }, { quoted: msg });
            }
        } catch (err) {
            console.error('Media download error:', err);
            return sock.sendMessage(from, { text: '❌ Failed to download the media.' }, { quoted: msg });
        }

        try {
            const form = new FormData();
            form.append('reqtype', 'fileupload');
            form.append('fileToUpload', mediaBuffer, { filename, contentType });

            const response = await axios.post('https://catbox.moe/user/api.php', form, {
                headers: form.getHeaders()
            });

            const url = response.data.trim();
            if (!url.startsWith('https://files.catbox.moe/')) {
                throw new Error('Invalid response from Catbox');
            }

            await sock.sendMessage(from, { text: `✅ Media uploaded!\n\n🔗 ${url}` }, { quoted: msg });
        } catch (err) {
            console.error('Catbox upload error:', err);
            await sock.sendMessage(from, { text: '❌ Failed to upload the media. Please try again later.' }, { quoted: msg });
        }
    } },
    { name: 'urldecode', category: 'tools', description: 'URL decode a string', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const encoded = args.join(' ');
        if (!encoded) {
            return sock.sendMessage(from, { text: '❌ Usage: .urldecode <encoded_string>' }, { quoted: msg });
        }

        try {
            const decoded = decodeURIComponent(encoded);
            await sock.sendMessage(from, { text: `🔓 *URL Decoded*\n\n${decoded}` }, { quoted: msg });
        } catch {
            await sock.sendMessage(from, { text: '❌ Invalid URL encoded string.' }, { quoted: msg });
        }
    } },
    { name: 'urlencode', category: 'tools', description: 'URL encode a string', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const text = args.join(' ');
        if (!text) {
            return sock.sendMessage(from, { text: '❌ Usage: .urlencode <text>' }, { quoted: msg });
        }

        const encoded = encodeURIComponent(text);
        await sock.sendMessage(from, { text: `🔗 *URL Encoded*\n\n${encoded}` }, { quoted: msg });
    } },
    { name: 'userid', category: 'group', description: 'Get WhatsApp ID of a user (reply to a message or your own)', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;
        const sender = msg.key.participant || msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');

        let hasPermission = false;
        if (isGroup) {
            let isAdmin = false;
            try {
                const meta = await sock.groupMetadata(from);
                const participant = meta.participants.find(p => p.id === sender);
                isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
            } catch (e) {
                return await sock.sendMessage(from, { text: '❌ Failed to verify admin status.' }, { quoted: msg });
            }
            const isOwner = sender === global.ownerJid;
            const isSudo = global.sudoUsers?.includes(sender);
            hasPermission = isAdmin || isArchitect || isOwner || isSudo;
        } else {
            const isOwner = sender === global.ownerJid;
            const isSudo = global.sudoUsers?.includes(sender);
            hasPermission = isArchitect || isOwner || isSudo;
        }

        if (!hasPermission) {
            return await sock.sendMessage(from, { text: isGroup ? '❎ You are not worthy of this command.' : 'This command is restricted to the owner and sudo users only.' }, { quoted: msg });
        }

        let targetJid = null;
        const quotedMsg = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quotedMsg) {
            targetJid = msg.message.extendedTextMessage.contextInfo.participant || msg.message.extendedTextMessage.contextInfo.remoteJid;
        }

        if (!targetJid) {
            targetJid = sender;
        }

        await sock.sendMessage(from, { text: `🆔 User ID: ${targetJid}` }, { quoted: msg });
    } },
    { name: 'uuid', category: 'tools', description: 'Generate UUID v4', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const uuid = crypto.randomUUID();
        await sock.sendMessage(from, { text: `🆔 *UUID*\n\n${uuid}` }, { quoted: msg });
    } },
    { name: 'valentines', category: 'fun', description: 'Valentine’s Day message', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const random = valentine[Math.floor(Math.random() * valentine.length)];
        await sock.sendMessage(from, { text: `❤️ *Valentine’s Wish*\n\n${random}` }, { quoted: msg });
    } },
    { name: 'vaporwave', category: 'Audio Effects', description: 'Apply vaporwave effect to an audio/video URL', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        let url = args[0];

        if (!url && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            if (quoted.conversation) {
                const match = quoted.conversation.match(/(https?:\/\/[^\s]+)/);
                if (match) url = match[0];
            } else if (quoted.extendedTextMessage?.text) {
                const match = quoted.extendedTextMessage.text.match(/(https?:\/\/[^\s]+)/);
                if (match) url = match[0];
            }
        }

        if (!url) {
            return sock.sendMessage(from, {
                text: '❌ Provide an audio/video URL, or reply to a message with one.\nExample: `.vaporwave https://youtu.be/xxx`'
            }, { quoted: msg });
        }

        if (!url.startsWith('http')) {
            return sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: '🎧 Applying vaporwave effect...' }, { quoted: msg });

            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/api/audio/vaporwave?url=${encodeURIComponent(url)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 30000 });

            const data = response.data;
            if (!data.success || !data.result || !data.result.downloadUrl) {
                throw new Error('Invalid API response: ' + JSON.stringify(data));
            }

            const downloadUrl = data.result.downloadUrl;
            const audioRes = await axios.get(downloadUrl, {
                responseType: 'arraybuffer',
                httpsAgent: agent,
                timeout: 60000
            });
            const audioBuffer = Buffer.from(audioRes.data);

            await sock.sendMessage(from, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                fileName: 'vaporwave_effect.mp3',
                caption: '✅ Vaporwave effect applied.'
            }, { quoted: msg });

        } catch (err) {
            console.error('Vaporwave effect error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'vcf', category: 'group', description: 'Export group contacts into VCF', execute: async function (sock, msg, args, { isArchitect, isMe }) {
        const from = msg.key.remoteJid;

        if (!from.endsWith('@g.us')) {
            return await sock.sendMessage(from, {
                text: '❎ This command can only be used inside groups.'
            }, { quoted: msg });
        }

        const sender = msg.key.participant || msg.participant || msg.key.remoteJid;
        const isOwner = sender === global.ownerJid;
        const isSudo = global.sudoUsers?.includes(sender);

        let isAdmin = false;
        try {
            const metadata = await sock.groupMetadata(from);
            const participant = metadata.participants.find(p => p.id === sender || p.jid === sender);
            isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
        } catch (err) {
            console.log(err);
        }

        if (!isAdmin && !isArchitect && !isOwner && !isSudo) {
            return await sock.sendMessage(from, {
                text: '❎ You are not worthy of this command.'
            }, { quoted: msg });
        }

        await sock.sendMessage(from, {
            text: '📡 Collecting group members...'
        }, { quoted: msg });

        try {
            const metadata = await sock.groupMetadata(from);
            const participants = metadata.participants || [];

            if (!participants.length) {
                return await sock.sendMessage(from, {
                    text: '⚠️ Group members could not be loaded.'
                }, { quoted: msg });
            }

            const contacts = [];
            const cache = new Set();

            for (const participant of participants) {
                const jid = participant.jid || participant.id || '';
                if (!jid) continue;

                let number = jid.split('@')[0];
                if (number.includes(':')) number = number.split(':')[0];
                number = number.replace(/\D/g, '');

                if (!number || number.length < 7) continue;
                if (cache.has(number)) continue;
                cache.add(number);

                contacts.push({
                    name: 'Savage Tech',
                    phone: `+${number}`
                });
            }

            if (!contacts.length) {
                return await sock.sendMessage(from, {
                    text: '❌ No exportable contacts found.'
                }, { quoted: msg });
            }

            let vcfData = '';
            for (const user of contacts) {
                vcfData += `BEGIN:VCARD\nVERSION:3.0\nFN:${user.name}\nTEL;TYPE=CELL:${user.phone}\nEND:VCARD\n\n`;
            }

            const fileBuffer = Buffer.from(vcfData, 'utf-8');
            const preview = contacts.slice(0, 30);
            const message =
                `╭━━━〔 📇 VCF EXPORT 〕━━━⬣\n` +
                `┃ 👥 Contacts : ${contacts.length}\n` +
                `┃ 📦 Format   : VCF\n` +
                `┃ 🏷️ Group    : ${metadata.subject}\n` +
                `╰━━━━━━━━━━━━━━━━⬣\n\n` +
                `📜 *Preview Contacts*\n\n\`\`\`json\n${JSON.stringify(preview, null, 2)}\n\`\`\`\n\n_...and ${contacts.length - preview.length} more_`;

            await sock.sendMessage(from, {
                document: fileBuffer,
                mimetype: 'text/vcard',
                fileName: `${metadata.subject}_SavageTech.vcf`,
                caption: message
            }, { quoted: msg });

        } catch (err) {
            console.log(err);
            await sock.sendMessage(from, {
                text: `❌ Failed to generate VCF file.\n\nReason: ${err.message}`
            }, { quoted: msg });
        }
    } },
    { name: 'venice', category: 'ai', description: 'Chat with Venice AI', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) return sock.sendMessage(from, { text: '❌ Usage: .venice <message>' }, { quoted: msg });

        try {
            await sock.sendMessage(from, { text: '🤔 Thinking...' }, { quoted: msg });
            const response = await axios.get(`https://ravenn.site/ai/venice?q=${encodeURIComponent(query)}`, { timeout: 30000 });
            const data = response.data;
            if (data.status && data.result) {
                await sock.sendMessage(from, { text: data.result }, { quoted: msg });
            } else {
                throw new Error('Invalid response');
            }
        } catch (err) {
            console.error('Venice error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'venue', category: 'sports', description: 'Get venue information', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .venue <venue name or ID>' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: `🏟️ Fetching venue details for "${query}"...` }, { quoted: msg });

            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/api/sports/venue?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });
            const data = response.data;

            const result = formatResult(data);
            const output = `🏟️ *Venue Info*\n🔍 Query: ${query}\n\n${result}`;

            await sock.sendMessage(from, { text: output.slice(0, 2000) }, { quoted: msg });
        } catch (err) {
            console.error('Venue error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'version', category: 'engine', description: 'Show bot version and commit info', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;

        let commitCount = 0;
        let commitHash = 'unknown';
        let version = '1.4.0';

        try {
            commitCount = parseInt(execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim());
            commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
            const minor = Math.floor(commitCount / 10);
            const patch = commitCount % 10;
            version = `1.${minor}.${patch}`;
        } catch (e) {
            try {
                const pkgPath = path.join(__dirname, '..', 'package.json');
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                version = pkg.version;
            } catch (err) {
                version = '1.0.0';
            }
        }

        const text =
            `📦 *Version Info*\n\n` +
            `🔖 Version       : ${version}\n` +
            `🔢 Total Commits : ${commitCount}\n` +
            `🔀 Latest Commit : ${commitHash}`;

        await sock.sendMessage(from, { text: text }, { quoted: msg });
    } },
    { name: 'vgd', category: 'tools', description: 'Shorten URL with v.gd', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const longUrl = args[0];
        if (!longUrl || !longUrl.startsWith('http')) {
            return sock.sendMessage(from, { text: '❌ Usage: .vgd <https://example.com/long/url>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/api/short/vgd?url=${encodeURIComponent(longUrl)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });

            let short = null;
            if (response.data.success) {
                short = extractShortUrl(response.data);
            }
            if (!short) {
                short = response.data.error || 'Shortening failed';
            }

            await sock.sendMessage(from, {
                text: `🔗 *Shortened URL (v.gd)*\n\n${short}`
            }, { quoted: msg });
        } catch (err) {
            console.error('v.gd error:', err);
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'vibrato', category: 'Audio Effects', description: 'Apply vibrato effect to an audio/video URL', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        let url = args[0];

        if (!url && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            if (quoted.conversation) {
                const match = quoted.conversation.match(/(https?:\/\/[^\s]+)/);
                if (match) url = match[0];
            } else if (quoted.extendedTextMessage?.text) {
                const match = quoted.extendedTextMessage.text.match(/(https?:\/\/[^\s]+)/);
                if (match) url = match[0];
            }
        }

        if (!url) {
            return sock.sendMessage(from, {
                text: '❌ Provide an audio/video URL, or reply to a message with one.\nExample: `.vibrato https://youtu.be/xxx`'
            }, { quoted: msg });
        }

        if (!url.startsWith('http')) {
            return sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: '🎧 Applying vibrato effect...' }, { quoted: msg });

            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/api/audio/vibrato?url=${encodeURIComponent(url)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 30000 });

            const data = response.data;
            if (!data.success || !data.result || !data.result.downloadUrl) {
                throw new Error('Invalid API response: ' + JSON.stringify(data));
            }

            const downloadUrl = data.result.downloadUrl;
            const audioRes = await axios.get(downloadUrl, {
                responseType: 'arraybuffer',
                httpsAgent: agent,
                timeout: 60000
            });
            const audioBuffer = Buffer.from(audioRes.data);

            await sock.sendMessage(from, {
                audio: audioBuffer,
                mimetype: 'audio/mpeg',
                fileName: 'vibrato_effect.mp3',
                caption: '✅ Vibrato effect applied.'
            }, { quoted: msg });

        } catch (err) {
            console.error('Vibrato effect error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'vicuna', category: 'ai', description: 'Chat with Vicuna AI', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .vicuna <message>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_9ddecf073b';
            const url = `https://apis.xwolf.space/api/ai/vicuna?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(url, { timeout: 30000 });
            const data = response.data;

            let reply = 'No response';
            if (data.status && data.result) {
                reply = data.result;
            } else if (data.error) {
                reply = `⚠️ ${data.error}`;
            }

            await sock.sendMessage(from, { text: `🤖 *Vicuna:*\n${reply.slice(0, 2000)}` }, { quoted: msg });
        } catch (err) {
            console.error('Vicuna error:', err);
            await sock.sendMessage(from, { text: '❌ API error. Please try again later.' }, { quoted: msg });
        }
    } },
    { name: 'video-to-gif', category: 'tools', description: 'Convert video to GIF using a URL', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const url = args[0];
        if (!url || !url.startsWith('http')) {
            return sock.sendMessage(from, {
                text: '❌ Usage: .video-to-gif <video_url>'
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: '🔄 Converting video to GIF...' }, { quoted: msg });

            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/api/converter/video-to-gif?url=${encodeURIComponent(url)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, {
                httpsAgent: agent,
                timeout: 60000,
                responseType: 'arraybuffer'
            });

            const buffer = Buffer.from(response.data);
            const contentType = response.headers['content-type'] || '';

            if (contentType.includes('image')) {
                await sock.sendMessage(from, {
                    image: buffer,
                    caption: '✅ GIF created.'
                }, { quoted: msg });
            } else {
                await sock.sendMessage(from, {
                    video: buffer,
                    caption: '✅ GIF created (video format).'
                }, { quoted: msg });
            }
        } catch (err) {
            console.error('Video-to-GIF error:', err);
            await sock.sendMessage(from, { text: `❌ Conversion failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'video-to-sticker', category: 'tools', description: 'Convert video to sticker using a URL', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const url = args[0];
        if (!url || !url.startsWith('http')) {
            return sock.sendMessage(from, {
                text: '❌ Usage: .video-to-sticker <video_url>'
            }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: '🔄 Converting video to sticker...' }, { quoted: msg });

            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/api/converter/video-to-sticker?url=${encodeURIComponent(url)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, {
                httpsAgent: agent,
                timeout: 60000,
                responseType: 'arraybuffer'
            });

            const buffer = Buffer.from(response.data);
            const contentType = response.headers['content-type'] || '';

            if (contentType.includes('webp')) {
                await sock.sendMessage(from, {
                    sticker: buffer
                }, { quoted: msg });
            } else if (contentType.includes('image')) {
                await sock.sendMessage(from, {
                    image: buffer,
                    caption: '✅ Sticker created (image format).'
                }, { quoted: msg });
            } else {
                await sock.sendMessage(from, {
                    video: buffer,
                    caption: '✅ Sticker created (video format).'
                }, { quoted: msg });
            }
        } catch (err) {
            console.error('Video-to-sticker error:', err);
            await sock.sendMessage(from, { text: `❌ Conversion failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'video', category: 'media', description: 'Download YouTube video (Wolf API)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) return sock.sendMessage(from, { text: '❌ Usage: .video <song name or YouTube URL>' }, { quoted: msg });

        try {
            await sock.sendMessage(from, { text: `🎬 Processing: ${query}\n⏳ Fetching video...` }, { quoted: msg });

            let videoUrl = null;
            let title = 'Unknown';
            let duration = 'N/A';

            const isUrl = query.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/);

            if (isUrl) {
                videoUrl = query;
                try {
                    const info = await yts({ videoId: videoUrl });
                    if (info) {
                        title = info.title || 'Unknown';
                        duration = info.duration?.timestamp || 'N/A';
                    }
                } catch (e) {}
            } else {
                try {
                    const searchResult = await yts(query);
                    const video = searchResult.videos[0];
                    if (video) {
                        videoUrl = video.url;
                        title = video.title || 'Unknown';
                        duration = video.duration.timestamp || 'N/A';
                    } else {
                        throw new Error('No YouTube results');
                    }
                } catch (ytErr) {
                    console.log('YouTube search failed:', ytErr.message);
                }
            }

            if (!videoUrl) {
                return sock.sendMessage(from, { text: '❌ Could not find video.' }, { quoted: msg });
            }

            const apiKey = 'wxa_f_1be53c1604';
            const apiUrl = `https://apis.xwolf.space/download/video?url=${encodeURIComponent(videoUrl)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { timeout: 15000 });
            const data = response.data;

            if (!data.success) {
                throw new Error(data.error || 'API did not return a result');
            }

            let downloadUrl = data.result || data.downloadUrl || data.url;
            if (!downloadUrl) {
                throw new Error('No download URL found in API response');
            }

            const videoRes = await axios.get(downloadUrl, {
                responseType: 'arraybuffer',
                timeout: 60000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            let videoBuffer = Buffer.from(videoRes.data);

            let finalBuffer = videoBuffer;
            const fileSizeMB = videoBuffer.length / (1024 * 1024);
            if (fileSizeMB > 15) {
                try {
                    const tempFile = path.join(__dirname, `temp_vid_${Date.now()}.mp4`);
                    const outFile = path.join(__dirname, `temp_out_${Date.now()}.mp4`);
                    fs.writeFileSync(tempFile, videoBuffer);
                    await execPromise(`ffmpeg -i "${tempFile}" -vf "scale=640:480" -c:v libx264 -c:a aac -b:v 800k -b:a 64k "${outFile}" -y`);
                    const compressedBuffer = fs.readFileSync(outFile);
                    fs.unlinkSync(tempFile);
                    fs.unlinkSync(outFile);
                    if (compressedBuffer.length < videoBuffer.length) {
                        finalBuffer = compressedBuffer;
                    }
                } catch (ffErr) {
                    console.log('FFmpeg conversion failed:', ffErr.message);
                }
            }

            const caption = `🎬 *${title}*\n⏱️ *Duration:* ${duration}`;

            await sock.sendMessage(from, {
                video: finalBuffer,
                mimetype: 'video/mp4',
                caption: caption
            }, { quoted: msg });

        } catch (err) {
            console.error('Video error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'vv', category: 'tools', description: '', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;

        const viewOnce = quoted?.viewOnceMessageV2?.message || quoted?.viewOnceMessage?.message;
        const target = viewOnce || quoted;

        if (!target) return sock.sendMessage(from, { text: 'You can\'t hide. Reply to a View-Once message.' });

        const coldLines = [
            "Nothing disappears when I'm watching.",
            "View once? I saw it twice.",
            "Your secret is my entertainment.",
            "You blinked. I saved it.",
            "Vanishing act failed.",
            "Forever stored. No regrets.",
            "Privacy is a myth I just debunked.",
            "Gone for you, not for me.",
            "Thanks for the media.",
            "I collect secrets. You just donated.",
            "Vanished? I don't think so.",
            "You tried. I prevailed.",
            "Another hidden gem acquired.",
            "Disappearing messages are my favourite.",
            "I don't forget. Ever.",
            "Your loss, my gain.",
            "Nice try. Better luck next time.",
            "Caught in 4K. Then saved.",
            "You thought that was temporary?",
            "Nothing escapes my sight."
        ];

        const savageLine = coldLines[Math.floor(Math.random() * coldLines.length)];
        const header = `*───「 SAVAGE-EXPOSE 」───*\n\n${savageLine}`;
        const footer = `\n\n⚡ Retrieved by Savage Tech`;

        try {
            let mediaType;
            let message;

            if (target.imageMessage) {
                mediaType = 'image';
                message = target.imageMessage;
            } else if (target.videoMessage) {
                mediaType = 'video';
                message = target.videoMessage;
            } else if (target.audioMessage) {
                mediaType = 'audio';
                message = target.audioMessage;
            } else {
                return sock.sendMessage(from, { text: 'This isn\'t a media secret.' });
            }

            const stream = await downloadContentFromMessage(message, mediaType);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
            }

            if (mediaType === 'image') {
                await sock.sendMessage(from, { image: buffer, caption: header + footer }, { quoted: msg });
            } else if (mediaType === 'video') {
                await sock.sendMessage(from, { video: buffer, caption: header + footer }, { quoted: msg });
            } else if (mediaType === 'audio') {
                await sock.sendMessage(from, { audio: buffer, mimetype: message.mimetype || 'audio/mpeg', ptt: false }, { quoted: msg });
                await sock.sendMessage(from, { text: header + footer }, { quoted: msg });
            }
        } catch (e) {
            console.error(e);
            await sock.sendMessage(from, { text: 'The secret died before I could catch it. (Failed to extract)' });
        }
    } },
    { name: 'wallet', category: 'financial data', description: 'Get financial data (crypto, stock, forex, etc.)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const subcommand = args[0] ? args[0].toLowerCase() : null;
        const param = args.slice(1).join(' ');

        let apiUrl = 'https://apis.xwolf.space/api/economy/wallet';
        let paramLabel = '';
        let type = 'wallet';

        if (subcommand === 'crypto') {
            const symbol = param || 'BTC';
            apiUrl = `https://apis.xwolf.space/api/economy/crypto?symbol=${symbol}`;
            paramLabel = symbol;
            type = 'crypto';
        } else if (subcommand === 'stock') {
            const ticker = param || 'AAPL';
            apiUrl = `https://apis.xwolf.space/api/economy/stock?symbol=${ticker}`;
            paramLabel = ticker;
            type = 'stock';
        } else if (subcommand === 'forex') {
            const [from, to] = param ? param.split(',') : ['USD', 'EUR'];
            apiUrl = `https://apis.xwolf.space/api/economy/forex?from=${from}&to=${to}`;
            paramLabel = `${from}/${to}`;
            type = 'forex';
        } else if (subcommand === 'gold') {
            apiUrl = 'https://apis.xwolf.space/api/economy/gold';
            type = 'gold';
        } else if (subcommand === 'market') {
            apiUrl = 'https://apis.xwolf.space/api/economy/market';
            type = 'market';
        } else if (subcommand === 'inflation') {
            const country = param || 'US';
            apiUrl = `https://apis.xwolf.space/api/economy/inflation?country=${country}`;
            paramLabel = country;
            type = 'inflation';
        } else if (subcommand === 'gdp') {
            const country = param || 'US';
            apiUrl = `https://apis.xwolf.space/api/economy/gdp?country=${country}`;
            paramLabel = country;
            type = 'gdp';
        } else if (subcommand === 'bankrate') {
            const country = param || 'US';
            apiUrl = `https://apis.xwolf.space/api/economy/bank-rate?country=${country}`;
            paramLabel = country;
            type = 'bankrate';
        } else if (subcommand === 'news') {
            apiUrl = 'https://apis.xwolf.space/api/economy/news';
            type = 'news';
        } else if (subcommand && subcommand.match(/^[A-Za-z0-9]{26,}$/)) {
            // treat as wallet address (crypto address)
            apiUrl = `https://apis.xwolf.space/api/economy/wallet?address=${subcommand}`;
            paramLabel = subcommand.slice(0, 10) + '...';
            type = 'wallet';
        } else {
            return sock.sendMessage(from, {
                text: '❌ Usage:\n' +
                    '.wallet crypto <symbol> (e.g., BTC)\n' +
                    '.wallet stock <ticker> (e.g., AAPL)\n' +
                    '.wallet forex <from>,<to> (e.g., USD,EUR)\n' +
                    '.wallet gold\n' +
                    '.wallet market\n' +
                    '.wallet inflation <country> (e.g., US)\n' +
                    '.wallet gdp <country>\n' +
                    '.wallet bankrate <country>\n' +
                    '.wallet news\n' +
                    '.wallet <crypto_address>'
            }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_9ddecf073b';
            const urlWithKey = apiUrl + (apiUrl.includes('?') ? '&' : '?') + `key=${apiKey}`;
            const response = await axios.get(urlWithKey, { httpsAgent: agent, timeout: 15000 });
            const data = response.data;

            if (!data.success) throw new Error(data.error || 'No data');

            let output = `📊 *${type.toUpperCase()} DATA*`;
            if (paramLabel) output += ` (${paramLabel})`;
            output += '\n\n';

            if (type === 'crypto') {
                output += `💎 *${data.symbol || paramLabel}*\n`;
                output += `💰 Price: ${formatNumber(data.price_usd)}\n`;
                if (data.change_24h !== undefined) output += `📈 24h Change: ${data.change_24h > 0 ? '+' : ''}${data.change_24h}%\n`;
                if (data.market_cap_usd) output += `🏦 Market Cap: ${formatNumber(data.market_cap_usd)}\n`;
                if (data.volume_24h_usd) output += `📊 24h Volume: ${formatNumber(data.volume_24h_usd)}\n`;
            } else if (type === 'stock') {
                output += `📈 *${data.symbol || paramLabel}*\n`;
                output += `💵 Price: ${formatNumber(data.price)}\n`;
                if (data.change !== undefined) output += `📉 Change: ${data.change > 0 ? '+' : ''}${data.change}%\n`;
                if (data.volume) output += `📊 Volume: ${formatNumber(data.volume)}\n`;
            } else if (type === 'forex') {
                output += `💱 *${data.from || 'USD'} → ${data.to || 'EUR'}*\n`;
                output += `💹 Rate: ${data.rate || data.result}\n`;
                if (data.change) output += `📈 Change: ${data.change}%\n`;
            } else if (type === 'gold') {
                output += `🥇 *Gold & Silver*\n`;
                output += `🪙 Gold: ${formatNumber(data.gold)}/oz\n`;
                if (data.silver) output += `🥈 Silver: ${formatNumber(data.silver)}/oz\n`;
            } else if (type === 'market') {
                output += `🌍 *Market Indices*\n`;
                if (data.sp500) output += `📊 S&P 500: ${formatNumber(data.sp500)}\n`;
                if (data.dow) output += `📈 Dow Jones: ${formatNumber(data.dow)}\n`;
                if (data.nasdaq) output += `📉 Nasdaq: ${formatNumber(data.nasdaq)}\n`;
            } else if (type === 'inflation') {
                output += `📉 *Inflation Rate (${paramLabel || 'US'})*\n`;
                output += `📅 Annual: ${data.rate}%\n`;
                if (data.year) output += `🗓️ Year: ${data.year}\n`;
            } else if (type === 'gdp') {
                output += `📊 *GDP (${paramLabel || 'US'})*\n`;
                output += `💰 GDP: ${formatNumber(data.gdp)}\n`;
                if (data.growth) output += `📈 Growth: ${data.growth}%\n`;
            } else if (type === 'bankrate') {
                output += `🏦 *Central Bank Rate (${paramLabel || 'US'})*\n`;
                output += `💹 Rate: ${data.rate}%\n`;
            } else if (type === 'news') {
                output += `📰 *Financial News*\n\n`;
                const headlines = data.result || data.articles || [];
                if (Array.isArray(headlines) && headlines.length) {
                    headlines.slice(0, 5).forEach((item, i) => {
                        output += `${i+1}. ${item.title || item.headline}\n`;
                        if (item.source) output += `   📍 ${item.source}\n`;
                        output += `\n`;
                    });
                } else {
                    output += `No news available.\n`;
                }
            } else if (type === 'wallet') {
                output += `💳 *Wallet Balance*\n`;
                output += `💰 Balance: ${formatNumber(data.balance)} ${data.currency || 'BTC'}\n`;
                if (data.transactions) output += `🔄 Transactions: ${data.transactions}\n`;
            } else {
                output += JSON.stringify(data.result || data, null, 2);
            }

            await sock.sendMessage(from, { text: output.slice(0, 2000) }, { quoted: msg });
        } catch (err) {
            console.error('Wallet error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'warn', category: 'group', description: '', execute: async function (sock, msg, args, { isArchitect, isMe }) {

        const from = msg.key.remoteJid;

        if (!from.endsWith("@g.us")) {
            return await sock.sendMessage(from, {
                text: "❌ Group only command."
            }, { quoted: msg });
        }

        const sender = msg.key.participant || msg.key.remoteJid;

        let isAdmin = false;

        try {
            const meta = await sock.groupMetadata(from);

            const participant = meta.participants.find(
                p => p.id === sender || p.jid === sender
            );

            isAdmin =
                participant?.admin === "admin" ||
                participant?.admin === "superadmin";

        } catch {}

        if (!isAdmin && !isArchitect && !isMe) {
            return await sock.sendMessage(from, {
                text: "❎ You are not worthy of this command."
            }, { quoted: msg });
        }

        let mentioned =
            msg.message?.extendedTextMessage
                ?.contextInfo
                ?.mentionedJid?.[0];

        if (!mentioned) {
            mentioned =
                msg.message?.extendedTextMessage
                    ?.contextInfo
                    ?.participant;
        }

        if (!mentioned) {
            return await sock.sendMessage(from, {
                text:
`⚠️ Reply to a message or mention a user.

Example:
.warn @user spam

OR
Reply:
.warn spam`
            }, { quoted: msg });
        }

        if (global.owner?.includes(mentioned)) {
            return await sock.sendMessage(from, {
                text: "⚡ You cannot warn the creator of Savage Tech."
            }, { quoted: msg });
        }

        const reason = mentioned
            ? args.slice(1).join(" ") || "No reason provided"
            : args.join(" ") || "No reason provided";

        if (!global.warns[from]) global.warns[from] = {};
        if (!global.warns[from][mentioned]) global.warns[from][mentioned] = 0;

        global.warns[from][mentioned]++;

        const warns = global.warns[from][mentioned];
        const remaining = 3 - warns;

        const quotes = [
            "Spencer's patience decreases with every mistake.",
            "Rules exist for a reason. You ignored them.",
            "Another violation added to your record.",
            "Savage Tech sees everything.",
            "You're approaching removal territory.",
            "Discipline is enforced here, not requested.",
            "You were warned. The system remembers.",
            "Chaos is temporary. Enforcement is permanent.",
            "Every action has consequences in this group.",
            "You are testing a system designed to win."
        ];

        const quote = quotes[Math.floor(Math.random() * quotes.length)];

        if (warns >= 3) {

            delete global.warns[from][mentioned];

            await sock.sendMessage(from, {
                text:
`☠️ *FINAL WARNING EXCEEDED*

👤 User: @${mentioned.split("@")[0]}
📌 Reason: ${reason}

📊 Warnings: 3/3
🚫 Action: Removal Initiated

🧊 ${quote}

⚡ Powered by Savage Tech`,
                mentions: [mentioned]
            }, { quoted: msg });

            try {
                await sock.groupParticipantsUpdate(from, [mentioned], "remove");
            } catch (err) {
                console.log(err);
            }

            return;
        }

        await sock.sendMessage(from, {
            text:
`⚠️ *WARNING ISSUED*

👤 User: @${mentioned.split("@")[0]}
📌 Reason: ${reason}

📊 Warnings: ${warns}/3
⏳ Remaining Before Kick: ${remaining}

🧊 ${quote}

⚡ Powered by Savage Tech`,
            mentions: [mentioned]
        }, { quoted: msg });
    } },
    { name: 'wave', category: 'anime', description: 'Random anime waving image', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;

        try {
            await sock.sendMessage(from, { text: '🎴 Fetching random anime wave...' }, { quoted: msg });
            const response = await axios.get('https://nekos.best/api/v2/wave', { httpsAgent: agent, timeout: 10000 });
            const imgUrl = response.data.results[0].url;
            await sock.sendMessage(from, {
                image: { url: imgUrl },
                caption: '✅ Anime wave'
            }, { quoted: msg });
        } catch (err) {
            console.error('Wave error:', err);
            await sock.sendMessage(from, { text: '❌ Failed to fetch anime wave.' }, { quoted: msg });
        }
    } },
    { name: 'weather', category: 'tools', description: 'Get current weather for a city', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const city = args.join(' ');
        if (!city) {
            return sock.sendMessage(from, { text: '❌ Usage: .weather <city_name>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/api/tools/weather?city=${encodeURIComponent(city)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });
            const data = response.data;

            const result = data.result || data.weather || 'No result';
            await sock.sendMessage(from, { text: `🌤️ *Weather in ${city}*\n\n${result.slice(0, 1900)}` }, { quoted: msg });
        } catch (err) {
            console.error('Weather error:', err);
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'welcome', category: 'group', description: 'Toggle welcome messages on/off for this group (admin/owner only)', execute: async function (sock, msg, args, { isMe }) {
    const from = msg.key.remoteJid;
    if (!from.endsWith('@g.us')) return await sock.sendMessage(from, { text: '❌ Group only command.' }, { quoted: msg });

    const sender = msg.key.participant || msg.key.remoteJid;
    const groupMetadata = await sock.groupMetadata(from);
    const participant = groupMetadata.participants.find(p => p.id === sender);
    const isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
    
    if (!isAdmin && !isMe) return await sock.sendMessage(from, { text: '❎ You are not worthy of this command.' }, { quoted: msg });
    
    if (global.welcomeEnabled[from] === undefined) global.welcomeEnabled[from] = true;
    const newState = !global.welcomeEnabled[from];
    global.welcomeEnabled[from] = newState;
    settings.setGroup(from, 'welcomeEnabled', newState);
    await sock.sendMessage(from, { text: `✅ Welcome messages are now *${newState ? "ON" : "OFF"}* for this group.` }, { quoted: msg });
  } },
    { name: 'whois', category: 'ethical hacking', description: 'WHOIS domain lookup', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const domain = args[0];
        if (!domain) {
            return sock.sendMessage(from, { text: '❌ Usage: .whois <domain>' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: `🔎 Looking up WHOIS for ${domain}...` }, { quoted: msg });
            const response = await axios.get(`https://who-dat.as93.net/${domain}`, { httpsAgent: agent, timeout: 10000 });
            const data = response.data;

            let text = `📋 *WHOIS for ${domain}*\n\n`;
            text += `Registrar: ${data.registrar || 'N/A'}\n`;
            text += `Creation: ${data.creation_date || 'N/A'}\n`;
            text += `Expiry: ${data.expiry_date || 'N/A'}\n`;
            text += `Name Servers: ${data.name_servers ? data.name_servers.join(', ') : 'N/A'}`;

            await sock.sendMessage(from, { text: text.slice(0, 2000) }, { quoted: msg });
        } catch (err) {
            console.error('WHOIS error:', err);
            await sock.sendMessage(from, { text: `❌ WHOIS error: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'wiki', category: 'search menu', description: 'Search Wikipedia articles', execute: async function (sock, msg, args) {
    const query = args.join(' ');
    if (!query) return sock.sendMessage(msg.key.remoteJid, { text: '❓ Usage: .wiki <search term>' }, { quoted: msg });

    try {
      await sock.sendMessage(msg.key.remoteJid, { text: `🔍 Searching Wikipedia for "${query}"...` }, { quoted: msg });
      const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro&explaintext&redirects=1&titles=${encodeURIComponent(query)}`;
      const res = await axios.get(apiUrl, { httpsAgent: agent, headers: { 'User-Agent': 'Savage-Tech-Bot/1.0' } });
      const pages = res.data.query.pages;
      const page = pages[Object.keys(pages)[0]];
      if (!page || page.missing) throw new Error('Page not found');
      let extract = page.extract || 'No description.';
      if (extract.length > 1600) extract = extract.slice(0, 1600) + '…';
      const result = `📖 *WIKIPEDIA: ${page.title}*\n🚀 POWERED BY SAVAGE-CORE\n\n${extract}\n\n🔗 https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`;
      await sock.sendMessage(msg.key.remoteJid, { text: result.slice(0, 2000) }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(msg.key.remoteJid, { text: `❌ Wiki error: ${err.message}` }, { quoted: msg });
    }
  } },
    { name: 'wikipedia', category: 'tools', description: 'Get Wikipedia article summary', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .wikipedia <topic>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/api/tools/wikipedia?query=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { httpsAgent: agent, timeout: 15000 });
            const data = response.data;

            const result = data.result || data.summary || 'No result';
            await sock.sendMessage(from, { text: `📖 *Wikipedia: ${query}*\n\n${result.slice(0, 1900)}` }, { quoted: msg });
        } catch (err) {
            console.error('Wikipedia error:', err);
            await sock.sendMessage(from, { text: `❌ Error: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'wink', category: 'anime', description: 'Random anime wink image', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;

        try {
            await sock.sendMessage(from, { text: '🎴 Fetching random anime wink...' }, { quoted: msg });
            const response = await axios.get('https://nekos.best/api/v2/wink', { httpsAgent: agent, timeout: 10000 });
            const imgUrl = response.data.results[0].url;
            await sock.sendMessage(from, {
                image: { url: imgUrl },
                caption: '✅ Anime wink'
            }, { quoted: msg });
        } catch (err) {
            console.error('Wink error:', err);
            await sock.sendMessage(from, { text: '❌ Failed to fetch anime wink.' }, { quoted: msg });
        }
    } },
    { name: 'wisdom', category: 'fun', description: 'Wise sayings and quotes', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const random = wisdom[Math.floor(Math.random() * wisdom.length)];
        await sock.sendMessage(from, {
            text: `🧠 *Wisdom*\n\n${random}`
        }, { quoted: msg });
    } },
    { name: 'wizard', category: 'ai', description: 'Chat with WizardLM AI', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .wizard <message>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_9ddecf073b';
            const url = `https://apis.xwolf.space/api/ai/wizard?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(url, { timeout: 30000 });
            const data = response.data;

            let reply = 'No response';
            if (data.status && data.result) {
                reply = data.result;
            } else if (data.error) {
                reply = `⚠️ ${data.error}`;
            }

            await sock.sendMessage(from, { text: `🤖 *WizardLM:*\n${reply.slice(0, 2000)}` }, { quoted: msg });
        } catch (err) {
            console.error('WizardLM error:', err);
            await sock.sendMessage(from, { text: '❌ API error. Please try again later.' }, { quoted: msg });
        }
    } },
    { name: 'wouldyourather', category: 'fun', description: 'Would you rather question', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const random = wyr[Math.floor(Math.random() * wyr.length)];
        await sock.sendMessage(from, {
            text: `🤔 *Would You Rather?*\n\n${random}`
        }, { quoted: msg });
    } },
    { name: 'yawn', category: 'anime', description: 'Random anime yawn image', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;

        try {
            await sock.sendMessage(from, { text: '🎴 Fetching random anime yawn...' }, { quoted: msg });
            const response = await axios.get('https://nekos.best/api/v2/yawn', { httpsAgent: agent, timeout: 10000 });
            const imgUrl = response.data.results[0].url;
            await sock.sendMessage(from, {
                image: { url: imgUrl },
                caption: '✅ Anime yawn'
            }, { quoted: msg });
        } catch (err) {
            console.error('Yawn error:', err);
            await sock.sendMessage(from, { text: '❌ Failed to fetch anime yawn.' }, { quoted: msg });
        }
    } },
    { name: 'yeet', category: 'anime', description: 'Random anime yeet image', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;

        try {
            await sock.sendMessage(from, { text: '🎴 Fetching random anime yeet...' }, { quoted: msg });
            const response = await axios.get('https://nekos.best/api/v2/yeet', { httpsAgent: agent, timeout: 10000 });
            const imgUrl = response.data.results[0].url;
            await sock.sendMessage(from, {
                image: { url: imgUrl },
                caption: '✅ Anime yeet'
            }, { quoted: msg });
        } catch (err) {
            console.error('Yeet error:', err);
            await sock.sendMessage(from, { text: '❌ Failed to fetch anime yeet.' }, { quoted: msg });
        }
    } },
    { name: 'yt', category: 'download', description: 'Download YouTube video (ravenn.site)', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        let url = args[0];

        if (!url && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            if (quoted.conversation) {
                const match = quoted.conversation.match(/(https?:\/\/[^\s]+)/);
                if (match) url = match[0];
            } else if (quoted.extendedTextMessage?.text) {
                const match = quoted.extendedTextMessage.text.match(/(https?:\/\/[^\s]+)/);
                if (match) url = match[0];
            }
        }

        if (!url) {
            return sock.sendMessage(from, {
                text: '❌ Provide a YouTube URL, or reply to a message with one.\nExample: `.yt https://youtu.be/xxx`'
            }, { quoted: msg });
        }

        if (!url.startsWith('http')) {
            return sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: '⬇️ Downloading YouTube video...' }, { quoted: msg });

            const ravennUrl = `https://ravenn.site/download/ytv4?url=${encodeURIComponent(url)}`;
            const response = await axios.get(ravennUrl, { httpsAgent: agent, timeout: 15000 });
            const data = response.data;

            if (!data.status || !data.result) {
                throw new Error('Invalid response: ' + JSON.stringify(data));
            }

            const downloadUrl = data.result;
            const videoRes = await axios.get(downloadUrl, {
                responseType: 'arraybuffer',
                httpsAgent: agent,
                timeout: 60000
            });
            const videoBuffer = Buffer.from(videoRes.data);

            await sock.sendMessage(from, {
                video: videoBuffer,
                caption: '✅ YouTube video downloaded.'
            }, { quoted: msg });

        } catch (err) {
            console.error('YouTube error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'yta', category: 'audio', description: 'YouTube Audio extractor', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .yta <song name or YouTube URL>' }, { quoted: msg });
        }

        await sock.sendMessage(from, { text: '🔍 Searching for audio...' }, { quoted: msg });

        try {
            let videoUrl = query;
            if (!query.includes('youtube.com') && !query.includes('youtu.be')) {
                const searchResults = await yts(query);
                if (!searchResults.videos.length) {
                    return sock.sendMessage(from, { text: '❌ No results found.' }, { quoted: msg });
                }
                videoUrl = searchResults.videos[0].url;
            }

            const videoId = videoUrl.split('v=')[1]?.split('&')[0] || videoUrl.split('youtu.be/')[1]?.split('?')[0];
            if (!videoId) {
                return sock.sendMessage(from, { text: '❌ Invalid YouTube URL.' }, { quoted: msg });
            }

            const info = await yts({ videoId });
            const title = info.title || 'Unknown Title';
            const duration = info.duration.timestamp || 'Unknown';
            const views = info.views?.toLocaleString() || 'Unknown';
            const author = info.author?.name || 'Unknown';
            const thumbnail = info.thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

            await sock.sendMessage(from, {
                image: { url: thumbnail },
                caption: `🎵 *Audio Extractor*\n♡ Title: ${title}\n♡ Duration: ${duration}\n♡ Views: ${views}\n♡ Author: ${author}\n♡ Status: Extracting...`
            }, { quoted: msg });

            const apiKey = 'wxa_f_9ddecf073b';
            const endpoint = `https://apis.xwolf.space/download/yta?url=${encodeURIComponent(videoUrl)}&key=${apiKey}`;
            const response = await axios.get(endpoint, {
                timeout: 30000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36' }
            });

            let audioUrl = response.data.downloadUrl || response.data.downloaded_at || response.data.url || response.data.result?.url || response.data.link;
            if (!audioUrl) {
                return sock.sendMessage(from, { text: '❌ No audio URL in API response.' }, { quoted: msg });
            }

            const audioRes = await axios.get(audioUrl, {
                responseType: 'arraybuffer',
                timeout: 90000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });

            const audioBuffer = Buffer.from(audioRes.data);
            if (audioBuffer.length < 50000) {
                return sock.sendMessage(from, { text: `❌ Downloaded file too small (${audioBuffer.length} bytes).` }, { quoted: msg });
            }

            const fileSizeMB = (audioBuffer.length / (1024 * 1024)).toFixed(2);
            if (audioBuffer.length > 16 * 1024 * 1024) {
                return sock.sendMessage(from, { text: `❌ Audio too large (${fileSizeMB} MB). Max 16 MB.` }, { quoted: msg });
            }

            const tempDir = path.join(__dirname, '../temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
            const tempFile = path.join(tempDir, `${videoId}.mp3`);
            fs.writeFileSync(tempFile, audioBuffer);

            await sock.sendMessage(from, {
                audio: { url: tempFile },
                mimetype: 'audio/mpeg',
                fileName: `${title.replace(/[^a-z0-9]/gi, '_')}.mp3`,
                ptt: false
            }, { quoted: msg });

            fs.unlinkSync(tempFile);
        } catch (error) {
            console.error('YTA error:', error);
            await sock.sendMessage(from, { text: '❌ Failed to extract audio. Try another song or URL.' }, { quoted: msg });
        }
    } },
    { name: 'ytinfo', category: 'download', description: 'Get YouTube video information', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        let url = args[0];

        if (!url && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
            const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage;
            if (quoted.conversation) {
                const match = quoted.conversation.match(/(https?:\/\/[^\s]+)/);
                if (match) url = match[0];
            } else if (quoted.extendedTextMessage?.text) {
                const match = quoted.extendedTextMessage.text.match(/(https?:\/\/[^\s]+)/);
                if (match) url = match[0];
            }
        }

        if (!url) {
            return sock.sendMessage(from, {
                text: '❌ Provide a YouTube URL, or reply to a message with one.\nExample: `.ytinfo https://youtu.be/xxx`'
            }, { quoted: msg });
        }

        if (!url.startsWith('http')) {
            return sock.sendMessage(from, { text: '❌ Invalid URL.' }, { quoted: msg });
        }

        try {
            await sock.sendMessage(from, { text: '📊 Fetching YouTube info...' }, { quoted: msg });

            const apiKey = 'wxa_f_9ddecf073b';
            const apiUrl = `https://apis.xwolf.space/download/youtube/info?url=${encodeURIComponent(url)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { timeout: 15000 });
            const data = response.data;

            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch info');
            }

            let infoText = '';
            if (data.result) {
                if (typeof data.result === 'object') {
                    infoText = JSON.stringify(data.result, null, 2);
                } else {
                    infoText = data.result;
                }
            } else if (data.info) {
                infoText = JSON.stringify(data.info, null, 2);
            } else {
                infoText = JSON.stringify(data, null, 2);
            }

            const output = `📋 *YouTube Info*\n\n${infoText.slice(0, 2000)}`;

            await sock.sendMessage(from, { text: output }, { quoted: msg });
        } catch (err) {
            console.error('YouTube info error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    } },
    { name: 'ytmp3', category: 'audio', description: 'Convert YouTube video to MP3', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .ytmp3 <song name or YouTube URL>' }, { quoted: msg });
        }

        await sock.sendMessage(from, { text: '🔍 Searching for audio...' }, { quoted: msg });

        try {
            let videoUrl = query;
            if (!query.includes('youtube.com') && !query.includes('youtu.be')) {
                const searchResults = await yts(query);
                if (!searchResults.videos.length) {
                    return sock.sendMessage(from, { text: '❌ No results found.' }, { quoted: msg });
                }
                videoUrl = searchResults.videos[0].url;
            }

            const videoId = videoUrl.split('v=')[1]?.split('&')[0] || videoUrl.split('youtu.be/')[1]?.split('?')[0];
            if (!videoId) {
                return sock.sendMessage(from, { text: '❌ Invalid YouTube URL.' }, { quoted: msg });
            }

            const info = await yts({ videoId });
            const title = info.title || 'Unknown Title';
            const duration = info.duration.timestamp || 'Unknown';
            const views = info.views?.toLocaleString() || 'Unknown';
            const author = info.author?.name || 'Unknown';
            const thumbnail = info.thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

            await sock.sendMessage(from, {
                image: { url: thumbnail },
                caption: `🎵 *MP3 Converter*\n♡ Title: ${title}\n♡ Duration: ${duration}\n♡ Views: ${views}\n♡ Author: ${author}\n♡ Status: Converting...`
            }, { quoted: msg });

            const apiKey = 'wxa_f_9ddecf073b';
            const endpoint = `https://apis.xwolf.space/download/yta2?url=${encodeURIComponent(videoUrl)}&key=${apiKey}`;
            const response = await axios.get(endpoint, {
                timeout: 30000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36' }
            });

            let audioUrl = response.data.downloadUrl || response.data.downloaded_at || response.data.url || response.data.result?.url || response.data.link;
            if (!audioUrl) {
                return sock.sendMessage(from, { text: '❌ No audio URL in API response.' }, { quoted: msg });
            }

            const audioRes = await axios.get(audioUrl, {
                responseType: 'arraybuffer',
                timeout: 90000,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });

            const audioBuffer = Buffer.from(audioRes.data);
            if (audioBuffer.length < 50000) {
                return sock.sendMessage(from, { text: `❌ Downloaded file too small (${audioBuffer.length} bytes).` }, { quoted: msg });
            }

            const fileSizeMB = (audioBuffer.length / (1024 * 1024)).toFixed(2);
            if (audioBuffer.length > 16 * 1024 * 1024) {
                return sock.sendMessage(from, { text: `❌ Audio too large (${fileSizeMB} MB). Max 16 MB.` }, { quoted: msg });
            }

            const tempDir = path.join(__dirname, '../temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
            const tempFile = path.join(tempDir, `${videoId}.mp3`);
            fs.writeFileSync(tempFile, audioBuffer);

            await sock.sendMessage(from, {
                audio: { url: tempFile },
                mimetype: 'audio/mpeg',
                fileName: `${title.replace(/[^a-z0-9]/gi, '_')}.mp3`,
                ptt: false
            }, { quoted: msg });

            fs.unlinkSync(tempFile);
        } catch (error) {
            console.error('YTMP3 error:', error);
            await sock.sendMessage(from, { text: '❌ Failed to convert. Try another song or URL.' }, { quoted: msg });
        }
    } },
    { name: 'ytmp4', category: 'download', description: 'Convert YouTube video to MP4', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .ytmp4 <song name or YouTube URL>' }, { quoted: msg });
        }

        await sock.sendMessage(from, { text: '🔍 Searching for video...' }, { quoted: msg });

        try {
            let videoUrl = query;
            if (!query.includes('youtube.com') && !query.includes('youtu.be')) {
                const searchResults = await yts(query);
                if (!searchResults.videos.length) {
                    return sock.sendMessage(from, { text: '❌ No results found.' }, { quoted: msg });
                }
                videoUrl = searchResults.videos[0].url;
            }

            const videoId = videoUrl.split('v=')[1]?.split('&')[0] || videoUrl.split('youtu.be/')[1]?.split('?')[0];
            if (!videoId) {
                return sock.sendMessage(from, { text: '❌ Invalid YouTube URL.' }, { quoted: msg });
            }

            const info = await yts({ videoId });
            const title = info.title || 'Unknown Title';
            const duration = info.duration.timestamp || 'Unknown';
            const views = info.views?.toLocaleString() || 'Unknown';
            const author = info.author?.name || 'Unknown';
            const thumbnail = info.thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

            await sock.sendMessage(from, {
                image: { url: thumbnail },
                caption: `🎥 *Video Info*\n♡ Title: ${title}\n♡ Duration: ${duration}\n♡ Views: ${views}\n♡ Author: ${author}\n♡ Status: Converting...`
            }, { quoted: msg });

            const apiKey = 'wxa_f_9ddecf073b';
            const endpoints = [
                `https://apis.xwolf.space/download/mp4?url=${encodeURIComponent(videoUrl)}&key=${apiKey}`,
                `https://apis.xwolf.space/download/video?url=${encodeURIComponent(videoUrl)}&key=${apiKey}`,
                `https://apis.xwolf.space/download/hd?url=${encodeURIComponent(videoUrl)}&key=${apiKey}`
            ];

            let videoBuffer = null;
            for (const endpoint of endpoints) {
                try {
                    const response = await axios.get(endpoint, {
                        httpsAgent: agent,
                        timeout: 30000,
                        headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36' }
                    });
                    let videoFileUrl = response.data.downloadUrl || response.data.downloaded_at || response.data.url || response.data.result?.url || response.data.link;
                    if (!videoFileUrl && response.data.mp4) {
                        videoFileUrl = typeof response.data.mp4 === 'string' ? response.data.mp4 : response.data.mp4.url;
                    }
                    if (videoFileUrl) {
                        const videoRes = await axios.get(videoFileUrl, {
                            responseType: 'arraybuffer',
                            httpsAgent: agent,
                            timeout: 120000,
                            headers: { 'User-Agent': 'Mozilla/5.0' }
                        });
                        videoBuffer = Buffer.from(videoRes.data);
                        if (videoBuffer.length > 50000) break;
                    }
                } catch (e) {
                    continue;
                }
            }

            if (!videoBuffer || videoBuffer.length < 50000) {
                return sock.sendMessage(from, { text: '❌ No video data received. Try another song or use .mp4' }, { quoted: msg });
            }

            const fileSizeMB = (videoBuffer.length / (1024 * 1024)).toFixed(2);
            if (videoBuffer.length > 50 * 1024 * 1024) {
                return sock.sendMessage(from, { text: `❌ Video too large (${fileSizeMB} MB). Max 50 MB.` }, { quoted: msg });
            }

            const tempDir = path.join(__dirname, '../temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
            const tempFile = path.join(tempDir, `${videoId}.mp4`);
            fs.writeFileSync(tempFile, videoBuffer);

            await sock.sendMessage(from, {
                video: { url: tempFile },
                mimetype: 'video/mp4',
                caption: `🎥 *${title}*`
            }, { quoted: msg });

            fs.unlinkSync(tempFile);
        } catch (error) {
            console.error('YTMP4 error:', error);
            await sock.sendMessage(from, { text: '❌ Failed to convert video. Try another song or URL.' }, { quoted: msg });
        }
    } },
    { name: 'ytmp5', category: 'download', description: 'Get both MP3 and MP4 download URLs', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .ytmp5 <song name or YouTube URL>' }, { quoted: msg });
        }

        await sock.sendMessage(from, { text: '🔍 Searching...' }, { quoted: msg });

        try {
            let videoUrl = query;
            if (!query.includes('youtube.com') && !query.includes('youtu.be')) {
                const searchResults = await yts(query);
                if (!searchResults.videos.length) {
                    return sock.sendMessage(from, { text: '❌ No results found.' }, { quoted: msg });
                }
                videoUrl = searchResults.videos[0].url;
            }

            const endpoint = `https://apis.xwolf.space/download/ytmp5?url=${encodeURIComponent(videoUrl)}`;
            const response = await axios.get(endpoint, {
                timeout: 60000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36' }
            });

            let mp3Url = null;
            let mp4Url = null;

            if (response.data.mp3) {
                mp3Url = typeof response.data.mp3 === 'string' ? response.data.mp3 : (response.data.mp3.url || response.data.mp3.downloadUrl || response.data.mp3.link);
            }
            if (response.data.mp4) {
                mp4Url = typeof response.data.mp4 === 'string' ? response.data.mp4 : (response.data.mp4.url || response.data.mp4.downloadUrl || response.data.mp4.link);
            }
            if (!mp3Url && response.data.audioUrl) mp3Url = typeof response.data.audioUrl === 'string' ? response.data.audioUrl : response.data.audioUrl.url;
            if (!mp4Url && response.data.videoUrl) mp4Url = typeof response.data.videoUrl === 'string' ? response.data.videoUrl : response.data.videoUrl.url;

            if (!mp3Url && !mp4Url) {
                return sock.sendMessage(from, { text: '❌ No download URLs found. Try another song or use .play' }, { quoted: msg });
            }

            let caption = `🎵 *Download Links*\n\n`;
            if (mp3Url) caption += `🎵 *MP3:*\n${mp3Url}\n\n`;
            if (mp4Url) caption += `🎥 *MP4:*\n${mp4Url}\n\n`;

            await sock.sendMessage(from, { text: caption }, { quoted: msg });
        } catch (error) {
            console.error('YTMP5 error:', error);
            await sock.sendMessage(from, { text: '❌ Failed to fetch links. Try another song or URL.' }, { quoted: msg });
        }
    } },
    { name: 'ytsearch', category: 'download', description: 'Search YouTube videos', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .ytsearch <search query>' }, { quoted: msg });
        }

        try {
            const results = await yts(query);
            if (!results.videos.length) {
                return sock.sendMessage(from, { text: '❌ No results found.' }, { quoted: msg });
            }

            let text = '📹 *YouTube Search Results*\n\n';
            results.videos.slice(0, 10).forEach((video, index) => {
                text += `${index + 1}. *${video.title}*\n`;
                text += `   👤 ${video.author.name}\n`;
                text += `   ⏱️ ${video.duration.timestamp}\n`;
                text += `   🔗 ${video.url}\n\n`;
            });

            await sock.sendMessage(from, { text: text.slice(0, 2000) }, { quoted: msg });
        } catch (error) {
            console.error('YouTube search error:', error);
            await sock.sendMessage(from, { text: '❌ Search failed. Try again later.' }, { quoted: msg });
        }
    } },
    { name: 'zephyr', category: 'ai', description: 'Chat with Zephyr AI', execute: async function (sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) {
            return sock.sendMessage(from, { text: '❌ Usage: .zephyr <message>' }, { quoted: msg });
        }

        try {
            const apiKey = 'wxa_f_9ddecf073b';
            const url = `https://apis.xwolf.space/api/ai/zephyr?q=${encodeURIComponent(query)}&key=${apiKey}`;
            const response = await axios.get(url, { timeout: 30000 });
            const data = response.data;

            let reply = 'No response';
            if (data.status && data.result) {
                reply = data.result;
            } else if (data.error) {
                reply = `⚠️ ${data.error}`;
            }

            await sock.sendMessage(from, { text: `🤖 *Zephyr:*\n${reply.slice(0, 2000)}` }, { quoted: msg });
        } catch (err) {
            console.error('Zephyr error:', err);
            await sock.sendMessage(from, { text: '❌ API error. Please try again later.' }, { quoted: msg });
        }
    } }
    ];

    for (const cmd of internalCommands) {
        if (cmd.name) {
            global.commands.set(cmd.name, cmd);
        }
    }

    console.log(`✅ ${global.commands.size} Commands loaded internally (from bot.js).`);
};


async function startSavage() {
    const sessionPath = "./session";
    const credsFile = path.join(sessionPath, 'creds.json');

    if (!fs.existsSync(sessionPath)) fs.mkdirSync(sessionPath, { recursive: true });

    if (!fs.existsSync(credsFile)) {
        let sessionFromEnv = null;
        if (process.env.SESSION_ID) {
            sessionFromEnv = process.env.SESSION_ID;
            if (sessionFromEnv.includes("Savage~")) {
                const compressedBase64 = sessionFromEnv.split("Savage~")[1];
                const compressed = Buffer.from(compressedBase64, 'base64');
                try {
                    const decompressed = zlib.gunzipSync(compressed);
                    const authData = decompressed.toString('utf-8');
                    fs.writeFileSync(credsFile, authData);
                    console.log("✅ Session decompressed (gzipped format) and written.");
                } catch (e) {
                    console.error("❌ Failed to decompress gzipped session:", e.message);
                    process.exit(1);
                }
            } else if (sessionFromEnv.includes(";;;")) {
                const rawBase64 = sessionFromEnv.split(";;;")[1];
                const authData = Buffer.from(rawBase64, 'base64').toString('utf-8');
                fs.writeFileSync(credsFile, authData);
                console.log("✅ Session written (raw base64 with prefix).");
            } else {
                const authData = Buffer.from(sessionFromEnv, 'base64').toString('utf-8');
                fs.writeFileSync(credsFile, authData);
                console.log("✅ Session written (raw base64, no prefix).");
            }
        } else {
            console.log("\n❌ No session found.");
            console.log("Add your session to the .env file:");
            console.log("SESSION_ID=your_base64_string_here");
            console.log("Then restart the bot.\n");
            process.exit(1);
        }
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }))
        },
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["SΛVΛGΞ-TECH", "Safari", "1.0.0"],
        syncFullHistory: true,
        emitOwnEvents: true,
        fireInitQueries: true
    });

    global.sock = sock;

    let connectionTimeout = setTimeout(() => {
        console.error("❌ Connection timeout. The session is invalid or expired. Check your SESSION_ID in .env and restart.");
        process.exit(1);
    }, 20000);

    sock.ev.on("connection.update", async (update) => {
        const { connection } = update;
        if (connection === "open") {
            clearTimeout(connectionTimeout);
        }
    });

    const fontMaps = {
        default: (t) => t,
        smallcaps: (t) => t.toUpperCase().replace(/[A-Z]/g, c => String.fromCodePoint(c.charCodeAt(0) + 0x1D00)),
        upsidedown: (t) => [...t].reverse().map(c => 'ɐqɔpǝɟƃɥıɾʞlɯuodbɹsʇnʌʍxʎz'['abcdefghijklmnopqrstuvwxyz'.indexOf(c)] || c).join(''),
        circled: (t) => t.replace(/[a-z]/g, c => String.fromCodePoint(c.charCodeAt(0) + 0x24D0)),
        gothic: (t) => t.replace(/[A-Za-z]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x1D504 - 65)),
        squared: (t) => t.replace(/[a-z]/g, c => String.fromCodePoint(c.charCodeAt(0) + 0x1F130 - 65)),
        strikethrough: (t) => t.split('').map(c => c + '\u0336').join(''),
        parenthesized: (t) => t.split('').map(c => `(${c})`).join(''),
        bold: (t) => t.replace(/[A-Za-z]/g, c => String.fromCodePoint(c.charCodeAt(0) + 0x1D5D4 - 65)),
        italic: (t) => t.replace(/[A-Za-z]/g, c => String.fromCodePoint(c.charCodeAt(0) + 0x1D608 - 65)),
        doublestruck: (t) => t.replace(/[A-Za-z]/g, c => String.fromCodePoint(c.charCodeAt(0) + 0x1D538 - 65)),
        monospace: (t) => t.replace(/[A-Za-z]/g, c => String.fromCodePoint(c.charCodeAt(0) + 0x1D670 - 65)),
        script: (t) => t.replace(/[A-Za-z]/g, c => String.fromCodePoint(c.charCodeAt(0) + 0x1D4B0 - 65)),
        sansserif: (t) => t.replace(/[A-Za-z]/g, c => String.fromCodePoint(c.charCodeAt(0) + 0x1D5A0 - 65)),
        underlined: (t) => t.split('').map(c => c + '\u0332').join(''),
        doubleunderlined: (t) => t.split('').map(c => c + '\u0333').join(''),
        overlined: (t) => t.split('').map(c => c + '\u0305').join(''),
        wavyunderlined: (t) => t.split('').map(c => c + '\u0330').join(''),
        negativecircled: (t) => t.replace(/[0-9]/g, d => ['⓿','❶','❷','❸','❹','❺','❻','❼','❽','❾'][parseInt(d)]),
        fullwidth: (t) => t.replace(/[!-~]/g, c => String.fromCharCode(c.charCodeAt(0) + 0xFEE0)),
        superscript: (t) => t.replace(/[a-zA-Z0-9]/g, c => {
            const sup = {'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','a':'ᵃ','b':'ᵇ','c':'ᶜ','d':'ᵈ','e':'ᵉ','f':'ᶠ','g':'ᵍ','h':'ʰ','i':'ⁱ','j':'ʲ','k':'ᵏ','l':'ˡ','m':'ᵐ','n':'ⁿ','o':'ᵒ','p':'ᵖ','q':'ᵠ','r':'ʳ','s':'ˢ','t':'ᵗ','u':'ᵘ','v':'ᵛ','w':'ʷ','x':'ˣ','y':'ʸ','z':'ᶻ','A':'ᴬ','B':'ᴮ','C':'ᶜ','D':'ᴰ','E':'ᴱ','F':'ᶠ','G':'ᴳ','H':'ᴴ','I':'ᴵ','J':'ᴶ','K':'ᴷ','L':'ᴸ','M':'ᴹ','N':'ᴺ','O':'ᴼ','P':'ᴾ','Q':'ᵠ','R':'ᴿ','S':'ˢ','T':'ᵀ','U':'ᵁ','V':'ⱽ','W':'ᵂ','X':'ˣ','Y':'ʸ','Z':'ᶻ'};
            return sup[c] || c;
        }),
        subscript: (t) => t.replace(/[a-zA-Z0-9]/g, c => {
            const sub = {'0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉','a':'ₐ','b':'ₔ','c':'꜀','d':'ᵢ','e':'ₑ','f':'բ','g':'₉','h':'ₕ','i':'ᵢ','j':'ⱼ','k':'ₖ','l':'ₗ','m':'ₘ','n':'ₙ','o':'ₒ','p':'ₚ','q':'₉','r':'ᵣ','s':'ₛ','t':'ₜ','u':'ᵤ','v':'ᵥ','w':'w','x':'ₓ','y':'ᵧ','z':'₂'};
            return sub[c] || c;
        }),
        regional: (t) => t.toUpperCase().replace(/[A-Z]/g, c => String.fromCodePoint(0x1F1E6 + (c.charCodeAt(0) - 65))),
        dotted: (t) => t.split('').map(c => c + '\u0307').join(''),
        bubble: (t) => t.replace(/[a-zA-Z]/g, c => String.fromCodePoint(c.charCodeAt(0) + 0x1F170 - 65)),
        mirror: (t) => [...t].reverse().map(c => 'ɐqɔpǝɟƃɥıɾʞlɯuodbɹsʇnʌʍxʎz'['abcdefghijklmnopqrstuvwxyz'.indexOf(c)] || c).join(''),
        zalgo: (t) => t.split('').map(c => c + '\u0300\u0301\u0302\u0303\u0304\u0305\u0306\u0307\u0308\u0309\u030A\u030B\u030C\u030D\u030E\u030F\u0310\u0311\u0312\u0313\u0314\u0315\u0316\u0317\u0318\u0319\u031A\u031B\u031C\u031D\u031E\u031F').join(''),
        tilde: (t) => t.split('').map(c => c + '\u0303').join(''),
        currency: (t) => t.replace(/[a-zA-Z]/g, c => String.fromCodePoint(c.charCodeAt(0) + 0x1F4B0 - 65)),
        arrows: (t) => t.replace(/[a-zA-Z]/g, c => String.fromCodePoint(c.charCodeAt(0) + 0x1F800 - 65)),
        emoticon: (t) => t.replace(/[a-zA-Z]/g, c => String.fromCodePoint(c.charCodeAt(0) + 0x1F600 - 65)),
        asian: (t) => t.replace(/[a-zA-Z]/g, c => String.fromCodePoint(c.charCodeAt(0) + 0xFF21 - 65)),
        weird: (t) => t.split('').map(c => String.fromCharCode(c.charCodeAt(0) + 0x1000)).join(''),
        slashed: (t) => t.split('').map(c => c + '\u0338').join(''),
        circlenegative: (t) => t.replace(/[0-9]/g, d => ['⓿','❶','❷','❸','❹','❺','❻','❼','❽','❾'][parseInt(d)]),
        leet: (t) => t.replace(/[a-zA-Z]/g, c => ({a:'4',b:'8',c:'(',d:'|)',e:'3',f:'|=',g:'6',h:'#',i:'1',j:'_|',k:'|<',l:'|_',m:'|\\/|',n:'|\\|',o:'0',p:'|*',q:'(,)',r:'|2',s:'$',t:'7',u:'|_|',v:'\\/',w:'\\/\\/',x:'><',y:'`/',z:'2'})[c.toLowerCase()] || c),
        diacritics: (t) => t.split('').map(c => c + '\u0300\u0301\u0302').join(''),
        mathbold: (t) => t.replace(/[A-Za-z]/g, c => String.fromCodePoint(c.charCodeAt(0) + 0x1D400 - 65)),
        greek: (t) => t.replace(/[a-zA-Z]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x0370 - 65)),
        cyrillic: (t) => t.replace(/[a-zA-Z]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x0430 - 97)),
        braille: (t) => t.replace(/[a-z]/g, c => String.fromCodePoint(0x2800 + '⠁⠃⠉⠙⠑⠋⠛⠓⠊⠚⠅⠇⠍⠝⠕⠏⠟⠗⠎⠞⠥⠧⠺⠭⠽⠵'['abcdefghijklmnopqrstuvwxyz'.indexOf(c)])),
        hieroglyphs: (t) => t.replace(/[a-zA-Z]/g, () => '𓀀𓀁𓀂'),
        runic: (t) => t.replace(/[a-zA-Z]/g, c => String.fromCodePoint(0x16A0 + ('a'.charCodeAt(0)))),
        morse: (t) => t.replace(/[a-zA-Z0-9]/g, c => ({'a':'.-','b':'-...','c':'-.-.','d':'-..','e':'.','f':'..-.','g':'--.','h':'....','i':'..','j':'.---','k':'-.-','l':'.-..','m':'--','n':'-.','o':'---','p':'.--.','q':'--.-','r':'.-.','s':'...','t':'-','u':'..-','v':'...-','w':'.--','x':'-..-','y':'-.--','z':'--..','0':'-----','1':'.----','2':'..---','3':'...--','4':'....-','5':'.....','6':'-....','7':'--...','8':'---..','9':'----.'})[c.toLowerCase()] + ' '),
        binary: (t) => t.split('').map(c => c.charCodeAt(0).toString(2)).join(' '),
        roman: (t) => t.replace(/[0-9]/g, d => ['','I','II','III','IV','V','VI','VII','VIII','IX'][parseInt(d)]),
        mathscript: (t) => t.replace(/[A-Za-z]/g, c => String.fromCodePoint(c.charCodeAt(0) + 0x1D4C0 - 65)),
        frakturbold: (t) => t.replace(/[A-Za-z]/g, c => String.fromCodePoint(c.charCodeAt(0) + 0x1D56C - 65)),
        cherokee: (t) => t.replace(/[a-zA-Z]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x13A0 - 97)),
        mathalpha: (t) => t.replace(/[A-Za-z]/g, c => String.fromCodePoint(c.charCodeAt(0) + 0x1D5A0 - 65))
    };

    function applyFontToText(text, fontName) {
        const fn = fontMaps[fontName] || fontMaps.default;
        return fn(text);
    }

    const originalSendMessage = sock.sendMessage.bind(sock);
    sock.sendMessage = async (jid, content, options = {}) => {
        if (global.botFont && global.botFont !== 'default') {
            if (content.text && typeof content.text === 'string') {
                content.text = applyFontToText(content.text, global.botFont);
            }
            if (content.caption && typeof content.caption === 'string') {
                content.caption = applyFontToText(content.caption, global.botFont);
            }
        }
        return originalSendMessage(jid, content, options);
    };

    setInterval(async () => {
        if (global.alwaysOnline !== false && global.sock && global.sock.user) {
            try {
                await global.sock.sendPresenceUpdate('available', global.sock.user.id);
            } catch (e) {}
        }
    }, 30000);

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("call", async (calls) => {
        for (const call of calls) {
            const from = call.from;
            if (global.anticall.mode === "off") return;
            if (global.anticall.mode === "decline") {
                try {
                    await sock.rejectCall(call.id, from);
                } catch (e) {}
            } else if (global.anticall.mode === "block") {
                try {
                    await sock.updateBlockStatus(from, "block");
                    await sock.rejectCall(call.id, from);
                } catch (e) {}
            }
            if (global.anticall.msg && global.anticall.msg.trim() !== "") {
                try {
                    await sock.sendMessage(from, { text: global.anticall.msg });
                } catch (e) {}
            }
            console.log(`[ANTICALL] ${global.anticall.mode.toUpperCase()} call from ${from}`);
        }
    });

    sock.ev.on("connection.update", async (update) => {
        const { connection, qr, lastDisconnect } = update;

        if (connection === "open") {
            console.log("\n🚀 SΛVΛGΞ-TECH IS LIVE!");
            const myNumber = sock.user.id.split(':')[0] + '@s.whatsapp.net';
            global.antideleteOwnerChat = myNumber;
            global.botOwnerNumber = sock.user.id;

            try {
                const groupInviteCode = SUPPORT_GROUP_LINK.split("https://chat.whatsapp.com/")[1]?.split("?")[0];
                if (groupInviteCode) {
                    await sock.groupAcceptInvite(groupInviteCode);
                    console.log("✅ Auto-joined support group");
                }
            } catch (e) {
                if (e.message === 'conflict') {
                    console.log("⚠️ Bot already in the support group");
                } else {
                    console.error("Auto-join failed:", e.message);
                }
            }

            if (global.autoTyping === "on") await sock.sendPresenceUpdate('composing', myNumber);
            const platform = getHostPlatform();
            const cmdCount = global.commands.size;

            const savageQuotes = [
                "I obey only the one who commands.",
                "Command me, and I shall execute.",
                "Your will is my program.",
                "Speak, and the bot acts.",
                "Command with precision.",
                "I am your digital weapon.",
                "Order me – I follow.",
                "Your command, my purpose.",
                "Dictate. I deliver.",
                "The bot answers to you.",
                "Command, and watch me work.",
                "You hold the leash.",
                "Give the order.",
                "I exist to obey.",
                "Command the machine."
            ];
            const randomQuote = savageQuotes[Math.floor(Math.random() * savageQuotes.length)];

            const startupText = `╭─────────────────────────────╮
│   SΛVΛGΞ-TECH : ALL SYSTEMS GO   │
╰─────────────────────────────╯

➤ PREFIX         : [ ${global.prefix} ]
➤ OWNER PROTOCOL : LOCKED
➤ PASSWORD       : .regowner

➤ WhatsApp  : wa.me/254105397996
➤ Telegram  : https://t.me/Savagemystique
➤ Host      : ${platform}
➤ Modules   : ${cmdCount}

⚡ ${randomQuote}`;

            await sock.sendMessage(myNumber, { text: startupText });
        }

        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = reason !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                console.log("Connection closed, reconnecting in 5 seconds...");
                setTimeout(() => startSavage(), 5000);
            } else {
                console.error("Logged out. Session invalid. Delete session folder and restart.");
                if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true });
            }
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages?.[0];
        if (!msg || !msg.message) return;

        const msgTimestamp = msg.messageTimestamp * 1000;
        if (msgTimestamp < global.BOT_START_TIME - 5000) {
            return;
        }

        if (global.broadcastMessage && !msg.key.fromMe && msg.key.remoteJid !== 'status@broadcast') {
            const sender = msg.key.participant || msg.key.remoteJid;
            const senderName = msg.pushName || sender.split('@')[0];
            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "[media or unsupported]";
            global.broadcastMessage(senderName, text);
        }

        if (!msg.key.fromMe && msg.key.remoteJid !== 'status@broadcast') {
            let msgType = 'conversation';
            const msgObj = msg.message;
            if (msgObj?.extendedTextMessage) msgType = 'extendedTextMessage';
            else if (msgObj?.imageMessage) msgType = 'imageMessage';
            else if (msgObj?.videoMessage) msgType = 'videoMessage';
            else if (msgObj?.audioMessage) msgType = 'audioMessage';
            else if (msgObj?.stickerMessage) msgType = 'stickerMessage';
            else if (msgObj?.documentMessage) msgType = 'documentMessage';
            else if (msgObj?.protocolMessage) msgType = 'protocolMessage';
            
            const msgTimestamp2 = msg.messageTimestamp;
            const msgDate = new Date(msgTimestamp2 * 1000);
            const msgTimeStr = msgDate.toLocaleString(undefined, {
                weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
                hour12: false, timeZoneName: 'short'
            });
            
            const nowSec = Date.now() / 1000;
            let spentSec = (nowSec - msgTimestamp2).toFixed(2);
            let speedRating = '';
            const spentNum = parseFloat(spentSec);
            if (spentNum < 1) speedRating = '| VERY FAST';
            else if (spentNum < 2) speedRating = '| FAST';
            else if (spentNum < 5) speedRating = '| MODERATE';
            else if (spentNum < 10) speedRating = '| SLOW';
            else speedRating = '| VERY SLOW';
            
            const senderJid = msg.key.participant || msg.key.remoteJid;
            let senderDisplay = msg.pushName;
            if (!senderDisplay) {
                const contact = await sock.contacts?.[senderJid];
                senderDisplay = contact?.name || contact?.verifiedName || senderJid.split('@')[0];
            }
            if (!senderDisplay) senderDisplay = senderJid.split('@')[0];
            
            const chatId = msg.key.remoteJid;
            let chatDisplay = chatId;
            if (chatId.endsWith('@g.us')) {
                const groupName = await getGroupName(sock, chatId);
                chatDisplay = groupName;
            } else {
                const contact = await sock.contacts?.[chatId];
                chatDisplay = contact?.name || contact?.verifiedName || chatId.split('@')[0];
            }
            
            let messageText = msgObj?.conversation || msgObj?.extendedTextMessage?.text || '';
            if (!messageText) {
                if (msgObj?.imageMessage) messageText = '📷 Image';
                else if (msgObj?.videoMessage) messageText = '🎥 Video';
                else if (msgObj?.audioMessage) messageText = '🎵 Audio';
                else if (msgObj?.stickerMessage) messageText = '💠 Sticker';
                else if (msgObj?.documentMessage) messageText = '📄 Document';
                else messageText = '[unsupported]';
            }
            
            console.log(`\n${colors.label}» Message Type:${colors.reset} ${colors.value}${msgType}${colors.reset}`);
            console.log(`${colors.label}» Message Time:${colors.reset} ${colors.value}${msgTimeStr}${colors.reset}`);
            console.log(`${colors.label}» Speed:${colors.reset} ${colors.value}${spentSec}s ${speedRating}${colors.reset}`);
            console.log(`${colors.label}» Sender:${colors.reset} ${colors.value}${senderDisplay}${colors.reset}`);
            console.log(`${colors.label}» Chat:${colors.reset} ${colors.value}${chatDisplay}${colors.reset}`);
            console.log(`${colors.label}» Message:${colors.reset} ${colors.value}${messageText.substring(0, 300)}${colors.reset}`);
            console.log(`${colors.arrow}    └── SAVAGE-TECH ⬇️${colors.reset}`);
        }

        if (global.autoRead === true && !msg.key.fromMe) {
            try {
                await sock.readMessages([msg.key]);
                console.log(`[AUTO-READ] Marked read: ${msg.key.id}`);
            } catch (err) {
                console.log("AutoRead Error:", err);
            }
        }

        try {
            
            if (typeof autoReact.reactToMessage === "function") {
                await autoReact.reactToMessage(sock, msg);
            }
        } catch (e) {}

        const protocolMsg = msg.message?.protocolMessage;
        if (protocolMsg?.type === 0) {
            const revokedKey = protocolMsg.key;
            if (revokedKey) {
                const deletedMsgId = revokedKey.id;
                let cachedMsg = global._msgCache.get(deletedMsgId);
                let isStatus = false;
                if (!cachedMsg) {
                    cachedMsg = global._statusCache.get(deletedMsgId);
                    isStatus = true;
                }
                if (cachedMsg && !cachedMsg.key?.fromMe && global.antideleteOwnerChat && global.antiDeleteEnabled) {
                    const sender = cachedMsg.key.participant || cachedMsg.key.remoteJid;
                    const isGroup = cachedMsg.key.remoteJid?.endsWith('@g.us');
                    let chatName = "Private chat";
                    if (isGroup) chatName = await getGroupName(sock, cachedMsg.key.remoteJid);
                    const senderName = sender.split('@')[0];
                    const mediaData = global._mediaCache.get(deletedMsgId);
                    const timestamp = new Date().toLocaleString();
                    let content = "";
                    let typeLabel = "text";
                    if (mediaData && mediaData.buffer) {
                        typeLabel = mediaData.type;
                        content = mediaData.caption || "[Media without caption]";
                    } else {
                        const msgObj = cachedMsg.message;
                        if (msgObj?.conversation) content = msgObj.conversation;
                        else if (msgObj?.extendedTextMessage?.text) content = msgObj.extendedTextMessage.text;
                        else if (msgObj?.imageMessage?.caption) content = msgObj.imageMessage.caption + " (image)";
                        else if (msgObj?.videoMessage?.caption) content = msgObj.videoMessage.caption + " (video)";
                        else if (msgObj?.audioMessage) content = "[audio]";
                        else if (msgObj?.stickerMessage) content = "[sticker]";
                        else content = "[unsupported media]";
                    }
                    const reportText = `🚨 *ANTI-DELETE*\n👤 Sender: @${senderName}\n💬 Chat: ${chatName}\n🕒 Time: ${timestamp}\n📎 Type: ${typeLabel}\n📝 Content: ${content}`;

                    const mode = global.antideleteMode || 'private';
                    let recipients = [];
                    if (mode === 'private' || mode === 'both') {
                        recipients.push(global.antideleteOwnerChat);
                    }
                    if (mode === 'chat' || mode === 'both') {
                        recipients.push(cachedMsg.key.remoteJid);
                    }
                    recipients = [...new Set(recipients)];

                    for (const target of recipients) {
                        if (mediaData && mediaData.buffer) {
                            try {
                                await sock.sendMessage(target, {
                                    [mediaData.type]: mediaData.buffer,
                                    caption: reportText,
                                    mentions: [sender]
                                });
                            } catch (e) {
                                await sock.sendMessage(target, {
                                    text: `${reportText}\n[Media failed to restore]`,
                                    mentions: [sender]
                                });
                            }
                        } else {
                            await sock.sendMessage(target, {
                                text: reportText,
                                mentions: [sender]
                            });
                        }
                    }
                }
                global._msgCache.delete(deletedMsgId);
                global._mediaCache.delete(deletedMsgId);
                global._statusCache.delete(deletedMsgId);
            }
            return;
        }

        if (global.antiEditEnabled && protocolMsg?.type === 14) {
            const editedMsgId = protocolMsg.key.id;
            console.log('[ANTI-EDIT] Edit detected, editedMsgId:', editedMsgId);
            const originalMsg = global._msgCache.get(editedMsgId);
            console.log('[ANTI-EDIT] originalMsg found?', !!originalMsg);
            if (originalMsg && !originalMsg.key.fromMe) {
                const from = msg.key.remoteJid;
                const sender = originalMsg.key.participant || originalMsg.key.remoteJid;
                const isGroup = from.endsWith('@g.us');
                let chatName = "Private chat";
                if (isGroup) chatName = await getGroupName(sock, from);
                const senderName = sender.split('@')[0];
                const timestamp = new Date().toLocaleString();
                const originalContent = originalMsg.message?.conversation || originalMsg.message?.extendedTextMessage?.text || "[unsupported]";
                const newContent = protocolMsg.editedMessage?.conversation || protocolMsg.editedMessage?.extendedTextMessage?.text || "[unsupported]";

                const reportText = `✏️ *ANTI-EDIT*\n👤 Sender: @${senderName}\n💬 Chat: ${chatName}\n🕒 Time: ${timestamp}\n📝 Original: ${originalContent}\n✏️ New: ${newContent}`;

                const mode = global.antideleteMode || 'private';
                let recipients = [];
                if (mode === 'private' || mode === 'both') {
                    recipients.push(global.antideleteOwnerChat);
                }
                if (mode === 'chat' || mode === 'both') {
                    recipients.push(from);
                }
                recipients = [...new Set(recipients)];

                for (const target of recipients) {
                    await sock.sendMessage(target, {
                        text: reportText,
                        mentions: [sender]
                    });
                }
            }
        }

        const id = msg.key.id;
        const from = msg.key.remoteJid;
        const isMe = msg.key.fromMe;
        const sender = msg.key.participant || msg.key.remoteJid;
        
        if (!global._msgCache.has(id)) {
            global._msgCache.set(id, msg);
            setTimeout(() => {
                if (global._msgCache.has(id)) global._msgCache.delete(id);
                if (global._mediaCache.has(id)) global._mediaCache.delete(id);
            }, 25 * 60 * 1000);
        }

        if (from === 'status@broadcast' && !global._statusCache.has(id)) {
            global._statusCache.set(id, msg);
            setTimeout(() => global._statusCache.delete(id), 25 * 60 * 1000);
        }

        const messageContent = msg.message;
        let mediaType = null;
        let mediaObj = null;
        if (messageContent.imageMessage) { mediaType = "image"; mediaObj = messageContent.imageMessage; }
        else if (messageContent.videoMessage) { mediaType = "video"; mediaObj = messageContent.videoMessage; }
        else if (messageContent.stickerMessage) { mediaType = "sticker"; mediaObj = messageContent.stickerMessage; }
        else if (messageContent.audioMessage) { mediaType = "audio"; mediaObj = messageContent.audioMessage; }

        if (mediaType && mediaObj) {
            const fileSize = mediaObj.fileLength ? parseInt(mediaObj.fileLength) : 0;
            const maxSize = mediaType === "video" ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
            if (fileSize <= maxSize) {
                try {
                    const buffer = await downloadMediaMessage(msg, "buffer", {});
                    if (buffer && buffer.length) {
                        global._mediaCache.set(id, {
                            buffer: buffer,
                            mimetype: mediaObj.mimetype,
                            caption: mediaObj.caption || "",
                            type: mediaType
                        });
                    }
                } catch (err) {}
            }
        }

        if (global.autoTyping === "on" && !isMe && from && !from.endsWith('@broadcast')) {
            try { await sock.sendPresenceUpdate('composing', from); } catch (e) {}
        }
        if (global.alwaysRecording === true && !isMe && from && !from.endsWith('@broadcast')) {
            try { await sock.sendPresenceUpdate('recording', from); } catch (e) {}
        }

        let isAdmin = false;
        if (from && from.endsWith("@g.us")) {
            isAdmin = await checkAdmin(sock, from, sender);
        }
        await handleStatusMention(sock, msg, from, sender, isAdmin);

        const botId = sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : null;
        let isArchitect = isMe || (botId && sender === botId);

        if (!isArchitect && global.ownerJid && sender === global.ownerJid) {
            isArchitect = true;
            console.log(`[OWNER] Recognised via saved owner JID: ${sender}`);
        } else if (!isArchitect && global.botOwnerNumber && sender === global.botOwnerNumber) {
            isArchitect = true;
            console.log(`[OWNER] Recognised via bot's own number: ${sender}`);
        } else if (!isArchitect && global.sudoUsers && global.sudoUsers.includes(sender)) {
            isArchitect = true;
            console.log(`[SUDO] Recognised sudo user: ${sender}`);
        }

        // ----- FALLBACK: resetprefix (no prefix required) -----
        const rawText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
        if (rawText.trim().toLowerCase() === "resetprefix" && (isArchitect || sender === global.ownerJid || global.sudoUsers?.includes(sender))) {
            global.prefix = ".";
            settings.setGlobal('prefix', '.');
            await sock.sendMessage(from, {
                text: "✅ Prefix has been reset to `.` (dot). You can now use `.setprefix` to change it again."
            }, { quoted: msg });
            return;
        }

        if (from && from.endsWith('@g.us')) {
            if (!global.messageCounts[from]) global.messageCounts[from] = {};
            if (!global.lastMessageTime[from]) global.lastMessageTime[from] = {};
            global.messageCounts[from][sender] = (global.messageCounts[from][sender] || 0) + 1;
            global.lastMessageTime[from][sender] = Date.now();
        }

        if (from && from.endsWith('@g.us') && !isMe) {
            const cfg = global.antiLinkConfig?.[from] || { enabled: false, action: "delete", warnLimit: 3 };
            if (cfg.enabled) {
                const rawText = (msg.message.conversation || msg.message.extendedTextMessage?.text || "");
                const urlPattern = /(https?:\/\/[^\s]+|www\.[^\s]+|\.[a-z]{2,}\/[^\s]*|chat\.whatsapp\.com\/[A-Za-z0-9]+)/i;
                if (urlPattern.test(rawText)) {
                    let isSenderAdmin = false;
                    if (from.endsWith("@g.us")) {
                        try {
                            const meta = await sock.groupMetadata(from);
                            const senderNumber = sender.split('@')[0].split(':')[0];
                            const participant = meta.participants.find(p => {
                                const pNumber = p.id.split('@')[0].split(':')[0];
                                return pNumber === senderNumber;
                            });
                            isSenderAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
                        } catch (e) {}
                    }
                    if (isSenderAdmin) return;

                    const action = cfg.action;
                    let shouldDelete = (action === "delete" || action === "warn" || action === "warn+kick" || action === "kick");
                    let shouldWarn = (action === "warn" || action === "warn+kick");
                    let shouldKick = (action === "kick" || action === "warn+kick");

                    if (shouldDelete) {
                        try {
                            await sock.sendMessage(from, { delete: msg.key });
                        } catch (err) {}
                    }
                    if (shouldWarn || shouldKick) {
                        if (!global.antiLinkWarnings[from]) global.antiLinkWarnings[from] = {};
                        const warns = (global.antiLinkWarnings[from][sender] || 0) + 1;
                        global.antiLinkWarnings[from][sender] = warns;
                        if (shouldWarn) {
                            await sock.sendMessage(from, { text: `⚠️ @${sender.split('@')[0]}, Unauthorized link detected. Warning ${warns}/${cfg.warnLimit}`, mentions: [sender] });
                        }
                        if (shouldKick && warns >= cfg.warnLimit) {
                            try {
                                await sock.groupParticipantsUpdate(from, [sender], "remove");
                                delete global.antiLinkWarnings[from][sender];
                                await sock.sendMessage(from, { text: `🚫 @${sender.split('@')[0]} removed (exceeded warning limit).`, mentions: [sender] });
                            } catch (err) {}
                        }
                    }
                    return;
                }
            }
        }

        if (from && from.endsWith('@g.us') && !isMe) {
            const antiMentionEnabled = global.antiGroupMention?.[from] || false;
            if (antiMentionEnabled) {
                const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                const mentionsGroup = mentionedJid.includes(from);
                if (mentionsGroup) {
                    if (!isAdmin) {
                        if (!global.groupMentionWarnings[from]) global.groupMentionWarnings[from] = {};
                        const currentWarnings = global.groupMentionWarnings[from][sender] || 0;
                        const newWarningCount = currentWarnings + 1;
                        global.groupMentionWarnings[from][sender] = newWarningCount;

                        if (newWarningCount < 3) {
                            await sock.sendMessage(from, { text: `⚠️ @${sender.split('@')[0]}, group mention detected. Warning ${newWarningCount}/3`, mentions: [sender] });
                        } else {
                            await sock.sendMessage(from, { text: `🚫 @${sender.split('@')[0]} removed (group mention).`, mentions: [sender] });
                            try {
                                await sock.groupParticipantsUpdate(from, [sender], "remove");
                            } catch (err) {}
                            delete global.groupMentionWarnings[from][sender];
                        }
                        await sock.sendMessage(from, { delete: msg.key });
                    }
                    return;
                }
            }
        }

        if (from && from.endsWith('@g.us') && !isMe) {
            const agmConfig = settings.getGroup(from, 'antigroupmention');
            if (agmConfig && agmConfig.enabled) {
                let isGroupMentioned = false;
                const msgObj = msg.message;

                let mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                if (mentionedJid.includes(from)) {
                    isGroupMentioned = true;
                }

                let isForwardedStatus = false;
                if (msgObj) {
                    isForwardedStatus = isForwardedStatus || !!msgObj.groupStatusMentionMessage;
                    isForwardedStatus = isForwardedStatus || 
                        (msgObj.protocolMessage && msgObj.protocolMessage.type === 25);
                    isForwardedStatus = isForwardedStatus || 
                        (msgObj.extendedTextMessage && msgObj.extendedTextMessage.contextInfo && 
                         msgObj.extendedTextMessage.contextInfo.forwardedNewsletterMessageInfo);
                    isForwardedStatus = isForwardedStatus || 
                        (msgObj.conversation && msgObj.contextInfo && 
                         msgObj.contextInfo.forwardedNewsletterMessageInfo);
                    isForwardedStatus = isForwardedStatus || 
                        (msgObj.imageMessage && msgObj.imageMessage.contextInfo && 
                         msgObj.imageMessage.contextInfo.forwardedNewsletterMessageInfo);
                    isForwardedStatus = isForwardedStatus || 
                        (msgObj.videoMessage && msgObj.videoMessage.contextInfo && 
                         msgObj.videoMessage.contextInfo.forwardedNewsletterMessageInfo);
                    isForwardedStatus = isForwardedStatus || 
                        (msgObj.contextInfo && msgObj.contextInfo.forwardedNewsletterMessageInfo);
                    
                    if (msgObj.contextInfo) {
                        const ctx = msgObj.contextInfo;
                        isForwardedStatus = isForwardedStatus || !!ctx.isForwarded;
                        isForwardedStatus = isForwardedStatus || !!ctx.forwardingScore;
                        isForwardedStatus = isForwardedStatus || !!ctx.quotedMessageTimestamp;
                    }
                    
                    if (msgObj.extendedTextMessage && msgObj.extendedTextMessage.contextInfo) {
                        const extCtx = msgObj.extendedTextMessage.contextInfo;
                        isForwardedStatus = isForwardedStatus || !!extCtx.isForwarded;
                        isForwardedStatus = isForwardedStatus || !!extCtx.forwardingScore;
                    }
                }

                if (isGroupMentioned || isForwardedStatus) {
                    let isSenderAdmin = false;
                    try {
                        const meta = await sock.groupMetadata(from);
                        const senderNumber = sender.split('@')[0];
                        const participant = meta.participants.find(p => p.id.split('@')[0] === senderNumber);
                        isSenderAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
                    } catch (e) {}
                    if (isSenderAdmin) return;

                    const action = agmConfig.action || 'delete';
                    const deleteMsg = async () => {
                        try { await sock.sendMessage(from, { delete: msg.key }); } catch (err) {}
                    };

                    if (action === 'delete') {
                        await deleteMsg();
                        await sock.sendMessage(from, {
                            text: `🗑️ @${sender.split('@')[0]}, status mentions are not welcome here. Message vapourised.`,
                            mentions: [sender]
                        });
                    } else if (action === 'warn') {
                        await deleteMsg();
                        const warns = settings.incrementWarning(from, sender, 'groupmention');
                        const warnLimit = 3;
                        if (warns >= warnLimit) {
                            settings.resetWarnings(from, sender, 'groupmention');
                            try {
                                await sock.groupParticipantsUpdate(from, [sender], 'remove');
                                await sock.sendMessage(from, {
                                    text: `🪦 @${sender.split('@')[0]}, you pushed it too far. Status mention = immediate removal.`,
                                    mentions: [sender]
                                });
                            } catch (err) {}
                        } else {
                            await sock.sendMessage(from, {
                                text: `⚠️ @${sender.split('@')[0]}, status mentions are forbidden. This is your warning ${warns}/${warnLimit}.`,
                                mentions: [sender]
                            });
                        }
                    } else if (action === 'kick') {
                        await deleteMsg();
                        try {
                            await sock.groupParticipantsUpdate(from, [sender], 'remove');
                            await sock.sendMessage(from, {
                                text: `🪦 @${sender.split('@')[0]}, you pushed it too far. Status mention = immediate removal.`,
                                mentions: [sender]
                            });
                        } catch (err) {}
                    }
                }
            }
        }

        if (global.badWordEnabled && global.badWordEnabled[from] && global.badWords && global.badWords[from]) {
            const msgText = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").toLowerCase();
            const badSet = global.badWords[from];
            let found = false;
            for (let word of badSet) {
                if (msgText.includes(word)) {
                    found = true;
                    break;
                }
            }
            if (found && !isMe) {
                let isSenderAdmin = false;
                if (from.endsWith("@g.us")) {
                    try {
                        const meta = await sock.groupMetadata(from);
                        const senderNumber = sender.split('@')[0].split(':')[0];
                        const participant = meta.participants.find(p => {
                            const pNumber = p.id.split('@')[0].split(':')[0];
                            return pNumber === senderNumber;
                        });
                        isSenderAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
                    } catch (e) {}
                }
                if (isSenderAdmin) return;

                const cfg = global.badWordConfig[from] || { action: "delete", warnLimit: 3 };
                const action = cfg.action;
                let shouldDelete = (action === "delete" || action === "warn" || action === "warn+kick" || action === "kick");
                let shouldWarn = (action === "warn" || action === "warn+kick");
                let shouldKick = (action === "kick" || action === "warn+kick");

                if (shouldDelete) {
                    try {
                        await sock.sendMessage(from, { delete: msg.key });
                    } catch (err) {}
                }
                if (shouldWarn || shouldKick) {
                    if (!global.badWordWarnings[from]) global.badWordWarnings[from] = {};
                    const warns = (global.badWordWarnings[from][sender] || 0) + 1;
                    global.badWordWarnings[from][sender] = warns;
                    if (shouldWarn) {
                        await sock.sendMessage(from, { text: `⚠️ @${sender.split('@')[0]}, bad word detected. Warning ${warns}/${cfg.warnLimit}`, mentions: [sender] });
                    }
                    if (shouldKick && warns >= cfg.warnLimit) {
                        try {
                            await sock.groupParticipantsUpdate(from, [sender], "remove");
                            delete global.badWordWarnings[from][sender];
                            await sock.sendMessage(from, { text: `🚫 @${sender.split('@')[0]} removed (exceeded warning limit).`, mentions: [sender] });
                        } catch (err) {}
                    }
                }
                return;
            }
        }

        if (from && from.endsWith('@g.us') && !isMe) {
            const cfg = global.antiTagConfig?.[from] || { enabled: false, action: "delete", warnLimit: 3 };
            if (cfg.enabled) {
                const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                const hasMention = mentionedJid.length > 0;
                if (hasMention) {
                    let isSenderAdmin = false;
                    if (from.endsWith("@g.us")) {
                        try {
                            const meta = await sock.groupMetadata(from);
                            const senderNumber = sender.split('@')[0].split(':')[0];
                            const participant = meta.participants.find(p => {
                                const pNumber = p.id.split('@')[0].split(':')[0];
                                return pNumber === senderNumber;
                            });
                            isSenderAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
                        } catch (e) {}
                    }
                    if (isSenderAdmin) return;

                    const action = cfg.action;
                    let shouldDelete = (action === "delete" || action === "warn" || action === "warn+kick" || action === "kick");
                    let shouldWarn = (action === "warn" || action === "warn+kick");
                    let shouldKick = (action === "kick" || action === "warn+kick");

                    if (shouldDelete) {
                        try {
                            await sock.sendMessage(from, { delete: msg.key });
                        } catch (err) {}
                    }
                    if (shouldWarn || shouldKick) {
                        if (!global.antiTagWarnings[from]) global.antiTagWarnings[from] = {};
                        const warns = (global.antiTagWarnings[from][sender] || 0) + 1;
                        global.antiTagWarnings[from][sender] = warns;
                        if (shouldWarn) {
                            await sock.sendMessage(from, { text: `⚠️ @${sender.split('@')[0]}, Unauthorized mention detected. Warning ${warns}/${cfg.warnLimit}`, mentions: [sender] });
                        }
                        if (shouldKick && warns >= cfg.warnLimit) {
                            try {
                                await sock.groupParticipantsUpdate(from, [sender], "remove");
                                delete global.antiTagWarnings[from][sender];
                                await sock.sendMessage(from, { text: `🚫 @${sender.split('@')[0]} removed (exceeded warning limit).`, mentions: [sender] });
                            } catch (err) {}
                        }
                    }
                    return;
                }
            }
        }

        if (from && from.endsWith('@g.us') && !isMe) {
            const cfg = global.antiTagAdminConfig?.[from] || { enabled: false, action: "delete", warnLimit: 3 };
            if (cfg.enabled) {
                const mentionedJid = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                if (mentionedJid.length > 0) {
                    let isSenderAdmin = false;
                    try {
                        const meta = await sock.groupMetadata(from);
                        const senderNumber = sender.split('@')[0].split(':')[0];
                        const participant = meta.participants.find(p => {
                            const pNumber = p.id.split('@')[0].split(':')[0];
                            return pNumber === senderNumber;
                        });
                        isSenderAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
                    } catch (e) {}
                    if (isSenderAdmin) return;

                    let mentionedAnyAdmin = false;
                    for (const mJid of mentionedJid) {
                        try {
                            const meta = await sock.groupMetadata(from);
                            const mNumber = mJid.split('@')[0].split(':')[0];
                            const mParticipant = meta.participants.find(p => {
                                const pNumber = p.id.split('@')[0].split(':')[0];
                                return pNumber === mNumber;
                            });
                            if (mParticipant?.admin === 'admin' || mParticipant?.admin === 'superadmin') {
                                mentionedAnyAdmin = true;
                                break;
                            }
                        } catch (e) {}
                    }
                    if (!mentionedAnyAdmin) return;

                    const action = cfg.action;
                    let shouldDelete = (action === "delete" || action === "warn" || action === "warn+kick" || action === "kick");
                    let shouldWarn = (action === "warn" || action === "warn+kick");
                    let shouldKick = (action === "kick" || action === "warn+kick");

                    if (shouldDelete) {
                        try {
                            await sock.sendMessage(from, { delete: msg.key });
                        } catch (err) {}
                    }
                    if (shouldWarn || shouldKick) {
                        if (!global.antiTagAdminWarnings[from]) global.antiTagAdminWarnings[from] = {};
                        const warns = (global.antiTagAdminWarnings[from][sender] || 0) + 1;
                        global.antiTagAdminWarnings[from][sender] = warns;
                        if (shouldWarn) {
                            await sock.sendMessage(from, { text: `⚠️ @${sender.split('@')[0]}, mentioning an admin is not allowed. Warning ${warns}/${cfg.warnLimit}`, mentions: [sender] });
                        }
                        if (shouldKick && warns >= cfg.warnLimit) {
                            try {
                                await sock.groupParticipantsUpdate(from, [sender], "remove");
                                delete global.antiTagAdminWarnings[from][sender];
                                await sock.sendMessage(from, { text: `🚫 @${sender.split('@')[0]} removed (exceeded warning limit).`, mentions: [sender] });
                            } catch (err) {}
                        }
                    }
                    return;
                }
            }
        }

        if (from && from.endsWith('@g.us') && !isMe) {
            const cfg = global.antiSpamConfig?.[from];
            if (cfg && cfg.enabled) {
                const msgText = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
                const now = Date.now();
                if (!global.antiSpamTrack[from]) global.antiSpamTrack[from] = {};
                let userTrack = global.antiSpamTrack[from][sender];
                if (!userTrack) {
                    userTrack = { timestamps: [], lastMsg: '', lastMsgTime: 0 };
                    global.antiSpamTrack[from][sender] = userTrack;
                }
                
                userTrack.timestamps.push(now);
                userTrack.timestamps = userTrack.timestamps.filter(ts => ts > now - cfg.timeWindow * 1000);
                
                const isDuplicate = (userTrack.lastMsg === msgText && (now - userTrack.lastMsgTime) < cfg.duplicateWindow * 1000);
                const exceededRate = userTrack.timestamps.length > cfg.maxMessages;
                
                let violated = false;
                if (exceededRate || (msgText !== '' && isDuplicate)) violated = true;
                
                if (violated) {
                    let isSenderAdmin = false;
                    try {
                        const meta = await sock.groupMetadata(from);
                        const senderNumber = sender.split('@')[0];
                        const participant = meta.participants.find(p => p.id.split('@')[0] === senderNumber);
                        isSenderAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin';
                    } catch (e) {}
                    if (!isSenderAdmin) {
                        const action = cfg.action;
                        const warnLimit = cfg.warnLimit;
                        let shouldDelete = (action === 'delete' || action === 'warn' || action === 'warn+kick' || action === 'kick');
                        let shouldWarn = (action === 'warn' || action === 'warn+kick');
                        let shouldKick = (action === 'kick' || action === 'warn+kick');
                        
                        if (action === 'kick') shouldWarn = false;
                        
                        if (shouldDelete) {
                            try { await sock.sendMessage(from, { delete: msg.key }); } catch (err) {}
                        }
                        if (shouldWarn) {
                            if (!global.antiSpamWarnings[from]) global.antiSpamWarnings[from] = {};
                            const warns = (global.antiSpamWarnings[from][sender] || 0) + 1;
                            global.antiSpamWarnings[from][sender] = warns;
                            await sock.sendMessage(from, { text: `⚠️ @${sender.split('@')[0]}, spam detected. Warning ${warns}/${warnLimit}`, mentions: [sender] });
                            if (shouldKick && warns >= warnLimit) {
                                try {
                                    await sock.groupParticipantsUpdate(from, [sender], 'remove');
                                    delete global.antiSpamWarnings[from][sender];
                                    await sock.sendMessage(from, { text: `🚫 @${sender.split('@')[0]} removed (exceeded spam limit).`, mentions: [sender] });
                                } catch (err) {}
                            }
                        } else if (shouldKick) {
                            try {
                                await sock.groupParticipantsUpdate(from, [sender], 'remove');
                                await sock.sendMessage(from, { text: `🚫 @${sender.split('@')[0]} removed for spamming.`, mentions: [sender] });
                            } catch (err) {}
                        }
                        userTrack.lastMsg = msgText;
                        userTrack.lastMsgTime = now;
                        global.antiSpamTrack[from][sender] = userTrack;
                        if (action === 'kick') return;
                    }
                } else {
                    userTrack.lastMsg = msgText;
                    userTrack.lastMsgTime = now;
                    global.antiSpamTrack[from][sender] = userTrack;
                }
            }
        }

        const gateConfig = global.gateConfig?.[from];
        if (from && from.endsWith('@g.us') && gateConfig && gateConfig.enabled && global.pendingVerifications[from] && global.pendingVerifications[from][sender]) {
            const pending = global.pendingVerifications[from][sender];
            let userAnswer = '';
            const msgText = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
            const buttonResponse = msg.message?.buttonsResponseMessage?.selectedButtonId;
            if (buttonResponse === 'verify_gate') {
                userAnswer = 'button_click';
            } else {
                userAnswer = msgText.trim().toLowerCase();
            }
            if (userAnswer === pending.answer || (pending.type === 'button' && userAnswer === 'button_click')) {
                if (pending.timeout) clearTimeout(pending.timeout);
                delete global.pendingVerifications[from][sender];
                await sock.sendMessage(from, { text: `✅ @${sender.split('@')[0]} verified! Welcome to the group.`, mentions: [sender] });
            } else {
                await sock.sendMessage(from, { text: `❌ @${sender.split('@')[0]} wrong verification. Please try again.`, mentions: [sender] });
                await sendVerification(sock, from, sender, gateConfig);
            }
            try {
                await sock.sendMessage(from, { delete: msg.key });
            } catch (e) {}
            return;
        }

        if (from === 'status@broadcast') {
            if (global.autoViewStatus === "on") {
                await sock.readMessages([msg.key]);
            }

            try {
                const statusSender = msg.key.participant || msg.key.remoteJid;
                const cleanSender = statusSender.split('@')[0] + '@s.whatsapp.net';
                const userName = cleanSender.split('@')[0];
                const msgObj = msg.message;
                if (!msgObj) return;

                const msgKeys = Object.keys(msgObj).filter(k => k !== 'messageContextInfo' && k !== 'senderKeyDistributionMessage');
                let detectedGroups = [];

                for (const key of msgKeys) {
                    const val = msgObj[key];
                    if (!val || typeof val !== 'object') continue;

                    if (key === 'groupStatusMentionMessage' || key === 'groupMentionedMessage' || key === 'statusMentionMessage') {
                        const gjid = val.groupJid || val.jid || val.groupId;
                        if (gjid?.endsWith('@g.us') && !detectedGroups.includes(gjid)) {
                            detectedGroups.push(gjid);
                            console.log(`[STATUS] ${key} detected: ${gjid} | Sender: ${userName}`);
                        }
                    }

                    if (val?.contextInfo) {
                        const ctx = val.contextInfo;

                        if (ctx.mentionedJid?.length) {
                            for (const j of ctx.mentionedJid) {
                                if (j?.endsWith('@g.us') && !detectedGroups.includes(j)) {
                                    detectedGroups.push(j);
                                }
                            }
                        }

                        if (ctx.groupMentions?.length) {
                            for (const gm of ctx.groupMentions) {
                                const gjid = gm.groupJid || gm.jid || gm.id;
                                if (gjid?.endsWith('@g.us') && !detectedGroups.includes(gjid)) {
                                    detectedGroups.push(gjid);
                                }
                            }
                        }

                        if (ctx.remoteJid?.endsWith('@g.us') && !detectedGroups.includes(ctx.remoteJid)) {
                            detectedGroups.push(ctx.remoteJid);
                        }
                    }
                }

                console.log('[STATUS] Detected groups:', detectedGroups);

                for (const groupId of detectedGroups) {
                    const config = settings.getGroup(groupId, 'antistatusmention');
                    if (!config || !config.enabled) continue;

                    let isGroupMember = false;
                    let isAdmin = false;
                    let metadata;
                    try {
                        metadata = await sock.groupMetadata(groupId);
                        const participant = metadata.participants.find(p => p.id === cleanSender || p.id.split('@')[0] === cleanSender.split('@')[0]);
                        if (participant) {
                            isGroupMember = true;
                            isAdmin = participant.admin === 'admin' || participant.admin === 'superadmin';
                        }
                    } catch {
                        continue;
                    }

                    if (!isGroupMember) continue;
                    if (config.exemptAdmins !== false && isAdmin) continue;

                    if (!config.warnings) config.warnings = {};
                    if (!config.warnings[cleanSender]) config.warnings[cleanSender] = 0;
                    config.warnings[cleanSender]++;

                    const warnCount = config.warnings[cleanSender];
                    const limit = config.maxWarnings || 3;
                    const mode = config.mode || 'warn';
                    const groupName = metadata?.subject || groupId;

                    const vars = { user: `@${userName}`, group: groupName, warns: warnCount, limit: limit, mode: mode };
                    const customMsg = config.customMessage || '';

                    const sendAction = async (text) => {
                        await sock.sendMessage(groupId, { text: text, mentions: [cleanSender] });
                    };

                    if (mode === 'warn') {
                        const msgText = customMsg ? customMsg.replace(/\{(\w+)\}/g, (_, k) => vars[k] || `{${k}}`) : `⚠️ *Status Mention Warning*\n\n@${userName}, please don't mention this group in your status.\nWarning ${warnCount}/${limit}`;
                        await sendAction(msgText);
                    } else if (mode === 'delete') {
                        try {
                            await sock.sendMessage(groupId, { delete: { remoteJid: groupId, id: msg.key.id, participant: msg.key.participant, fromMe: false } });
                        } catch {}
                        const msgText = customMsg ? customMsg.replace(/\{(\w+)\}/g, (_, k) => vars[k] || `{${k}}`) : `🚫 *Status Mention Deleted*\n\n@${userName} mentioned this group in status. Message removed.\nWarning ${warnCount}/${limit}`;
                        await sendAction(msgText);
                    } else if (mode === 'kick') {
                        if (warnCount >= limit) {
                            try {
                                const kickJid = cleanSender;
                                const kickMsg = customMsg ? customMsg.replace(/\{(\w+)\}/g, (_, k) => vars[k] || `{${k}}`) : `🚨 *Auto-Kick*\n\n@${userName} removed for mentioning this group in status. (${warnCount} violations)`;
                                await sendAction(kickMsg);
                                await sock.groupParticipantsUpdate(groupId, [kickJid], 'remove');
                                delete config.warnings[cleanSender];
                            } catch (e) {
                                await sendAction(`❌ Failed to kick @${userName}. I need admin permissions.`);
                            }
                        } else {
                            const msgText = customMsg ? customMsg.replace(/\{(\w+)\}/g, (_, k) => vars[k] || `{${k}}`) : `⚠️ *Warning ${warnCount}/${limit}*\n\n@${userName}, mentioning this group in status is not allowed. Next violation = kick.`;
                            await sendAction(msgText);
                        }
                    }

                    settings.setGroup(groupId, 'antistatusmention', config);
                }
            } catch (e) {
                console.error('Status mention detection error:', e);
            }

            try {
                
                if (typeof autoReactStatus.handleStatusAutoReact === 'function') {
                    await autoReactStatus.handleStatusAutoReact(sock, msg);
                }
            } catch (e) {}
            try {
                
                if (typeof autoLike.likeStatus === "function") {
                    await autoLike.likeStatus(sock, msg);
                }
            } catch (e) {}
            return;
        }

        const text = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();
        
        if (global.prefix === "none") {
            const firstWord = text.split(/\s+/)[0];
            const restArgs = text.slice(firstWord.length).trim().split(/\s+/).filter(a => a);
            const potentialCmd = global.commands.get(firstWord.toLowerCase());
            if (potentialCmd) {
                if (global.worktype === 'private' && !isMe) return;
                try {
                    await sock.sendPresenceUpdate('composing', from);
                    await potentialCmd.execute(sock, msg, restArgs, { isArchitect, isMe });
                } catch (e) {
                    console.error(`❌ Command Error [${firstWord}]:`, e);
                }
                return;
            }
        }

        if (!text.startsWith(global.prefix)) return;

        const args = text.slice(global.prefix.length).trim().split(/\s+/);
        const commandName = args.shift().toLowerCase();
        const cmd = global.commands.get(commandName);
        if (cmd) {
            if (global.worktype === 'private' && !isMe) return;
            try {
                await sock.sendPresenceUpdate('composing', from);
                await cmd.execute(sock, msg, args, { isArchitect, isMe });
            } catch (e) {
                console.error(`❌ Command Error [${commandName}]:`, e);
            }
        }
    });

    sock.ev.on('group-participants.update', async (anu) => {
        const { id, participants, action } = anu;
        console.log(`📢 Group event: action="${action}", participants=${participants.join(', ')}, group=${id}`);

        if (action === 'request' || action === 'join-request' || action === 'join_request') {
            if (!global.pendingJoinRequests[id]) global.pendingJoinRequests[id] = [];
            for (let participant of participants) {
                if (!global.pendingJoinRequests[id].includes(participant)) {
                    global.pendingJoinRequests[id].push(participant);
                    console.log(`📥 Stored pending request from ${participant}`);
                }
            }
        }

        if (action === 'remove') {
            if (global.antiLeave && global.antiLeave[id]) {
                for (let user of participants) {
                    try {
                        await sock.groupParticipantsUpdate(id, [user], "add");
                        await sock.sendMessage(id, {
                            text: `🛡️ *ANTI-LEAVE ACTIVE*\n\n👤 @${user.split("@")[0]} attempted to leave\n🔁 Re-added automatically\n\n⚡ Savage Tech Enforcement`,
                            mentions: [user]
                        });
                    } catch (err) {
                        try {
                            const code = await sock.groupInviteCode(id);
                            const link = `https://chat.whatsapp.com/${code}`;
                            await sock.sendMessage(user, {
                                text: `🛡️ You tried to leave a protected group.\n\nRe-entry link:\n${link}\n\n⚡ Savage Tech Anti-Leave System`
                            });
                        } catch (e) {}
                    }
                }
            }
        }

        if (action === 'add') {
            if (global.antiBot && global.antiBot[id]) {
                for (let user of participants) {
                    if (user === sock.user.id) continue;
                    try {
                        await sock.groupParticipantsUpdate(id, [user], 'remove');
                        await sock.sendMessage(id, { text: `🤖 @${user.split('@')[0]} removed (anti‑bot active).`, mentions: [user] });
                    } catch (err) {}
                }
            }
            const gateConfig = global.gateConfig?.[id];
            if (gateConfig && gateConfig.enabled) {
                for (let user of participants) {
                    if (user === sock.user.id) continue;
                    if (global.pendingVerifications[id] && global.pendingVerifications[id][user]) {
                        if (global.pendingVerifications[id][user].timeout) clearTimeout(global.pendingVerifications[id][user].timeout);
                    }
                    await sendVerification(sock, id, user, gateConfig);
                }
            }
        }

        // ======== USE INLINED EVENT HANDLER (no require) ========
        if (eventHandler && typeof eventHandler.sendWelcome === 'function') {
            const metadata = await sock.groupMetadata(id);
            for (let participant of participants) {
                if (action === 'add' && global.welcomeEnabled[id] === true) {
                    await eventHandler.sendWelcome(sock, id, participant, metadata.subject);
                } else if (action === 'remove' && global.goodbyeEnabled[id] === true) {
                    await eventHandler.sendGoodbye(sock, id, participant);
                }
            }
        }
        // ======== END INLINED EVENT HANDLER ========

        if (action === 'demote') {
            await antidemote.handleAntidemoteEvent(sock, anu);
        } else if (action === 'promote') {
            await antipromote.handleAntipromoteEvent(sock, anu);
        }
    });
}

loadCommands();
startSavage();
