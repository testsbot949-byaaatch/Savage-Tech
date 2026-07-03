const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

module.exports = {
    name: 'video',
    category: 'media',
    description: 'Download YouTube video (Wolf API)',
    async execute(sock, msg, args) {
        const from = msg.key.remoteJid;
        const query = args.join(' ');
        if (!query) return sock.sendMessage(from, { text: '❌ Usage: .video <song name or YouTube URL>' }, { quoted: msg });

        try {
            await sock.sendMessage(from, { text: `🎬 Processing: ${query}\n⏳ Fetching video...` }, { quoted: msg });

            let videoUrl = null;
            let title = 'Unknown';
            let duration = 'N/A';

            const isUrl = query.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/);

            if (isUrl) {
                videoUrl = query;
                try {
                    const info = await yts({ videoId: videoUrl });
                    if (info) {
                        title = info.title || 'Unknown';
                        duration = info.duration?.timestamp || 'N/A';
                    }
                } catch (e) {}
            } else {
                try {
                    const searchResult = await yts(query);
                    const video = searchResult.videos[0];
                    if (video) {
                        videoUrl = video.url;
                        title = video.title || 'Unknown';
                        duration = video.duration.timestamp || 'N/A';
                    } else {
                        throw new Error('No YouTube results');
                    }
                } catch (ytErr) {
                    console.log('YouTube search failed:', ytErr.message);
                }
            }

            if (!videoUrl) {
                return sock.sendMessage(from, { text: '❌ Could not find video.' }, { quoted: msg });
            }

            const apiKey = 'wxa_f_1be53c1604';
            const apiUrl = `https://apis.xwolf.space/download/video?url=${encodeURIComponent(videoUrl)}&key=${apiKey}`;
            const response = await axios.get(apiUrl, { timeout: 15000 });
            const data = response.data;

            if (!data.success) {
                throw new Error(data.error || 'API did not return a result');
            }

            let downloadUrl = data.result || data.downloadUrl || data.url;
            if (!downloadUrl) {
                throw new Error('No download URL found in API response');
            }

            const videoRes = await axios.get(downloadUrl, {
                responseType: 'arraybuffer',
                timeout: 60000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            let videoBuffer = Buffer.from(videoRes.data);

            let finalBuffer = videoBuffer;
            const fileSizeMB = videoBuffer.length / (1024 * 1024);
            if (fileSizeMB > 15) {
                try {
                    const tempFile = path.join(__dirname, `temp_vid_${Date.now()}.mp4`);
                    const outFile = path.join(__dirname, `temp_out_${Date.now()}.mp4`);
                    fs.writeFileSync(tempFile, videoBuffer);
                    await execPromise(`ffmpeg -i "${tempFile}" -vf "scale=640:480" -c:v libx264 -c:a aac -b:v 800k -b:a 64k "${outFile}" -y`);
                    const compressedBuffer = fs.readFileSync(outFile);
                    fs.unlinkSync(tempFile);
                    fs.unlinkSync(outFile);
                    if (compressedBuffer.length < videoBuffer.length) {
                        finalBuffer = compressedBuffer;
                    }
                } catch (ffErr) {
                    console.log('FFmpeg conversion failed:', ffErr.message);
                }
            }

            const caption = `🎬 *${title}*\n⏱️ *Duration:* ${duration}`;

            await sock.sendMessage(from, {
                video: finalBuffer,
                mimetype: 'video/mp4',
                caption: caption
            }, { quoted: msg });

        } catch (err) {
            console.error('Video error:', err);
            await sock.sendMessage(from, { text: `❌ Failed: ${err.message}` }, { quoted: msg });
        }
    }
};
