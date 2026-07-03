const tls = require('tls');

module.exports = {
  name: 'ssl',
  category: 'ethical hacking',
  description: 'Check SSL certificate details',
  async execute(sock, msg, args) {
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
  }
};
