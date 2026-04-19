import { spawnSync, execSync } from 'child_process';
import fs from 'fs';
import { spinner, confirm, isCancel } from '@clack/prompts';
import pc from 'picocolors';

let ffmpegPath = 'ffmpeg';
let ffprobePath = 'ffprobe';

/**
 * Initializes and checks for required FFmpeg and FFprobe binaries.
 */
export async function setupFFmpeg() {
    // 1. Check for FFmpeg (Required)
    const ffmpegRes = spawnSync('ffmpeg', ['-version']);
    if (!ffmpegRes.error) {
        ffmpegPath = 'ffmpeg';
    } else {
        try {
            const { default: staticFfmpeg } = await import('ffmpeg-static');
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
            const { default: staticFfprobe } = await import('ffprobe-static');
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
            const { default: staticFfmpeg } = await import('ffmpeg-static');
            ffmpegPath = staticFfmpeg;
            try { 
                const { default: staticFfprobe } = await import('ffprobe-static');
                ffprobePath = staticFfprobe.path; 
            } catch(e) { ffprobePath = null; }
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
export function getMetadata(filePath) {
    if (!ffprobePath) return null;
    try {
        const result = spawnSync(ffprobePath, ['-v', 'error', '-show_format', '-show_streams', filePath]);
        const output = result.stdout.toString();
        if (!output) return null;
        
        let width = 0, height = 0, duration = 0, aspect = "16:9";
        
        // Aggressive duration parsing: find first occurrence of duration=X.XX
        const durationMatch = output.match(/duration=([\d\.]+)/);
        if (durationMatch && durationMatch[1] && durationMatch[1] !== 'N/A') {
            duration = parseFloat(durationMatch[1]);
        }

        // Fallback for WebM / MKV files which use TAG:DURATION=HH:MM:SS.mmmmmm
        if (!duration || isNaN(duration)) {
            const tagDurationMatch = output.match(/DURATION=([\d:\.]+)/i);
            if (tagDurationMatch && tagDurationMatch[1]) {
                const parts = tagDurationMatch[1].split(':').map(Number).reverse();
                duration = (parts[0] || 0) + (parts[1] || 0) * 60 + (parts[2] || 0) * 3600;
            }
        }

        const lines = output.split('\n');
        for (const line of lines) {
            const [key, val] = line.split('=');
            if (!val || val.trim() === 'N/A') continue;
            const v = val.trim();
            if (key === 'width' && !width) width = parseInt(v);
            else if (key === 'height' && !height) height = parseInt(v);
            else if (key === 'display_aspect_ratio' && aspect === "16:9") aspect = v;
        }
        
        if (!width) return null;
        
        return { 
            width, 
            height, 
            duration: (duration && !isNaN(duration)) ? duration.toFixed(1) : "0.0", 
            aspect
        };
    } catch (e) { return null; }
}

export const getFFmpegPath = () => ffmpegPath;
export const getFFprobePath = () => ffprobePath;
