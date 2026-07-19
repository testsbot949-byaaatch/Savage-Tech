module.exports = {
    name: 'insult',
    category: 'fun',
    description: 'Send a random insult – optionally target a user',
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

        let target = null;
        if (quoted) {
            target = msg.key.participant || msg.key.remoteJid;
        } else if (mentioned.length > 0) {
            target = mentioned[0];
        }
        if (!target) {
            target = msg.key.participant || msg.key.remoteJid;
        }

        const insults = [
            "You're not stupid; you just have bad luck thinking.",
            "You're the reason they put instructions on shampoo bottles.",
            "I've seen salads with more personality than you.",
            "You're like a cloud. When you disappear, it's a beautiful day.",
            "You're proof that evolution can go in reverse.",
            "You're not a clown; you're the entire circus.",
            "I'd agree with you, but then we'd both be wrong.",
            "You're the human equivalent of a participation trophy.",
            "You're not ugly; you're just interesting-looking.",
            "You're a perfect example of why natural selection exists.",
            "I'd call you a tool, but even tools have a purpose.",
            "You're like a software update. I see you, but I ignore you.",
            "You're the reason why 'average' exists.",
            "You're not useless – you can always serve as a bad example.",
            "You're not a mistake; you're a warning.",
            "You're like a broken pencil – pointless.",
            "You're not the sharpest tool in the shed, but you're definitely in the shed.",
            "You're the reason why scientists will never find intelligent life on Earth.",
            "You're not a failure; you're just a success in progress… very slow progress.",
            "You're like a dictionary – you add meaning to my life, but I still don't understand you.",
            "You're a walking contradiction – and not the interesting kind.",
            "You're like a Wi-Fi signal – weak and easily disconnected.",
            "You're not a diamond; you're a lump of coal that hasn't even started to heat up.",
            "You're the kind of person who uses a spoon to cut a steak.",
            "Your personality is as flat as a pancake, and twice as bland.",
            "You're a legend in your own mind, and a nobody everywhere else.",
            "You're like a magic show – impressive until you see how it works.",
            "You're the reason why 'idiot' is still a valid word.",
            "You're not a disappointment; you're a constant source of it.",
            "You're like a library book – overdue and nobody wants you.",
            "You're a masterpiece of mediocrity.",
            "You're a black hole of charisma.",
            "You're like a fire extinguisher – only useful when you're not around.",
            "You're a walking talking stereotype of everything wrong with the world.",
            "You're like a broken clock – you're right twice a day, but nobody trusts you.",
            "You're not a loser; you're a champion at losing.",
            "You're like a traffic jam – slow, frustrating, and everyone wants to avoid you.",
            "You're a blank canvas – but you've been painted with the wrong colors.",
            "You're the kind of person who laughs at their own jokes… and nobody else.",
            "You're like a bad haircut – you look better when you're covered up.",
            "You're the human version of a participation ribbon – nobody asked for you.",
            "You're like a phone with 1% battery – annoying and about to die.",
            "You're the reason why 'boring' was invented.",
            "You're a walking warning label.",
            "You're not an expert; you're just confidently wrong.",
            "You're like a cold cup of tea – disappointing and lukewarm.",
            "You're the kind of person who brings a knife to a gunfight and still loses.",
            "You're a monument to all your own bad decisions.",
            "You're like a broken printer – you make a lot of noise but nothing useful comes out.",
            "You're not a star; you're a black hole that sucks the energy out of the room."
        ];

        const insult = insults[Math.floor(Math.random() * insults.length)];
        const mention = target;

        await sock.sendMessage(from, {
            text: `😈 @${mention.split('@')[0]}, ${insult}`,
            mentions: [mention]
        }, { quoted: msg });
    }
};
