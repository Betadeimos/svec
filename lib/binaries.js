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
        
        let formatDuration = 0;
        let streamDuration = 0;
        let isFormat = false;
        let isStream = false;

        const lines = output.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === '[FORMAT]') { isFormat = true; isStream = false; continue; }
            if (trimmed === '[STREAM]') { isStream = true; isFormat = false; continue; }
            if (trimmed === '[/FORMAT]' || trimmed === '[/STREAM]') { isFormat = false; isStream = false; continue; }

            const parts = line.split('=');
            if (parts.length < 2) continue;
            const key = parts[0];
            const val = parts.slice(1).join('=');
            if (!val || val.trim() === 'N/A') continue;
            
            const v = val.trim();
            if (key === 'width' && !width) width = parseInt(v);
            else if (key === 'height' && !height) height = parseInt(v);
            else if (key === 'display_aspect_ratio' && aspect === "16:9") aspect = v;
            else if (key === 'duration') {
                const d = parseFloat(v);
                if (!isNaN(d) && d > 0) {
                    if (isFormat) formatDuration = d;
                    else if (isStream && !streamDuration) streamDuration = d;
                }
            } else if (key.toLowerCase() === 'tag:duration') {
                const tParts = v.split(':').map(Number).reverse();
                const d = (tParts[0] || 0) + (tParts[1] || 0) * 60 + (tParts[2] || 0) * 3600;
                if (!isNaN(d) && d > 0) {
                    if (isFormat && !formatDuration) formatDuration = d;
                    else if (isStream && !streamDuration) streamDuration = d;
                }
            }
        }
        
        duration = formatDuration || streamDuration || 0;
        
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
