const axios = require('axios');
const https = require('https');
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

module.exports = {
  name: 'chorus',
  category: 'Audio Effects',
  description: 'Apply chorus effect to audio',
  async execute(sock, msg, args) {
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
  }
};
