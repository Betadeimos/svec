#!/usr/bin/env node

const { intro, outro, text, select, multiselect, spinner, isCancel, confirm } = require('@clack/prompts');
const pc = require('picocolors');
const fs = require('fs');
const path = require('path');
const { version } = require('./package.json');

const { setupFFmpeg, getMetadata, getFFmpegPath, getFFprobePath } = require('./lib/binaries');
const { parseTime } = require('./lib/utils');
const { executeFFmpeg } = require('./lib/processor');

// Global input interceptor to map Shift+Tab to Ctrl+C (which Clack treats as 'cancel/back')
const originalEmit = process.stdin.emit;
process.stdin.emit = function (event, ...args) {
    if (event === 'keypress') {
        const key = args[1];
        if (key) {
            // Ctrl+Q to quit entirely
            if (key.ctrl && key.name === 'q') process.exit(0);
            
            // Map Shift+Tab to Ctrl+C (\x03) so Clack cancels the prompt and goes back
            if (key.name === 'tab' && key.shift) {
                return originalEmit.call(this, 'keypress', '\x03', { 
                    sequence: '\x03',
                    name: 'c', 
                    ctrl: true, 
                    meta: false, 
                    shift: false 
                });
            }
        }
    }
    return originalEmit.apply(this, [event, ...args]);
};

// Start readline to enable keypress emitting for our interceptor
require('readline').emitKeypressEvents(process.stdin);

async function promptStep(p) {
    const res = await p;
    if (isCancel(res)) return 'back';
    return res;
}

async function main() {
    console.log(pc.cyan(`
  ┌───────────────────────────────────────┐
  │                                       │
  │   ███████╗██╗   ██╗███████╗ ██████╗   │
  │   ██╔════╝██║   ██║██╔════╝██╔════╝   │
  │   ███████╗██║   ██║█████╗  ██║        │
  │   ╚════██║╚██╗ ██╔╝██╔══╝  ██║        │
  │   ███████║ ╚████╔╝ ███████╗╚██████╗   │
  │   ╚══════╝  ╚═══╝  ╚══════╝ ╚═════╝   │
  │                                       │
  └───────────────────────────────────────┘`));
    console.log(`  ${pc.cyan('SVEC')} ${pc.dim('•')} ${pc.gray('Simplest Video Editor CLI')} ${pc.dim('•')} ${pc.cyan('v' + version)}`);
    console.log(pc.dim('  ─────────────────────────────────────────'));
    console.log(pc.dim('  Shortcuts: [Ctrl+Q] Quit | [Ctrl+R] Reload\n'));

    await setupFFmpeg();

    let sessionActive = true;
    while (sessionActive) {
        let state = { step: 0, d: {} };
        const steps = ['selectFile', 'selectActions', 'configTrim', 'configResize', 'configCodec', 'configFormat', 'configAudio', 'configQuality', 'execute'];

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
                if (state.d.meta) {
                    console.log(pc.blue(`\n  🎞️  ${state.d.meta.width}x${state.d.meta.height} | Aspect: ${state.d.meta.aspect} | ${state.d.meta.duration}s\n`));
                } else if (!getFFprobePath()) {
                    console.log(pc.yellow(`\n  ⚠️  Install ffprobe-static for metadata display: npm install ffprobe-static\n`));
                }
                state.step++;
            }

            else if (step === 'selectActions') {
                const act = await promptStep(multiselect({ message: 'What would you like to do?', options: [{ value: 'trim', label: '✂️  Trim (extract a portion)' }, { value: 'resize', label: '📏 Resize / Change aspect ratio' }, { value: 'codec', label: '🔄 Convert codec (H.264/H.265)' }, { value: 'container', label: '📦 Change container format' }], required: true }));
                if (act === 'back') { state.step--; continue; }
                state.d.actions = act;
                state.step++;
            }

            else if (step === 'configTrim') {
                if (!state.d.actions.includes('trim')) { state.step++; continue; }
                const dur = state.d.meta ? `Duration: ${state.d.meta.duration}s, ` : '';
                const start = await promptStep(text({ 
                    message: `Start time (${dur}empty=0s):`,
                    validate(v) {
                        if (v && v.trim() !== '' && parseTime(v) === v && !v.includes(':') && isNaN(parseFloat(v))) return 'Invalid time format (use e.g. 1m 20s, 10s, or 00:00:10)';
                    }
                }));
                if (start === 'back') { state.step--; continue; }
                const end = await promptStep(text({ 
                    message: 'End time (empty=end):',
                    validate(v) {
                        if (v && v.trim() !== '' && parseTime(v) === v && !v.includes(':') && isNaN(parseFloat(v))) return 'Invalid time format';
                    }
                }));
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
                    finalAsp = await promptStep(text({ 
                        message: 'Enter aspect (e.g. 21:9):',
                        validate(v) {
                            const parts = v.split(':');
                            if (!v || !v.includes(':') || parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1]) || parseFloat(parts[0]) <= 0 || parseFloat(parts[1]) <= 0) {
                                return 'Use positive numbers with COLON (:) e.g. 21:9';
                            }
                        }
                    }));
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
                        if (padColor === 'custom') { 
                            padColor = await promptStep(text({ 
                                message: 'Enter color (e.g. #FF0000):',
                                validate(v) {
                                    if (!v || v.trim() === '') return 'Color cannot be empty';
                                }
                            })); 
                            if (padColor === 'back') continue; 
                        }
                    }
                }

                const res = await promptStep(select({ message: 'Select Size:', options: [{ value: '720', label: '720p' }, { value: '1080', label: '1080p' }, { value: '2160', label: '4K' }, { value: 'custom', label: 'Custom Pixels' }] }));
                if (res === 'back') continue;
                let tw, th;
                if (res === 'custom') {
                    const customRes = await promptStep(text({ 
                        message: 'Resolution (W:H):', 
                        validate(v) { 
                            if (isCancel(v)) return; 
                            const parts = (v || '').split(':');
                            if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1]) || parseInt(parts[0]) <= 0 || parseInt(parts[1]) <= 0) {
                                return 'Use positive numbers with COLON (:) e.g. 1920:1080';
                            }
                        } 
                    }));
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
                const ext = await promptStep(select({ message: 'Format:', options: [{ value: '.mp4', label: '.mp4' }, { value: '.mkv', label: '.mkv' }, { value: '.mov', label: '.mov' }, { value: '.avi', label: '.avi' }, { value: '.gif', label: '.gif' }, { value: 'custom', label: 'Custom' }] }));
                if (ext === 'back') { state.step--; continue; }
                let finalExt = ext === 'custom' ? await promptStep(text({ 
                    message: 'Extension (.ext):',
                    validate(v) {
                        if (!v || !v.startsWith('.') || v.length < 2) return 'Must start with a DOT (e.g. .avi)';
                    }
                })) : ext;
                if (finalExt === 'back') continue;
                state.d.targetExt = finalExt;
                state.step++;
            }

            else if (step === 'configAudio') {
                if (state.d.targetExt === '.gif') { state.d.audio = 'remove'; state.step++; continue; }
                const audio = await promptStep(select({ message: 'Audio handling:', options: [
                    { value: 'copy', label: '🔒 Keep original (lossless copy)' },
                    { value: 'aac', label: '🔧 Convert to AAC (best compatibility)' },
                    { value: 'remove', label: '🔇 Remove audio (no sound)' }
                ] }));
                if (audio === 'back') { state.step--; continue; }
                state.d.audio = audio;
                state.step++;
            }

            else if (step === 'configQuality') {
                const needsReEncode = state.d.resize || state.d.actions.includes('codec') || state.d.targetExt === '.gif' || state.d.trim?.precise;
                if (!needsReEncode) { state.step++; continue; }
                let est = '';
                if (state.d.meta && state.d.meta.duration) { 
                    const d = parseFloat(state.d.meta.duration); 
                    const isGif = state.d.targetExt === '.gif';
                    const low = isGif ? 0.04 : 0.08;
                    const mid = isGif ? 0.25 : 0.5;
                    const high = isGif ? 0.8 : 2.5;
                    est = `\n  ${pc.gray(`Rough Est: 1≈${(d*low).toFixed(1)}MB | 5≈${(d*mid).toFixed(1)}MB | 10≈${(d*high).toFixed(1)}MB`)}`; 
                }
                const q = await promptStep(select({ message: `Output Quality (1-10):${est}`, initialValue: '5', options: Array.from({length: 10}, (_, i) => {
                    const val = i + 1;
                    let desc = '';
                    if (val === 1) desc = ' (Smallest file, lowest quality)';
                    if (val === 5) desc = ' ← Balanced (Recommended)';
                    if (val === 10) desc = ' (Largest file, highest quality)';
                    return { value: val.toString(), label: `${val}${desc}` };
                })}));
                if (q === 'back') { state.step--; continue; }
                state.d.quality = q;
                state.step++;
            }

            else if (step === 'execute') {
                if (state.d.trim && state.d.trim.precise === undefined) {
                    const needsReEncodeDefault = state.d.resize || state.d.actions.includes('codec') || state.d.targetExt === '.gif';
                    if (!needsReEncodeDefault) {
                        const exact = await promptStep(select({ 
                            message: 'Trim mode (default: Lossless):', 
                            options: [
                                { value: false, label: '⚡ Fast (Lossless - Copy codec)' }, 
                                { value: true, label: '🔧 Precise (Re-encode for frame accuracy)' }
                            ] 
                        }));
                        if (exact === 'back') { state.step--; continue; } 
                        state.d.trim.precise = !!exact;
                    }
                }

                try {
                    await executeFFmpeg(state.d, getFFmpegPath());
                } catch (e) {
                    // Error is already handled/logged inside executeFFmpeg
                }

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
