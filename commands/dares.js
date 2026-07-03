const dares = [
  "Send a cheesy pickup line to the last person you messaged.",
  "Tell a joke – if no one laughs, you lose.",
  "Send a random compliment to three contacts.",
  "Share a childhood memory that makes you cringe.",
  "Send a one-word summary of your day to the group.",
  "Text someone 'You're my favourite notification' and screenshot the reply (no need to send).",
  "Make up a haiku about the group.",
  "Send a message in all caps to someone.",
  "Post a random fun fact you just learned.",
  "Reply to the next message you receive with only emojis.",
  "Send a screenshot of your weather app.",
  "Ask someone for their go-to comfort food and share it.",
  "Write a short story in 3 sentences and send it.",
  "Send a song lyric that describes your current mood.",
  "Send a motivational quote to a friend.",
  "Tell the group your most recent dream (even if it's vague).",
  "Send a 'thank you' message to someone you appreciate.",
  "Share a weird food combination you actually like.",
  "Send a riddle and let the group solve it.",
  "Send a voice message of you saying 'I am a bot' (text is fine).",
  "Compliment the person above you.",
  "Send a screenshot of your most played song this month.",
  "Type a message using only emojis and let the group decode it.",
  "Send a link to a video that made you laugh this week.",
  "Share a one-minute life tip.",
  "Describe your perfect day in five words.",
  "Send a text with your phone's autocorrect set to another language.",
  "Ask a friend for a random word and use it in a sentence.",
  "Send a picture of what's on your desk right now (if comfortable).",
  "Tell a two-truths-and-a-lie about yourself."
];

module.exports = {
  name: 'dares',
  category: 'fun',
  description: 'Text-friendly dares for WhatsApp games',
  async execute(sock, msg, args) {
    const random = dares[Math.floor(Math.random() * dares.length)];
    await sock.sendMessage(msg.key.remoteJid, {
      text: `⚡ *Dare*\n\n${random}`
    }, { quoted: msg });
  }
};
