const { Buffer } = require('buffer');

module.exports = {
  name: 'base64decode',
  category: 'tools',
  description: 'Decode Base64 to text',
  async execute(sock, msg, args) {
    const b64 = args.join(' ');
    if (!b64) return sock.sendMessage(msg.key.remoteJid, { text: '❓ Usage: .base64decode <base64_string>' }, { quoted: msg });

    try {
      const decoded = Buffer.from(b64, 'base64').toString('utf-8');
      await sock.sendMessage(msg.key.remoteJid, { text: `🔓 *Base64 Decoded*\n\n${decoded}` }, { quoted: msg });
    } catch {
      await sock.sendMessage(msg.key.remoteJid, { text: '❌ Invalid Base64 string' }, { quoted: msg });
    }
  }
};
