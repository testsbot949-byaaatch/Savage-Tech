module.exports = {
    name: "move",
    category: "fun",

    async execute(sock, msg, args) {

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
    }
};
