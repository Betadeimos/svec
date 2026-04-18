import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import { spinner } from '@clack/prompts';
import { parseTime } from './utils.js';

/**
 * Builds and executes the FFmpeg command based on the provided user state.
 * @param {object} d User session data
 * @param {string} ffmpegPath Path to the FFmpeg binary
 * @returns {Promise<void>}
 */
export async function executeFFmpeg(d, ffmpegPath) {
    let inputArgs = [], outputArgs = [], videoFilters = [];
    let needsReEncode = d.resize || d.actions.includes('codec') || d.targetExt === '.gif' || (d.trim && d.trim.precise);

    // 1. Handling Trimming
    if (d.trim) { 
        inputArgs.push('-ss', parseTime(d.trim.start)); 
        if (d.trim.end) inputArgs.push('-to', parseTime(d.trim.end)); 
    }

    // 2. Handling Resizing & Filters
    if (d.resize) { 
        const { logic, padColor, tw, th, finalAsp } = d.resize; 
        if (finalAsp === 'skip') videoFilters.push(`scale=${tw}:${th},setsar=1:1`); 
        else if (logic === 'stretch') videoFilters.push(`scale=${tw}:${th},setsar=1:1`); 
        else if (logic === 'fit') videoFilters.push(`scale=${tw}:${th}:force_original_aspect_ratio=decrease,pad=${tw}:${th}:(ow-iw)/2:(oh-ih)/2:${padColor},setsar=1:1`); 
        else if (logic === 'crop') videoFilters.push(`scale=${tw}:${th}:force_original_aspect_ratio=increase,crop=${tw}:${th},setsar=1:1`); 
    }

    // 3. Handling GIF specific settings
    if (d.targetExt === '.gif') { 
        const gifMap = { '1': [5, 320], '2': [8, 360], '3': [10, 380], '4': [12, 420], '5': [15, 480], '6': [18, 540], '7': [20, 600], '8': [22, 640], '9': [25, 680], '10': [30, 720] }; 
        const [gfps, gscale] = gifMap[d.quality || '5']; 
        videoFilters.push(`fps=${gfps},scale=${gscale}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`); 
    }

    // 4. Handling Video Codecs & Quality
    if (needsReEncode && d.targetExt !== '.gif') { 
        const crfMap = { '1': 45, '2': 40, '3': 35, '4': 30, '5': 26, '6': 23, '7': 20, '8': 18, '9': 14, '10': 10 }; 
        outputArgs.push('-c:v', d.codec || 'libx264', '-crf', crfMap[d.quality || '5'].toString()); 
    } else if (d.targetExt !== '.gif') { 
        outputArgs.push('-c:v', 'copy'); 
    }
    
    if (videoFilters.length > 0) outputArgs.push('-vf', videoFilters.join(','));

    // 5. Handling Output Path
    const parsed = path.parse(d.videoPath);
    let outputPath = path.join(parsed.dir, `${parsed.name}_edited${d.targetExt}`);
    let c = 1; while (fs.existsSync(outputPath)) { outputPath = path.join(parsed.dir, `${parsed.name}_edited_${c++}${d.targetExt}`); }
    
    const ffmpegArgs = ['-y', ...inputArgs, '-i', d.videoPath, ...outputArgs];
    
    // 6. Handling Audio
    if (d.audio === 'remove' || d.targetExt === '.gif') {
        ffmpegArgs.push('-an');
    } else if (d.audio === 'copy') {
        ffmpegArgs.push('-c:a', 'copy');
    } else {
        ffmpegArgs.push('-c:a', 'aac');
    }
    ffmpegArgs.push(outputPath);

    // Processing Flow
    const mode = needsReEncode ? pc.yellow('Re-encoding') : pc.green('Lossless (stream copy)');
    console.log(pc.dim(`\n  Mode: ${mode} | Output: ${path.basename(outputPath)}\n`));
    
    const s = spinner();
    let labels = [];
    if (d.actions.includes('trim')) labels.push('Trimming');
    if (d.actions.includes('resize')) labels.push('Resizing');
    if (d.actions.includes('codec')) labels.push('Transcoding');
    if (d.actions.includes('container')) labels.push('Converting');
    let taskLabel = labels.length === 1 ? `${labels[0]} video` : labels.join(', ').replace(/, ([^,]*)$/, ' & $1');
    
    s.start(`${taskLabel}...`);

    return new Promise((resolve, reject) => {
        const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
        let lastUpdate = 0;
        let errorOutput = '';
        
        ffmpegProcess.stderr.on('data', (data) => {
            const now = Date.now();
            errorOutput += data.toString();
            if (now - lastUpdate < 1000) return;
            const match = data.toString().match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
            if (match) { s.message(`${taskLabel}... (Time: ${pc.yellow(match[1])})`); lastUpdate = now; }
        });

        ffmpegProcess.on('close', (code) => {
            if (code === 0) { 
                s.stop(pc.green(`✅ Done! Saved to: ${outputPath}`)); 
                resolve(outputPath); 
            } else { 
                const errMsg = errorOutput.includes('No such file') ? 'File not found' : 
                              errorOutput.includes('Invalid data') ? 'Invalid video file' : 
                              `Failed (code ${code})`;
                s.stop(pc.red(`❌ ${errMsg}`)); 
                reject(new Error(errMsg)); 
            }
        });

        ffmpegProcess.on('error', (err) => { 
            s.stop(pc.red(`❌ Cannot start FFmpeg: ${err.message}`)); 
            reject(err); 
        });
    });
}
