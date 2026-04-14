#!/usr/bin/env node

const { intro, outro, text, select, multiselect, spinner, isCancel, cancel, confirm } = require('@clack/prompts');
const pc = require('picocolors');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync, execSync } = require('child_process');

let ffmpegPath = 'ffmpeg';
let ffprobePath = 'ffprobe';

// Global key listener for shortcuts
process.stdin.on('data', (data) => {
    if (data[0] === 17) { // Ctrl+Q
        process.exit(0);
    }
});

async function setupFFmpeg() {
    // 1. Check if ffmpeg and ffprobe are in the system PATH (Best performance)
    const ffmpegRes = spawnSync('ffmpeg', ['-version']);
    const ffprobeRes = spawnSync('ffprobe', ['-version']);
    
    if (!ffmpegRes.error && !ffprobeRes.error) {
        ffmpegPath = 'ffmpeg';
        ffprobePath = 'ffprobe';
        return;
    }

    // 2. Try to use bundled static binaries (Zero-configuration)
    try {
        const staticFfmpeg = require('ffmpeg-static');
        const staticFfprobe = require('ffprobe-static');
        if (staticFfmpeg && staticFfprobe.path) {
            ffmpegPath = staticFfmpeg;
            ffprobePath = staticFfprobe.path;
            if (fs.existsSync(ffmpegPath) && fs.existsSync(ffprobePath)) return;
        }
    } catch (e) {}

    // 3. Last resort: Ask to install (shouldn't happen if dependencies are correct)
    const shouldInstall = await confirm({ message: 'FFmpeg/FFprobe binaries not found. Try reinstalling dependencies?' });
    if (isCancel(shouldInstall) || !shouldInstall) process.exit(1);
    
    const s = spinner();
    s.start('Updating dependencies...');
    try {
        execSync('npm install ffmpeg-static ffprobe-static', { stdio: 'ignore' });
        ffmpegPath = require('ffmpeg-static');
        ffprobePath = require('ffprobe-static').path;
        s.stop(pc.green('✅ Binaries ready!'));
    } catch (err) {
        s.stop(pc.red('❌ Failed to prepare binaries'));
        process.exit(1);
    }
}

function parseTime(input) {
    if (!input || input.trim() === '') return '0';
    input = input.trim().toLowerCase();
    if (input.includes(':')) return input;
    let seconds = 0;
    let matched = false;
    const hMatch = input.match(/([\d.]+)h/);
    const mMatch = input.match(/([\d.]+)m/);
    const sMatch = input.match(/([\d.]+)s/);
    if (hMatch) { seconds += parseFloat(hMatch[1]) * 3600; matched = true; }
    if (mMatch) { seconds += parseFloat(mMatch[1]) * 60; matched = true; }
    if (sMatch) { seconds += parseFloat(sMatch[1]); matched = true; }
    if (!matched && !isNaN(parseFloat(input))) { seconds = parseFloat(input); matched = true; }
    return matched ? seconds.toString() : input;
}

function getMetadata(filePath) {
    try {
        const result = spawnSync(ffprobePath, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,duration,display_aspect_ratio', '-of', 'json', filePath]);
        const data = JSON.parse(result.stdout.toString());
        const stream = data.streams[0];
        return { width: stream.width, height: stream.height, duration: parseFloat(stream.duration).toFixed(1), aspect: stream.display_aspect_ratio || `${(stream.width/stream.height).toFixed(2)}:1` };
    } catch (e) { return null; }
}

async function promptStep(p) {
    const res = await p;
    if (isCancel(res)) return 'back';
    return res;
}

async function main() {
    console.log(pc.cyan(`
   _____ __      ________ _____ 
  / ____|\\ \\    / /  ____/ ____|
 | (___   \\ \\  / /| |__ | |     
  \\___ \\   \\ \\/ / |  __|| |     
  ____) |   \\  /  | |___| |____ 
 |_____/     \\/   |______\\_____|
`));
    console.log(pc.gray('   Simplest Video Editor CLI'));
    console.log(pc.gray('   ━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(pc.dim('   Shortcuts: [Ctrl+Q] Quit\n'));

    await setupFFmpeg();

    let sessionActive = true;
    while (sessionActive) {
        let state = { step: 0, d: {} };
        const steps = ['selectFile', 'selectActions', 'configTrim', 'configResize', 'configCodec', 'configFormat', 'configQuality', 'execute'];

        while (state.step < steps.length) {
            const step = steps[state.step];

            if (step === 'selectFile') {
                const cwd = process.cwd();
                const videoFiles = fs.readdirSync(cwd).filter(f => ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.wmv', '.m4v'].includes(path.extname(f).toLowerCase()));
                let sel;
                if (videoFiles.length > 0) {
                    const opts = videoFiles.map(f => ({ value: f, label: f }));
                    opts.push({ value: 'manual', label: '✏️  Enter path or Drag & Drop...' });
                    sel = await promptStep(select({ message: 'Select a video file:', options: opts }));
                } else { sel = 'manual'; }

                if (sel === 'back') { state.step = 0; continue; }
                if (sel === 'manual') {
                    const manual = await promptStep(text({ message: 'Path/Drag & Drop:', validate(v) { 
                        let p = (v || '').trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
                        if (!fs.existsSync(p)) return 'File not found';
                    }}));
                    if (manual === 'back') { state.step = 0; continue; }
                    state.d.videoPath = manual.trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
                } else { state.d.videoPath = path.join(cwd, sel); }
                state.d.meta = getMetadata(state.d.videoPath);
                if (state.d.meta) console.log(pc.blue(`\n  🎞️  ${state.d.meta.width}x${state.d.meta.height} | Aspect: ${state.d.meta.aspect} | ${state.d.meta.duration}s\n`));
                state.step++;
            }

            else if (step === 'selectActions') {
                const act = await promptStep(multiselect({ message: 'Select actions:', options: [{ value: 'trim', label: '✂️  Trim Video' }, { value: 'resize', label: '📏 Resize / Aspect Ratio' }, { value: 'codec', label: '🔄 Change Codec' }, { value: 'container', label: '📦 Change Format/Extension' }], required: true }));
                if (act === 'back') { state.step--; continue; }
                state.d.actions = act;
                state.step++;
            }

            else if (step === 'configTrim') {
                if (!state.d.actions.includes('trim')) { state.step++; continue; }
                const dur = state.d.meta ? `Duration: ${state.d.meta.duration}s, ` : '';
                const start = await promptStep(text({ message: `Start time (${dur}empty=0s):` }));
                if (start === 'back') { state.step--; continue; }
                const end = await promptStep(text({ message: 'End time (empty=end):' }));
                if (end === 'back') continue;
                state.d.trim = { start: (start || '').trim(), end: (end || '').trim() };
                state.step++;
            }

            else if (step === 'configResize') {
                if (!state.d.actions.includes('resize')) { state.step++; continue; }
                const asp = await promptStep(select({ message: 'Select Target Aspect Ratio:', options: [{ value: 'skip', label: 'Keep Original' }, { value: '16:9', label: '16:9' }, { value: '9:16', label: '9:16' }, { value: '1:1', label: '1:1' }, { value: '4:3', label: '4:3' }, { value: 'custom', label: 'Custom' }] }));
                if (asp === 'back') { state.step--; continue; }
                let finalAsp = asp;
                if (asp === 'custom') {
                    finalAsp = await promptStep(text({ message: 'Enter aspect (e.g. 21:9):' }));
                    if (finalAsp === 'back') continue;
                }
                
                let logic = 'stretch';
                let padColor = 'black';
                if (finalAsp !== 'skip') {
                    logic = await promptStep(select({ message: 'Resize Logic:', options: [{ value: 'fit', label: 'Fit (Padding)' }, { value: 'crop', label: 'Fill (Crop)' }, { value: 'stretch', label: 'Stretch' }] }));
                    if (logic === 'back') continue;
                    if (logic === 'fit') {
                        padColor = await promptStep(select({ message: 'Padding Color:', options: [{ value: 'black', label: 'Black' }, { value: 'white', label: 'White' }, { value: 'custom', label: 'Custom Hex/RGB' }] }));
                        if (padColor === 'back') continue;
                        if (padColor === 'custom') { padColor = await promptStep(text({ message: 'Enter color (e.g. #FF0000):' })); if (padColor === 'back') continue; }
                    }
                }

                const res = await promptStep(select({ message: 'Select Size:', options: [{ value: '720', label: '720p' }, { value: '1080', label: '1080p' }, { value: '2160', label: '4K' }, { value: 'custom', label: 'Custom Pixels' }] }));
                if (res === 'back') continue;
                let tw, th;
                if (res === 'custom') {
                    const customRes = await promptStep(text({ message: 'Resolution (W:H):', validate(v) { if (isCancel(v)) return; if (!(v || '').includes(':')) return 'Use COLON (:) e.g. 1920:1080'; } }));
                    if (customRes === 'back') continue;
                    [tw, th] = customRes.split(':');
                } else {
                    const S = parseInt(res);
                    if (finalAsp === 'skip') { const isTall = state.d.meta && (parseInt(state.d.meta.height) > parseInt(state.d.meta.width)); if (isTall) { tw = S; th = '-2'; } else { tw = '-2'; th = S; } }
                    else { const [aw, ah] = finalAsp.split(':').map(Number); const ratio = aw / ah; if (ratio >= 1) { tw = Math.round(S * ratio); th = S; } else { tw = S; th = Math.round(S / ratio); } if (tw % 2 !== 0) tw++; if (th % 2 !== 0) th++; }
                }
                state.d.resize = { logic, padColor, tw, th, finalAsp };
                state.step++;
            }

            else if (step === 'configCodec') {
                if (!state.d.actions.includes('codec')) { state.d.codec = 'libx264'; state.step++; continue; }
                const codec = await promptStep(select({ message: 'Codec:', options: [{ value: 'libx264', label: 'H.264' }, { value: 'libx265', label: 'H.265' }] }));
                if (codec === 'back') { state.step--; continue; }
                state.d.codec = codec;
                state.step++;
            }

            else if (step === 'configFormat') {
                if (!state.d.actions.includes('container')) { state.d.targetExt = path.extname(state.d.videoPath); state.step++; continue; }
                const ext = await promptStep(select({ message: 'Format:', options: [{ value: '.mp4', label: '.mp4' }, { value: '.mkv', label: '.mkv' }, { value: '.mov', label: '.mov' }, { value: '.gif', label: '.gif' }, { value: 'custom', label: 'Custom' }] }));
                if (ext === 'back') { state.step--; continue; }
                let finalExt = ext === 'custom' ? await promptStep(text({ message: 'Extension (.ext):' })) : ext;
                if (finalExt === 'back') continue;
                state.d.targetExt = finalExt;
                state.step++;
            }

            else if (step === 'configQuality') {
                const needs = state.d.resize || state.d.actions.includes('codec') || state.d.targetExt === '.gif';
                if (!needs) { state.step++; continue; }
                let est = '';
                if (state.d.meta && state.d.meta.duration) { const d = parseFloat(state.d.meta.duration); est = `\n  ${pc.gray(`Rough Est: 1≈${(d*0.1).toFixed(1)}MB | 5≈${(d*0.5).toFixed(1)}MB | 10≈${(d*5.0).toFixed(1)}MB`)}`; }
                const q = await promptStep(select({ message: `Output Quality (1-10):${est}`, options: Array.from({length: 10}, (_, i) => ({ value: (i+1).toString(), label: `${i+1} ${i===0?'(Smallest)':i===4?'(Balanced)':i===9?'(Best)':''}` })) }));
                if (q === 'back') { state.step--; continue; }
                state.d.quality = q;
                state.step++;
            }

            else if (step === 'execute') {
                let inputArgs = [], outputArgs = [], videoFilters = [], needsReEncode = state.d.resize || state.d.actions.includes('codec') || state.d.targetExt === '.gif';
                if (state.d.trim) { inputArgs.push('-ss', parseTime(state.d.trim.start)); if (state.d.trim.end) inputArgs.push('-to', parseTime(state.d.trim.end)); if (!needsReEncode) {
                    const exact = await promptStep(select({ message: 'Precision Trim (requires re-encode)?\n  (Fast trim copies the stream but may be less accurate\n   on the start frames of the trim)', options: [{ value: false, label: 'Fast (Lossless)' }, { value: true, label: 'Precise (Re-encode)' }] }));
                    if (exact === 'back') { state.step--; continue; } if (exact) needsReEncode = true;
                } }
                if (state.d.resize) { const { logic, padColor, tw, th, finalAsp } = state.d.resize; if (finalAsp === 'skip') videoFilters.push(`scale=${tw}:${th}`); else if (logic === 'stretch') videoFilters.push(`scale=${tw}:${th},setsar=1:1`); else if (logic === 'fit') videoFilters.push(`scale=${tw}:${th}:force_original_aspect_ratio=decrease,pad=${tw}:${th}:(ow-iw)/2:(oh-ih)/2:${padColor},setsar=1:1`); else if (logic === 'crop') videoFilters.push(`scale=${tw}:${th}:force_original_aspect_ratio=increase,crop=${tw}:${th},setsar=1:1`); }
                if (state.d.targetExt === '.gif') videoFilters.push('fps=15', 'scale=480:-1:flags=lanczos');
                if (needsReEncode) { const crfMap = { '1': 45, '2': 40, '3': 35, '4': 30, '5': 26, '6': 23, '7': 20, '8': 18, '9': 14, '10': 10 }; outputArgs.push('-c:v', state.d.codec || 'libx264', '-crf', crfMap[state.d.quality || '5'].toString()); } else { outputArgs.push('-c:v', 'copy'); }
                if (videoFilters.length > 0) outputArgs.push('-vf', videoFilters.join(','));
                const parsed = path.parse(state.d.videoPath);
                let outputPath = path.join(parsed.dir, `${parsed.name}_edited${state.d.targetExt}`);
                let c = 1; while (fs.existsSync(outputPath)) { outputPath = path.join(parsed.dir, `${parsed.name}_edited_${c++}${state.d.targetExt}`); }
                const ffmpegArgs = ['-y', ...inputArgs, '-i', state.d.videoPath, ...outputArgs];
                if (state.d.targetExt === '.gif') ffmpegArgs.push('-an'); else ffmpegArgs.push('-c:a', 'aac');
                ffmpegArgs.push(outputPath);
                const s = spinner();
                let labels = state.d.actions.map(a => a === 'trim' ? 'Trimming' : a === 'resize' ? 'Resizing' : a === 'codec' ? 'Transcoding' : 'Converting');
                let taskLabel = labels.join(', ').replace(/, ([^,]*)$/, ' & $1');
                s.start(`${taskLabel}...`);
                await new Promise((resolve, reject) => {
                    const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);
                    let lastUpdate = 0;
                    ffmpegProcess.stderr.on('data', (data) => {
                        const now = Date.now();
                        if (now - lastUpdate < 1000) return;
                        const match = data.toString().match(/time=(\d{2}:\d{2}:\d{2}\.\d{2})/);
                        if (match) { s.message(`${taskLabel}... (Time: ${pc.yellow(match[1])})`); lastUpdate = now; }
                    });
                    ffmpegProcess.on('close', (code) => {
                        if (code === 0) { s.stop(pc.green(`✅ Done! Saved to: ${outputPath}`)); resolve(); }
                        else { s.stop(pc.red(`❌ Failed (Code ${code})`)); reject(); }
                    });
                    ffmpegProcess.on('error', (err) => { s.stop(pc.red(`❌ Error`)); reject(err); });
                });
                const more = await confirm({ message: 'Edit another video?' });
                if (isCancel(more) || !more) {
                    sessionActive = false;
                    break;
                } else {
                    state.step = 0;
                }
                console.log('\n');
            }
        }
    }
    outro(pc.inverse(' Thank you for using SVEC! '));
}

main().catch(console.error);
