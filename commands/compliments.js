const compliments = [
  "Your calm presence makes everyone feel safe.",
  "You listen without judgment, and that's rare.",
  "You carry yourself with quiet confidence.",
  "Your patience is a quiet superpower.",
  "You make people feel seen and heard.",
  "You're wise beyond your years.",
  "Your honesty is refreshing.",
  "You have a gentle way of speaking truth.",
  "You're resilient in ways you don't even realise.",
  "You bring out the best in people.",
  "Your laughter is warm and infectious.",
  "You're reliable, and that means the world.",
  "You handle difficult situations with grace.",
  "Your kindness is not performative – it's real.",
  "You have a beautifully curious mind.",
  "You're not afraid to be vulnerable, and that's strength.",
  "You make space for others without shrinking yourself.",
  "Your presence is grounding.",
  "You're a source of light without even trying.",
  "You inspire those around you just by being yourself.",
  "You have a rare ability to make people feel valued.",
  "Your insights often surprise and delight.",
  "You're a wonderful mix of strength and softness.",
  "You approach life with intention and care.",
  "You're a safe space for the people who matter.",
  "Your authenticity is magnetic.",
  "You have a quiet way of making a big difference.",
  "You're learning and growing, and it shows.",
  "You bring calm to chaos, effortlessly.",
  "You are deeply loved, and you deserve all the good things."
];

module.exports = {
  name: 'compliments',
  category: 'fun',
  description: 'Random mature and realistic compliment',
  async execute(sock, msg, args) {
    const random = compliments[Math.floor(Math.random() * compliments.length)];
    await sock.sendMessage(msg.key.remoteJid, {
      text: `🌸 *Compliment*\n\n${random}`
    }, { quoted: msg });
  }
};
