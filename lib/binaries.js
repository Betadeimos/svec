const { spawnSync, execSync } = require('child_process');
const fs = require('fs');
const { spinner, confirm, isCancel } = require('@clack/prompts');
const pc = require('picocolors');

let ffmpegPath = 'ffmpeg';
let ffprobePath = 'ffprobe';

/**
 * Initializes and checks for required FFmpeg and FFprobe binaries.
 */
async function setupFFmpeg() {
    // 1. Check for FFmpeg (Required)
    const ffmpegRes = spawnSync('ffmpeg', ['-version']);
    if (!ffmpegRes.error) {
        ffmpegPath = 'ffmpeg';
    } else {
        try {
            const staticFfmpeg = require('ffmpeg-static');
            if (staticFfmpeg && fs.existsSync(staticFfmpeg)) {
                ffmpegPath = staticFfmpeg;
            }
        } catch (e) {}
    }

    // 2. Check for FFprobe (Optional - used for metadata)
    const ffprobeRes = spawnSync('ffprobe', ['-version']);
    if (!ffprobeRes.error) {
        ffprobePath = 'ffprobe';
    } else {
        try {
            const staticFfprobe = require('ffprobe-static');
            if (staticFfprobe && staticFfprobe.path && fs.existsSync(staticFfprobe.path)) {
                ffprobePath = staticFfprobe.path;
            } else {
                ffprobePath = null;
            }
        } catch (e) {
            ffprobePath = null;
        }
    }

    // 3. Only prompt if FFmpeg itself is missing entirely
    if (ffmpegRes.error && ffmpegPath === 'ffmpeg') {
        const shouldInstall = await confirm({ message: 'FFmpeg was not found. Try installing dependencies?' });
        if (isCancel(shouldInstall) || !shouldInstall) process.exit(1);
        
        const s = spinner();
        s.start('Updating dependencies...');
        try {
            execSync('npm install ffmpeg-static ffprobe-static', { stdio: 'ignore' });
            ffmpegPath = require('ffmpeg-static');
            try { ffprobePath = require('ffprobe-static').path; } catch(e) { ffprobePath = null; }
            s.stop(pc.green('✅ Binaries ready!'));
        } catch (err) {
            s.stop(pc.red('❌ Failed to prepare binaries'));
            process.exit(1);
        }
    }
}

/**
 * Extracts metadata from a video file.
 * @param {string} filePath 
 * @returns {object|null}
 */
function getMetadata(filePath) {
    if (!ffprobePath) return null;
    try {
        const result = spawnSync(ffprobePath, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,duration,display_aspect_ratio', '-of', 'json', filePath]);
        const stdout = result.stdout.toString();
        if (!stdout) return null;
        const data = JSON.parse(stdout);
        if (!data || !data.streams || !data.streams[0]) return null;
        const stream = data.streams[0];
        return { 
            width: stream.width, 
            height: stream.height, 
            duration: parseFloat(stream.duration).toFixed(1), 
            aspect: stream.display_aspect_ratio || `${(stream.width/stream.height).toFixed(2)}:1` 
        };
    } catch (e) { return null; }
}

module.exports = {
    setupFFmpeg,
    getMetadata,
    getFFmpegPath: () => ffmpegPath,
    getFFprobePath: () => ffprobePath
};
