const axios = require('axios');

module.exports = {
    name: 'cocktailrandom',
    category: 'food',
    description: 'Get a random cocktail with ingredients and preparation instructions',
    async execute(sock, msg) {
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
    }
};
