const axios = require('axios');
const yts = require('yt-search');

module.exports = {
    name: 'song',
    category: 'audio',
    description: 'Download a song as MP3 (Ravenn primary, Wolf fallback, Deezer last)',
    async execute(sock, msg, args) {
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
    }
};
