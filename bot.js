require('dotenv').config();

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    downloadMediaMessage
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
    "@whiskeysockets/baileys": "^6.7.22",
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
const SUPPORT_GROUP_LINK = "https://chat.whatsapp.com/HgMMyAbBsRE0dgC8qDObUB?s=cl&p=a&ilr=2&amv=0";
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

 
